import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FinancialService } from "./financial.service";
import { Decimal } from "decimal.js";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";

/**
 * Top-Up Settlement Tests
 * 
 * Validates automatic settlement logic:
 * - Case A: usedCredit > topUp (partial settlement)
 * - Case B: usedCredit > 0 and topUp > usedCredit (full settlement + balance increase)
 * - Case C: usedCredit = 0 (full topUp to balance)
 */

let db: any;
let connection: any;

async function setupDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  connection = await mysql.createConnection(url);
  db = drizzle(connection);
}

async function teardownDatabase() {
  if (connection) await connection.end();
}

async function createTestData() {
  const provider = await db
    .insert(schema.serviceProviders)
    .values({
      name: "Test Provider",
      providerCode: `PROV-${Date.now()}`,
      status: "active",
    });

  const distributor = await db
    .insert(schema.distributors)
    .values({
      name: "Test Distributor",
      status: "active",
    });

  const account = await db
    .insert(schema.providerDistributorAccounts)
    .values({
      providerId: provider[0],
      distributorId: distributor[0],
      balance: "1000.00",
      creditLine: "2000.00",
    });

  return {
    providerId: provider[0],
    distributorId: distributor[0],
    accountId: account[0],
  };
}

async function cleanupTestData(testData: any) {
  await db
    .delete(schema.providerDistributorLedger)
    .where(
      and(
        eq(schema.providerDistributorLedger.providerId, testData.providerId),
        eq(schema.providerDistributorLedger.distributorId, testData.distributorId)
      )
    );

  await db
    .delete(schema.providerDistributorAccounts)
    .where(eq(schema.providerDistributorAccounts.id, testData.accountId));

  await db
    .delete(schema.distributors)
    .where(eq(schema.distributors.id, testData.distributorId));

  await db
    .delete(schema.serviceProviders)
    .where(eq(schema.serviceProviders.id, testData.providerId));
}

describe("Top-Up Settlement Logic", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it("Case A: usedCredit > topUp (partial settlement)", async () => {
    const testData = await createTestData();

    try {
      // Setup: balance = 1000, usedCredit = 1500, topUp = 500
      await db
        .update(schema.providerDistributorAccounts)
        .set({
          balance: "1000.00",
        })
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId));

      // Execute top-up
      const result = await FinancialService.processTopUp(
        db,
        testData.providerId,
        testData.distributorId,
        "500.00",
        `payment-${Date.now()}`
      );

      // Expected: usedCredit = 1000, balance = 1000
      expect(result.newUsedCredit.toFixed(2)).toBe("1000.00");
      expect(result.newBalance.toFixed(2)).toBe("1000.00");

      // Verify in database
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId))
        .limit(1);

      expect(account[0].balance).toBe("1000.00");
      expect(account[0].usedCredit).toBe("1000.00");

      // Verify ledger entry
      const ledger = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testData.providerId),
            eq(schema.providerDistributorLedger.referenceType, "topup")
          )
        )
        .limit(1);

      expect(ledger[0]).toBeDefined();
      const metadata = JSON.parse(ledger[0].metadata);
      expect(metadata.originalBalance).toBe("1000.00");
      expect(metadata.originalUsedCredit).toBe("1500.00");
      expect(metadata.amountAppliedToUsedCredit).toBe("500.00");
      expect(metadata.amountAddedToBalance).toBe("0.00");
      expect(metadata.finalBalance).toBe("1000.00");
      expect(metadata.finalUsedCredit).toBe("1000.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("Case B: usedCredit > 0 and topUp > usedCredit (full settlement + balance increase)", async () => {
    const testData = await createTestData();

    try {
      // Setup: balance = 1000, usedCredit = 1500, topUp = 2000
      await db
        .update(schema.providerDistributorAccounts)
        .set({
          balance: "1000.00",
        })
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId));

      // Execute top-up
      const result = await FinancialService.processTopUp(
        db,
        testData.providerId,
        testData.distributorId,
        "2000.00",
        `payment-${Date.now()}`
      );

      // Expected: usedCredit = 0, balance = 1500
      expect(result.newUsedCredit.toFixed(2)).toBe("0.00");
      expect(result.newBalance.toFixed(2)).toBe("1500.00");

      // Verify in database
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId))
        .limit(1);

      expect(account[0].balance).toBe("1500.00");
      expect(account[0].usedCredit).toBe("0.00");

      // Verify ledger entry
      const ledger = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testData.providerId),
            eq(schema.providerDistributorLedger.referenceType, "topup")
          )
        )
        .limit(1);

      expect(ledger[0]).toBeDefined();
      const metadata = JSON.parse(ledger[0].metadata);
      expect(metadata.originalBalance).toBe("1000.00");
      expect(metadata.originalUsedCredit).toBe("1500.00");
      expect(metadata.amountAppliedToUsedCredit).toBe("1500.00");
      expect(metadata.amountAddedToBalance).toBe("500.00");
      expect(metadata.finalBalance).toBe("1500.00");
      expect(metadata.finalUsedCredit).toBe("0.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("Case C: usedCredit = 0 (full topUp to balance)", async () => {
    const testData = await createTestData();

    try {
      // Setup: balance = 1000, usedCredit = 0, topUp = 500
      await db
        .update(schema.providerDistributorAccounts)
        .set({
          balance: "1000.00",
        })
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId));

      // Execute top-up
      const result = await FinancialService.processTopUp(
        db,
        testData.providerId,
        testData.distributorId,
        "500.00",
        `payment-${Date.now()}`
      );

      // Expected: usedCredit = 0, balance = 1500
      expect(result.newUsedCredit.toFixed(2)).toBe("0.00");
      expect(result.newBalance.toFixed(2)).toBe("1500.00");

      // Verify in database
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId))
        .limit(1);

      expect(account[0].balance).toBe("1500.00");
      expect(account[0].usedCredit).toBe("0.00");

      // Verify ledger entry
      const ledger = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testData.providerId),
            eq(schema.providerDistributorLedger.referenceType, "topup")
          )
        )
        .limit(1);

      expect(ledger[0]).toBeDefined();
      const metadata = JSON.parse(ledger[0].metadata);
      expect(metadata.originalBalance).toBe("1000.00");
      expect(metadata.originalUsedCredit).toBe("0.00");
      expect(metadata.amountAppliedToUsedCredit).toBe("0.00");
      expect(metadata.amountAddedToBalance).toBe("500.00");
      expect(metadata.finalBalance).toBe("1500.00");
      expect(metadata.finalUsedCredit).toBe("0.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should update ledger with settlement metadata", async () => {
    const testData = await createTestData();

    try {
      // Setup: balance = 1000, usedCredit = 1500
      await db
        .update(schema.providerDistributorAccounts)
        .set({
          balance: "1000.00",
        })
        .where(eq(schema.providerDistributorAccounts.id, testData.accountId));

      // Execute top-up
      const paymentId = `payment-${Date.now()}`;
      await FinancialService.processTopUp(
        db,
        testData.providerId,
        testData.distributorId,
        "2000.00",
        paymentId
      );

      // Verify ledger entry includes all settlement metadata
      const ledger = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testData.providerId),
            eq(schema.providerDistributorLedger.referenceId, paymentId)
          )
        )
        .limit(1);

      expect(ledger[0]).toBeDefined();
      const metadata = JSON.parse(ledger[0].metadata);

      // Verify all required settlement fields
      expect(metadata).toHaveProperty("originalBalance");
      expect(metadata).toHaveProperty("originalUsedCredit");
      expect(metadata).toHaveProperty("topupAmount");
      expect(metadata).toHaveProperty("amountAppliedToUsedCredit");
      expect(metadata).toHaveProperty("amountAddedToBalance");
      expect(metadata).toHaveProperty("finalBalance");
      expect(metadata).toHaveProperty("finalUsedCredit");

      // Verify state tracking
      expect(ledger[0].balanceAfterTransaction).toBe("1500.00");
      expect(ledger[0].usedCreditAfterTransaction).toBe("0.00");
    } finally {
      await cleanupTestData(testData);
    }
  });
});
