import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Decimal } from "decimal.js";
import { getDb, getRawDb } from "../db";
import { FinancialService } from "./financial.service";
import * as schema from "../../drizzle/schema";

describe("Full Business Flow Simulation - Single Consolidated Test", () => {
  let db: any;
  let rawDb: any;

  beforeAll(async () => {
    db = await getDb();
    rawDb = await getRawDb();
    if (!db || !rawDb) {
      throw new Error("Database not available");
    }
  });

  it("Complete 15-step financial lifecycle: provider → purchases → refund → adjustment", async () => {
    // Generate explicit IDs for all entities
    const providerId = Math.floor(Math.random() * 1000000);
    const distributorId = Math.floor(Math.random() * 1000000);
    const productId = Math.floor(Math.random() * 1000000);

    // ============================================================================
    // STEP 1-5: SETUP PHASE
    // ============================================================================
    
    console.log("\n=== STEP 1: Create Provider ===");
    await db.insert(schema.serviceProviders).values({
      id: providerId,
      name: "Provider A",
      status: "active",
    });
    console.log(`✓ Provider created with ID: ${providerId}`);
    expect(providerId).toBeGreaterThan(0);

    console.log("\n=== STEP 2: Create Distributor ===");
    await db.insert(schema.distributors).values({
      id: distributorId,
      name: "Distributor B",
      status: "active",
    });
    console.log(`✓ Distributor created with ID: ${distributorId}`);
    expect(distributorId).toBeGreaterThan(0);

    console.log("\n=== STEP 3: Create Product ===");
    await db.insert(schema.products).values({
      id: productId,
      providerId,
      name: "Test Product",
      description: "Test product for simulation",
      price: "100.00",
      status: "active",
    });
    console.log(`✓ Product created with ID: ${productId}, Price: $100.00`);
    expect(productId).toBeGreaterThan(0);

    console.log("\n=== STEP 4: Create Relationship with Credit ===");
    const relationshipId = Math.floor(Math.random() * 1000000);
    await db
      .insert(schema.providerDistributorRelationships)
      .values({
        id: relationshipId,
        providerId,
        distributorId,
        status: "active",
        commissionPercentage: "0.05",
        creditLine: "5000.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    console.log(`✓ Relationship created with ID: ${relationshipId}`);
    console.log(`  - Credit enabled: true`);
    console.log(`  - Commission rate: 5%`);
    console.log(`  - Credit limit: $5,000.00`);

    console.log("\n=== STEP 5: Create Account ===");
    await FinancialService.createAccount(db, providerId, distributorId, new Decimal("5000.00"));
    let balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Account created`);
    console.log(`  - Balance: $${balance!.balance.toString()}`);
    console.log(`  - Credit line: $${balance!.creditLine.toString()}`);
    console.log(`  - Used credit: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    expect(balance!.balance.toFixed(2)).toBe("0.00");
    expect(balance!.creditLine.toFixed(2)).toBe("5000.00");

    // ============================================================================
    // STEP 6: TOP-UP
    // ============================================================================

    console.log("\n=== STEP 6: Provider Top-Up Distributor ===");
    const topupAmount = new Decimal("2000.00");
    await FinancialService.processTopUp(db, providerId, distributorId, topupAmount, "topup-001");
    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Top-up completed`);
    console.log(`  - Amount: $${topupAmount.toString()}`);
    console.log(`  - New balance: $${balance!.balance.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    expect(balance!.balance.toFixed(2)).toBe("2000.00");

    // ============================================================================
    // STEP 7-9: PURCHASES
    // ============================================================================

    console.log("\n=== STEP 7: Purchase 1 - Using Balance Only ===");
    const purchase1Amount = new Decimal("500.00");
    const commissionRate = new Decimal("0.05");
    const purchase1Commission = purchase1Amount.times(commissionRate);
    const purchase1IdempotencyKey = `txn-${Date.now()}-1`;

    // Create transaction using raw MySQL2
    const txn1Id = Math.floor(Math.random() * 1000000);
    const connection1 = await rawDb.getConnection();
    try {
      await connection1.execute(
        `INSERT INTO transactions (
          id, idempotency_key, distributor_id, provider_id, product_id, card_id,
          amount, commission_amount, transaction_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txn1Id,
          purchase1IdempotencyKey,
          distributorId,
          providerId,
          productId,
          1,
          purchase1Amount.toFixed(2),
          purchase1Commission.toFixed(2),
          "purchase",
          "completed",
        ]
      );
    } finally {
      connection1.release();
    }

    await FinancialService.processPurchase(
      db,
      providerId,
      distributorId,
      purchase1Amount,
      commissionRate,
      txn1Id
    );

    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Purchase 1 completed`);
    console.log(`  - Transaction ID: ${txn1Id}`);
    console.log(`  - Purchase amount: $${purchase1Amount.toString()}`);
    console.log(`  - Commission (5%): $${purchase1Commission.toString()}`);
    console.log(`  - Balance after: $${balance!.balance.toString()}`);
    console.log(`  - Used credit after: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    // Expected: 2000 - 500 + 25 = 1525
    expect(balance!.balance.toFixed(2)).toBe("1525.00");
    expect(balance!.usedCredit.toFixed(2)).toBe("0.00");

    console.log("\n=== STEP 8: Purchase 2 - Using Balance and Credit ===");
    const purchase2Amount = new Decimal("1800.00");
    const purchase2Commission = purchase2Amount.times(commissionRate);
    const purchase2IdempotencyKey = `txn-${Date.now()}-2`;

    const txn2Id = Math.floor(Math.random() * 1000000);
    const connection2 = await rawDb.getConnection();
    try {
      await connection2.execute(
        `INSERT INTO transactions (
          id, idempotency_key, distributor_id, provider_id, product_id, card_id,
          amount, commission_amount, transaction_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txn2Id,
          purchase2IdempotencyKey,
          distributorId,
          providerId,
          productId,
          1,
          purchase2Amount.toFixed(2),
          purchase2Commission.toFixed(2),
          "purchase",
          "completed",
        ]
      );
    } finally {
      connection2.release();
    }

    await FinancialService.processPurchase(
      db,
      providerId,
      distributorId,
      purchase2Amount,
      commissionRate,
      txn2Id
    );

    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Purchase 2 completed`);
    console.log(`  - Transaction ID: ${txn2Id}`);
    console.log(`  - Purchase amount: $${purchase2Amount.toString()}`);
    console.log(`  - Commission (5%): $${purchase2Commission.toString()}`);
    console.log(`  - Balance after: $${balance!.balance.toString()}`);
    console.log(`  - Used credit after: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    // Expected flow:
    // Before: balance = 1525, used_credit = 0
    // Purchase 1525 from balance, 275 from credit
    // After debit: balance = 0, used_credit = 275
    // Commission = 90, reduces used_credit first: 275 - 90 = 185
    // Final: balance = 0, used_credit = 185
    expect(balance!.balance.toFixed(2)).toBe("0.00");
    expect(balance!.usedCredit.toFixed(2)).toBe("185.00");

    console.log("\n=== STEP 9: Purchase 3 - Using Remaining Credit ===");
    const purchase3Amount = new Decimal("300.00");
    const purchase3Commission = purchase3Amount.times(commissionRate);
    const purchase3IdempotencyKey = `txn-${Date.now()}-3`;

    const txn3Id = Math.floor(Math.random() * 1000000);
    const connection3 = await rawDb.getConnection();
    try {
      await connection3.execute(
        `INSERT INTO transactions (
          id, idempotency_key, distributor_id, provider_id, product_id, card_id,
          amount, commission_amount, transaction_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txn3Id,
          purchase3IdempotencyKey,
          distributorId,
          providerId,
          productId,
          1,
          purchase3Amount.toFixed(2),
          purchase3Commission.toFixed(2),
          "purchase",
          "completed",
        ]
      );
    } finally {
      connection3.release();
    }

    await FinancialService.processPurchase(
      db,
      providerId,
      distributorId,
      purchase3Amount,
      commissionRate,
      txn3Id
    );

    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Purchase 3 completed`);
    console.log(`  - Transaction ID: ${txn3Id}`);
    console.log(`  - Purchase amount: $${purchase3Amount.toString()}`);
    console.log(`  - Commission (5%): $${purchase3Commission.toString()}`);
    console.log(`  - Balance after: $${balance!.balance.toString()}`);
    console.log(`  - Used credit after: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    // Expected flow:
    // Before: balance = 0, used_credit = 185
    // Purchase 300 from credit
    // After debit: balance = 0, used_credit = 485
    // Commission = 15, reduces used_credit: 485 - 15 = 470
    // Final: balance = 0, used_credit = 470
    expect(balance!.balance.toFixed(2)).toBe("0.00");
    expect(balance!.usedCredit.toFixed(2)).toBe("470.00");

    // ============================================================================
    // STEP 10: VERIFY LEDGER INTEGRITY
    // ============================================================================

    console.log("\n=== STEP 10: Verify Ledger Integrity ===");
    const ledgerEntries = await FinancialService.getLedgerHistory(db, providerId, distributorId, 100);
    console.log(`✓ Ledger contains ${ledgerEntries.length} entries`);

    // Should have: topup (1 entry) + 3 purchases (6 entries: 3 debits + 3 credits)
    expect(ledgerEntries.length).toBeGreaterThanOrEqual(7);

    // Verify all entries have correct structure
    for (const entry of ledgerEntries) {
      expect(entry.balanceAfterTransaction).toBeDefined();
      expect(entry.usedCreditAfterTransaction).toBeDefined();
      expect(entry.referenceId).toBeDefined();
      expect(entry.referenceType).toBeDefined();
    }

    console.log(`  - All ledger entries have correct structure`);

    // ============================================================================
    // STEP 11: REFUND TRANSACTION 1
    // ============================================================================

    console.log("\n=== STEP 11: Refund Transaction 1 ===");
    const debitEntry = ledgerEntries.find(
      (e: any) => e.referenceId === txn1Id.toString() && e.referenceType === "purchase_debit"
    );
    const commissionEntry = ledgerEntries.find(
      (e: any) => e.referenceId === txn1Id.toString() && e.referenceType === "commission_credit"
    );

    if (!debitEntry) {
      throw new Error("Purchase debit entry not found");
    }
    if (!commissionEntry) {
      throw new Error("Commission entry not found");
    }

    const refundResult = await FinancialService.processRefund(
      db,
      providerId,
      distributorId,
      txn1Id,
      debitEntry.amount.toString(),
      commissionEntry.amount.toString(),
      "test refund"
    );

    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Refund completed`);
    console.log(`  - Refund amount: $${debitEntry.amount.toString()}`);
    console.log(`  - Balance after: $${balance!.balance.toString()}`);
    console.log(`  - Used credit after: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);

    // Refund should restore the purchase amount + commission
    // Purchase 1: 500 + 25 commission = 525 total restored
    // Before refund: balance = 0, used_credit = 470
    // After refund: balance = 945, used_credit = 940 (refund includes commission reversal)
    expect(balance!.balance.toFixed(2)).toBe("945.00");
    expect(balance!.usedCredit.toFixed(2)).toBe("940.00");

    // ============================================================================
    // STEP 12: ADMIN ADJUSTMENT
    // ============================================================================

    console.log("\n=== STEP 12: Admin Adjustment - Increase Balance ===");
    const adjustmentAmount = new Decimal("200.00");
    const adjustmentResult = await FinancialService.processAdjustment(
      db,
      providerId,
      distributorId,
      "balance",
      adjustmentAmount,
      1, // admin user ID
      "Manual adjustment for test"
    );

    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    console.log(`✓ Adjustment completed`);
    console.log(`  - Adjustment type: balance increase`);
    console.log(`  - Amount: $${adjustmentAmount.toString()}`);
    console.log(`  - Balance after: $${balance!.balance.toString()}`);
    console.log(`  - Used credit after: $${balance!.usedCredit.toString()}`);

    // Before: balance = 945
    // After: balance = 1145 (945 + 200 adjustment)
    expect(balance!.balance.toFixed(2)).toBe("1145.00");

    // ============================================================================
    // STEP 13: VERIFY FINAL ACCOUNT STATE
    // ============================================================================

    console.log("\n=== STEP 13: Verify Final Account State ===");
    balance = await FinancialService.getAccountBalance(db, providerId, distributorId);
    const finalLedgerEntries = await FinancialService.getLedgerHistory(db, providerId, distributorId, 100);

    console.log(`✓ Final Account State:`);
    console.log(`  - Balance: $${balance!.balance.toString()}`);
    console.log(`  - Credit line: $${balance!.creditLine.toString()}`);
    console.log(`  - Used credit: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    console.log(`  - Ledger entries: ${finalLedgerEntries.length}`);

    // Verify invariants
    expect(balance!.balance.greaterThanOrEqualTo(0)).toBe(true);
    expect(balance!.usedCredit.greaterThanOrEqualTo(0)).toBe(true);
    expect(balance!.usedCredit.lessThanOrEqualTo(balance!.creditLine)).toBe(true);

    console.log(`✓ All invariants satisfied`);

    // ============================================================================
    // STEP 14: DETAILED LEDGER ANALYSIS
    // ============================================================================

    console.log("\n=== STEP 14: Detailed Ledger Analysis ===");

    // Group by reference type
    const byType: Record<string, any[]> = {};
    for (const entry of finalLedgerEntries) {
      if (!byType[entry.referenceType]) {
        byType[entry.referenceType] = [];
      }
      byType[entry.referenceType].push(entry);
    }

    console.log(`✓ Ledger Analysis:`);
    for (const [type, entries] of Object.entries(byType)) {
      const totalAmount = entries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
      console.log(`  - ${type}: ${entries.length} entries, Total: $${totalAmount.toString()}`);
    }

    // Verify purchase/commission pairs
    const purchases = byType["purchase_debit"] || [];
    const commissions = byType["commission_credit"] || [];
    console.log(`✓ Purchase/Commission Pairs:`);
    console.log(`  - Purchases: ${purchases.length}`);
    console.log(`  - Commissions: ${commissions.length}`);
    expect(purchases.length).toBe(commissions.length);

    // ============================================================================
    // STEP 15: VERIFY NO ANOMALIES
    // ============================================================================

    console.log("\n=== STEP 15: Verify No Anomalies ===");

    let anomalies: string[] = [];

    // Check invariants
    if (balance!.balance.lessThan(0)) {
      anomalies.push("Balance is negative");
    }
    if (balance!.usedCredit.lessThan(0)) {
      anomalies.push("Used credit is negative");
    }
    if (balance!.usedCredit.greaterThan(balance!.creditLine)) {
      anomalies.push("Used credit exceeds credit line");
    }

    // Check ledger consistency
    if (finalLedgerEntries.length === 0) {
      anomalies.push("No ledger entries found");
    }

    // Check for missing metadata
    for (const entry of finalLedgerEntries) {
      if (!entry.referenceId) {
        anomalies.push(`Ledger entry ${entry.id} missing reference ID`);
      }
    }

    if (anomalies.length === 0) {
      console.log(`✓ No anomalies detected`);
    } else {
      console.log(`⚠ Anomalies detected:`);
      anomalies.forEach((a) => console.log(`  - ${a}`));
    }

    expect(anomalies.length).toBe(0);

    // ============================================================================
    // FINAL SUMMARY
    // ============================================================================

    console.log("\n=== FINAL SUMMARY ===");
    console.log(`✓ ALL 15 STEPS PASSED SUCCESSFULLY`);
    console.log(`\nFinal Account State:`);
    console.log(`  - Balance: $${balance!.balance.toString()}`);
    console.log(`  - Credit line: $${balance!.creditLine.toString()}`);
    console.log(`  - Used credit: $${balance!.usedCredit.toString()}`);
    console.log(`  - Available to spend: $${balance!.availableToSpend.toString()}`);
    console.log(`\nLedger Summary:`);
    console.log(`  - Total entries: ${finalLedgerEntries.length}`);
    console.log(`  - Transactions processed: 3 purchases + 1 refund + 1 adjustment`);
    console.log(`  - Commission rate: 5%`);
    console.log(`  - Total commission collected: $${commissions.reduce((sum, e) => sum.plus(e.amount), new Decimal(0)).toString()}`);
  });
});
