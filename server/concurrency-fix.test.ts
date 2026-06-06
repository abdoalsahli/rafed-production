/**
 * Concurrency Test for Atomic Card Allocation Fix
 * 
 * This test verifies that the atomic card allocation using SELECT FOR UPDATE SKIP LOCKED
 * prevents race conditions in concurrent purchase scenarios.
 * 
 * Scenario:
 * - Upload 20 cards
 * - Run 10 concurrent purchase requests
 * 
 * Expected Results:
 * - All 10 purchases succeed
 * - Exactly 10 cards marked SOLD
 * - No duplicate card allocations
 * - 20 ledger entries created (10 debit + 10 credit)
 * - No failed or partial transactions
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, getRawDb } from "../db";
import { PurchaseIntegratedService } from "../services/purchase.integrated.service";
import { Decimal } from "decimal.js";
import crypto from "crypto";

const purchaseService = new PurchaseIntegratedService();

describe("Concurrency Test: Atomic Card Allocation", () => {
  let db: any;
  let rawDb: any;
  let testData: {
    providerId: number;
    distributorId: number;
    productId: number;
    accountId: number;
    cardIds: number[];
  } = {
    providerId: 0,
    distributorId: 0,
    productId: 0,
    accountId: 0,
    cardIds: [],
  };

  beforeAll(async () => {
    db = await getDb();
    rawDb = await getRawDb();

    if (!db || !rawDb) {
      throw new Error("Database connection not available");
    }

    // Create test provider
    const [providerResult] = await rawDb.execute(
      "INSERT INTO service_providers (name, status) VALUES (?, ?)",
      [`Concurrency Test Provider ${Date.now()}`, "active"]
    );
    testData.providerId = providerResult.insertId;

    // Create test distributor
    const [distributorResult] = await rawDb.execute(
      "INSERT INTO distributors (name, status) VALUES (?, ?)",
      [`Concurrency Test Distributor ${Date.now()}`, "active"]
    );
    testData.distributorId = distributorResult.insertId;

    // Create test product
    const [productResult] = await rawDb.execute(
      "INSERT INTO products (provider_id, name, price, status) VALUES (?, ?, ?, ?)",
      [testData.providerId, "Concurrency Test Product", 100, "active"]
    );
    testData.productId = productResult.insertId;

    // Create account
    const [accountResult] = await rawDb.execute(
      "INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit) VALUES (?, ?, ?, ?, ?)",
      [testData.providerId, testData.distributorId, 10000, 10000, 0]
    );
    testData.accountId = accountResult.insertId;

    // Create commission configuration
    await rawDb.execute(
      "INSERT INTO provider_distributor_commission (provider_id, distributor_id, commission_rate, commission_type) VALUES (?, ?, ?, ?)",
      [testData.providerId, testData.distributorId, 0.05, "percentage"]
    );

    // Upload 20 cards
    const pinEncryptionKey = process.env.PIN_ENCRYPTION_KEY;
    if (!pinEncryptionKey) {
      throw new Error("PIN_ENCRYPTION_KEY not set");
    }

    for (let i = 0; i < 20; i++) {
      const pin = String(1000000000 + i).padStart(10, "0");
      const iv = crypto.randomBytes(16).toString("hex");
      const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(pinEncryptionKey, "hex"),
        Buffer.from(iv, "hex")
      );
      let encrypted = cipher.update(pin, "utf8", "hex");
      encrypted += cipher.final("hex");
      const encryptedPin = `${iv}:${encrypted}`;

      const [cardResult] = await rawDb.execute(
        "INSERT INTO cards (provider_id, product_id, pin_encrypted, status) VALUES (?, ?, ?, ?)",
        [testData.providerId, testData.productId, encryptedPin, "AVAILABLE"]
      );
      testData.cardIds.push(cardResult.insertId);
    }

    console.log(`\n✓ Test setup complete:`);
    console.log(`  Provider ID: ${testData.providerId}`);
    console.log(`  Distributor ID: ${testData.distributorId}`);
    console.log(`  Product ID: ${testData.productId}`);
    console.log(`  Account ID: ${testData.accountId}`);
    console.log(`  Cards uploaded: ${testData.cardIds.length}`);
  });

  it("should allocate 10 unique cards to 10 concurrent purchases without duplicates", async () => {
    // Execute 10 concurrent purchases
    const purchasePromises = [];
    for (let i = 0; i < 10; i++) {
      purchasePromises.push(
        purchaseService.purchaseCard({
          distributorId: testData.distributorId,
          productId: testData.productId,
          idempotencyKey: `concurrent_test_${Date.now()}_${i}`,
        })
      );
    }

    // Wait for all purchases to complete
    const results = await Promise.allSettled(purchasePromises);

    // Count successful purchases
    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    console.log(`\n✓ Purchase results:`);
    console.log(`  Successful: ${successful.length}/10`);
    console.log(`  Failed: ${failed.length}/10`);

    // Verify all purchases succeeded
    expect(successful.length).toBe(10);
    expect(failed.length).toBe(0);
  });

  it("should have exactly 10 cards marked as SOLD", async () => {
    const [soldCards] = await rawDb.execute(
      "SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?",
      [testData.productId, "SOLD"]
    );

    console.log(`\n✓ Card status: ${soldCards[0].count} SOLD`);
    expect(soldCards[0].count).toBe(10);
  });

  it("should have 10 unique allocated cards with no duplicates", async () => {
    const [allocatedCards] = await rawDb.execute(
      "SELECT COUNT(DISTINCT allocated_to_distributor_id) as unique_count, COUNT(*) as total_count FROM cards WHERE product_id = ? AND status = ? AND allocated_to_distributor_id IS NOT NULL",
      [testData.productId, "SOLD"]
    );

    console.log(`\n✓ Allocated cards: ${allocatedCards[0].unique_count} unique, ${allocatedCards[0].total_count} total`);
    expect(allocatedCards[0].total_count).toBe(10);
    expect(allocatedCards[0].unique_count).toBe(1); // All allocated to same distributor
  });

  it("should create 20 ledger entries (10 debit + 10 credit)", async () => {
    const [ledgerEntries] = await rawDb.execute(
      "SELECT reference_type, COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id = ? AND distributor_id = ? GROUP BY reference_type",
      [testData.providerId, testData.distributorId]
    );

    const debitCount = ledgerEntries.find((e: any) => e.reference_type === "purchase_debit")?.count || 0;
    const creditCount = ledgerEntries.find((e: any) => e.reference_type === "commission_credit")?.count || 0;
    const totalCount = ledgerEntries.reduce((sum: number, e: any) => sum + e.count, 0);

    console.log(`\n✓ Ledger entries:`);
    console.log(`  Total: ${totalCount}`);
    console.log(`  Debits: ${debitCount}`);
    console.log(`  Credits: ${creditCount}`);

    expect(debitCount).toBe(10);
    expect(creditCount).toBe(10);
    expect(totalCount).toBe(20);
  });

  it("should have correct account balance after 10 purchases", async () => {
    const [accountData] = await rawDb.execute(
      "SELECT balance FROM provider_distributor_accounts WHERE id = ?",
      [testData.accountId]
    );

    const currentBalance = parseFloat(accountData[0].balance);
    const expectedBalance = 10000 - 10 * 100 + 10 * 5; // 10000 - 1000 + 50 = 9050

    console.log(`\n✓ Account balance:`);
    console.log(`  Initial: $10000.00`);
    console.log(`  After 10 purchases: $${currentBalance.toFixed(2)}`);
    console.log(`  Expected: $${expectedBalance.toFixed(2)}`);

    expect(Math.abs(currentBalance - expectedBalance)).toBeLessThan(0.01);
  });

  afterAll(async () => {
    // Cleanup
    if (rawDb) {
      try {
        await rawDb.execute("DELETE FROM provider_distributor_ledger WHERE provider_id = ?", [testData.providerId]);
        await rawDb.execute("DELETE FROM provider_distributor_accounts WHERE provider_id = ?", [testData.providerId]);
        await rawDb.execute("DELETE FROM provider_distributor_commission WHERE provider_id = ?", [testData.providerId]);
        await rawDb.execute("DELETE FROM cards WHERE product_id = ?", [testData.productId]);
        await rawDb.execute("DELETE FROM products WHERE id = ?", [testData.productId]);
        await rawDb.execute("DELETE FROM distributors WHERE id = ?", [testData.distributorId]);
        await rawDb.execute("DELETE FROM service_providers WHERE id = ?", [testData.providerId]);
        await rawDb.end();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
  });
});
