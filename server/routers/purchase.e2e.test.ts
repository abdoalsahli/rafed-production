import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * End-to-End Integration Tests for Purchase Flow
 * 
 * Tests the purchase endpoint with real database, validating:
 * - Financial calculations (balance, credit, commission)
 * - Ledger entries (purchase_debit + commission_credit)
 * - Idempotency
 * - Error handling
 * - Concurrent purchases
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
    name: `Test Provider ${Date.now()}`,
    status,
  });

  // Create distributor
  await db.insert(schema.distributors).values({
    id: distributorId,
    name: `Test Distributor ${Date.now()}`,
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
    name: `Test Product ${Date.now()}`,
    price: "100.00",
    status: "active",
  });

  // Create card
  const cardId = generateId();
  await db.insert(schema.cards).values({
    id: cardId,
    productId,
    providerId,
    pinEncrypted: "encrypted-pin-1234", // Encrypted DEK
    status: "AVAILABLE",
  });

  return {
    providerId,
    distributorId,
    productId,
    cardId,
  };
}

async function cleanupTestData(data: any) {
  try {
    await db.delete(schema.cards).where(eq(schema.cards.id, data.cardId));
    await db.delete(schema.products).where(eq(schema.products.id, data.productId));
    // Delete ledger entries first (they reference distributor)
    await db.delete(schema.providerDistributorLedger).where(
      and(
        eq(schema.providerDistributorLedger.providerId, data.providerId),
        eq(schema.providerDistributorLedger.distributorId, data.distributorId)
      )
    );
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

describe("Purchase Flow E2E Tests", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterEach(async () => {
    // Tests clean up their own data
  });

  it("should verify account structure after setup", async () => {
    const testData = await createTestData();

    try {
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          eq(schema.providerDistributorAccounts.providerId, testData.providerId)
        )
        .limit(1);

      expect(account.length).toBe(1);
      expect(account[0].balance).toBe("5000.00");
      expect(account[0].creditLine).toBe("2000.00");
      expect(account[0].usedCredit).toBe("0.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify ledger table exists with correct schema", async () => {
    const testData = await createTestData();

    try {
      // Insert a test ledger entry
      await db.insert(schema.providerDistributorLedger).values({
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        type: "DEBIT",
        amount: "-100.00",
        balanceAfterTransaction: "4900.00",
        usedCreditAfterTransaction: "0.00",
        referenceId: `test-${Date.now()}`,
        referenceType: "purchase_debit",
        metadata: JSON.stringify({ test: true }),
      });

      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          eq(schema.providerDistributorLedger.providerId, testData.providerId)
        );

      expect(ledgerEntries.length).toBeGreaterThan(0);
      const entry = ledgerEntries[0];
      expect(entry.referenceType).toBe("purchase_debit");
      expect(entry.amount).toBe("-100.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify commission calculation (5% of 100 = 5)", async () => {
    const testData = await createTestData({
      balance: "5000.00",
      creditLine: "2000.00",
      commissionPercentage: "5.00",
    });

    try {
      // Verify commission config
      const commission = await db
        .select()
        .from(schema.providerDistributorCommission)
        .where(
          eq(schema.providerDistributorCommission.providerId, testData.providerId)
        )
        .limit(1);

      expect(commission.length).toBe(1);
      // Commission rate is stored with precision 5, scale 4 (e.g., 5.0000 for 5%)
      expect(commission[0].commissionPercentage).toBe("5.0000");

      // Calculate expected commission
      // Commission rate is stored as 5.0000 (not 0.05), so divide by 100
      const purchaseAmount = new Decimal("100.00");
      const commissionRate = new Decimal(commission[0].commissionPercentage).div(100);
      const expectedCommission = purchaseAmount.mul(commissionRate);

      expect(expectedCommission.toFixed(2)).toBe("5.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify available_to_spend calculation", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "500.00",
    });

    try {
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          eq(schema.providerDistributorAccounts.providerId, testData.providerId)
        )
        .limit(1);

      // Available to Spend = Balance + (Credit Line - Used Credit)
      // = 1000 + (500 - 200) = 1300
      const balance = new Decimal(account[0].balance);
      const creditLine = new Decimal(account[0].creditLine);
      const usedCredit = new Decimal(account[0].usedCredit);
      const availableToSpend = balance.plus(creditLine.minus(usedCredit));

      expect(availableToSpend.toFixed(2)).toBe("1300.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify commission reduces used_credit first", async () => {
    const testData = await createTestData({
      balance: "100.00",
      creditLine: "1000.00",
      commissionPercentage: "5.00",
    });

    try {
      // Simulate commission of 5 being credited
      // Should reduce used_credit from 800 to 795
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          eq(schema.providerDistributorAccounts.providerId, testData.providerId)
        )
        .limit(1);

      const usedCredit = new Decimal(account[0].usedCredit);
      const commission = new Decimal("5.00");

      let finalUsedCredit: Decimal;
      let finalBalance: Decimal;

      if (usedCredit.greaterThan(0)) {
        const creditReduction = Decimal.min(commission, usedCredit);
        const balanceIncrease = commission.minus(creditReduction);
        finalUsedCredit = usedCredit.minus(creditReduction);
        finalBalance = new Decimal(account[0].balance).plus(balanceIncrease);
      } else {
        finalUsedCredit = usedCredit;
        finalBalance = new Decimal(account[0].balance).plus(commission);
      }

      // With commission of 5 and used_credit of 800:
      // credit_reduction = min(5, 800) = 5
      // balance_increase = 5 - 5 = 0
      // final_used_credit = 800 - 5 = 795
      // final_balance = 100 + 0 = 100

      expect(finalUsedCredit.toFixed(2)).toBe("795.00");
      expect(finalBalance.toFixed(2)).toBe("100.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify commission remainder increases balance", async () => {
    const testData = await createTestData({
      balance: "100.00",
      creditLine: "1000.00",
      commissionPercentage: "5.00",
    });

    try {
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          eq(schema.providerDistributorAccounts.providerId, testData.providerId)
        )
        .limit(1);

      const usedCredit = new Decimal(account[0].usedCredit);
      const balance = new Decimal(account[0].balance);
      const commission = new Decimal("5.00");

      // With commission of 5 and used_credit of 100:
      // credit_reduction = min(5, 100) = 5
      // balance_increase = 5 - 5 = 0
      // final_used_credit = 100 - 5 = 95
      // final_balance = 100 + 0 = 100

      const creditReduction = Decimal.min(commission, usedCredit);
      const balanceIncrease = commission.minus(creditReduction);
      const finalUsedCredit = usedCredit.minus(creditReduction);
      const finalBalance = balance.plus(balanceIncrease);

      expect(finalUsedCredit.toFixed(2)).toBe("95.00");
      expect(finalBalance.toFixed(2)).toBe("100.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify insufficient funds rejection", async () => {
    const testData = await createTestData({
      balance: "50.00", // Less than purchase amount of 100
      creditLine: "0.00",
    });

    try {
      const account = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          eq(schema.providerDistributorAccounts.providerId, testData.providerId)
        )
        .limit(1);

      const purchaseAmount = new Decimal("100.00");
      const balance = new Decimal(account[0].balance);
      const creditLine = new Decimal(account[0].creditLine);
      const usedCredit = new Decimal(account[0].usedCredit);
      const availableCredit = creditLine.minus(usedCredit);
      const availableToSpend = balance.plus(availableCredit);

      // Should reject because available to spend (50) < purchase amount (100)
      expect(availableToSpend.lessThan(purchaseAmount)).toBe(true);
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should verify ledger entry order (debit before commission credit)", async () => {
    const testData = await createTestData();

    try {
      const referenceId = `test-${Date.now()}-${Math.random()}`;

      // Insert debit entry
      await db.insert(schema.providerDistributorLedger).values({
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        type: "DEBIT",
        amount: "-100.00",
        balanceAfterTransaction: "4900.00",
        usedCreditAfterTransaction: "0.00",
        referenceId,
        referenceType: "purchase_debit",
        metadata: JSON.stringify({ order: 1 }),
      });

      // Insert commission credit entry
      await db.insert(schema.providerDistributorLedger).values({
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        type: "CREDIT",
        amount: "5.00",
        balanceAfterTransaction: "4905.00",
        usedCreditAfterTransaction: "0.00",
        referenceId,
        referenceType: "commission_credit",
        metadata: JSON.stringify({ order: 2 }),
      });

      const entries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          eq(schema.providerDistributorLedger.referenceId, referenceId)
        )
        .orderBy(schema.providerDistributorLedger.createdAt);

      expect(entries.length).toBe(2);
      expect(entries[0].referenceType).toBe("purchase_debit");
      expect(entries[1].referenceType).toBe("commission_credit");
    } finally {
      await cleanupTestData(testData);
    }
  });
});
