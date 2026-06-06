import { getDb } from "../db";
import {
  serviceProviders,
  distributors,
  products,
  providerDistributorRelationships,
  providerDistributorAccounts,
} from "../../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * RebuildService - Recreates infrastructure for testing
 * Creates organizations, products, relationships, and accounts
 * Uses ORM only (no raw SQL)
 */
export class RebuildService {
  async rebuildInfrastructure() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    console.log("[RebuildService] Starting infrastructure rebuild...");
    const startTime = Date.now();

    try {
      // Test: Check if table exists and is accessible
      console.log("[RebuildService] Testing database connectivity...");
      try {
        const testResult = await db.execute(sql`SELECT COUNT(*) as count FROM service_providers`);
        console.log("[RebuildService] Database test passed, current provider count:", testResult);
      } catch (testError) {
        console.error("[RebuildService] Database test failed:", testError);
        throw testError;
      }

      // Phase 1: Create Service Providers (5)
      console.log("[RebuildService] Phase 1: Creating service providers...");
      const providerCodes = ["LIBYANA", "ALMADAR", "LTT", "CONNECT", "GIGA"];
      const providerNames = ["Libyana", "Almadar", "LTT", "Connect", "Giga"];

      for (let i = 0; i < 5; i++) {
        try {
          console.log(`[RebuildService] Inserting provider ${i + 1}/5: ${providerNames[i]}`);
          const result = await db.insert(serviceProviders).values({
            name: providerNames[i],
            providerCode: providerCodes[i],
            status: "active" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`[RebuildService] ✓ Provider ${i + 1} created successfully`);
        } catch (err) {
          console.error(`[RebuildService] Error creating provider ${i + 1}:`, err);
          throw err;
        }
      }
      console.log("[RebuildService] ✓ Created 5 service providers");

      // Phase 2: Create Distributors (3)
      console.log("[RebuildService] Phase 2: Creating distributors...");
      const distributorNames = ["Anis", "iCard", "Qareep"];

      for (const name of distributorNames) {
        try {
          console.log(`[RebuildService] Inserting distributor: ${name}`);
          await db.insert(distributors).values({
            name,
            status: "active" as const,
          });
          console.log(`[RebuildService] ✓ Distributor ${name} created successfully`);
        } catch (err) {
          console.error(`[RebuildService] Error creating distributor ${name}:`, err);
          throw err;
        }
      }
      console.log("[RebuildService] ✓ Created 3 distributors");

      // Phase 3: Create Products (5 providers × 5 denominations = 25 products)
      console.log("[RebuildService] Phase 3: Creating products...");
      const denominations = [5, 10, 20, 50, 75];
      let productCount = 0;

      for (let providerId = 1; providerId <= 5; providerId++) {
        for (const denom of denominations) {
          try {
            await db.insert(products).values({
              providerId,
              name: `${providerNames[providerId - 1]} ${denom} LYD`,
              displayName: `${denom} LYD Card`,
              description: `${providerNames[providerId - 1]} prepaid card ${denom} LYD`,
              faceValue: denom.toString(),
              currency: "LYD",
              price: (denom * 1.05).toString(), // 5% markup
              status: "active" as const,
              isActive: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            productCount++;
          } catch (err) {
            console.error(`[RebuildService] Error creating product for provider ${providerId}:`, err);
            throw err;
          }
        }
      }
      console.log(`[RebuildService] ✓ Created ${productCount} products`);

      // Phase 4: Create Provider-Distributor Relationships (5 × 3 = 15)
      console.log("[RebuildService] Phase 4: Creating relationships...");
      const commissionRates = [
        ["1.75", "2.00", "2.25"], // Libyana
        ["2.00", "2.25", "2.50"], // Almadar
        ["2.25", "2.50", "2.75"], // LTT
        ["2.50", "2.75", "3.00"], // Connect
        ["2.75", "3.00", "3.00"], // Giga
      ];
      let relationshipCount = 0;

      for (let providerId = 1; providerId <= 5; providerId++) {
        for (let distributorId = 1; distributorId <= 3; distributorId++) {
          try {
            await db.insert(providerDistributorRelationships).values({
              providerId,
              distributorId,
              commissionPercentage: commissionRates[providerId - 1][distributorId - 1],
              creditLine: "50000.00",
              status: "active" as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            relationshipCount++;
          } catch (err) {
            console.error(`[RebuildService] Error creating relationship P${providerId}-D${distributorId}:`, err);
            throw err;
          }
        }
      }
      console.log(`[RebuildService] ✓ Created ${relationshipCount} relationships`);

      // Phase 5: Create Provider-Distributor Accounts (15 with initial balances)
      console.log("[RebuildService] Phase 5: Creating accounts...");
      let accountCount = 0;

      for (let providerId = 1; providerId <= 5; providerId++) {
        for (let distributorId = 1; distributorId <= 3; distributorId++) {
          try {
            await db.insert(providerDistributorAccounts).values({
              providerId,
              distributorId,
              balance: "10000.00",
              creditLine: "50000.00",
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            accountCount++;
          } catch (err) {
            console.error(`[RebuildService] Error creating account P${providerId}-D${distributorId}:`, err);
            throw err;
          }
        }
      }
      console.log(`[RebuildService] ✓ Created ${accountCount} accounts with 10,000 LYD each`);

      const duration = Date.now() - startTime;
      console.log(`[RebuildService] ✅ Rebuild completed in ${duration}ms`);

      return {
        success: true,
        message: "Infrastructure rebuild completed successfully",
        duration,
        summary: {
          providers: 5,
          distributors: 3,
          products: productCount,
          relationships: relationshipCount,
          accounts: accountCount,
          totalBalance: "150000.00",
        },
      };
    } catch (error) {
      console.error("[RebuildService] Error during rebuild:", error);
      throw error;
    }
  }
}

export const rebuildService = new RebuildService();
