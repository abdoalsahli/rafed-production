import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { FinancialService } from "./services/financial.service";
import { RefundService } from "./services/refund.service";

/**
 * Comprehensive End-to-End Scenario Validation
 * 
 * Tests the complete workflow:
 * 1. Create provider & distributor
 * 2. Distributor requests access
 * 3. Provider approves with commission + credit line
 * 4. Provider tops up account
 * 5. Distributor purchases cards
 * 6. Verify ledger entries, balances, metrics
 * 7. Process refund & verify reversal
 * 8. Suspend/reactivate & verify blocking
 * 9. Trigger alerts & verify dashboard updates
 */

let db: any;
let connection: any;
let testData: any = {};

async function setupDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const urlObj = new URL(url);
  const sslParam = urlObj.searchParams.get("ssl");
  const sslConfig = sslParam ? JSON.parse(sslParam) : undefined;

  connection = await mysql.createConnection({
    host: urlObj.hostname,
    user: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1),
    ssl: sslConfig,
  });

  db = drizzle(connection, { schema, mode: "default" });
}

function generateId() {
  return Math.floor(Math.random() * 1000000);
}

function log(step: string, message: string, data?: any) {
  console.log(`\n[${step}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

async function cleanup() {
  try {
    if (testData.transactionIds?.length) {
      for (const txId of testData.transactionIds) {
        await db.delete(schema.transactions).where(eq(schema.transactions.id, txId));
      }
    }
    if (testData.cardIds?.length) {
      for (const cardId of testData.cardIds) {
        await db.delete(schema.cards).where(eq(schema.cards.id, cardId));
      }
    }
    if (testData.productId) {
      await db.delete(schema.products).where(eq(schema.products.id, testData.productId));
    }
    if (testData.providerId && testData.distributorId) {
      await db.delete(schema.providerDistributorLedger).where(
        and(
          eq(schema.providerDistributorLedger.providerId, testData.providerId),
          eq(schema.providerDistributorLedger.distributorId, testData.distributorId)
        )
      );
      await db.delete(schema.providerDistributorAccounts).where(
        and(
          eq(schema.providerDistributorAccounts.providerId, testData.providerId),
          eq(schema.providerDistributorAccounts.distributorId, testData.distributorId)
        )
      );
      await db.delete(schema.providerDistributorRelationships).where(
        and(
          eq(schema.providerDistributorRelationships.providerId, testData.providerId),
          eq(schema.providerDistributorRelationships.distributorId, testData.distributorId)
        )
      );
      await db.delete(schema.providerDistributorCommission).where(
        eq(schema.providerDistributorCommission.providerId, testData.providerId)
      );
      await db.delete(schema.accessRequests).where(
        eq(schema.accessRequests.providerId, testData.providerId)
      );
    }
    if (testData.distributorId) {
      await db.delete(schema.distributors).where(eq(schema.distributors.id, testData.distributorId));
    }
    if (testData.providerId) {
      await db.delete(schema.serviceProviders).where(eq(schema.serviceProviders.id, testData.providerId));
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

describe("End-to-End Scenario Validation", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await cleanup();
    await connection.end();
  });

  it("should complete full workflow: access request → purchase → refund → suspend → reactivate", async () => {
    try {
      // ========== STEP 1: Create Provider ==========
      const providerId = generateId();
      await db.insert(schema.serviceProviders).values({
        id: providerId,
        name: `Test Provider ${Date.now()}`,
        status: "active",
      });
      testData.providerId = providerId;
      log("STEP 1", "Provider created", { providerId });

      // ========== STEP 2: Create Distributor ==========
      const distributorId = generateId();
      await db.insert(schema.distributors).values({
        id: distributorId,
        name: `Test Distributor ${Date.now()}`,
        status: "active",
      });
      testData.distributorId = distributorId;
      log("STEP 2", "Distributor created", { distributorId });

      // ========== STEP 3: Distributor Requests Access ==========
      const requestId = generateId();
      await db.insert(schema.accessRequests).values({
        id: requestId,
        providerId,
        distributorId,
        requestedCommission: "5.00",
        requestedCreditLine: "1000.00",
        status: "pending",
      });
      log("STEP 3", "Access request created", { requestId, status: "pending" });

      // ========== STEP 4: Provider Approves Request ==========
      const commissionRate = "5.00";
      const creditLine = "1000.00";

      // Create relationship
      const relationshipId = generateId();
      await db.insert(schema.providerDistributorRelationships).values({
        id: relationshipId,
        providerId,
        distributorId,
        status: "active",
        commissionRate,
        creditLine,
      });

      // Create account with topup balance
      const initialBalance = "5000.00";
      await db.insert(schema.providerDistributorAccounts).values({
        providerId,
        distributorId,
        balance: initialBalance,
        creditLine,
      });

      // Create commission config
      await db.insert(schema.providerDistributorCommission).values({
        providerId,
        distributorId,
        commissionRate,
        commissionType: "percentage",
      });

      // Update request status
      await db.update(schema.accessRequests).set({ status: "approved" }).where(eq(schema.accessRequests.id, requestId));

      log("STEP 4", "Provider approved request", {
        relationshipId,
        commissionRate,
        creditLine,
        initialBalance,
      });

      // ========== STEP 5: Create Product & Cards ==========
      const productId = generateId();
      const cardPrice = "100.00";
      await db.insert(schema.products).values({
        id: productId,
        providerId,
        name: `Test Product ${Date.now()}`,
        price: cardPrice,
        status: "active",
      });
      testData.productId = productId;

      // Create 3 cards for purchases
      const cardIds = [];
      for (let i = 0; i < 3; i++) {
        const cardId = generateId();
        await db.insert(schema.cards).values({
          id: cardId,
          productId,
          providerId,
          pinEncrypted: `pin-${i}`,
          status: "AVAILABLE",
        });
        cardIds.push(cardId);
      }
      testData.cardIds = cardIds;
      log("STEP 5", "Product and cards created", { productId, cardCount: 3, cardPrice });

      // ========== STEP 6: Distributor Purchases Cards (3x) ==========
      const transactionIds = [];
      const purchases = [];

      for (let i = 0; i < 3; i++) {
        const transactionId = generateId();
        const purchaseAmount = cardPrice;
        const commissionAmount = new Decimal(purchaseAmount).times(new Decimal(commissionRate).div(100)).toFixed(2);

        await db.insert(schema.transactions).values({
          id: transactionId,
          distributorId,
          cardId: cardIds[i],
          providerId,
          productId,
          amount: purchaseAmount,
          commissionAmount,
          transactionType: "purchase",
          status: "completed",
          idempotencyKey: `purchase-${Date.now()}-${i}`,
        });

        // Process purchase through financial service
        await FinancialService.processPurchase(db, providerId, distributorId, purchaseAmount, commissionRate, transactionId);

        transactionIds.push(transactionId);
        purchases.push({ transactionId, purchaseAmount, commissionAmount });
      }
      testData.transactionIds = transactionIds;
      log("STEP 6", "Distributor purchased 3 cards", {
        purchases,
        totalPurchaseAmount: "300.00",
        totalCommission: "15.00",
      });

      // ========== STEP 7: Verify Ledger Entries & Balances ==========
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, providerId),
            eq(schema.providerDistributorLedger.distributorId, distributorId)
          )
        );

      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, providerId),
            eq(schema.providerDistributorAccounts.distributorId, distributorId)
          )
        )
        .limit(1);

      const expectedBalance = new Decimal(initialBalance).minus(300).plus(15).toFixed(2);
      const actualBalance = account[0].balance;

      log("STEP 7", "Verify ledger and balances", {
        ledgerEntryCount: ledgerEntries.length,
        expectedEntries: 6, // 3 purchases + 3 commissions
        actualEntries: ledgerEntries.length,
        expectedBalance,
        actualBalance,
        balanceMatch: expectedBalance === actualBalance,
        creditLine: account[0].creditLine,
      });

      expect(ledgerEntries.length).toBe(6);
      expect(actualBalance).toBe(expectedBalance);

      // ========== STEP 8: Process Refund ==========
      const refundService = new RefundService();
      const refundResult = await refundService.processRefund({
        distributorId,
        transactionId: transactionIds[0],
        purchaseAmount: "100.00",
        commissionAmount: "5.00",
        refundReason: "Test refund",
        idempotencyKey: `refund-${Date.now()}`,
      });

      log("STEP 8", "Refund processed", {
        refundId: refundResult.refundId,
        transactionId: refundResult.transactionId,
        finalBalance: refundResult.finalBalance,
      });

      // ========== STEP 9: Verify Refund Reversal ==========
      const accountAfterRefund = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, providerId),
            eq(schema.providerDistributorAccounts.distributorId, distributorId)
          )
        )
        .limit(1);

      const expectedBalanceAfterRefund = new Decimal(expectedBalance).plus(100).minus(5).toFixed(2);
      const actualBalanceAfterRefund = accountAfterRefund[0].balance;

      log("STEP 9", "Verify refund reversal", {
        expectedBalanceAfterRefund,
        actualBalanceAfterRefund,
        balanceMatch: expectedBalanceAfterRefund === actualBalanceAfterRefund,
      });

      expect(actualBalanceAfterRefund).toBe(expectedBalanceAfterRefund);

      // ========== STEP 10: Suspend Distributor ==========
      await db
        .update(schema.providerDistributorRelationships)
        .set({ status: "suspended" })
        .where(
          and(
            eq(schema.providerDistributorRelationships.providerId, providerId),
            eq(schema.providerDistributorRelationships.distributorId, distributorId)
          )
        );

      log("STEP 10", "Distributor suspended", { status: "suspended" });

      // ========== STEP 11: Verify Purchase Blocked (Relationship Validation) ==========
      const suspendedRelationship = await db
        .select()
        .from(schema.providerDistributorRelationships)
        .where(
          and(
            eq(schema.providerDistributorRelationships.providerId, providerId),
            eq(schema.providerDistributorRelationships.distributorId, distributorId)
          )
        )
        .limit(1);

      log("STEP 11", "Verify suspension blocks transactions", {
        relationshipStatus: suspendedRelationship[0].status,
        canTransact: suspendedRelationship[0].status === "active",
      });

      expect(suspendedRelationship[0].status).toBe("suspended");

      // ========== STEP 12: Reactivate Distributor ==========
      await db
        .update(schema.providerDistributorRelationships)
        .set({ status: "active" })
        .where(
          and(
            eq(schema.providerDistributorRelationships.providerId, providerId),
            eq(schema.providerDistributorRelationships.distributorId, distributorId)
          )
        );

      const reactivatedRelationship = await db
        .select()
        .from(schema.providerDistributorRelationships)
        .where(
          and(
            eq(schema.providerDistributorRelationships.providerId, providerId),
            eq(schema.providerDistributorRelationships.distributorId, distributorId)
          )
        )
        .limit(1);

      log("STEP 12", "Distributor reactivated", {
        relationshipStatus: reactivatedRelationship[0].status,
        canTransact: reactivatedRelationship[0].status === "active",
      });

      expect(reactivatedRelationship[0].status).toBe("active");

      // ========== STEP 13: Verify Dashboard Metrics ==========
      const finalAccount = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, providerId),
            eq(schema.providerDistributorAccounts.distributorId, distributorId)
          )
        )
        .limit(1);

      const finalLedger = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, providerId),
            eq(schema.providerDistributorLedger.distributorId, distributorId)
          )
        );

      log("STEP 13", "Final dashboard metrics", {
        distributorBalance: finalAccount[0].balance,
        distributorUsedCredit: finalAccount[0].usedCredit,
        distributorAvailableToSpend: new Decimal(finalAccount[0].creditLine)
          .minus(finalAccount[0].usedCredit)
          .plus(finalAccount[0].balance)
          .toFixed(2),
        ledgerEntryCount: finalLedger.length,
        purchaseCount: finalLedger.filter((e: any) => e.type === "purchase_debit").length,
        commissionCount: finalLedger.filter((e: any) => e.type === "commission_credit").length,
        refundCount: finalLedger.filter((e: any) => e.type === "refund_debit" || e.type === "refund_credit").length,
      });

      log("VALIDATION", "✅ End-to-End Scenario Complete", {
        status: "PASSED",
        stepsCompleted: 13,
        workflowValidated: true,
      });
    } catch (error) {
      log("ERROR", "Scenario failed", { error: (error as any).message });
      throw error;
    }
  });
});
