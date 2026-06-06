import { db } from "./server/db";
import { users, organizations, organizationUsers, serviceProviders, distributors, products, cardBatches, cards, providerDistributorRelationships, providerDistributorAccounts, providerDistributorLedger, transactions, notifications, apiCredentials, apiLogs } from "./drizzle/schema";
import { count, eq } from "drizzle-orm";

async function analyzeDatabase() {
  console.log("=== DATABASE STATE ANALYSIS ===\n");

  const tables = [
    { name: "users", schema: users },
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

  console.log("TABLE RECORD COUNTS:");
  console.log("=".repeat(50));

  for (const table of tables) {
    try {
      const result = await db.select({ count: count() }).from(table.schema);
      console.log(`${table.name.padEnd(35)} : ${result[0].count} records`);
    } catch (e) {
      console.log(`${table.name.padEnd(35)} : ERROR`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("\nADMIN ACCOUNT CHECK:");
  console.log("=".repeat(50));

  try {
    const adminUser = await db.select().from(users).where(eq(users.email, "abdogiydan2000@gmail.com"));
    if (adminUser.length > 0) {
      const user = adminUser[0];
      console.log(`✓ Admin account found:`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Name: ${user.name}`);
      console.log(`  - Role: ${user.role}`);
    } else {
      console.log(`✗ Admin account NOT found`);
    }
  } catch (e) {
    console.log(`✗ Error checking admin account`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\nDEMO USERS:");
  console.log("=".repeat(50));

  try {
    const demoUsers = await db.select().from(users);
    const filtered = demoUsers.filter(u => u.email?.includes("demo") || u.loginMethod === "demo");
    console.log(`Found ${filtered.length} demo users:`);
    filtered.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
    });
  } catch (e) {
    console.log(`Error checking demo users`);
  }

  process.exit(0);
}

analyzeDatabase().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
