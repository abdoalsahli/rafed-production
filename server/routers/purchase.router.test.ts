import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { purchaseRouter } from "./purchase.router";
import { createCallerFactory } from "../_core/trpc";

/**
 * Integration Tests for Purchase Router
 * 
 * Tests the purchase endpoint with FinancialService integration
 */

let db: any;
let connection: any;

const createCallerFn = createCallerFactory(purchaseRouter);

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

async function createTestData() {
  const providerId = Math.floor(Math.random() * 1000000);
  const distributorId = Math.floor(Math.random() * 1000000);
  const productId = Math.floor(Math.random() * 1000000);

  // Create provider
  await db.insert(schema.serviceProviders).values({
    id: providerId,
    name: `Test Provider ${Date.now()}`,
    apiKey: `key-${Date.now()}-${Math.random()}`,
    status: "active",
  });

  // Create distributor
  await db.insert(schema.distributors).values({
    id: distributorId,
    userId: 1,
    businessName: `Test Distributor ${Date.now()}`,
    status: "active",
  });

  // Create provider-distributor account
  await db.insert(schema.providerDistributorAccounts).values({
    providerId,
    distributorId,
    balance: "5000.00",
    creditLine: "2000.00",
  });

  // Create commission config
  await db.insert(schema.providerDistributorCommission).values({
    providerId,
    distributorId,
    commissionPercentage: "5.00",
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
  const cardId = Math.floor(Math.random() * 1000000);
  await db.insert(schema.cards).values({
    id: cardId,
    productId,
    providerId,
    pin: "1234", // encrypted
    status: "available",
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
    // Delete in reverse order of dependencies
    await db.delete(schema.cards).where(schema.cards.id.eq(data.cardId));
    await db.delete(schema.products).where(schema.products.id.eq(data.productId));
    await db.delete(schema.providerDistributorCommission).where(
      schema.providerDistributorCommission.providerId.eq(data.providerId)
    );
    await db.delete(schema.providerDistributorAccounts).where(
      schema.providerDistributorAccounts.providerId.eq(data.providerId)
    );
    await db.delete(schema.distributors).where(schema.distributors.id.eq(data.distributorId));
    await db.delete(schema.serviceProviders).where(schema.serviceProviders.id.eq(data.providerId));
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

describe("Purchase Router", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterEach(async () => {
    // Tests will clean up their own data
  });

  it("should successfully purchase a card", async () => {
    const testData = await createTestData();
    const idempotencyKey = `key-${Date.now()}-${Math.random()}`;

    try {
      const caller = createCallerFn({
        user: {
          id: testData.distributorId,
          role: "user",
          openId: "test-user",
          name: "Test User",
          email: "test@example.com",
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      });

      const response = await caller.card({
        productId: testData.productId,
        idempotencyKey,
      });

      expect(response.success).toBe(true);
      expect(response.status).toBe("completed");
      expect(response.transactionId).toBeDefined();
      expect(response.pin).toBeDefined();
      expect(response.amount).toBe("100.00");
      expect(response.commission).toBe("5.00"); // 5% of 100
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should create two ledger entries (debit + commission credit)", async () => {
    const testData = await createTestData();
    const idempotencyKey = `key-${Date.now()}-${Math.random()}`;

    try {
      const caller = createCallerFn({
        user: {
          id: testData.distributorId,
          role: "user",
          openId: "test-user",
          name: "Test User",
          email: "test@example.com",
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      });

      await caller.card({
        productId: testData.productId,
        idempotencyKey,
      });

      // Verify ledger entries
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          schema.providerDistributorLedger.providerId.eq(testData.providerId)
        );

      expect(ledgerEntries.length).toBeGreaterThanOrEqual(2);

      const debitEntry = ledgerEntries.find(
        (e: any) => e.referenceType === "purchase_debit"
      );
      const creditEntry = ledgerEntries.find(
        (e: any) => e.referenceType === "commission_credit"
      );

      expect(debitEntry).toBeDefined();
      expect(creditEntry).toBeDefined();

      // Verify amounts
      expect(new Decimal(debitEntry.amount).toFixed(2)).toBe("-100.00");
      expect(new Decimal(creditEntry.amount).toFixed(2)).toBe("5.00");
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should reject purchase with insufficient balance", async () => {
    const testData = await createTestData();

    // Set balance to 0
    await db
      .update(schema.providerDistributorAccounts)
      .set({ balance: "0.00" })
      .where(
        schema.providerDistributorAccounts.providerId.eq(testData.providerId)
      );

    const idempotencyKey = `key-${Date.now()}-${Math.random()}`;

    try {
      const caller = createCallerFn({
        user: {
          id: testData.distributorId,
          role: "user",
          openId: "test-user",
          name: "Test User",
          email: "test@example.com",
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      });

      await expect(
        caller.card({
          productId: testData.productId,
          idempotencyKey,
        })
      ).rejects.toThrow();
    } finally {
      await cleanupTestData(testData);
    }
  });

  it("should handle idempotency correctly", async () => {
    const testData = await createTestData();
    const idempotencyKey = `key-${Date.now()}-${Math.random()}`;

    try {
      const caller = createCallerFn({
        user: {
          id: testData.distributorId,
          role: "user",
          openId: "test-user",
          name: "Test User",
          email: "test@example.com",
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: {} as any,
        res: {} as any,
      });

      // First purchase
      const response1 = await caller.card({
        productId: testData.productId,
        idempotencyKey,
      });

      // Second purchase with same idempotency key
      const response2 = await caller.card({
        productId: testData.productId,
        idempotencyKey,
      });

      // Should return same transaction ID
      expect(response1.transactionId).toBe(response2.transactionId);

      // Should only have one ledger entry set
      const ledgerEntries = await db
        .select()
        .from(schema.providerDistributorLedger)
        .where(
          schema.providerDistributorLedger.providerId.eq(testData.providerId)
        );

      // Should have exactly 2 entries (debit + credit), not 4
      expect(ledgerEntries.length).toBe(2);
    } finally {
      await cleanupTestData(testData);
    }
  });
});
