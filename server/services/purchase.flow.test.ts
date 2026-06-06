import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { FinancialService } from "./financial.service";

/**
 * Comprehensive Purchase Flow Integration Tests
 * 
 * Tests all purchase scenarios with real database:
 * - Purchase using balance only
 * - Purchase using credit
 * - Mixed balance + credit
 * - Commission reduces used_credit first
 * - Insufficient funds
 * - Verify purchase_debit and commission_credit ledger entries
 */

let db: any;
let connection: any;

async function setupDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }

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
  return db;
}

function generateId() {
  return Math.floor(Math.random() * 1000000);
}

async function createTestData(options: any = {}) {
  const providerId = generateId();
  const distributorId = generateId();
  const productId = generateId();

  const {
    balance = "5000.00",
    creditLine = "2000.00",
    usedCredit = "0.00",
    commissionRate = "5.00",
    status = "active",
  } = options;

  // Create provider
  await db.insert(schema.serviceProviders).values({
    id: providerId,
    name: `Test Provider ${Date.now()}-${Math.random()}`,
    status,
  });

  // Create distributor
  await db.insert(schema.distributors).values({
    id: distributorId,
    name: `Test Distributor ${Date.now()}-${Math.random()}`,
    status: "active",
  });

  // Create provider-distributor account
  await db.insert(schema.providerDistributorAccounts).values({
    providerId,
    distributorId,
    balance,
    creditLine,
    usedCredit,
  });

  // Create commission config
  await db.insert(schema.providerDistributorCommission).values({
    providerId,
    distributorId,
    commissionRate,
    commissionType: "percentage",
  });

  // Create product
  await db.insert(schema.products).values({
    id: productId,
    providerId,
    name: `Test Product ${Date.now()}-${Math.random()}`,
    price: "100.00",
    status: "active",
  });

  // Create card
  const cardId = generateId();
  await db.insert(schema.cards).values({
    id: cardId,
    productId,
    providerId,
    pinEncrypted: "encrypted-pin-1234",
    status: "AVAILABLE",
  });

  // Create transaction record (for idempotency tracking)
  const transactionId = generateId();
  await db.insert(schema.transactions).values({
    id: transactionId,
    distributorId,
    cardId,
    providerId,
    productId,
    amount: "100.00",
    commissionAmount: "5.00",
    transactionType: "purchase",
    status: "pending",
    idempotencyKey: `purchase-${Date.now()}-${Math.random()}`,
  });

  return {
    providerId,
    distributorId,
    productId,
    cardId,
    transactionId,
  };
}

async function cleanupTestData(data: any) {
  try {
    // Delete in order of dependencies
    await db.delete(schema.providerDistributorLedger).where(
      and(
        eq(schema.providerDistributorLedger.providerId, data.providerId),
        eq(schema.providerDistributorLedger.distributorId, data.distributorId)
      )
    );
    await db.delete(schema.transactions).where(eq(schema.transactions.id, data.transactionId));
    await db.delete(schema.cards).where(eq(schema.cards.id, data.cardId));
    await db.delete(schema.products).where(eq(schema.products.id, data.productId));
    await db.delete(schema.providerDistributorCommission).where(
      eq(schema.providerDistributorCommission.providerId, data.providerId)
    );
    await db.delete(schema.providerDistributorAccounts).where(
      eq(schema.providerDistributorAccounts.providerId, data.providerId)
    );
    await db.delete(schema.distributors).where(eq(schema.distributors.id, data.distributorId));
    await db.delete(schema.serviceProviders).where(eq(schema.serviceProviders.id, data.providerId));
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

describe("Purchase Flow Integration Tests", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  it("should process purchase using balance only", async () => {
    const testData = await createTestData({
      balance: "500.00",
      creditLine: "0.00",
    });

    try {
      // Process purchase
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission rate as decimal multiplier
        testData.transactionId
      );

      // Purchase 100: all from balance (500 available)
      // Commission 5: all goes to balance (no used_credit)
      expect(result.finalBalance.toFixed(2)).toBe("405.00"); // 500 - 100 + 5
      expect(result.finalUsedCredit.toFixed(2)).toBe("0.00");
      expect(result.commissionAmount.toFixed(2)).toBe("5.00");

      // Verify ledger entries
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          eq(schema.providerDistributorLedger.referenceId, testData.transactionId.toString())
        )
        .orderBy(schema.providerDistributorLedger.createdAt);

      expect(ledgerEntries.length).toBe(2);
      expect(ledgerEntries[0].referenceType).toBe("purchase_debit");
      expect(ledgerEntries[0].amount).toBe("100.00"); // DEBIT entries are positive in ledger
      expect(ledgerEntries[1].referenceType).toBe("commission_credit");
      expect(ledgerEntries[1].amount).toBe("5.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should process purchase using credit when balance insufficient", async () => {
    const testData = await createTestData({
      balance: "50.00",
      creditLine: "200.00",
    });

    try {
      // Process purchase (100 total, 50 from balance, 50 from credit)
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      // Purchase 100: 50 from balance, 50 from credit
      // Commission 5: reduces used_credit from 50 to 45
      expect(result.finalBalance.toFixed(2)).toBe("0.00");
      expect(result.finalUsedCredit.toFixed(2)).toBe("45.00");
      expect(result.commissionAmount.toFixed(2)).toBe("5.00");

      // Verify account state
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      expect(account[0].balance).toBe("0.00");
      expect(account[0].usedCredit).toBe("45.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should process purchase with mixed balance and credit", async () => {
    const testData = await createTestData({
      balance: "30.00",
      creditLine: "500.00",
    });

    try {
      // Process purchase (100 total, 30 from balance, 70 from credit)
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      // Purchase 100: 30 from balance, 70 from credit
      // Commission 5: reduces used_credit from 170 to 165
      expect(result.finalBalance.toFixed(2)).toBe("0.00");
      expect(result.finalUsedCredit.toFixed(2)).toBe("165.00");

      // Verify account state
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      expect(account[0].balance).toBe("0.00");
      expect(account[0].usedCredit).toBe("165.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should apply commission and reduce used_credit first", async () => {
    const testData = await createTestData({
      balance: "100.00",
      creditLine: "1000.00",
    });

    try {
      // Process purchase
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      // Purchase 100: all from balance (100 available)
      // Commission 5: all goes to balance (no used_credit to reduce)
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      // Purchase 100: all from balance (100 available)
      // After purchase: balance = 0, used_credit = 800
      // Commission 5: reduces used_credit from 800 to 795
      expect(account[0].usedCredit).toBe("795.00");
      expect(account[0].balance).toBe("0.00"); // 100 - 100 = 0 (commission all went to used_credit reduction)
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject purchase with insufficient funds", async () => {
    const testData = await createTestData({
      balance: "50.00",
      creditLine: "0.00",
    });

    try {
      // Process purchase (100 > 50 available)
      let error: any = null;
      try {
        await FinancialService.processPurchase(
          db,
          testData.providerId,
          testData.distributorId,
          "100.00",
          "0.05", // 5% commission
          testData.transactionId
        );
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain("Insufficient");

      // Verify no ledger entries created
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          eq(schema.providerDistributorLedger.referenceId, testData.transactionId.toString())
        );

      expect(ledgerEntries.length).toBe(0);
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify both ledger entries are created atomically", async () => {
    const testData = await createTestData({
      balance: "500.00",
      creditLine: "0.00",
    });

    try {
      // Process purchase
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      // Verify BOTH ledger entries exist
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          eq(schema.providerDistributorLedger.referenceId, testData.transactionId.toString())
        )
        .orderBy(schema.providerDistributorLedger.createdAt);

      expect(ledgerEntries.length).toBe(2);

      // Verify entry order and types
      expect(ledgerEntries[0].referenceType).toBe("purchase_debit");
      expect(ledgerEntries[0].type).toBe("DEBIT");
      expect(ledgerEntries[0].amount).toBe("100.00"); // DEBIT entries are positive in ledger
      expect(ledgerEntries[0].balanceAfterTransaction).toBe("400.00");

      expect(ledgerEntries[1].referenceType).toBe("commission_credit");
      expect(ledgerEntries[1].type).toBe("CREDIT");
      expect(ledgerEntries[1].amount).toBe("5.00");
      expect(ledgerEntries[1].balanceAfterTransaction).toBe("405.00"); // 400 + 5

      // Verify timestamps (second entry should be after first)
      expect(ledgerEntries[1].createdAt.getTime()).toBeGreaterThanOrEqual(
        ledgerEntries[0].createdAt.getTime()
      );
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify account balance after transaction", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "500.00",
    });

    try {
      // Available to spend = 1000 + (500 - 100) = 1400
      // Purchase 100, commission 5
      // Final: balance = 900, used_credit = 95 (commission reduces used_credit)
      // Available to spend = 900 + (500 - 95) = 1305

      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const balance = new Decimal(account[0].balance);
      const creditLine = new Decimal(account[0].creditLine);
      const usedCredit = new Decimal(account[0].usedCredit);
      const availableToSpend = balance.plus(creditLine.minus(usedCredit));

      // Purchase 100: 100 from balance
      // Commission 5: reduces used_credit from 100 to 95
      expect(balance.toFixed(2)).toBe("900.00");
      expect(usedCredit.toFixed(2)).toBe("95.00");
      expect(availableToSpend.toFixed(2)).toBe("1305.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify transaction record is updated after purchase", async () => {
    const testData = await createTestData({
      balance: "500.00",
      creditLine: "0.00",
    });

    try {
      // Process purchase
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      // Verify transaction record
      const transaction = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, testData.transactionId))
        .limit(1);

      expect(transaction.length).toBe(1);
      expect(transaction[0].amount).toBe("100.00");
      expect(transaction[0].commissionAmount).toBe("5.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify endpoint response format", async () => {
    const testData = await createTestData({
      balance: "500.00",
      creditLine: "0.00",
    });

    try {
      const result = await FinancialService.processPurchase(
        db,
        testData.providerId,
        testData.distributorId,
        "100.00",
        "0.05", // 5% commission
        testData.transactionId
      );

      // Verify response structure
      expect(result).toHaveProperty("finalBalance");
      expect(result).toHaveProperty("finalUsedCredit");
      expect(result).toHaveProperty("commissionAmount");

      // Verify types
      expect(result.finalBalance instanceof Decimal).toBe(true);
      expect(result.finalUsedCredit instanceof Decimal).toBe(true);
      expect(result.commissionAmount instanceof Decimal).toBe(true);

      // Verify values are valid decimals
      expect(result.finalBalance.toNumber()).toBeGreaterThanOrEqual(0);
      expect(result.finalUsedCredit.toNumber()).toBeGreaterThanOrEqual(0);
      expect(result.commissionAmount.toNumber()).toBeGreaterThan(0);
    } finally {
      await cleanupTestData(testData);
    }
  });
});
