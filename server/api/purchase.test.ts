import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "crypto";
import { getDb, getRawDb } from "../db";
import {
  distributorApiCredentials,
  purchaseRequests,
  distributors,
  organizations,
  organizationUsers,
  serviceProviders,
  products,
  providerDistributorRelationships,
  users,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Helper to hash secret (same as api-auth.ts)
function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

describe("External Purchase API", () => {
  let testDistributorId: number;
  let testProviderId: number;
  let testProductId: number;
  let testUserId: number;
  let testApiKeyId: string;
  let testApiSecret: string;
  let testApiSecretHash: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const userResult = await db.insert(users).values({
      openId: `test_user_${Date.now()}`,
      name: "Test User",
      email: `test${Date.now()}@example.com`,
      loginMethod: "google",
      status: "active",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    testUserId = (userResult as any).insertId;

    // Create test organization for distributor
    const orgResult = await db.insert(organizations).values({
      name: `Test Distributor Org ${Date.now()}`,
      type: "distributor",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const testOrgId = (orgResult as any).insertId;

    // Link user to organization
    await db.insert(organizationUsers).values({
      userId: testUserId,
      organizationId: testOrgId,
      role: "admin",
      updatedAt: new Date(),
    });

    // Create test distributor
    const distResult = await db.insert(distributors).values({
      organizationId: testOrgId,
      name: `Test Distributor ${Date.now()}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testDistributorId = (distResult as any).insertId;

    // Create test provider
    const providerOrgResult = await db.insert(organizations).values({
      name: `Test Provider Org ${Date.now()}`,
      type: "provider",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const providerOrgId = (providerOrgResult as any).insertId;

    const providerResult = await db.insert(serviceProviders).values({
      organizationId: providerOrgId,
      name: `Test Provider ${Date.now()}`,
      code: `PROV_${Date.now()}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testProviderId = (providerResult as any).insertId;

    // Create test product
    const productResult = await db.insert(products).values({
      providerId: testProviderId,
      name: `Test Product ${Date.now()}`,
      price: 10.0,
      commissionAmount: 0.5,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testProductId = (productResult as any).insertId;

    // Create provider-distributor relationship
    await db.insert(providerDistributorRelationships).values({
      providerId: testProviderId,
      distributorId: testDistributorId,
      commissionType: "percentage",
      commissionValue: 5.0,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test API credentials
    testApiKeyId = `sk_live_${crypto.randomBytes(16).toString("hex")}`;
    testApiSecret = crypto.randomBytes(32).toString("hex");
    testApiSecretHash = hashSecret(testApiSecret);

    await db.insert(distributorApiCredentials).values({
      distributorId: testDistributorId,
      keyId: testApiKeyId,
      secretHash: testApiSecretHash,
      maskedKey: `sk_live_${testApiSecret.slice(-12)}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("Test 1: Valid API credentials purchase", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const idempotencyKey = `test_${Date.now()}_1`;

    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": testApiSecret,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.requestId).toBeDefined();
    expect(data.status).toBe("PENDING");

    // Verify purchase_request was created
    const requests = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.idempotencyKey, idempotencyKey));
    expect(requests.length).toBe(1);
  });

  it("Test 2: Invalid API key", async () => {
    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "sk_live_invalid",
        "X-API-Secret": testApiSecret,
        "Idempotency-Key": `test_${Date.now()}_2`,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_API_CREDENTIALS");
  });

  it("Test 3: Invalid API secret", async () => {
    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": "invalid_secret",
        "Idempotency-Key": `test_${Date.now()}_3`,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_API_CREDENTIALS");
  });

  it("Test 4: Missing Idempotency-Key", async () => {
    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": testApiSecret,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("MISSING_IDEMPOTENCY_KEY");
  });

  it("Test 5: Duplicate Idempotency-Key returns same result", async () => {
    const idempotencyKey = `test_${Date.now()}_5`;

    // First request
    const response1 = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": testApiSecret,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    const requestId1 = data1.requestId;

    // Second request with same idempotency key
    const response2 = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": testApiSecret,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    expect(data2.requestId).toBe(requestId1);

    // Verify only one purchase_request was created
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const requests = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.idempotencyKey, idempotencyKey));
    expect(requests.length).toBe(1);
  });

  it("Test 6: Invalid product", async () => {
    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": testApiSecret,
        "Idempotency-Key": `test_${Date.now()}_6`,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: 99999,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("Test 7: Missing credentials headers", async () => {
    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test_${Date.now()}_7`,
      },
      body: JSON.stringify({
        providerId: testProviderId,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("MISSING_CREDENTIALS");
  });

  it("Test 8: Invalid request body", async () => {
    const response = await fetch("http://localhost:3000/api/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": testApiKeyId,
        "X-API-Secret": testApiSecret,
        "Idempotency-Key": `test_${Date.now()}_8`,
      },
      body: JSON.stringify({
        providerId: -1,
        productId: testProductId,
        quantity: 1,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  afterAll(async () => {
    // Cleanup is optional for tests
  });
});
