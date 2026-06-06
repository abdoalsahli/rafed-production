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
 * StepwiseRebuildService - Rebuilds infrastructure step-by-step with validation
 * Each step is isolated and validated before proceeding
 */
export class StepwiseRebuildService {
  async rebuildStepwise() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    console.log("[StepwiseRebuild] Starting step-by-step infrastructure rebuild...");
    const startTime = Date.now();
    const results: any = {};

    try {
      // Step 1: Create Service Providers
      console.log("[StepwiseRebuild] Step 1: Creating service providers...");
      try {
        const providerCodes = ["LIBYANA", "ALMADAR", "LTT", "CONNECT", "GIGA"];
        const providerNames = ["Libyana", "Almadar", "LTT", "Connect", "Giga"];

        for (let i = 0; i < 5; i++) {
          await db.insert(serviceProviders).values({
            name: providerNames[i],
            providerCode: providerCodes[i],
            status: "active" as const,
            organizationId: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Validate
        const providerCount = await db.select({ count: sql<number>`COUNT(*)` }).from(serviceProviders);
        const count = (providerCount[0] as any)?.count || 0;
        console.log(`[StepwiseRebuild] ✓ Step 1 complete: ${count} service providers created`);
        results.providers = { success: true, count };
      } catch (err) {
        console.error("[StepwiseRebuild] ✗ Step 1 failed:", err);
        results.providers = { success: false, error: String(err), errorCode: (err as any)?.code };
        throw err;
      }

      // Step 2: Create Distributors
      console.log("[StepwiseRebuild] Step 2: Creating distributors...");
      try {
        const distributorNames = ["Anis", "iCard", "Qareep"];

        for (const name of distributorNames) {
          await db.insert(distributors).values({
            name,
            status: "active" as const,
          });
        }

        // Validate
        const distCount = await db.select({ count: sql<number>`COUNT(*)` }).from(distributors);
        const count = (distCount[0] as any)?.count || 0;
        console.log(`[StepwiseRebuild] ✓ Step 2 complete: ${count} distributors created`);
        results.distributors = { success: true, count };
      } catch (err) {
        console.error("[StepwiseRebuild] ✗ Step 2 failed:", err);
        results.distributors = { success: false, error: String(err), errorCode: (err as any)?.code };
        throw err;
      }

      // Step 3: Create Products
      console.log("[StepwiseRebuild] Step 3: Creating products...");
      try {
        const denominations = [5, 10, 20, 50, 75];
        const providerIds = [1, 2, 3, 4, 5]; // Assuming IDs are sequential

        for (let i = 0; i < providerIds.length; i++) {
          for (const denom of denominations) {
            await db.insert(products).values({
              providerId: providerIds[i],
              name: `${denom} LYD Card`,
              displayName: `${denom} LYD`,
              description: `Prepaid card with ${denom} LYD face value`,
              faceValue: String(denom),
              currency: "LYD",
              price: String(denom * 1.02), // 2% markup
              status: "active" as const,
              isActive: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        // Validate
        const prodCount = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
        const count = (prodCount[0] as any)?.count || 0;
        console.log(`[StepwiseRebuild] ✓ Step 3 complete: ${count} products created`);
        results.products = { success: true, count };
      } catch (err) {
        console.error("[StepwiseRebuild] ✗ Step 3 failed:", err);
        results.products = { success: false, error: String(err), errorCode: (err as any)?.code };
        throw err;
      }

      // Step 4: Create Provider-Distributor Relationships
      console.log("[StepwiseRebuild] Step 4: Creating provider-distributor relationships...");
      try {
        const providerIds = [1, 2, 3, 4, 5];
        const distributorIds = [1, 2, 3];

        for (const providerId of providerIds) {
          for (const distributorId of distributorIds) {
            await db.insert(providerDistributorRelationships).values({
              providerId,
              distributorId,
              commissionPercentage: "2.50",
              creditLine: "50000.00",
              status: "active" as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        // Validate
        const relCount = await db.select({ count: sql<number>`COUNT(*)` }).from(providerDistributorRelationships);
        const count = (relCount[0] as any)?.count || 0;
        console.log(`[StepwiseRebuild] ✓ Step 4 complete: ${count} relationships created`);
        results.relationships = { success: true, count };
      } catch (err) {
        console.error("[StepwiseRebuild] ✗ Step 4 failed:", err);
        results.relationships = { success: false, error: String(err), errorCode: (err as any)?.code };
        throw err;
      }

      // Step 5: Create Provider-Distributor Accounts
      console.log("[StepwiseRebuild] Step 5: Creating provider-distributor accounts...");
      try {
        const providerIds = [1, 2, 3, 4, 5];
        const distributorIds = [1, 2, 3];

        for (const providerId of providerIds) {
          for (const distributorId of distributorIds) {
            await db.insert(providerDistributorAccounts).values({
              providerId,
              distributorId,
              balance: "10000.00",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        // Validate
        const accCount = await db.select({ count: sql<number>`COUNT(*)` }).from(providerDistributorAccounts);
        const count = (accCount[0] as any)?.count || 0;
        console.log(`[StepwiseRebuild] ✓ Step 5 complete: ${count} accounts created`);
        results.accounts = { success: true, count };
      } catch (err) {
        console.error("[StepwiseRebuild] ✗ Step 5 failed:", err);
        results.accounts = { success: false, error: String(err), errorCode: (err as any)?.code };
        throw err;
      }

      const duration = Date.now() - startTime;
      console.log(`[StepwiseRebuild] ✓ Rebuild complete in ${duration}ms`);

      return {
        success: true,
        message: "Infrastructure rebuild completed successfully",
        duration,
        summary: results,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("[StepwiseRebuild] ✗ Rebuild failed:", error);
      throw error;
    }
  }
}

export const stepwiseRebuildService = new StepwiseRebuildService();
