/**
 * Run-Mode Cleanup Script
 * 
 * Safely removes all seeded data created by seed-run-mode.mjs
 * Preserves production data and admin accounts
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const url = new URL(DATABASE_URL);
const pool = mysql.createPool({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {},
});

async function cleanupRunModeData() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🧹 Starting Run-Mode Data Cleanup...\n');
    
    // Get IDs of seeded providers and distributors (by SEED_ prefix)
    const [seedProviders] = await connection.execute(
      `SELECT id FROM service_providers WHERE provider_code LIKE 'SEED_%'`
    );
    
    const [seedDistributors] = await connection.execute(
      `SELECT id FROM distributors WHERE name LIKE 'SEED_%'`
    );
    
    // Also get seeded organizations
    const [seedOrganizations] = await connection.execute(
      `SELECT id FROM organizations WHERE (type = 'provider' AND name IN ('Libyana', 'Almadar', 'LTT', 'Connect', 'Giga')) 
       OR (type = 'distributor' AND name IN ('Anis', 'iCard', 'Qareep'))`
    );
    
    if (seedProviders.length === 0 && seedDistributors.length === 0 && seedOrganizations.length === 0) {
      console.log('ℹ️  No seeded data found to clean up.\n');
      return;
    }
    
    const providerIds = seedProviders.map(p => p.id);
    const distributorIds = seedDistributors.map(d => d.id);
    const organizationIds = seedOrganizations.map(o => o.id);
    
    console.log(`Found ${providerIds.length} seeded providers, ${distributorIds.length} seeded distributors, and ${organizationIds.length} seeded organizations\n`);
    
    // Delete in order of dependencies
    
    // 1. Delete organization_users (links to organizations)
    if (organizationIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM organization_users WHERE organization_id IN (${organizationIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} organization user links`);
    }
    
    // 2. Delete transactions
    if (providerIds.length > 0 || distributorIds.length > 0) {
      let sql = 'DELETE FROM transactions WHERE ';
      const conditions = [];
      if (providerIds.length > 0) conditions.push(`provider_id IN (${providerIds.join(',')})`);
      if (distributorIds.length > 0) conditions.push(`distributor_id IN (${distributorIds.join(',')})`);
      sql += conditions.join(' OR ');
      const [result] = await connection.execute(sql);
      console.log(`✓ Deleted ${result.affectedRows} transactions`);
    }
    
    // 3. Delete ledger entries
    if (providerIds.length > 0 || distributorIds.length > 0) {
      let sql = 'DELETE FROM provider_distributor_ledger WHERE ';
      const conditions = [];
      if (providerIds.length > 0) conditions.push(`provider_id IN (${providerIds.join(',')})`);
      if (distributorIds.length > 0) conditions.push(`distributor_id IN (${distributorIds.join(',')})`);
      sql += conditions.join(' OR ');
      const [result] = await connection.execute(sql);
      console.log(`✓ Deleted ${result.affectedRows} ledger entries`);
    }
    
    // 4. Delete financial accounts
    if (providerIds.length > 0 || distributorIds.length > 0) {
      let sql = 'DELETE FROM provider_distributor_accounts WHERE ';
      const conditions = [];
      if (providerIds.length > 0) conditions.push(`provider_id IN (${providerIds.join(',')})`);
      if (distributorIds.length > 0) conditions.push(`distributor_id IN (${distributorIds.join(',')})`);
      sql += conditions.join(' OR ');
      const [result] = await connection.execute(sql);
      console.log(`✓ Deleted ${result.affectedRows} financial accounts`);
    }
    
    // 5. Delete relationships
    if (providerIds.length > 0 || distributorIds.length > 0) {
      let sql = 'DELETE FROM provider_distributor_relationships WHERE ';
      const conditions = [];
      if (providerIds.length > 0) conditions.push(`provider_id IN (${providerIds.join(',')})`);
      if (distributorIds.length > 0) conditions.push(`distributor_id IN (${distributorIds.join(',')})`);
      sql += conditions.join(' OR ');
      const [result] = await connection.execute(sql);
      console.log(`✓ Deleted ${result.affectedRows} relationships`);
    }
    
    // 6. Delete API credentials
    if (distributorIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM distributor_api_credentials WHERE distributor_id IN (${distributorIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} API credentials`);
    }
    
    // 7. Delete cards
    if (providerIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM cards WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} cards`);
    }
    
    // 8. Delete card batches
    if (providerIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM card_batches WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} card batches`);
    }
    
    // 9. Delete products
    if (providerIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM products WHERE provider_id IN (${providerIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} products`);
    }
    
    // 10. Delete providers
    if (providerIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM service_providers WHERE id IN (${providerIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} providers`);
    }
    
    // 11. Delete distributors
    if (distributorIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM distributors WHERE id IN (${distributorIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} distributors`);
    }
    
    // 12. Delete organizations
    if (organizationIds.length > 0) {
      const [result] = await connection.execute(
        `DELETE FROM organizations WHERE id IN (${organizationIds.join(',')})`
      );
      console.log(`✓ Deleted ${result.affectedRows} organizations`);
    }
    
    console.log('\n✅ Run-Mode Data Cleanup Completed Successfully!\n');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

cleanupRunModeData().catch(console.error);
