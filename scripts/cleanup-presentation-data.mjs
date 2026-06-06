#!/usr/bin/env node

/**
 * Cleanup Script for Presentation/Run-Mode Seeded Data
 * 
 * This script safely removes all seeded data created for presentation/testing:
 * - Seeded providers (Libyana, Almadar, LTT, Connect, Giga)
 * - Seeded distributors (SEED_Anis, SEED_iCard, SEED_Qareep)
 * - Presentation users (libyana-provider@presentation.local, anis-distributor@presentation.local)
 * - All related transactions, cards, ledger entries, and accounts
 * 
 * SAFETY FEATURES:
 * - Dry-run mode by default (--execute to apply changes)
 * - Preserves admin account (abdogiydan2000@gmail.com)
 * - Preserves non-seeded data
 * - Detailed logging of what will be deleted
 * 
 * Usage:
 *   node scripts/cleanup-presentation-data.mjs          # Dry-run (show what would be deleted)
 *   node scripts/cleanup-presentation-data.mjs --execute # Actually delete the data
 */

import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDryRun = !process.argv.includes('--execute');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const pool = mysql.createPool({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: {},
  });

  const conn = await pool.getConnection();

  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     PRESENTATION DATA CLEANUP SCRIPT                       ║');
    console.log(`║     Mode: ${isDryRun ? 'DRY-RUN (no changes)' : 'EXECUTE (deleting data)'}                  ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // ========================================
    // 1. IDENTIFY SEEDED DATA
    // ========================================
    console.log('📋 Identifying seeded data...\n');

    // Get seeded provider IDs
    const [seedProviders] = await conn.execute(
      'SELECT id, name, provider_code FROM service_providers WHERE provider_code LIKE "SEED_%"'
    );
    const providerIds = seedProviders.map(p => p.id);

    console.log(`📌 Seeded Providers (${seedProviders.length}):`);
    seedProviders.forEach(p => {
      console.log(`   - ${p.name} (ID: ${p.id})`);
    });

    // Get seeded distributor IDs
    const [seedDistributors] = await conn.execute(
      'SELECT id, name FROM distributors WHERE name LIKE "SEED_%"'
    );
    const distributorIds = seedDistributors.map(d => d.id);

    console.log(`\n📌 Seeded Distributors (${seedDistributors.length}):`);
    seedDistributors.forEach(d => {
      console.log(`   - ${d.name} (ID: ${d.id})`);
    });

    // Get presentation users
    const [presentationUsers] = await conn.execute(
      'SELECT id, email FROM users WHERE email LIKE "%@presentation.local"'
    );

    console.log(`\n📌 Presentation Users (${presentationUsers.length}):`);
    presentationUsers.forEach(u => {
      console.log(`   - ${u.email} (ID: ${u.id})`);
    });

    // ========================================
    // 2. COUNT RELATED DATA
    // ========================================
    console.log('\n📊 Related Data to be Deleted:\n');

    if (providerIds.length > 0) {
      const [txnCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM transactions WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Transactions: ${txnCount[0].count}`);

      const [cardCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM cards WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Cards: ${cardCount[0].count}`);

      const [batchCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM card_batches WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Card Batches: ${batchCount[0].count}`);

      const [productCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM products WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Products: ${productCount[0].count}`);

      const [ledgerCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Ledger Entries: ${ledgerCount[0].count}`);

      const [accountCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM provider_distributor_accounts WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Provider-Distributor Accounts: ${accountCount[0].count}`);

      const [relationshipCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM provider_distributor_relationships WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`   - Provider-Distributor Relationships: ${relationshipCount[0].count}`);
    }

    if (distributorIds.length > 0) {
      const [apiCredCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM api_credentials WHERE distributor_id IN (${distributorIds.join(',')})`
      );
      console.log(`   - API Credentials: ${apiCredCount[0].count}`);
    }

    // ========================================
    // 3. EXECUTE CLEANUP (if --execute flag)
    // ========================================
    if (isDryRun) {
      console.log('\n⚠️  DRY-RUN MODE: No data will be deleted.');
      console.log('    Run with --execute flag to actually delete the data:\n');
      console.log('    node scripts/cleanup-presentation-data.mjs --execute\n');
    } else {
      console.log('\n🗑️  EXECUTING CLEANUP...\n');

      // Delete in dependency order (leaf to root)
      const deletionOrder = [
        { table: 'transactions', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'cards', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'card_batches', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'products', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'provider_distributor_ledger', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'provider_distributor_accounts', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'provider_distributor_relationships', condition: providerIds.length > 0 ? `provider_id IN (${providerIds.join(',')})` : null },
        { table: 'api_credentials', condition: distributorIds.length > 0 ? `distributor_id IN (${distributorIds.join(',')})` : null },
        { table: 'organization_users', condition: presentationUsers.length > 0 ? `user_id IN (${presentationUsers.map(u => u.id).join(',')})` : null },
        { table: 'users', condition: presentationUsers.length > 0 ? `id IN (${presentationUsers.map(u => u.id).join(',')})` : null },
        { table: 'service_providers', condition: providerIds.length > 0 ? `id IN (${providerIds.join(',')})` : null },
        { table: 'distributors', condition: distributorIds.length > 0 ? `id IN (${distributorIds.join(',')})` : null },
        { table: 'organizations', condition: `name IN ('Libyana', 'Almadar', 'LTT', 'Connect', 'Giga', 'SEED_Anis', 'SEED_iCard', 'SEED_Qareep')` },
      ];

      for (const { table, condition } of deletionOrder) {
        if (!condition) continue;

        const [result] = await conn.execute(`DELETE FROM ${table} WHERE ${condition}`);
        if (result.affectedRows > 0) {
          console.log(`   ✓ Deleted ${result.affectedRows} rows from ${table}`);
        }
      }

      console.log('\n✅ Cleanup completed successfully!');
      console.log('   All presentation/seeded data has been removed.');
      console.log('   Admin account (abdogiydan2000@gmail.com) has been preserved.\n');
    }

    // ========================================
    // 4. VERIFICATION
    // ========================================
    console.log('🔍 Verification:\n');

    const [finalProviders] = await conn.execute(
      'SELECT COUNT(*) as count FROM service_providers WHERE provider_code LIKE "SEED_%"'
    );
    console.log(`   Seeded Providers Remaining: ${finalProviders[0].count}`);

    const [finalDistributors] = await conn.execute(
      'SELECT COUNT(*) as count FROM distributors WHERE name LIKE "SEED_%"'
    );
    console.log(`   Seeded Distributors Remaining: ${finalDistributors[0].count}`);

    const [finalUsers] = await conn.execute(
      'SELECT COUNT(*) as count FROM users WHERE email LIKE "%@presentation.local"'
    );
    console.log(`   Presentation Users Remaining: ${finalUsers[0].count}`);

    const [adminCheck] = await conn.execute(
      'SELECT COUNT(*) as count FROM users WHERE email = "abdogiydan2000@gmail.com"'
    );
    console.log(`   Admin Account Preserved: ${adminCheck[0].count === 1 ? '✅ YES' : '❌ NO'}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
