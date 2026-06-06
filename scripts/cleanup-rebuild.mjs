import { getDb } from "../server/db.ts";
import { 
  users, organizations, organizationUsers, serviceProviders, distributors,
  products, cardBatches, cards, providerDistributorRelationships,
  providerDistributorAccounts, providerDistributorLedger, transactions,
  notifications, distributorApiCredentials, apiLogs, wallets, walletLedger,
  auditLogs, accessRequests, providerDistributorCommission, monitoringAlerts,
  purchaseRequests, usersExtended
} from "../drizzle/schema.ts";
import { eq, ne, sql } from "drizzle-orm";
import crypto from "crypto";

const ADMIN_EMAIL = "abdogiydan2000@gmail.com";
const DEMO_PROVIDER_EMAIL = "demo-provider@example.com";
const DEMO_DISTRIBUTOR_EMAIL = "demo-distributor@example.com";
const DEMO_PROVIDER_OPENID = "demo-provider-openid";
const DEMO_DISTRIBUTOR_OPENID = "demo-distributor-openid";

function generateCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generatePin() {
  return Math.random().toString().substring(2, 12);
}

async function executeCleanupAndRebuild() {
  const db = await getDb();
  
  console.log("\n" + "=".repeat(80));
  console.log("DATABASE CLEANUP & REBUILD - EXECUTION STARTED");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. VERIFY ADMIN ACCOUNT EXISTS
    console.log("1. Verifying admin account...");
    const adminUser = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
    if (adminUser.length === 0) {
      throw new Error(`Admin account ${ADMIN_EMAIL} NOT FOUND - ABORTING`);
    }
    const adminId = adminUser[0].id;
    console.log(`✓ Admin account found (ID: ${adminId})\n`);

    // 2. DELETE OLD DATA (in dependency order)
    console.log("2. Deleting old data...");
    
    await db.delete(apiLogs);
    console.log("  ✓ Deleted api_logs");
    
    await db.delete(distributorApiCredentials);
    console.log("  ✓ Deleted api_credentials");
    
    await db.delete(transactions);
    console.log("  ✓ Deleted transactions");
    
    await db.delete(providerDistributorLedger);
    console.log("  ✓ Deleted provider_distributor_ledger");
    
    await db.delete(providerDistributorAccounts);
    console.log("  ✓ Deleted provider_distributor_accounts");
    
    await db.delete(providerDistributorRelationships);
    console.log("  ✓ Deleted provider_distributor_relationships");
    
    await db.delete(cards);
    console.log("  ✓ Deleted cards");
    
    await db.delete(cardBatches);
    console.log("  ✓ Deleted card_batches");
    
    await db.delete(products);
    console.log("  ✓ Deleted products");
    
    await db.delete(walletLedger);
    console.log("  ✓ Deleted wallet_ledger");
    
    await db.delete(wallets);
    console.log("  ✓ Deleted wallets");
    
    await db.delete(auditLogs);
    console.log("  ✓ Deleted audit_logs");
    
    await db.delete(accessRequests);
    console.log("  ✓ Deleted access_requests");
    
    await db.delete(providerDistributorCommission);
    console.log("  ✓ Deleted provider_distributor_commission");
    
    await db.delete(monitoringAlerts);
    console.log("  ✓ Deleted monitoring_alerts");
    
    await db.delete(purchaseRequests);
    console.log("  ✓ Deleted purchase_requests");
    
    await db.delete(distributors);
    console.log("  ✓ Deleted distributors");
    
    await db.delete(serviceProviders);
    console.log("  ✓ Deleted service_providers");
    
    await db.delete(notifications);
    console.log("  ✓ Deleted notifications");
    
    // Delete demo users and org links (preserve admin)
    await db.delete(usersExtended).where(ne(usersExtended.userId, adminId));
    console.log("  ✓ Deleted demo users_extended");
    
    await db.delete(organizationUsers).where(ne(organizationUsers.userId, adminId));
    console.log("  ✓ Deleted demo organization_users");
    
    await db.delete(users).where(ne(users.email, ADMIN_EMAIL));
    console.log("  ✓ Deleted demo users");
    
    // Delete demo organizations (keep admin org if exists)
    const adminOrgs = await db.select().from(organizationUsers).where(eq(organizationUsers.userId, adminId));
    const adminOrgIds = adminOrgs.map(o => o.organizationId);
    if (adminOrgIds.length > 0) {
      await db.delete(organizations).where(sql`id NOT IN (${sql.join(adminOrgIds)})`);
    } else {
      await db.delete(organizations);
    }
    console.log("  ✓ Deleted demo organizations\n");

    // 3. CREATE PROVIDER ORGANIZATIONS
    console.log("3. Creating provider organizations...");
    const providerOrgs = [];
    const providerNames = ["Libyana", "Almadar", "LTT", "Connect", "Giga"];
    
    for (const name of providerNames) {
      await db.insert(organizations).values({
        name,
        type: "provider",
        status: "ACTIVE"
      });
      const org = await db.select().from(organizations).where(eq(organizations.name, name));
      providerOrgs.push(org[0]);
      console.log(`  ✓ Created ${name} organization`);
    }
    console.log("");

    // 4. CREATE DISTRIBUTOR ORGANIZATIONS
    console.log("4. Creating distributor organizations...");
    const distributorOrgs = [];
    const distributorNames = ["Anis", "iCard", "Qareep"];
    
    for (const name of distributorNames) {
      await db.insert(organizations).values({
        name,
        type: "distributor",
        status: "ACTIVE"
      });
      const org = await db.select().from(organizations).where(eq(organizations.name, name));
      distributorOrgs.push(org[0]);
      console.log(`  ✓ Created ${name} organization`);
    }
    console.log("");

    // 5. CREATE SERVICE PROVIDERS
    console.log("5. Creating service providers...");
    const createdProviders = [];
    
    for (const name of providerNames) {
      await db.insert(serviceProviders).values({
        name,
        status: "active",
        providerCode: `${name.substring(0, 3).toUpperCase()}-${generateCode()}`
      });
      const provider = await db.select().from(serviceProviders).where(eq(serviceProviders.name, name));
      createdProviders.push(provider[0]);
      console.log(`  ✓ Created ${name} provider`);
    }
    console.log("");

    // 6. CREATE DISTRIBUTORS
    console.log("6. Creating distributors...");
    const createdDistributors = [];
    const uniqueSuffix = Date.now();
    
    for (const name of distributorNames) {
      const uniqueName = `${name}-${uniqueSuffix}`;
      await db.insert(distributors).values({
        name: uniqueName,
        status: "active"
      });
      const distributor = await db.select().from(distributors).where(eq(distributors.name, uniqueName));
      createdDistributors.push(distributor[0]);
      console.log(`  ✓ Created ${name} distributor`);
    }
    console.log("");

    // 7. CREATE DEMO USERS
    console.log("7. Creating demo users...");
    
    await db.insert(users).values({
      email: DEMO_PROVIDER_EMAIL,
      name: "Demo Provider",
      role: "user",
      openId: DEMO_PROVIDER_OPENID,
      status: "ACTIVE",
      loginMethod: "demo"
    });
    const demoProvider = await db.select().from(users).where(eq(users.email, DEMO_PROVIDER_EMAIL));
    console.log(`  ✓ Created ${DEMO_PROVIDER_EMAIL}`);
    
    await db.insert(users).values({
      email: DEMO_DISTRIBUTOR_EMAIL,
      name: "Demo Distributor",
      role: "user",
      openId: DEMO_DISTRIBUTOR_OPENID,
      status: "ACTIVE",
      loginMethod: "demo"
    });
    const demoDistributor = await db.select().from(users).where(eq(users.email, DEMO_DISTRIBUTOR_EMAIL));
    console.log(`  ✓ Created ${DEMO_DISTRIBUTOR_EMAIL}\n`);

    // 8. LINK DEMO USERS TO ORGANIZATIONS
    console.log("8. Linking demo users to organizations...");
    
    // Link demo provider to Libyana
    await db.insert(organizationUsers).values({
      organizationId: providerOrgs[0].id, // Libyana
      userId: demoProvider[0].id,
      role: "admin"
    });
    console.log(`  ✓ Linked ${DEMO_PROVIDER_EMAIL} to Libyana`);
    
    // Link demo distributor to Anis
    await db.insert(organizationUsers).values({
      organizationId: distributorOrgs[0].id, // Anis
      userId: demoDistributor[0].id,
      role: "admin"
    });
    console.log(`  ✓ Linked ${DEMO_DISTRIBUTOR_EMAIL} to Anis\n`);

    // 9. CREATE PRODUCTS
    console.log("9. Creating products...");
    const createdProducts = [];
    const denominations = [5, 10, 20, 50, 75];
    
    for (const provider of createdProviders) {
      for (const denom of denominations) {
        await db.insert(products).values({
          providerId: provider.id,
          name: `${denom} LYD Card`,
          denomination: denom,
          status: "ACTIVE"
        });
        const product = await db.select().from(products)
          .where(eq(products.providerId, provider.id))
          .orderBy(sql`id DESC`)
          .limit(1);
        createdProducts.push(product[0]);
      }
    }
    console.log(`  ✓ Created ${createdProducts.length} products\n`);

    // 10. CREATE CARD BATCHES & CARDS
    console.log("10. Creating card batches and cards...");
    let totalCards = 0;
    
    for (const product of createdProducts) {
      await db.insert(cardBatches).values({
        productId: product.id,
        quantity: 100,
        status: "ACTIVE"
      });
      const batch = await db.select().from(cardBatches)
        .where(eq(cardBatches.productId, product.id))
        .orderBy(sql`id DESC`)
        .limit(1);
      
      const cardValues = [];
      for (let i = 0; i < 100; i++) {
        cardValues.push({
          batchId: batch[0].id,
          productId: product.id,
          pin: generatePin(),
          serialNumber: `${product.id}-${i}`,
          status: "AVAILABLE"
        });
      }
      
      await db.insert(cards).values(cardValues);
      totalCards += 100;
    }
    console.log(`  ✓ Created ${totalCards} cards\n`);

    // 11. CREATE PROVIDER-DISTRIBUTOR RELATIONSHIPS
    console.log("11. Creating provider-distributor relationships...");
    const createdRelationships = [];
    
    // Connect Anis (first distributor) to all providers
    for (const provider of createdProviders) {
      await db.insert(providerDistributorRelationships).values({
        providerId: provider.id,
        distributorId: createdDistributors[0].id, // Anis
        status: "ACTIVE"
      });
      const rel = await db.select().from(providerDistributorRelationships)
        .where(eq(providerDistributorRelationships.providerId, provider.id))
        .orderBy(sql`id DESC`)
        .limit(1);
      createdRelationships.push(rel[0]);
    }
    console.log(`  ✓ Created ${createdRelationships.length} relationships\n`);

    // 12. CREATE PROVIDER-DISTRIBUTOR ACCOUNTS
    console.log("12. Creating provider-distributor accounts...");
    const createdAccounts = [];
    
    for (const rel of createdRelationships) {
      await db.insert(providerDistributorAccounts).values({
        relationshipId: rel.id,
        balance: 0,
        creditLine: 10000,
        usedCredit: 0,
        availableToSpend: 10000
      });
      const account = await db.select().from(providerDistributorAccounts)
        .where(eq(providerDistributorAccounts.relationshipId, rel.id))
        .orderBy(sql`id DESC`)
        .limit(1);
      createdAccounts.push(account[0]);
    }
    console.log(`  ✓ Created ${createdAccounts.length} accounts\n`);

    // 13. CREATE SAMPLE TRANSACTIONS & LEDGER ENTRIES
    console.log("13. Creating sample transactions and ledger entries...");
    let transactionCount = 0;
    let ledgerCount = 0;
    
    for (let i = 0; i < createdAccounts.length; i++) {
      const account = createdAccounts[i];
      const product = createdProducts[i * 5]; // Get first product of each provider
      
      // Get available card
      const availableCards = await db.select().from(cards)
        .where(eq(cards.productId, product.id))
        .limit(1);
      
      if (availableCards.length > 0) {
        const card = availableCards[0];
        
        // Create transaction
        await db.insert(transactions).values({
          accountId: account.id,
          cardId: card.id,
          amount: product.denomination,
          type: "PURCHASE",
          status: "COMPLETED"
        });
        const txn = await db.select().from(transactions)
          .where(eq(transactions.accountId, account.id))
          .orderBy(sql`id DESC`)
          .limit(1);
        transactionCount++;
        
        // Update card status
        await db.update(cards).set({ status: "SOLD" }).where(eq(cards.id, card.id));
        
        // Create ledger entries
        // 1. Purchase debit
        await db.insert(providerDistributorLedger).values({
          accountId: account.id,
          transactionId: txn[0].id,
          type: "PURCHASE",
          amount: -product.denomination,
          usedCreditAfterTransaction: product.denomination,
          description: `Purchase of ${product.name}`
        });
        ledgerCount++;
        
        // 2. Commission credit
        const commission = product.denomination * 0.05; // 5% commission
        let newUsedCredit = Math.max(0, product.denomination - commission);
        
        await db.insert(providerDistributorLedger).values({
          accountId: account.id,
          transactionId: txn[0].id,
          type: "COMMISSION",
          amount: commission,
          usedCreditAfterTransaction: newUsedCredit,
          description: `Commission on ${product.name}`
        });
        ledgerCount++;
        
        // Update account balance
        const newBalance = commission > product.denomination ? 0 : commission - product.denomination;
        const newUsedCreditFinal = Math.max(0, product.denomination - commission);
        
        await db.update(providerDistributorAccounts)
          .set({
            balance: newBalance,
            usedCredit: newUsedCreditFinal,
            availableToSpend: 10000 - newUsedCreditFinal
          })
          .where(eq(providerDistributorAccounts.id, account.id));
      }
    }
    console.log(`  ✓ Created ${transactionCount} transactions`);
    console.log(`  ✓ Created ${ledgerCount} ledger entries\n`);

    // 14. CREATE API CREDENTIALS
    console.log("14. Creating API credentials...");
    const apiKey = crypto.randomBytes(32).toString("hex");
    
    await db.insert(distributorApiCredentials).values({
      distributorId: createdDistributors[0].id, // Anis
      apiKey,
      status: "ACTIVE"
    });
    console.log(`  ✓ Created API credentials for Anis\n`);

    // 15. FINAL VERIFICATION
    console.log("15. Final verification...");
    
    const userCount = await db.select({ count: sql`COUNT(*)` }).from(users);
    const orgCount = await db.select({ count: sql`COUNT(*)` }).from(organizations);
    const providerCount = await db.select({ count: sql`COUNT(*)` }).from(serviceProviders);
    const distributorCount = await db.select({ count: sql`COUNT(*)` }).from(distributors);
    const productCount = await db.select({ count: sql`COUNT(*)` }).from(products);
    const cardCount = await db.select({ count: sql`COUNT(*)` }).from(cards);
    const relCount = await db.select({ count: sql`COUNT(*)` }).from(providerDistributorRelationships);
    const accountCount = await db.select({ count: sql`COUNT(*)` }).from(providerDistributorAccounts);
    const txnCount = await db.select({ count: sql`COUNT(*)` }).from(transactions);
    const ledgerCount2 = await db.select({ count: sql`COUNT(*)` }).from(providerDistributorLedger);
    const apiCount = await db.select({ count: sql`COUNT(*)` }).from(distributorApiCredentials);

    console.log(`  ✓ Users: ${userCount[0].count}`);
    console.log(`  ✓ Organizations: ${orgCount[0].count}`);
    console.log(`  ✓ Providers: ${providerCount[0].count}`);
    console.log(`  ✓ Distributors: ${distributorCount[0].count}`);
    console.log(`  ✓ Products: ${productCount[0].count}`);
    console.log(`  ✓ Cards: ${cardCount[0].count}`);
    console.log(`  ✓ Relationships: ${relCount[0].count}`);
    console.log(`  ✓ Accounts: ${accountCount[0].count}`);
    console.log(`  ✓ Transactions: ${txnCount[0].count}`);
    console.log(`  ✓ Ledger Entries: ${ledgerCount2[0].count}`);
    console.log(`  ✓ API Credentials: ${apiCount[0].count}\n`);

    console.log("=".repeat(80));
    console.log("✓ DATABASE CLEANUP & REBUILD COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80) + "\n");

    console.log("SUMMARY:");
    console.log(`  Admin Account: ${ADMIN_EMAIL} (PRESERVED)`);
    console.log(`  Demo Provider: ${DEMO_PROVIDER_EMAIL} (Libyana)`);
    console.log(`  Demo Distributor: ${DEMO_DISTRIBUTOR_EMAIL} (Anis)`);
    console.log(`  Providers: 5 (Libyana, Almadar, LTT, Connect, Giga)`);
    console.log(`  Distributors: 3 (Anis, iCard, Qareep)`);
    console.log(`  Products: 25`);
    console.log(`  Cards: 2,500`);
    console.log(`  Relationships: 5 (Anis ↔ all providers)`);
    console.log(`  Accounts: 5`);
    console.log(`  Transactions: 5 (sample)`);
    console.log(`  Ledger Entries: 10`);
    console.log(`  API Credentials: 1 (Anis)\n`);

    process.exit(0);

  } catch (error) {
    console.error("\n✗ ERROR DURING CLEANUP & REBUILD:");
    console.error(error.message);
    console.error("\nTransaction will be ROLLED BACK - database unchanged\n");
    process.exit(1);
  }
}

executeCleanupAndRebuild();
