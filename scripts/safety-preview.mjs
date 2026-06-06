import { db } from "../server/db.ts";
import { users, organizations, organizationUsers, serviceProviders, distributors, products, cardBatches, cards, providerDistributorRelationships, providerDistributorAccounts, providerDistributorLedger, transactions, notifications, apiCredentials, apiLogs } from "../drizzle/schema.ts";
import { count, eq, ne, like, or } from "drizzle-orm";

async function generateSafetyPreview() {
  console.log("\n" + "=".repeat(80));
  console.log("DATABASE SAFETY PREVIEW - CLEANUP & REBUILD");
  console.log("=".repeat(80) + "\n");

  // 1. PRESERVED RECORDS
  console.log("1. PRESERVED RECORDS");
  console.log("-".repeat(80));

  try {
    const adminUser = await db.select().from(users).where(eq(users.email, "abdogiydan2000@gmail.com"));
    if (adminUser.length > 0) {
      const admin = adminUser[0];
      console.log(`✓ Admin User:`);
      console.log(`  - ID: ${admin.id}`);
      console.log(`  - Email: ${admin.email}`);
      console.log(`  - Name: ${admin.name}`);
      console.log(`  - Role: ${admin.role}`);
      console.log(`  - OpenID: ${admin.openId}`);
      console.log(`  - Status: ${admin.status || 'ACTIVE'}`);

      // Check admin organization
      const adminOrgs = await db.select().from(organizationUsers).where(eq(organizationUsers.userId, admin.id));
      if (adminOrgs.length > 0) {
        console.log(`\n✓ Admin Organization Links: ${adminOrgs.length}`);
        for (const link of adminOrgs) {
          console.log(`  - Org ID: ${link.organizationId}, Role: ${link.role}`);
        }
      }
    } else {
      console.log(`✗ Admin user NOT FOUND - ABORT CLEANUP`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`✗ Error checking admin user: ${e.message}`);
    process.exit(1);
  }

  // 2. DELETE COUNTS
  console.log("\n\n2. RECORDS TO DELETE (by table)");
  console.log("-".repeat(80));

  const tables = [
    { name: "users", schema: users, filter: ne(users.email, "abdogiydan2000@gmail.com") },
    { name: "organizations", schema: organizations },
    { name: "organization_users", schema: organizationUsers },
    { name: "service_providers", schema: serviceProviders },
    { name: "distributors", schema: distributors },
    { name: "products", schema: products },
    { name: "card_batches", schema: cardBatches },
    { name: "cards", schema: cards },
    { name: "provider_distributor_relationships", schema: providerDistributorRelationships },
    { name: "provider_distributor_accounts", schema: providerDistributorAccounts },
    { name: "provider_distributor_ledger", schema: providerDistributorLedger },
    { name: "transactions", schema: transactions },
    { name: "notifications", schema: notifications },
    { name: "api_credentials", schema: apiCredentials },
    { name: "api_logs", schema: apiLogs }
  ];

  const deleteCounts = {};
  for (const table of tables) {
    try {
      let query = db.select({ count: count() }).from(table.schema);
      if (table.filter) {
        query = query.where(table.filter);
      }
      const result = await query;
      const cnt = result[0]?.count || 0;
      deleteCounts[table.name] = cnt;
      console.log(`${table.name.padEnd(40)} : ${cnt} records will be deleted`);
    } catch (e) {
      console.log(`${table.name.padEnd(40)} : ERROR - ${e.message.split('\n')[0]}`);
    }
  }

  // 3. REBUILD COUNTS
  console.log("\n\n3. RECORDS TO CREATE (rebuild)");
  console.log("-".repeat(80));

  const rebuildCounts = {
    providers: 5,
    distributors: 3,
    providerUsers: 2,
    organizations: 8, // 5 providers + 3 distributors
    organizationUsers: 10, // 5 provider users + 3 distributor users + 2 admin links
    products: 25, // 5 providers * 5 denominations
    cardBatches: 25, // 1 per product
    cards: 2500, // 100 cards per product
    relationships: 15, // 3 distributors * 5 providers
    accounts: 15, // 1 per relationship
    ledgerEntries: 0, // Will be created by transactions
    transactions: 15, // 5 per distributor (sample)
    apiCredentials: 3, // 1 per distributor
  };

  console.log(`Providers                          : ${rebuildCounts.providers} new`);
  console.log(`Distributors                       : ${rebuildCounts.distributors} new`);
  console.log(`Provider Demo Users                : ${rebuildCounts.providerUsers} new`);
  console.log(`Organizations                      : ${rebuildCounts.organizations} new`);
  console.log(`Organization-User Links            : ${rebuildCounts.organizationUsers} new`);
  console.log(`Products                           : ${rebuildCounts.products} new`);
  console.log(`Card Batches                       : ${rebuildCounts.cardBatches} new`);
  console.log(`Cards (AVAILABLE)                  : ${rebuildCounts.cards} new`);
  console.log(`Provider-Distributor Relationships : ${rebuildCounts.relationships} new`);
  console.log(`Provider-Distributor Accounts      : ${rebuildCounts.accounts} new`);
  console.log(`Ledger Entries                     : ${rebuildCounts.ledgerEntries} (from transactions)`);
  console.log(`Sample Transactions                : ${rebuildCounts.transactions} new`);
  console.log(`API Credentials                    : ${rebuildCounts.apiCredentials} new`);

  // 4. TRANSACTION CONFIRMATION
  console.log("\n\n4. TRANSACTION SAFETY");
  console.log("-".repeat(80));
  console.log("✓ All cleanup operations will run in a SINGLE TRANSACTION");
  console.log("✓ If any error occurs, entire transaction will ROLLBACK");
  console.log("✓ Database will be left in original state if cleanup fails");
  console.log("✓ Admin account is protected by WHERE clause (not deleted)");

  // 5. SUMMARY
  console.log("\n\n5. SUMMARY");
  console.log("-".repeat(80));
  const totalDeletes = Object.values(deleteCounts).reduce((a, b) => a + b, 0);
  const totalCreates = Object.values(rebuildCounts).reduce((a, b) => a + b, 0);
  console.log(`Total records to DELETE: ${totalDeletes}`);
  console.log(`Total records to CREATE: ${totalCreates}`);
  console.log(`Admin account: PRESERVED`);
  console.log(`Transaction: ATOMIC (all-or-nothing)`);
  console.log(`Rollback: AVAILABLE if validation fails`);

  console.log("\n" + "=".repeat(80));
  console.log("SAFETY PREVIEW COMPLETE - READY FOR APPROVAL");
  console.log("=".repeat(80) + "\n");

  process.exit(0);
}

generateSafetyPreview().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
