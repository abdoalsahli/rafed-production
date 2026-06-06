import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { serviceProviders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Provider Code Functionality", () => {
  let testProviderId: number;
  let testProviderCode: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const providers = await db
      .select({ id: serviceProviders.id, providerCode: serviceProviders.providerCode })
      .from(serviceProviders)
      .limit(1);

    if (providers.length === 0) {
      throw new Error("No providers found in database for testing");
    }

    testProviderId = providers[0].id;
    testProviderCode = String(providers[0].providerCode);
  });

  it("should fetch provider code from database", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const provider = await db
      .select({ providerCode: serviceProviders.providerCode })
      .from(serviceProviders)
      .where(eq(serviceProviders.id, testProviderId))
      .limit(1);

    expect(provider.length).toBe(1);
    expect(provider[0].providerCode).toBeTruthy();
    const code = String(provider[0].providerCode);
    expect(code.length).toBeGreaterThan(0);
  });

  it("should have provider codes in correct format", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const providers = await db
      .select({ providerCode: serviceProviders.providerCode })
      .from(serviceProviders)
      .limit(10);

    providers.forEach((p) => {
      const code = String(p.providerCode);
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });
  });

  it("should not have null provider codes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const providers = await db
      .select({ providerCode: serviceProviders.providerCode })
      .from(serviceProviders)
      .limit(100);

    providers.forEach((p) => {
      expect(p.providerCode).toBeTruthy();
    });
  });
});
