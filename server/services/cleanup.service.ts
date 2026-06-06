import { getDb } from "../db";
import {
  apiLogs,
  auditLogs,
  monitoringAlerts,
  notifications,
  purchaseRequests,
  accessRequests,
  providerDistributorLedger,
  transactions,
  providerDistributorAccounts,
  providerDistributorCommission,
  providerDistributorRelationships,
  distributorApiCredentials,
  cards,
  cardBatches,
  products,
  organizationUsers,
  organizations,
  distributors,
  serviceProviders,
  usersExtended,
  users,
} from "../../drizzle/schema";
import { ne } from "drizzle-orm";

/**
 * CleanupService - Removes all demo data using ORM only
 * Preserves only admin user (ID: 1004713)
 * Respects foreign key constraints by deleting children first
 */
export class CleanupService {
  async cleanDatabase() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    console.log("[CleanupService] Starting database cleanup...");
    const startTime = Date.now();

    try {
      // Disable foreign key checks for cleanup
      console.log("[CleanupService] Disabling foreign key checks...");
      await db.execute("SET FOREIGN_KEY_CHECKS = 0");
      console.log("[CleanupService] ✓ Foreign key checks disabled");

      // Phase 1: Delete transactional/audit data (no foreign keys)
      console.log("[CleanupService] Phase 1: Deleting audit and log data...");
      await db.delete(apiLogs);
      console.log("[CleanupService] ✓ Deleted api_logs");

      await db.delete(auditLogs);
      console.log("[CleanupService] ✓ Deleted audit_logs");

      await db.delete(monitoringAlerts);
      console.log("[CleanupService] ✓ Deleted monitoring_alerts");

      await db.delete(notifications);
      console.log("[CleanupService] ✓ Deleted notifications");

      // Phase 2: Delete purchase and access requests
      console.log("[CleanupService] Phase 2: Deleting requests...");
      await db.delete(purchaseRequests);
      console.log("[CleanupService] ✓ Deleted purchase_requests");

      await db.delete(accessRequests);
      console.log("[CleanupService] ✓ Deleted access_requests");

      // Phase 3: Delete financial ledger entries
      console.log("[CleanupService] Phase 3: Deleting financial data...");
      await db.delete(providerDistributorLedger);
      console.log("[CleanupService] ✓ Deleted provider_distributor_ledger");

      // Phase 4: Delete transactions
      console.log("[CleanupService] Phase 4: Deleting transactions...");
      await db.delete(transactions);
      console.log("[CleanupService] ✓ Deleted transactions");

      // Phase 5: Delete account and commission data
      console.log("[CleanupService] Phase 5: Deleting accounts and commissions...");
      await db.delete(providerDistributorAccounts);
      console.log("[CleanupService] ✓ Deleted provider_distributor_accounts");

      await db.delete(providerDistributorCommission);
      console.log("[CleanupService] ✓ Deleted provider_distributor_commission");

      // Phase 6: Delete relationships
      console.log("[CleanupService] Phase 6: Deleting relationships...");
      await db.delete(providerDistributorRelationships);
      console.log("[CleanupService] ✓ Deleted provider_distributor_relationships");

      await db.delete(distributorApiCredentials);
      console.log("[CleanupService] ✓ Deleted distributor_api_credentials");

      // Phase 7: Delete cards and batches
      console.log("[CleanupService] Phase 7: Deleting cards...");
      await db.delete(cards);
      console.log("[CleanupService] ✓ Deleted cards");

      await db.delete(cardBatches);
      console.log("[CleanupService] ✓ Deleted card_batches");

      // Phase 8: Delete products
      console.log("[CleanupService] Phase 8: Deleting products...");
      await db.delete(products);
      console.log("[CleanupService] ✓ Deleted products");

      // Phase 9: Delete organization relationships
      console.log("[CleanupService] Phase 9: Deleting organization relationships...");
      await db
        .delete(organizationUsers)
        .where(ne(organizationUsers.userId, 1004713));
      console.log("[CleanupService] ✓ Deleted organization_users (except admin)");

      // Phase 10: Delete organizations
      console.log("[CleanupService] Phase 10: Deleting organizations...");
      await db.delete(organizations);
      console.log("[CleanupService] ✓ Deleted organizations");

      // Phase 11: Delete providers and distributors
      console.log("[CleanupService] Phase 11: Deleting providers and distributors...");
      await db.delete(distributors);
      console.log("[CleanupService] ✓ Deleted distributors");

      await db.delete(serviceProviders);
      console.log("[CleanupService] ✓ Deleted service_providers");

      // Phase 12: Delete user extended data
      console.log("[CleanupService] Phase 12: Deleting user extended data...");
      await db
        .delete(usersExtended)
        .where(ne(usersExtended.userId, 1004713));
      console.log("[CleanupService] ✓ Deleted users_extended (except admin)");

      // Phase 13: Delete users (except admin)
      console.log("[CleanupService] Phase 13: Deleting users...");
      await db.delete(users).where(ne(users.id, 1004713));
      console.log("[CleanupService] ✓ Deleted users (except admin)");

      // Re-enable foreign key checks
      console.log("[CleanupService] Re-enabling foreign key checks...");
      await db.execute("SET FOREIGN_KEY_CHECKS = 1");
      console.log("[CleanupService] ✓ Foreign key checks enabled");

      const duration = Date.now() - startTime;
      console.log(`[CleanupService] ✅ Cleanup completed in ${duration}ms`);

      return {
        success: true,
        message: "Database cleanup completed successfully",
        duration,
      };
    } catch (error) {
      console.error("[CleanupService] Error during cleanup:", error);
      // Re-enable foreign key checks on error
      try {
        await db.execute("SET FOREIGN_KEY_CHECKS = 1");
      } catch (e) {
        console.error("[CleanupService] Error re-enabling foreign key checks:", e);
      }
      throw error;
    }
  }

  async getCleanupStatus() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    console.log("[CleanupService] Getting cleanup status...");

    try {
      const counts = {
        users: await db.select({ count: users.id }).from(users),
        organizations: await db
          .select({ count: organizations.id })
          .from(organizations),
        serviceProviders: await db
          .select({ count: serviceProviders.id })
          .from(serviceProviders),
        distributors: await db
          .select({ count: distributors.id })
          .from(distributors),
        products: await db.select({ count: products.id }).from(products),
        cards: await db.select({ count: cards.id }).from(cards),
        transactions: await db
          .select({ count: transactions.id })
          .from(transactions),
        providerDistributorAccounts: await db
          .select({ count: providerDistributorAccounts.id })
          .from(providerDistributorAccounts),
        providerDistributorLedger: await db
          .select({ count: providerDistributorLedger.id })
          .from(providerDistributorLedger),
        providerDistributorCommission: await db
          .select({ count: providerDistributorCommission.id })
          .from(providerDistributorCommission),
        distributorApiCredentials: await db
          .select({ count: distributorApiCredentials.id })
          .from(distributorApiCredentials),
      };

      return {
        success: true,
        counts,
      };
    } catch (error) {
      console.error("[CleanupService] Error getting cleanup status:", error);
      throw error;
    }
  }
}

export const cleanupService = new CleanupService();
