/**
 * Tests for financial.providerInsights endpoint
 *
 * This endpoint provides aggregated analytics per provider for the authenticated distributor.
 * It sources data from provider_distributor_ledger and calculates:
 * - Total purchases (sum of purchase_debit amounts)
 * - Total transactions (count of purchase_debit entries)
 * - Total commission earned (sum of commission_credit amounts)
 * - Average commission per transaction
 * - First and last transaction dates
 * - Connection date (from provider_distributor_relationships)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCallerFactory } from "@trpc/server";
import { financialRouter } from "./financial.router";
import { getDb } from "../db";
import {
  users,
  distributors,
  serviceProviders,
  providerDistributorRelationships,
  providerDistributorAccounts,
  providerDistributorLedger,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";

describe("financial.providerInsights", () => {
  let db: any;
  let testDistributorId: number;
  let testProviderId1: number;
  let testProviderId2: number;
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    // Create test user
    const userResult = await db
      .insert(users)
      .values({
        openId: `test-user-${Date.now()}`,
        name: "Test User",
        email: `test-${Date.now()}@example.com`,
        role: "user",
      });
    testUserId = userResult[0];

    // Create test distributor
    const distResult = await db
      .insert(distributors)
      .values({
        name: `Test Distributor ${Date.now()}`,
        status: "active",
      });
    testDistributorId = distResult[0];

    // Create test providers
    const prov1Result = await db
      .insert(serviceProviders)
      .values({
        name: "Test Provider 1",
        status: "active",
      });
    testProviderId1 = prov1Result[0];

    const prov2Result = await db
      .insert(serviceProviders)
      .values({
        name: "Test Provider 2",
        status: "active",
      });
    testProviderId2 = prov2Result[0];

    // Create provider-distributor relationships
    await db.insert(providerDistributorRelationships).values({
      providerId: testProviderId1,
      distributorId: testDistributorId,
      commissionPercentage: 2.5,
      creditLine: 100000,
      status: "active",
    });

    await db.insert(providerDistributorRelationships).values({
      providerId: testProviderId2,
      distributorId: testDistributorId,
      commissionPercentage: 3.0,
      creditLine: 75000,
      status: "active",
    });

    // Create provider-distributor accounts
    await db.insert(providerDistributorAccounts).values({
      providerId: testProviderId1,
      distributorId: testDistributorId,
      balance: 50000,
      creditLine: 100000,
    });

    await db.insert(providerDistributorAccounts).values({
      providerId: testProviderId2,
      distributorId: testDistributorId,
      balance: 30000,
      creditLine: 75000,
    });

    // Create test ledger entries for Provider 1
    // 3 purchases of $1000 each = $3000 total
    for (let i = 0; i < 3; i++) {
      await db.insert(providerDistributorLedger).values({
        providerId: testProviderId1,
        distributorId: testDistributorId,
        type: "DEBIT",
        amount: 1000,
        balanceAfterTransaction: 50000 - (i + 1) * 1000,
        usedCreditAfterTransaction: (i + 1) * 1000,
        referenceId: `purchase-p1-${i}`,
        referenceType: "purchase_debit",
        metadata: JSON.stringify({ orderId: `order-${i}` }),
      });
    }

    // 3 commissions of $25 each = $75 total
    for (let i = 0; i < 3; i++) {
      await db.insert(providerDistributorLedger).values({
        providerId: testProviderId1,
        distributorId: testDistributorId,
        type: "CREDIT",
        amount: 25,
        balanceAfterTransaction: 50000 - 3000 + (i + 1) * 25,
        usedCreditAfterTransaction: 3000,
        referenceId: `commission-p1-${i}`,
        referenceType: "commission_credit",
        metadata: JSON.stringify({ purchaseId: `purchase-p1-${i}` }),
      });
    }

    // Create test ledger entries for Provider 2\n    // 2 purchases of $500 each = $1000 total\n    for (let i = 0; i < 2; i++) {\n      await db.insert(providerDistributorLedger).values({\n        providerId: testProviderId2,\n        distributorId: testDistributorId,\n        type: \"DEBIT\",\n        amount: 500,\n        balanceAfterTransaction: 30000 - (i + 1) * 500,\n        usedCreditAfterTransaction: (i + 1) * 500,\n        referenceId: `purchase-p2-${i}`,\n        referenceType: \"purchase_debit\",\n        metadata: JSON.stringify({ orderId: `order-p2-${i}` }),\n      });\n    }\n\n    // 2 commissions of $15 each = $30 total\n    for (let i = 0; i < 2; i++) {\n      await db.insert(providerDistributorLedger).values({\n        providerId: testProviderId2,\n        distributorId: testDistributorId,\n        type: \"CREDIT\",\n        amount: 15,\n        balanceAfterTransaction: 30000 - 1000 + (i + 1) * 15,\n        usedCreditAfterTransaction: 1000,\n        referenceId: `commission-p2-${i}`,\n        referenceType: \"commission_credit\",\n        metadata: JSON.stringify({ purchaseId: `purchase-p2-${i}` }),\n      });\n    }\n  });\n\n  afterAll(async () => {\n    if (!db) return;\n\n    // Clean up test data\n    try {\n      await db\n        .delete(providerDistributorLedger)\n        .where(eq(providerDistributorLedger.distributorId, testDistributorId));\n      await db\n        .delete(providerDistributorAccounts)\n        .where(eq(providerDistributorAccounts.distributorId, testDistributorId));\n      await db\n        .delete(providerDistributorRelationships)\n        .where(eq(providerDistributorRelationships.distributorId, testDistributorId));\n      await db.delete(distributors).where(eq(distributors.id, testDistributorId));\n      await db.delete(serviceProviders).where(eq(serviceProviders.id, testProviderId1));\n      await db.delete(serviceProviders).where(eq(serviceProviders.id, testProviderId2));\n      await db.delete(users).where(eq(users.id, testUserId));\n    } catch (error) {\n      console.error(\"Cleanup error:\", error);\n    }\n  });\n\n  it(\"should return provider insights sorted by volume (default)\", async () => {\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: testDistributorId },\n    });\n\n    const result = await caller.providerInsights({ limit: 10, sortBy: \"volume\" });\n\n    expect(result).toHaveLength(2);\n\n    // Provider 1 should be first (higher volume: $3000 vs $1000)\n    expect(result[0].providerId).toBe(testProviderId1);\n    expect(result[0].totalPurchases).toBe(3000);\n    expect(result[0].totalTransactions).toBe(3);\n    expect(result[0].totalCommissionEarned).toBe(75);\n    expect(result[0].avgCommissionPerTransaction).toBe(25);\n    expect(result[0].providerName).toBe(\"Test Provider 1\");\n    expect(result[0].connectionDate).toBeDefined();\n    expect(result[0].firstTransactionDate).toBeDefined();\n    expect(result[0].lastTransactionDate).toBeDefined();\n\n    // Provider 2 should be second\n    expect(result[1].providerId).toBe(testProviderId2);\n    expect(result[1].totalPurchases).toBe(1000);\n    expect(result[1].totalTransactions).toBe(2);\n    expect(result[1].totalCommissionEarned).toBe(30);\n    expect(result[1].avgCommissionPerTransaction).toBe(15);\n  });\n\n  it(\"should return provider insights sorted by commission\", async () => {\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: testDistributorId },\n    });\n\n    const result = await caller.providerInsights({ limit: 10, sortBy: \"commission\" });\n\n    expect(result).toHaveLength(2);\n\n    // Provider 1 should be first (higher commission: $75 vs $30)\n    expect(result[0].providerId).toBe(testProviderId1);\n    expect(result[0].totalCommissionEarned).toBe(75);\n\n    // Provider 2 should be second\n    expect(result[1].providerId).toBe(testProviderId2);\n    expect(result[1].totalCommissionEarned).toBe(30);\n  });\n\n  it(\"should respect limit parameter\", async () => {\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: testDistributorId },\n    });\n\n    const result = await caller.providerInsights({ limit: 1, sortBy: \"volume\" });\n\n    expect(result).toHaveLength(1);\n    expect(result[0].providerId).toBe(testProviderId1);\n  });\n\n  it(\"should return empty array for distributor with no providers\", async () => {\n    // Create a new distributor with no relationships\n    const newDistResult = await db\n      .insert(distributors)\n      .values({\n        name: `Empty Distributor ${Date.now()}`,\n        status: \"active\",\n      });\n    const newDistId = newDistResult[0];\n\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: newDistId },\n    });\n\n    const result = await caller.providerInsights({ limit: 10 });\n\n    expect(result).toEqual([]);\n\n    // Cleanup\n    await db.delete(distributors).where(eq(distributors.id, newDistId));\n  });\n\n  it(\"should throw UNAUTHORIZED when user is not authenticated\", async () => {\n    const caller = createCallerFactory(financialRouter)({\n      user: null,\n    });\n\n    try {\n      await caller.providerInsights({ limit: 10 });\n      expect.fail(\"Should have thrown UNAUTHORIZED error\");\n    } catch (error: any) {\n      expect(error.code).toBe(\"UNAUTHORIZED\");\n      expect(error.message).toContain(\"must be authenticated\");\n    }\n  });\n\n  it(\"should calculate avgCommissionPerTransaction correctly\", async () => {\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: testDistributorId },\n    });\n\n    const result = await caller.providerInsights({ limit: 10 });\n\n    // Provider 1: $75 commission / 3 transactions = $25 per transaction\n    const provider1 = result.find((p) => p.providerId === testProviderId1);\n    expect(provider1?.avgCommissionPerTransaction).toBe(25);\n\n    // Provider 2: $30 commission / 2 transactions = $15 per transaction\n    const provider2 = result.find((p) => p.providerId === testProviderId2);\n    expect(provider2?.avgCommissionPerTransaction).toBe(15);\n  });\n\n  it(\"should include transaction date range\", async () => {\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: testDistributorId },\n    });\n\n    const result = await caller.providerInsights({ limit: 10 });\n\n    for (const insight of result) {\n      expect(insight.firstTransactionDate).toBeDefined();\n      expect(insight.lastTransactionDate).toBeDefined();\n      expect(insight.connectionDate).toBeDefined();\n\n      // First transaction should be <= last transaction\n      if (insight.firstTransactionDate && insight.lastTransactionDate) {\n        expect(new Date(insight.firstTransactionDate).getTime()).toBeLessThanOrEqual(\n          new Date(insight.lastTransactionDate).getTime()\n        );\n      }\n    }\n  });\n\n  it(\"should only return data for authenticated distributor\", async () => {\n    // Create another distributor\n    const otherDistResult = await db\n      .insert(distributors)\n      .values({\n        name: `Other Distributor ${Date.now()}`,\n        status: \"active\",\n      });\n    const otherDistId = otherDistResult[0];\n\n    const caller = createCallerFactory(financialRouter)({\n      user: { id: otherDistId },\n    });\n\n    const result = await caller.providerInsights({ limit: 10 });\n\n    // Should return empty array (no relationships for this distributor)\n    expect(result).toEqual([]);\n\n    // Cleanup\n    await db.delete(distributors).where(eq(distributors.id, otherDistId));\n  });\n});\n
