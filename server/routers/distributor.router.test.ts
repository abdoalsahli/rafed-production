import { describe, it, expect } from "vitest";
import { getDb } from "../db";
import { serviceProviders, accessRequests, distributors } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function generateProviderCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * 36)];
  }
  return code;
}

describe("Distributor Router - Provider Code Model", () => {
  it("should find active providers by code", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find any active provider
    const result = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.status, "active"))
      .limit(1);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].status).toBe("active");
    expect(result[0].providerCode).toBeDefined();
    expect(result[0].providerCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("should have unique provider codes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all providers
    const providers = await db
      .select({ providerCode: serviceProviders.providerCode })
      .from(serviceProviders)
      .limit(100);

    const codes = providers.map(p => p.providerCode);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("should not find inactive providers", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create an inactive provider
    await db.insert(serviceProviders).values({
      name: `Inactive Test ${Date.now()}`,
      providerCode: generateProviderCode(),
      status: "inactive",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Try to find it with active filter
    const result = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.status, "active"))
      .limit(1);

    // Result should not include the inactive provider
    const hasInactive = result.some(p => p.status === "inactive");
    expect(hasInactive).toBe(false);
  });



  it("should have all providers with non-null provider codes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check for null provider codes
    const result = await db
      .select()
      .from(serviceProviders)
      .limit(100);

    const nullCodes = result.filter(p => !p.providerCode);
    expect(nullCodes.length).toBe(0);
  });
});
