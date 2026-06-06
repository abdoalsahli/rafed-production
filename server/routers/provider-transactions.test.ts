import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import { transactions, distributors, products, serviceProviders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Provider Transactions Router", () => {
  let db: any;
  let providerId: number;
  let distributorId: number;
  let productId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    // Create test data
    const providerResult = await db
      .insert(serviceProviders)
      .values({
        name: "Test Provider",
        providerCode: `TEST-${Date.now()}`,
        status: "active",
      });
    providerId = providerResult[0]?.insertId || 1;

    const distributorResult = await db
      .insert(distributors)
      .values({
        name: "Test Distributor",
        status: "active",
      });
    distributorId = distributorResult[0]?.insertId || 1;

    const productResult = await db
      .insert(products)
      .values({
        providerId,
        name: "Test Product",
        displayName: "Test Product Display",
        faceValue: "100.00",
        currency: "USD",
        price: "100.00",
        status: "active",
      });
    productId = productResult[0]?.insertId || 1;
  });

  afterAll(async () => {
    if (db) {
      // Clean up test data
      await db.delete(transactions).where(eq(transactions.providerId, providerId));
      await db.delete(products).where(eq(products.providerId, providerId));
      await db.delete(distributors).where(eq(distributors.id, distributorId));
      await db.delete(serviceProviders).where(eq(serviceProviders.id, providerId));
    }
  });

  it("should fetch provider transactions with pagination", async () => {
    // Insert test transaction
    await db.insert(transactions).values({
      idempotencyKey: `TEST-TXN-${Date.now()}`,
      distributorId,
      providerId,
      productId,
      cardId: 1,
      amount: "100.00",
      commissionAmount: "10.00",
      transactionType: "purchase",
      status: "completed",
    });

    // Query transactions
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.providerId, providerId))
      .limit(20);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].providerId).toBe(providerId);
    expect(result[0].status).toBe("completed");
  });

  it("should filter transactions by status", async () => {
    // Insert test transactions with different statuses
    await db.insert(transactions).values({
      idempotencyKey: `TEST-PENDING-${Date.now()}`,
      distributorId,
      providerId,
      productId,
      cardId: 1,
      amount: "50.00",
      commissionAmount: "5.00",
      transactionType: "purchase",
      status: "pending",
    });

    // Query pending transactions
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.status, "pending"));

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t: any) => t.status === "pending")).toBe(true);
  });

  it("should filter transactions by date range", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Insert test transaction
    await db.insert(transactions).values({
      idempotencyKey: `TEST-DATE-${Date.now()}`,
      distributorId,
      providerId,
      productId,
      cardId: 1,
      amount: "75.00",
      commissionAmount: "7.50",
      transactionType: "purchase",
      status: "completed",
      createdAt: now,
    });

    // Query transactions created after yesterday
    const result = await db
      .select()
      .from(transactions)
      .where(
        sql`${transactions.createdAt} >= ${yesterday} AND ${transactions.createdAt} <= ${now}`
      );

    expect(result.length).toBeGreaterThan(0);
  });

  it("should calculate transaction summary statistics", async () => {
    // Insert multiple test transactions
    const txns = [
      {
        idempotencyKey: `TEST-SUM-1-${Date.now()}`,
        distributorId,
        providerId,
        productId,
        cardId: 1,
        amount: "100.00",
        commissionAmount: "10.00",
        transactionType: "purchase",
        status: "completed",
      },
      {
        idempotencyKey: `TEST-SUM-2-${Date.now()}`,
        distributorId,
        providerId,
        productId,
        cardId: 1,
        amount: "200.00",
        commissionAmount: "20.00",
        transactionType: "purchase",
        status: "completed",
      },
    ];

    for (const txn of txns) {
      await db.insert(transactions).values(txn);
    }

    // Calculate summary
    const result = await db
      .select({
        totalSales: sql`SUM(${transactions.amount})`,
        totalCommission: sql`SUM(${transactions.commissionAmount})`,
        count: sql`COUNT(*)`,
      })
      .from(transactions)
      .where(eq(transactions.providerId, providerId));

    expect(result[0].count).toBeGreaterThanOrEqual(2);
    expect(parseFloat(result[0].totalSales)).toBeGreaterThan(0);
    expect(parseFloat(result[0].totalCommission)).toBeGreaterThan(0);
  });

  it("should filter transactions by distributor", async () => {
    // Insert test transaction
    await db.insert(transactions).values({
      idempotencyKey: `TEST-DIST-${Date.now()}`,
      distributorId,
      providerId,
      productId,
      cardId: 1,
      amount: "150.00",
      commissionAmount: "15.00",
      transactionType: "purchase",
      status: "completed",
    });

    // Query transactions for specific distributor
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.distributorId, distributorId));

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t: any) => t.distributorId === distributorId)).toBe(true);
  });

  it("should filter transactions by product", async () => {
    // Insert test transaction
    await db.insert(transactions).values({
      idempotencyKey: `TEST-PROD-${Date.now()}`,
      distributorId,
      providerId,
      productId,
      cardId: 1,
      amount: "125.00",
      commissionAmount: "12.50",
      transactionType: "purchase",
      status: "completed",
    });

    // Query transactions for specific product
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.productId, productId));

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t: any) => t.productId === productId)).toBe(true);
  });

  it("should filter transactions by amount range", async () => {
    // Insert test transactions with different amounts
    const txns = [
      {
        idempotencyKey: `TEST-AMT-1-${Date.now()}`,
        distributorId,
        providerId,
        productId,
        cardId: 1,
        amount: "50.00",
        commissionAmount: "5.00",
        transactionType: "purchase",
        status: "completed",
      },
      {
        idempotencyKey: `TEST-AMT-2-${Date.now()}`,
        distributorId,
        providerId,
        productId,
        cardId: 1,
        amount: "500.00",
        commissionAmount: "50.00",
        transactionType: "purchase",
        status: "completed",
      },
    ];

    for (const txn of txns) {
      await db.insert(transactions).values(txn);
    }

    // Query transactions with amount between 100 and 600
    const result = await db
      .select()
      .from(transactions)
      .where(
        sql`${transactions.amount} >= 100 AND ${transactions.amount} <= 600`
      );

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (t: any) =>
          parseFloat(t.amount) >= 100 && parseFloat(t.amount) <= 600
      )
    ).toBe(true);
  });
});

// Import sql for query building
import { sql } from "drizzle-orm";
