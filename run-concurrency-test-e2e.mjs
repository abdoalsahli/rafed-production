#!/usr/bin/env node

/**
 * End-to-End Concurrency Test using actual tRPC purchase endpoint
 * 
 * This test verifies that the atomic card allocation fix works by:
 * 1. Creating test data (provider, distributor, product, account, 20 cards)
 * 2. Running 10 concurrent purchase requests through the tRPC endpoint
 * 3. Verifying that all 10 purchases succeed with no duplicates
 */

import { createConnection } from "mysql2/promise";
import crypto from "crypto";
import { URL } from "url";

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const url = new URL(dbUrl);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: {},
  waitForConnections: true,
  connectionLimit: 5,
};

const PIN_ENCRYPTION_KEY = process.env.PIN_ENCRYPTION_KEY;

if (!PIN_ENCRYPTION_KEY) {
  console.error("❌ PIN_ENCRYPTION_KEY not set");
  process.exit(1);
}

const BASE_URL = process.env.API_URL || "http://localhost:3000";

async function runConcurrencyTestE2E() {
  let conn;
  try {
    conn = await createConnection(config);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("E2E CONCURRENCY TEST: 20 Cards + 10 Concurrent Purchases");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Create provider
    const [providerResult] = await conn.execute(
      "INSERT INTO service_providers (name, status) VALUES (?, ?)",
      [`E2E Test Provider ${Date.now()}`, "active"]
    );
    const providerId = providerResult.insertId;
    console.log(`✓ Provider created: ID ${providerId}`);

    // Create distributor (this will be our test user)
    const [distributorResult] = await conn.execute(
      "INSERT INTO distributors (name, status) VALUES (?, ?)",
      [`E2E Test Distributor ${Date.now()}`, "active"]
    );
    const distributorId = distributorResult.insertId;
    console.log(`✓ Distributor created: ID ${distributorId}`);

    // Create user for authentication
    const [userResult] = await conn.execute(
      "INSERT INTO users (openId, name, role) VALUES (?, ?, ?)",
      [`test_user_${Date.now()}@test.com`, `Test User ${Date.now()}`, "user"]
    );
    const userId = userResult.insertId;
    console.log(`✓ User created: ID ${userId}`);

    // Link distributor to user
    await conn.execute(
      "UPDATE distributors SET userId = ? WHERE id = ?",
      [userId, distributorId]
    );

    // Create product
    const [productResult] = await conn.execute(
      "INSERT INTO products (provider_id, name, price, status) VALUES (?, ?, ?, ?)",
      [providerId, "E2E Test Product", 100, "active"]
    );
    const productId = productResult.insertId;
    console.log(`✓ Product created: ID ${productId}, Price: $100`);

    // Create account
    const [accountResult] = await conn.execute(
      "INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit) VALUES (?, ?, ?, ?, ?)",
      [providerId, distributorId, 5000, 5000, 0]
    );
    const accountId = accountResult.insertId;
    console.log(`✓ Account created: ID ${accountId}, Balance: $5000`);

    // Create commission configuration
    await conn.execute(
      "INSERT INTO provider_distributor_commission (provider_id, distributor_id, commission_rate, commission_type) VALUES (?, ?, ?, ?)",
      [providerId, distributorId, 0.05, "percentage"]
    );
    console.log(`✓ Commission configured: 5% of purchase`);

    // Upload 20 cards
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 1: Upload 20 Cards");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const cardsToInsert = [];
    for (let i = 0; i < 20; i++) {
      const pin = String(1000000000 + i).padStart(10, "0");
      const iv = crypto.randomBytes(16).toString("hex");
      const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(PIN_ENCRYPTION_KEY, "hex"),
        Buffer.from(iv, "hex")
      );
      let encrypted = cipher.update(pin, "utf8", "hex");
      encrypted += cipher.final("hex");
      const encryptedPin = `${iv}:${encrypted}`;

      cardsToInsert.push([providerId, productId, encryptedPin]);
    }

    // Insert all cards
    for (const card of cardsToInsert) {
      await conn.execute(
        "INSERT INTO cards (provider_id, product_id, pin_encrypted, status) VALUES (?, ?, ?, ?)",
        [...card, "AVAILABLE"]
      );
    }
    console.log(`✓ Inserted 20 cards`);

    // Verify cards
    const [allCards] = await conn.execute(
      "SELECT id FROM cards WHERE product_id = ? AND status = ?",
      [productId, "AVAILABLE"]
    );
    console.log(`✓ Verified: ${allCards.length} AVAILABLE cards in database`);

    // Execute 10 concurrent purchases through tRPC endpoint
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 2: Execute 10 Concurrent Purchases via tRPC");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const purchasePromises = [];
    for (let i = 0; i < 10; i++) {
      purchasePromises.push(
        (async () => {
          try {
            // Call tRPC purchase endpoint
            const idempotencyKey = `test_purchase_${Date.now()}_${i}`;
            const response = await fetch(`${BASE_URL}/api/trpc/purchase.card`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Note: In real scenario, you'd need proper authentication headers
              },
              body: JSON.stringify({
                json: {
                  productId,
                  idempotencyKey,
                },
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `HTTP ${response.status}: ${error}`,
                index: i,
              };
            }

            const data = await response.json();

            // Check if response has result
            if (data.result && data.result.data) {
              return {
                success: true,
                transactionId: data.result.data.transactionId,
                index: i,
              };
            } else if (data.error) {
              return {
                success: false,
                error: data.error.message || "Unknown error",
                index: i,
              };
            } else {
              return {
                success: false,
                error: "Unexpected response format",
                index: i,
              };
            }
          } catch (error) {
            return {
              success: false,
              error: error.message,
              index: i,
            };
          }
        })()
      );
    }

    const results = await Promise.all(purchasePromises);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`✓ Concurrent purchases completed`);
    console.log(`  Successful: ${successful.length}/10`);
    console.log(`  Failed: ${failed.length}/10`);

    if (failed.length > 0) {
      console.log(`\n  Failed purchases:`);
      failed.forEach((f) => {
        console.log(`    - Purchase ${f.index}: ${f.error}`);
      });
    }

    // Verify card status
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 3: Verify Card Status");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const [soldCards] = await conn.execute(
      "SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?",
      [productId, "SOLD"]
    );
    const [availableCardsAfter] = await conn.execute(
      "SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?",
      [productId, "AVAILABLE"]
    );

    console.log(`✓ Card status after purchases:`);
    console.log(`  SOLD: ${soldCards[0].count}`);
    console.log(`  AVAILABLE: ${availableCardsAfter[0].count}`);
    console.log(`  Total: ${soldCards[0].count + availableCardsAfter[0].count}`);

    // Verify ledger entries
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 4: Verify Ledger Entries");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const [allLedger] = await conn.execute(
      "SELECT reference_type, COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id = ? AND distributor_id = ? GROUP BY reference_type",
      [providerId, distributorId]
    );

    const debitCount = allLedger.find((e) => e.reference_type === "purchase_debit")?.count || 0;
    const creditCount = allLedger.find((e) => e.reference_type === "commission_credit")?.count || 0;

    console.log(`✓ Ledger entry count:`);
    console.log(`  Total entries: ${allLedger.reduce((sum, e) => sum + e.count, 0)}`);
    console.log(`  Purchase debits: ${debitCount}`);
    console.log(`  Commission credits: ${creditCount}`);

    // Verify account balance
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 5: Verify Account Balance");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const [accountData] = await conn.execute(
      "SELECT balance FROM provider_distributor_accounts WHERE id = ?",
      [accountId]
    );

    const currentBalance = parseFloat(accountData[0].balance);
    const expectedBalance = 5000 - successful.length * 100 + successful.length * 5;

    console.log(`✓ Account balance verification:`);
    console.log(`  Initial balance: $5000.00`);
    console.log(`  Total debits: -$${(successful.length * 100).toFixed(2)} (${successful.length} × $100)`);
    console.log(`  Total credits: +$${(successful.length * 5).toFixed(2)} (${successful.length} × $5)`);
    console.log(`  Expected balance: $${expectedBalance.toFixed(2)}`);
    console.log(`  Actual balance: $${currentBalance.toFixed(2)}`);

    // Final summary
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("E2E CONCURRENCY TEST RESULTS");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const passed =
      successful.length === 10 &&
      soldCards[0].count === 10 &&
      debitCount === 10 &&
      creditCount === 10 &&
      Math.abs(currentBalance - expectedBalance) < 0.01;

    if (passed) {
      console.log("✅ ALL TESTS PASSED:");
      console.log("  ✓ 20 cards uploaded successfully");
      console.log("  ✓ 10 concurrent purchases executed");
      console.log("  ✓ No duplicate card allocations");
      console.log("  ✓ Exactly 10 cards marked SOLD");
      console.log("  ✓ 20 ledger entries created (10 debit + 10 credit)");
      console.log("  ✓ Account balance correct");
      console.log("  ✓ No failed or partial transactions");
      console.log("\n");
      process.exit(0);
    } else {
      console.log("❌ TESTS FAILED:");
      if (successful.length !== 10) console.log(`  ✗ Expected 10 successful purchases, got ${successful.length}`);
      if (soldCards[0].count !== 10) console.log(`  ✗ Expected 10 SOLD cards, got ${soldCards[0].count}`);
      if (debitCount !== 10) console.log(`  ✗ Expected 10 debit entries, got ${debitCount}`);
      if (creditCount !== 10) console.log(`  ✗ Expected 10 credit entries, got ${creditCount}`);
      if (Math.abs(currentBalance - expectedBalance) >= 0.01) console.log(`  ✗ Expected balance $${expectedBalance.toFixed(2)}, got $${currentBalance.toFixed(2)}`);
      console.log("\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Test error:", error.message);
    if (error.code) console.error(`Error code: ${error.code}`);
    if (error.errno) console.error(`Error errno: ${error.errno}`);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

runConcurrencyTestE2E();
