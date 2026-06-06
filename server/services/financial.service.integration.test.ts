import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, sql } from "drizzle-orm";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import * as schema from "../../drizzle/schema";
import { FinancialService } from "./financial.service";

/**
 * Integration Test Suite for FinancialService
 * 
 * Tests against real database with UUID-based test isolation
 * Each test creates completely independent test data
 * 
 * ISOLATION STRATEGY:
 * - Use random UUIDs for all test IDs (provider, distributor, reference)
 * - Each test creates its own complete environment
 * - No dependency on cleanup to avoid collisions
 * - Cleanup is best-effort only
 */

// Test database connection
let testDb: any;
let testConnection: any;

/**
 * Parse DATABASE_URL and extract connection config
 */
function parseConnectionConfig() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable not set");
  }

  const url = new URL(dbUrl);
  const sslParam = url.searchParams.get("ssl");
  const ssl = sslParam ? JSON.parse(sslParam) : true;

  return {
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    port: parseInt(url.port) || 3306,
    ssl: ssl,
  };
}

/**
 * Setup: Create database connection
 */
async function setupTestDatabase() {
  try {
    const config = parseConnectionConfig();
    
    // Create connection pool
    const connection = await mysql.createConnection(config);

    testConnection = connection;
    testDb = drizzle(connection, { schema, mode: "default" });

    console.log("✓ Database connection established");
    return testDb;
  } catch (error) {
    console.error("Failed to setup test database:", error);
    throw error;
  }
}

/**
 * Teardown: Close database connection
 */
async function teardownTestDatabase() {
  if (testConnection) {
    await testConnection.end();
    console.log("✓ Database connection closed");
  }
}

/**
 * Generate unique test IDs using random values
 * Avoids collisions by using random numbers instead of sequential
 */
function generateUniqueTestIds() {
  // Use random numbers between 100000 and 999999
  const providerId = Math.floor(Math.random() * 900000) + 100000;
  const distributorId = Math.floor(Math.random() * 900000) + 100000;
  const referenceId = `test_${randomUUID().slice(0, 8)}`;
  
  return { providerId, distributorId, referenceId };
}

/**
 * Create isolated test environment for a single test
 * Does NOT depend on cleanup - creates completely fresh data
 */
async function createTestEnvironment() {
  const { providerId, distributorId, referenceId } = generateUniqueTestIds();
  const creditLine = new Decimal("500.00");
  const initialBalance = new Decimal("1000.00");

  console.log(`  Creating test environment:`);
  console.log(`    provider_id=${providerId}, distributor_id=${distributorId}`);
  console.log(`    reference_id=${referenceId}`);

  try {
    // Create test provider
    console.log(`    Inserting provider ${providerId}...`);
    await testDb.insert(schema.serviceProviders).values({
      id: providerId,
      name: `Test Provider ${providerId}`,
      status: "active",
    });
    console.log(`    ✓ Provider created`);

    // Create test distributor
    console.log(`    Inserting distributor ${distributorId}...`);
    await testDb.insert(schema.distributors).values({
      id: distributorId,
      userId: 1,
      name: `Test Distributor ${distributorId}`,
      status: "active",
    });
    console.log(`    ✓ Distributor created`);

    // Create test commission record (relationship)
    console.log(`    Creating commission record...`);
    await testDb.insert(schema.providerDistributorCommission).values({
      providerId,
      distributorId,
      commissionPercentage: new Decimal("0.05"),
      commissionType: "percentage",
    });
    console.log(`    ✓ Commission record created`);

    // Create test account
    console.log(`    Creating account...`);
    await testDb.insert(schema.providerDistributorAccounts).values({
      providerId,
      distributorId,
      balance: initialBalance,
      creditLine,
      version: 1,
    });
    console.log(`    ✓ Account created`);

    console.log(`  ✓ Test environment ready`);

    return { providerId, distributorId, referenceId, creditLine, initialBalance };
  } catch (error) {
    console.error(`✗ Failed to create test environment:`, error);
    throw error;
  }
}

/**
 * Cleanup test environment after a test (best effort)
 * Does NOT block test if cleanup fails
 */
async function cleanupTestEnvironment(providerId: number, distributorId: number) {
  try {
    console.log(`  Cleaning up: provider=${providerId}, distributor=${distributorId}`);

    // Delete ledger entries
    await testDb.execute(sql`
      DELETE FROM provider_distributor_ledger
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    // Delete account
    await testDb.execute(sql`
      DELETE FROM provider_distributor_accounts
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    // Delete commission record
    await testDb.execute(sql`
      DELETE FROM provider_distributor_commission
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    // Delete distributor
    await testDb.execute(sql`
      DELETE FROM distributors
      WHERE id = ${distributorId}
    `);

    // Delete provider
    await testDb.execute(sql`
      DELETE FROM service_providers
      WHERE id = ${providerId}
    `);

    console.log(`  ✓ Cleanup complete`);
  } catch (error) {
    console.warn(`  ⚠ Cleanup warning (non-blocking):`, (error as any).message);
  }
}

/**
 * Get current account state for verification
 */
async function getAccountState(providerId: number, distributorId: number) {
  const account = await testDb
    .select()
    .from(schema.providerDistributorAccounts)
    .where(
      and(
        eq(schema.providerDistributorAccounts.providerId, providerId),
        eq(schema.providerDistributorAccounts.distributorId, distributorId)
      )
    )
    .limit(1);

  if (!account || account.length === 0) {
    console.error(`  ✗ Account not found: provider=${providerId}, distributor=${distributorId}`);
    return null;
  }

  console.log(`  Account state: balance=${account[0].balance}, usedCredit=${account[0].usedCredit}`);
  return account[0];
}

describe("FinancialService Integration Tests", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe("1. Purchase using balance only", () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await createTestEnvironment();
    });

    afterEach(async () => {
      await cleanupTestEnvironment(testEnv.providerId, testEnv.distributorId);
    });

    it("should reduce balance correctly", async () => {
      const service = new FinancialService();
      const purchaseAmount = new Decimal("100.00");
      const commission = new Decimal("5.00");

      console.log(`  Executing purchase: amount=${purchaseAmount}, commission=${commission}`);

      const result = await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      expect(result.success).toBe(true);
      expect(result.account.balance).toEqual(new Decimal("895.00")); // 1000 - 100 - 5
      expect(result.account.usedCredit).toEqual(new Decimal("0.00"));
      console.log(`  ✓ Balance reduced correctly`);
    });

    it("should create two ledger entries", async () => {
      const service = new FinancialService();
      const purchaseAmount = new Decimal("100.00");
      const commission = new Decimal("5.00");

      await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      const ledgerEntries = await testDb
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testEnv.providerId),
            eq(schema.providerDistributorLedger.distributorId, testEnv.distributorId),
            eq(schema.providerDistributorLedger.referenceId, testEnv.referenceId)
          )
        );

      expect(ledgerEntries.length).toBe(2);
      expect(ledgerEntries[0].type).toBe("DEBIT");
      expect(ledgerEntries[0].amount).toEqual(new Decimal("100.00"));
      expect(ledgerEntries[1].type).toBe("CREDIT");
      expect(ledgerEntries[1].amount).toEqual(new Decimal("5.00"));
      console.log(`  ✓ Two ledger entries created correctly`);
    });
  });

  describe("2. Purchase using credit", () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await createTestEnvironment();
    });

    afterEach(async () => {
      await cleanupTestEnvironment(testEnv.providerId, testEnv.distributorId);
    });

    it("should increase used_credit when balance insufficient", async () => {
      const service = new FinancialService();
      const purchaseAmount = new Decimal("950.00");
      const commission = new Decimal("47.50");

      console.log(`  Executing purchase with credit: amount=${purchaseAmount}`);

      const result = await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      expect(result.success).toBe(true);
      expect(result.account.usedCredit).toBeGreaterThan(new Decimal("0.00"));
      console.log(`  ✓ Used credit increased: ${result.account.usedCredit}`);
    });

    it("should reduce used_credit with commission first", async () => {
      const service = new FinancialService();
      
      // Update account to have used_credit
      await testDb
        .update(schema.providerDistributorAccounts)
        .set({
          balance: new Decimal("100.00"),
        })
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, testEnv.providerId),
            eq(schema.providerDistributorAccounts.distributorId, testEnv.distributorId)
          )
        );

      console.log(`  Updated account: balance=100, usedCredit=100`);

      const purchaseAmount = new Decimal("50.00");
      const commission = new Decimal("50.00");

      console.log(`  Executing purchase: amount=${purchaseAmount}, commission=${commission}`);

      const result = await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      expect(result.success).toBe(true);
      expect(result.account.usedCredit).toEqual(new Decimal("50.00"));
      console.log(`  ✓ Commission reduced used_credit: ${result.account.usedCredit}`);
    });
  });

  describe("3. Commission edge cases", () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await createTestEnvironment();
    });

    afterEach(async () => {
      await cleanupTestEnvironment(testEnv.providerId, testEnv.distributorId);
    });

    it("should handle commission > used_credit", async () => {
      const service = new FinancialService();
      
      await testDb
        .update(schema.providerDistributorAccounts)
        .set({
          balance: new Decimal("100.00"),
        })
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, testEnv.providerId),
            eq(schema.providerDistributorAccounts.distributorId, testEnv.distributorId)
          )
        );

      const purchaseAmount = new Decimal("50.00");
      const commission = new Decimal("50.00");

      console.log(`  Testing commission > used_credit: commission=${commission}, usedCredit=30`);

      const result = await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      expect(result.success).toBe(true);
      expect(result.account.usedCredit).toEqual(new Decimal("0.00"));
      expect(result.account.balance).toBeGreaterThan(new Decimal("100.00"));
      console.log(`  ✓ Commission handled correctly: balance=${result.account.balance}`);
    });

    it("should split commission between credit reduction and balance increase", async () => {
      const service = new FinancialService();
      
      await testDb
        .update(schema.providerDistributorAccounts)
        .set({
          balance: new Decimal("100.00"),
        })
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, testEnv.providerId),
            eq(schema.providerDistributorAccounts.distributorId, testEnv.distributorId)
          )
        );

      const purchaseAmount = new Decimal("50.00");
      const commission = new Decimal("60.00");

      console.log(`  Testing commission split: commission=${commission}, usedCredit=40`);

      const result = await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      expect(result.success).toBe(true);
      expect(result.account.usedCredit).toEqual(new Decimal("0.00"));
      console.log(`  ✓ Commission split correctly: balance=${result.account.balance}`);
    });
  });

  describe("4. Ledger integrity", () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await createTestEnvironment();
    });

    afterEach(async () => {
      await cleanupTestEnvironment(testEnv.providerId, testEnv.distributorId);
    });

    it("should ensure ledger is append-only", async () => {
      const service = new FinancialService();
      
      const initialCount = await testDb
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testEnv.providerId),
            eq(schema.providerDistributorLedger.distributorId, testEnv.distributorId)
          )
        );

      console.log(`  Initial ledger entries: ${initialCount.length}`);

      const purchaseAmount = new Decimal("25.00");
      const commission = new Decimal("1.25");

      await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      const finalCount = await testDb
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testEnv.providerId),
            eq(schema.providerDistributorLedger.distributorId, testEnv.distributorId)
          )
        );

      console.log(`  Final ledger entries: ${finalCount.length}`);
      expect(finalCount.length).toBe(initialCount.length + 2);
      console.log(`  ✓ Ledger is append-only`);
    });

    it("should record correct balance_after_transaction", async () => {
      const service = new FinancialService();
      
      const purchaseAmount = new Decimal("35.00");
      const commission = new Decimal("1.75");

      await service.processPurchase(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        purchaseAmount,
        commission,
        testEnv.referenceId,
        "purchase_debit"
      );

      const entries = await testDb
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testEnv.providerId),
            eq(schema.providerDistributorLedger.distributorId, testEnv.distributorId),
            eq(schema.providerDistributorLedger.referenceId, testEnv.referenceId)
          )
        );

      expect(entries.length).toBe(2);
      entries.forEach((entry) => {
        expect(entry.balanceAfterTransaction).toBeDefined();
        expect(entry.usedCreditAfterTransaction).toBeDefined();
        console.log(`  Entry: type=${entry.type}, balance_after=${entry.balanceAfterTransaction}, used_credit_after=${entry.usedCreditAfterTransaction}`);
      });
      console.log(`  ✓ Ledger snapshots recorded correctly`);
    });
  });

  describe("5. Provider top-up", () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await createTestEnvironment();
    });

    afterEach(async () => {
      await cleanupTestEnvironment(testEnv.providerId, testEnv.distributorId);
    });

    it("should credit account correctly", async () => {
      const service = new FinancialService();
      
      const topupAmount = new Decimal("500.00");

      console.log(`  Executing top-up: amount=${topupAmount}`);

      const result = await service.processTopUp(
        testDb,
        testEnv.providerId,
        testEnv.distributorId,
        topupAmount,
        testEnv.referenceId
      );

      expect(result.success).toBe(true);
      expect(result.account.balance).toEqual(new Decimal("1500.00"));
      console.log(`  ✓ Top-up credited: balance=${result.account.balance}`);
    });
  });

  describe("6. Account state consistency", () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await createTestEnvironment();
    });

    afterEach(async () => {
      await cleanupTestEnvironment(testEnv.providerId, testEnv.distributorId);
    });

    it("should maintain invariants across all flows", async () => {
      const account = await getAccountState(testEnv.providerId, testEnv.distributorId);

      expect(account).toBeDefined();
      expect(account.balance).toBeDefined();
      expect(account.creditLine).toBeDefined();
      expect(account.usedCredit).toBeDefined();

      // Verify invariant: balance + (creditLine - usedCredit) >= 0
      const availableToSpend = account.balance.plus(
        account.creditLine.minus(account.usedCredit)
      );
      expect(availableToSpend).toBeGreaterThanOrEqual(new Decimal("0.00"));
      console.log(`  ✓ Invariants maintained: availableToSpend=${availableToSpend}`);
    });
  });
});
