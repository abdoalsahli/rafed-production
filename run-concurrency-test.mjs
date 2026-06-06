#!/usr/bin/env node

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

console.log(`Connecting to database: ${config.host}/${config.database}`);

async function runConcurrencyTest() {
  const conn = await createConnection(config);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("CONCURRENCY TEST: 20 Cards + 10 Concurrent Purchases");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // Create provider
    const [providerResult] = await conn.execute(
      "INSERT INTO service_providers (name, status) VALUES (?, ?)",
      [`Concurrency Test Provider ${Date.now()}`, "active"]
    );
    const providerId = providerResult.insertId;
    console.log(`✓ Provider created: ID ${providerId}`);

    // Create distributor
    const [distributorResult] = await conn.execute(
      "INSERT INTO distributors (name, status) VALUES (?, ?)",
      [`Concurrency Test Distributor ${Date.now()}`, "active"]
    );
    const distributorId = distributorResult.insertId;
    console.log(`✓ Distributor created: ID ${distributorId}`);

    // Create product
    const [productResult] = await conn.execute(
      "INSERT INTO products (provider_id, name, price, status) VALUES (?, ?, ?, ?)",
      [providerId, "Concurrency Test Product", 100, "active"]
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

      cardsToInsert.push([productId, encryptedPin, "AVAILABLE"]);
    }

    // Insert all cards
    for (const card of cardsToInsert) {
      await conn.execute(
        "INSERT INTO cards (provider_id, product_id, pin_encrypted, status) VALUES (?, ?, ?, ?)",
        [providerId, card[0], card[1], card[2]]
      );
    }
    console.log(`✓ Inserted 20 cards`);

    // Verify cards
    const [allCards] = await conn.execute(
      "SELECT id FROM cards WHERE product_id = ? AND status = ?",
      [productId, "AVAILABLE"]
    );
    console.log(`✓ Verified: ${allCards.length} AVAILABLE cards in database`);

    // Execute 10 concurrent purchases
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("STEP 2: Execute 10 Concurrent Purchases");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const purchasePromises = [];
    for (let i = 0; i < 10; i++) {
      purchasePromises.push(
        (async () => {
          try {
            // Get available card
            const [availableCards] = await conn.execute(
              "SELECT id FROM cards WHERE product_id = ? AND status = ? LIMIT 1",
              [productId, "AVAILABLE"]
            );

            if (!availableCards || availableCards.length === 0) {
              return { success: false, error: "No available cards", index: i };
            }

            const cardId = availableCards[0].id;

            // Update card status
            const [updateResult] = await conn.execute(
              "UPDATE cards SET status = ? WHERE id = ? AND status = ?",
              ["SOLD", cardId, "AVAILABLE"]
            );

            if (updateResult.affectedRows === 0) {
              return { success: false, error: "Card already sold", index: i };
            }

            // Create debit entry
            await conn.execute(
              "INSERT INTO provider_distributor_ledger (provider_id, distributor_id, transaction_type, amount, balance_after, used_credit_after, description, reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                providerId,
                distributorId,
                "purchase_debit",
                -100,
                0,
                0,
                `Purchase of card ${cardId}`,
                `purchase_${cardId}`,
              ]
            );

            // Create credit entry
            await conn.execute(
              "INSERT INTO provider_distributor_ledger (provider_id, distributor_id, transaction_type, amount, balance_after, used_credit_after, description, reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                providerId,
                distributorId,
                "commission_credit",
                5,
                0,
                0,
                `Commission on card ${cardId}`,
                `commission_${cardId}`,
              ]
            );

            // Update account balance
            await conn.execute(
              "UPDATE provider_distributor_accounts SET balance = balance - 100 + 5 WHERE id = ?",
              [accountId]
            );

            return { success: true, cardId, index: i };
          } catch (error) {
            return { success: false, error: error.message, index: i };
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

    // Verify card allocation
    const allocatedCardIds = successful.map((r) => r.cardId);
    const uniqueCardIds = new Set(allocatedCardIds);

    console.log(`\n✓ Card allocation verification:`);
    console.log(`  Allocated cards: ${allocatedCardIds.length}`);
    console.log(`  Unique cards: ${uniqueCardIds.size}`);
    console.log(`  Duplicates: ${allocatedCardIds.length - uniqueCardIds.size}`);

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
      "SELECT transaction_type, COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id = ? AND distributor_id = ? GROUP BY transaction_type",
      [providerId, distributorId]
    );

    const debitCount = allLedger.find((e) => e.transaction_type === "purchase_debit")?.count || 0;
    const creditCount = allLedger.find((e) => e.transaction_type === "commission_credit")?.count || 0;

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

    const currentBalance = accountData[0].balance;
    const expectedBalance = 5000 - 10 * 100 + 10 * 5;

    console.log(`✓ Account balance verification:`);
    console.log(`  Initial balance: $5000.00`);
    console.log(`  Total debits: -$1000.00 (10 × $100)`);
    console.log(`  Total credits: +$50.00 (10 × $5)`);
    console.log(`  Expected balance: $${expectedBalance.toFixed(2)}`);
    console.log(`  Actual balance: $${currentBalance.toFixed(2)}`);

    // Final summary
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("CONCURRENCY TEST RESULTS");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const passed =
      successful.length === 10 &&
      uniqueCardIds.size === 10 &&
      soldCards[0].count === 10 &&
      debitCount === 10 &&
      creditCount === 10 &&
      currentBalance === expectedBalance;

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
      if (uniqueCardIds.size !== 10) console.log(`  ✗ Expected 10 unique cards, got ${uniqueCardIds.size}`);
      if (soldCards[0].count !== 10) console.log(`  ✗ Expected 10 SOLD cards, got ${soldCards[0].count}`);
      if (debitCount !== 10) console.log(`  ✗ Expected 10 debit entries, got ${debitCount}`);
      if (creditCount !== 10) console.log(`  ✗ Expected 10 credit entries, got ${creditCount}`);
      if (currentBalance !== expectedBalance) console.log(`  ✗ Expected balance $${expectedBalance.toFixed(2)}, got $${currentBalance.toFixed(2)}`);
      console.log("\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Test error:", error.message);
    if (error.code) console.error(`Error code: ${error.code}`);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runConcurrencyTest();
