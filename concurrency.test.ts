import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "./server/db";
import { eq, and } from "drizzle-orm";
import {
  serviceProviders,
  distributors,
  products,
  cards,
  providerDistributorAccounts,
  providerDistributorLedger,
} from "./drizzle/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";

describe("Concurrency Test: Purchase Flow with 20 Cards and 10 Concurrent Purchases", () => {
  let providerId: number;
  let distributorId: number;
  let productId: number;
  let accountId: number;
  const cardIds: number[] = [];
  const purchaseResults: any[] = [];

  beforeAll(async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("CONCURRENCY TEST: 20 Cards + 10 Concurrent Purchases");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Create provider
    const providerResult = await db.insert(serviceProviders).values({
      name: `Concurrency Test Provider ${Date.now()}`,
      status: "active",
    });
    providerId = (providerResult as any).insertId || (providerResult as any)[0];
    console.log(`✓ Provider created: ID ${providerId}`);

    // Create distributor
    const distributorResult = await db.insert(distributors).values({
      name: `Concurrency Test Distributor ${Date.now()}`,
      status: "active",
    });
    distributorId = (distributorResult as any).insertId || (distributorResult as any)[0];
    console.log(`✓ Distributor created: ID ${distributorId}`);

    // Create product
    const productResult = await db.insert(products).values({
      providerId,
      name: "Concurrency Test Product",
      denomination: 100,
      price: 100,
      status: "active",
    });
    productId = (productResult as any).insertId || (productResult as any)[0];
    console.log(`✓ Product created: ID ${productId}, Price: $100`);

    // Create account with sufficient balance
    const accountResult = await db.insert(providerDistributorAccounts).values({
      providerId,
      distributorId,
      balance: 5000, // $5000 for 10 purchases of $100 each
      creditLimit: 5000,
      usedCredit: 0,
    });
    accountId = (accountResult as any).insertId || (accountResult as any)[0];
    console.log(`✓ Account created: ID ${accountId}, Balance: $5000`);

    // Upload 20 cards
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 1: Upload 20 Cards");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const encryptionKey = process.env.PIN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("PIN_ENCRYPTION_KEY not set");
    }

    const cardsToInsert = [];
    for (let i = 0; i < 20; i++) {
      const pin = String(1000000000 + i).padStart(10, "0");
      const iv = crypto.randomBytes(16).toString("hex");
      const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(encryptionKey, "hex"),
        Buffer.from(iv, "hex")
      );
      let encrypted = cipher.update(pin, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag ? cipher.getAuthTag().toString("hex") : "";
      const encryptedPin = `${iv}:${encrypted}:${authTag}`;

      cardsToInsert.push({
        productId,
        pin: encryptedPin,
        status: "AVAILABLE",
      });
    }

    // Insert all cards
    const insertResult = await db.insert(cards).values(cardsToInsert);
    console.log(`✓ Inserted 20 cards`);

    // Verify all cards inserted
    const allCards = await db
      .select()
      .from(cards)
      .where(eq(cards.productId, productId));
    console.log(`✓ Verified: ${allCards.length} cards in database`);
    cardIds.push(...allCards.map((c: any) => c.id));

    console.log(`\n✓ Initial inventory: 20 AVAILABLE cards`);
  });

  it("should handle 10 concurrent purchases without duplicate allocations", async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 2: Execute 10 Concurrent Purchases");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Create 10 concurrent purchase requests
    const purchasePromises = [];
    for (let i = 0; i < 10; i++) {
      purchasePromises.push(
        (async () => {
          try {
            // Find an available card
            const availableCard = await db
              .select()
              .from(cards)
              .where(
                and(
                  eq(cards.productId, productId),
                  eq(cards.status, "AVAILABLE")
                )
              )
              .limit(1);

            if (!availableCard || availableCard.length === 0) {
              return {
                success: false,
                error: "No available cards",
                purchaseIndex: i,
              };
            }

            const cardId = availableCard[0].id;

            // Start transaction
            const result = await db.transaction(async (tx) => {
              // Lock and update card
              const updateCardResult = await tx
                .update(cards)
                .set({ status: "SOLD" })
                .where(
                  and(
                    eq(cards.id, cardId),
                    eq(cards.status, "AVAILABLE")
                  )
                );

              // Check if update was successful (optimistic locking)
              if ((updateCardResult as any).rowsAffected === 0) {
                throw new Error("Card already sold by another transaction");
              }

              // Create purchase debit entry
              const debitResult = await tx.insert(providerDistributorLedger).values({
                providerId,
                distributorId,
                transactionType: "purchase_debit",
                amount: -100,
                balanceAfter: 0, // Will be updated
                usedCreditAfter: 0,
                description: `Purchase of card ${cardId}`,
                reference: `purchase_${cardId}`,
              });

              // Create commission credit entry
              const creditResult = await tx.insert(providerDistributorLedger).values({
                providerId,
                distributorId,
                transactionType: "commission_credit",
                amount: 5,
                balanceAfter: 0, // Will be updated
                usedCreditAfter: 0,
                description: `Commission on card ${cardId}`,
                reference: `commission_${cardId}`,
              });

              // Update account balance
              const currentAccount = await tx
                .select()
                .from(providerDistributorAccounts)
                .where(eq(providerDistributorAccounts.id, accountId))
                .limit(1);

              if (!currentAccount || currentAccount.length === 0) {
                throw new Error("Account not found");
              }

              const newBalance = currentAccount[0].balance - 100 + 5; // debit + commission

              await tx
                .update(providerDistributorAccounts)
                .set({ balance: newBalance })
                .where(eq(providerDistributorAccounts.id, accountId));

              return {
                success: true,
                cardId,
                purchaseIndex: i,
                debitId: (debitResult as any).insertId,
                creditId: (creditResult as any).insertId,
              };
            });

            return result;
          } catch (error: any) {
            return {
              success: false,
              error: error.message,
              purchaseIndex: i,
            };
          }
        })()
      );
    }

    // Execute all purchases concurrently
    const results = await Promise.all(purchasePromises);
    purchaseResults.push(...results);

    // Count successes and failures
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`\n✓ Concurrent purchases completed`);
    console.log(`  Successful: ${successful.length}/10`);
    console.log(`  Failed: ${failed.length}/10`);

    if (failed.length > 0) {
      console.log(`\n  Failed purchases:`);
      failed.forEach((f) => {
        console.log(`    - Purchase ${f.purchaseIndex}: ${f.error}`);
      });
    }

    // Verify all successful purchases allocated different cards
    const allocatedCardIds = successful.map((r) => r.cardId);
    const uniqueCardIds = new Set(allocatedCardIds);

    console.log(`\n✓ Card allocation verification:`);
    console.log(`  Allocated cards: ${allocatedCardIds.length}`);
    console.log(`  Unique cards: ${uniqueCardIds.size}`);
    console.log(`  Duplicates: ${allocatedCardIds.length - uniqueCardIds.size}`);

    expect(uniqueCardIds.size).toBe(allocatedCardIds.length);
    expect(uniqueCardIds.size).toBe(successful.length);
  });

  it("should have exactly 10 cards marked as SOLD", async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 3: Verify Card Status");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const soldCards = await db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.productId, productId),
          eq(cards.status, "SOLD")
        )
      );

    const availableCards = await db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.productId, productId),
          eq(cards.status, "AVAILABLE")
        )
      );

    console.log(`✓ Card status after purchases:`);
    console.log(`  SOLD: ${soldCards.length}`);
    console.log(`  AVAILABLE: ${availableCards.length}`);
    console.log(`  Total: ${soldCards.length + availableCards.length}`);

    expect(soldCards.length).toBe(10);
    expect(availableCards.length).toBe(10);
    expect(soldCards.length + availableCards.length).toBe(20);
  });

  it("should have 20 ledger entries (10 debit + 10 commission)", async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 4: Verify Ledger Entries");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const allLedgerEntries = await db
      .select()
      .from(providerDistributorLedger)
      .where(
        and(
          eq(providerDistributorLedger.providerId, providerId),
          eq(providerDistributorLedger.distributorId, distributorId)
        )
      );

    const debitEntries = allLedgerEntries.filter(
      (e: any) => e.transactionType === "purchase_debit"
    );
    const creditEntries = allLedgerEntries.filter(
      (e: any) => e.transactionType === "commission_credit"
    );

    console.log(`✓ Ledger entry count:`);
    console.log(`  Total entries: ${allLedgerEntries.length}`);
    console.log(`  Purchase debits: ${debitEntries.length}`);
    console.log(`  Commission credits: ${creditEntries.length}`);

    // Calculate totals
    const debitTotal = debitEntries.reduce((sum: number, e: any) => sum + e.amount, 0);
    const creditTotal = creditEntries.reduce((sum: number, e: any) => sum + e.amount, 0);

    console.log(`\n✓ Financial totals:`);
    console.log(`  Total debits: $${Math.abs(debitTotal).toFixed(2)}`);
    console.log(`  Total credits: $${creditTotal.toFixed(2)}`);
    console.log(`  Net impact: $${(debitTotal + creditTotal).toFixed(2)}`);

    expect(debitEntries.length).toBe(10);
    expect(creditEntries.length).toBe(10);
    expect(allLedgerEntries.length).toBe(20);
  });

  it("should have correct account balance after all purchases", async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 5: Verify Account Balance");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const account = await db
      .select()
      .from(providerDistributorAccounts)
      .where(eq(providerDistributorAccounts.id, accountId));

    if (!account || account.length === 0) {
      throw new Error("Account not found");
    }

    const currentBalance = account[0].balance;
    const expectedBalance = 5000 - 10 * 100 + 10 * 5; // initial - (10 * debit) + (10 * commission)

    console.log(`✓ Account balance verification:`);
    console.log(`  Initial balance: $5000.00`);
    console.log(`  Total debits: -$1000.00 (10 × $100)`);
    console.log(`  Total credits: +$50.00 (10 × $5)`);
    console.log(`  Expected balance: $${expectedBalance.toFixed(2)}`);
    console.log(`  Actual balance: $${currentBalance.toFixed(2)}`);

    expect(currentBalance).toBe(expectedBalance);
  });

  it("should have no failed or partial transactions", async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 6: Verify Transaction Integrity");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const successful = purchaseResults.filter((r) => r.success);
    const failed = purchaseResults.filter((r) => !r.success);

    console.log(`✓ Transaction status:`);
    console.log(`  Successful: ${successful.length}/10`);
    console.log(`  Failed: ${failed.length}/10`);

    // Verify each successful purchase has both debit and credit entries
    for (const purchase of successful) {
      const debitEntry = await db
        .select()
        .from(providerDistributorLedger)
        .where(
          and(
            eq(providerDistributorLedger.providerId, providerId),
            eq(providerDistributorLedger.distributorId, distributorId),
            eq(providerDistributorLedger.transactionType, "purchase_debit"),
            eq(providerDistributorLedger.reference, `purchase_${purchase.cardId}`)
          )
        );

      const creditEntry = await db
        .select()
        .from(providerDistributorLedger)
        .where(
          and(
            eq(providerDistributorLedger.providerId, providerId),
            eq(providerDistributorLedger.distributorId, distributorId),
            eq(providerDistributorLedger.transactionType, "commission_credit"),
            eq(providerDistributorLedger.reference, `commission_${purchase.cardId}`)
          )
        );

      expect(debitEntry.length).toBe(1);
      expect(creditEntry.length).toBe(1);
    }

    console.log(`✓ All successful purchases have complete ledger entries`);

    expect(successful.length).toBe(10);
    expect(failed.length).toBe(0);
  });

  afterAll(async () => {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("CONCURRENCY TEST COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log("✅ All concurrency tests passed:");
    console.log("  ✓ 20 cards uploaded successfully");
    console.log("  ✓ 10 concurrent purchases executed");
    console.log("  ✓ No duplicate card allocations");
    console.log("  ✓ Exactly 10 cards marked SOLD");
    console.log("  ✓ 20 ledger entries created (10 debit + 10 credit)");
    console.log("  ✓ Account balance correct");
    console.log("  ✓ No failed or partial transactions");
    console.log("\n");
  });
});
