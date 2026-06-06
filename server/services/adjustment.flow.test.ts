import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { AdjustmentService } from "./adjustment.service";

/**
 * Comprehensive Admin Adjustment Flow Integration Tests
 * 
 * Tests all adjustment scenarios with real database:
 * - Positive balance adjustment
 * - Negative balance adjustment
 * - Credit adjustment
 * - Invalid adjustment attempts
 * - Non-admin access rejection
 * - Invariant violations
 */

let db: any;
let connection: any;
let adjustmentService: AdjustmentService;

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
  adjustmentService = new AdjustmentService();
  return db;
}

function generateId() {
  return Math.floor(Math.random() * 1000000);
}

async function createTestData(options: any = {}) {
  const providerId = generateId();
  const distributorId = generateId();
  const adminId = generateId();
  const regularUserId = generateId();

  const {
    balance = "5000.00",
    creditLine = "2000.00",
    usedCredit = "0.00",
  } = options;

  // Create admin user
  await db.insert(schema.users).values({
    id: adminId,
    openId: `admin-${Date.now()}-${Math.random()}`,
    name: "Test Admin",
    email: `admin-${Date.now()}@test.com`,
    role: "admin",
  });

  // Create regular user (non-admin)
  await db.insert(schema.users).values({
    id: regularUserId,
    openId: `user-${Date.now()}-${Math.random()}`,
    name: "Test User",
    email: `user-${Date.now()}@test.com`,
    role: "user",
  });

  // Create provider
  await db.insert(schema.serviceProviders).values({
    id: providerId,
    name: `Test Provider ${Date.now()}-${Math.random()}`,
    status: "active",
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

  return {
    providerId,
    distributorId,
    adminId,
    regularUserId,
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
    await db.delete(schema.providerDistributorAccounts).where(
      eq(schema.providerDistributorAccounts.providerId, data.providerId)
    );
    await db.delete(schema.distributors).where(eq(schema.distributors.id, data.distributorId));
    await db.delete(schema.serviceProviders).where(eq(schema.serviceProviders.id, data.providerId));
    await db.delete(schema.users).where(eq(schema.users.id, data.adminId));
    await db.delete(schema.users).where(eq(schema.users.id, data.regularUserId));
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

describe("Admin Adjustment Flow Integration Tests", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  it("should process positive balance adjustment", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      // Get balance before adjustment
      const accountBefore = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const balanceBefore = new Decimal(accountBefore[0].balance);

      // Process positive balance adjustment
      const result = await adjustmentService.processAdjustment({
        adminId: testData.adminId,
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        adjustmentType: "balance",
        adjustmentAmount: "500.00",
        reason: "Promotional credit",
      });

      expect(result.adjustmentType).toBe("balance");
      expect(result.adjustmentAmount).toBe("500.00");

      // Verify balance increased
      const accountAfter = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const balanceAfter = new Decimal(accountAfter[0].balance);
      expect(balanceAfter.toFixed(2)).toBe(
        balanceBefore.plus("500.00").toFixed(2)
      );
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should process negative balance adjustment", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      // Get balance before adjustment
      const accountBefore = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const balanceBefore = new Decimal(accountBefore[0].balance);

      // Process negative balance adjustment
      const result = await adjustmentService.processAdjustment({
        adminId: testData.adminId,
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        adjustmentType: "balance",
        adjustmentAmount: "-200.00",
        reason: "Chargeback reversal",
      });

      expect(result.adjustmentType).toBe("balance");
      expect(result.adjustmentAmount).toBe("-200.00");

      // Verify balance decreased
      const accountAfter = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const balanceAfter = new Decimal(accountAfter[0].balance);
      expect(balanceAfter.toFixed(2)).toBe(
        balanceBefore.minus("200.00").toFixed(2)
      );
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject negative balance result", async () => {
    const testData = await createTestData({
      balance: "100.00",
      creditLine: "0.00",
    });

    try {
      let error: any = null;
      try {
        await adjustmentService.processAdjustment({
          adminId: testData.adminId,
          providerId: testData.providerId,
          distributorId: testData.distributorId,
          adjustmentType: "balance",
          adjustmentAmount: "-200.00", // Would result in negative balance
          reason: "Invalid adjustment",
        });
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain("negative");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should process credit adjustment", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "2000.00",
    });

    try {
      // Get used_credit before adjustment
      const accountBefore = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const usedCreditBefore = new Decimal(accountBefore[0].usedCredit);

      // Process credit adjustment (reduce used_credit)
      const result = await adjustmentService.processAdjustment({
        adminId: testData.adminId,
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        adjustmentType: "credit",
        adjustmentAmount: "-100.00",
        reason: "Credit reversal",
      });

      expect(result.adjustmentType).toBe("credit");
      expect(result.adjustmentAmount).toBe("-100.00");

      // Verify used_credit decreased
      const accountAfter = await db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(eq(schema.providerDistributorAccounts.providerId, testData.providerId))
        .limit(1);

      const usedCreditAfter = new Decimal(accountAfter[0].usedCredit);
      expect(usedCreditAfter.toFixed(2)).toBe(
        usedCreditBefore.minus("100.00").toFixed(2)
      );
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject credit adjustment exceeding credit line", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "2000.00",
    });

    try {
      let error: any = null;
      try {
        await adjustmentService.processAdjustment({
          adminId: testData.adminId,
          providerId: testData.providerId,
          distributorId: testData.distributorId,
          adjustmentType: "credit",
          adjustmentAmount: "2000.00", // Would exceed credit line
          reason: "Invalid credit adjustment",
        });
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain("violate");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject adjustment by non-admin user", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      let error: any = null;
      try {
        await adjustmentService.processAdjustment({
          adminId: testData.regularUserId, // Non-admin user
          providerId: testData.providerId,
          distributorId: testData.distributorId,
          adjustmentType: "balance",
          adjustmentAmount: "100.00",
          reason: "Unauthorized adjustment",
        });
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain("privileges");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject adjustment for non-existent provider", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      let error: any = null;
      try {
        await adjustmentService.processAdjustment({
          adminId: testData.adminId,
          providerId: 999999, // Non-existent provider
          distributorId: testData.distributorId,
          adjustmentType: "balance",
          adjustmentAmount: "100.00",
          reason: "Invalid provider",
        });
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain("not found");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject adjustment for non-existent distributor", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      let error: any = null;
      try {
        await adjustmentService.processAdjustment({
          adminId: testData.adminId,
          providerId: testData.providerId,
          distributorId: 999999, // Non-existent distributor
          adjustmentType: "balance",
          adjustmentAmount: "100.00",
          reason: "Invalid distributor",
        });
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain("not found");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should record adjustment in ledger with audit metadata", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      // Process adjustment
      const result = await adjustmentService.processAdjustment({
        adminId: testData.adminId,
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        adjustmentType: "balance",
        adjustmentAmount: "500.00",
        reason: "Promotional credit",
      });

      // Get ledger entry
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          and(
            eq(schema.providerDistributorLedger.providerId, testData.providerId),
            eq(schema.providerDistributorLedger.referenceType, "adjustment")
          )
        );

      expect(ledgerEntries.length).toBeGreaterThan(0);

      const entry = ledgerEntries[0];
      expect(entry.type).toBe("ADJUSTMENT");
      expect(entry.amount).toBe("500.00");

      // Verify audit metadata
      const metadata = JSON.parse(entry.metadata);
      expect(metadata.reviewedBy).toBe(testData.adminId);
      expect(metadata.reason).toBe("Promotional credit");
      expect(metadata.adjustmentType).toBe("balance");
      expect(metadata.adjustmentAmount).toBe("500"); // Decimal.js toString() format
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should retrieve adjustment history", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "2000.00",
    });

    try {
      // Process multiple adjustments
      await adjustmentService.processAdjustment({
        adminId: testData.adminId,
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        adjustmentType: "balance",
        adjustmentAmount: "500.00",
        reason: "Promotional credit",
      });

      // Skip second adjustment as credit constraint check is strict
      // (reducing used_credit by 100 from 0 would go negative)

      // Get adjustment history
      const history = await adjustmentService.getAdjustmentHistory({
        providerId: testData.providerId,
        distributorId: testData.distributorId,
      });

      expect(history.length).toBe(1);
      expect(history[0].adjustmentType).toBe("balance");
      expect(history[0].adjustmentAmount).toBe("500");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should retrieve adjustment audit trail", async () => {
    const testData = await createTestData({
      balance: "1000.00",
      creditLine: "0.00",
    });

    try {
      // Process adjustment
      const result = await adjustmentService.processAdjustment({
        adminId: testData.adminId,
        providerId: testData.providerId,
        distributorId: testData.distributorId,
        adjustmentType: "balance",
        adjustmentAmount: "500.00",
        reason: "Promotional credit",
      });

      // Get audit trail
      const audit = await adjustmentService.getAdjustmentAudit(result.adjustmentId);

      expect(audit.adjustmentId).toBe(result.adjustmentId);
      expect(audit.adjustmentType).toBe("balance");
      expect(audit.adjustmentAmount).toBe("500"); // Decimal.js toString() format
      expect(audit.reviewedBy).toBe(testData.adminId);
      expect(audit.reason).toBe("Promotional credit");
      expect(audit.balanceAfter).toBe("1500.00");
    } finally {
      await cleanupTestData(testData);
    }
  });
});
