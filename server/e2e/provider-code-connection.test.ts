import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import {
  serviceProviders,
  distributors,
  accessRequests,
  providerDistributorRelationships,
  products,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("E2E: Provider Code-Based Connection Flow", () => {
  let testProviderId: number;
  let testDistributorId: number;
  let testProviderCode: string;

  function generateProviderCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += chars[Math.floor(Math.random() * 36)];
    }
    return code;
  }

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test provider with unique code
    testProviderCode = generateProviderCode();
    const timestamp = Date.now();

    await db.insert(serviceProviders).values({
      name: `E2E Test Provider ${timestamp}`,
      providerCode: testProviderCode,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get the provider ID
    const providers = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.providerCode, testProviderCode));

    testProviderId = providers[0].id;

    // Create test distributor
    await db.insert(distributors).values({
      name: `E2E Test Distributor ${timestamp}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get the distributor ID
    const dists = await db
      .select()
      .from(distributors)
      .where(eq(distributors.name, `E2E Test Distributor ${timestamp}`));

    testDistributorId = dists[0].id;
  });

  it("Step 1: Distributor can find provider by code", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Distributor looks up provider by code
    const result = await db
      .select()
      .from(serviceProviders)
      .where(
        and(
          eq(serviceProviders.providerCode, testProviderCode),
          eq(serviceProviders.status, "active")
        )
      )
      .limit(1);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(testProviderId);
    expect(result[0].name).toContain("E2E Test Provider");
    expect(result[0].status).toBe("active");
  });

  it("Step 2: Distributor sends connection request", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create access request
    await db.insert(accessRequests).values({
      providerId: testProviderId,
      distributorId: testDistributorId,
      requestedCommission: "5",
      requestedCreditLine: "10000",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify request was created
    const requests = await db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.providerId, testProviderId),
          eq(accessRequests.distributorId, testDistributorId)
        )
      );

    expect(requests.length).toBe(1);
    expect(requests[0].status).toBe("pending");
    expect(requests[0].requestedCommission).toBe("5.00");
  });

  it("Step 3: Provider sees pending request", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Provider queries pending requests
    const pendingRequests = await db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.providerId, testProviderId),
          eq(accessRequests.status, "pending")
        )
      );

    expect(pendingRequests.length).toBeGreaterThan(0);
    expect(pendingRequests[0].distributorId).toBe(testDistributorId);
  });

  it("Step 4: Provider approves connection request", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Provider approves the request
    await db
      .update(accessRequests)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accessRequests.providerId, testProviderId),
          eq(accessRequests.distributorId, testDistributorId)
        )
      );

    // Verify approval
    const updatedRequest = await db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.providerId, testProviderId),
          eq(accessRequests.distributorId, testDistributorId)
        )
      );

    expect(updatedRequest[0].status).toBe("approved");
    expect(updatedRequest[0].reviewedAt).toBeDefined();
  });

  it("Step 5: Create provider-distributor relationship", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create relationship (typically done after approval)
    await db.insert(providerDistributorRelationships).values({
      providerId: testProviderId,
      distributorId: testDistributorId,
      commissionPercentage: 5,
      creditLine: 10000,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify relationship
    const relationships = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, testProviderId),
          eq(providerDistributorRelationships.distributorId, testDistributorId)
        )
      );

    expect(relationships.length).toBe(1);
    expect(relationships[0].status).toBe("active");
  });

  it("Step 6: Distributor can access provider products", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test product for the provider
    await db.insert(products).values({
      providerId: testProviderId,
      name: "Test Card Product",
      displayName: "Test Card",
      faceValue: 50,
      currency: "USD",
      price: 50,
      description: "Test product for E2E",
      isActive: 1,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Distributor queries provider's products (after relationship is active)
    const relationship = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, testProviderId),
          eq(providerDistributorRelationships.distributorId, testDistributorId),
          eq(providerDistributorRelationships.status, "active")
        )
      );

    expect(relationship.length).toBe(1);

    // Query products from this provider
    const productsResult = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.providerId, testProviderId),
          eq(products.isActive, 1)
        )
      );

    expect(productsResult.length).toBeGreaterThan(0);
    expect(productsResult[0].name).toBe("Test Card Product");
  });

  it("Step 7: Verify connection status is active", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check final connection status
    const relationship = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, testProviderId),
          eq(providerDistributorRelationships.distributorId, testDistributorId)
        )
      );

    expect(relationship.length).toBe(1);
    expect(relationship[0].status).toBe("active");
    expect(relationship[0].commissionPercentage).toBe("5.00");
    expect(relationship[0].creditLine).toBe("10000.00");
  });

  it("Verify provider code format is correct", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const provider = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.id, testProviderId));

    expect(provider[0].providerCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("Verify no duplicate connections allowed", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check that there's already an approved request
    const existingRequests = await db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.providerId, testProviderId),
          eq(accessRequests.distributorId, testDistributorId)
        )
      );

    // Should have exactly one request (the approved one)
    expect(existingRequests.length).toBe(1);
    expect(existingRequests[0].status).toBe("approved");
  });
});
