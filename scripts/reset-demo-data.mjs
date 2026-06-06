#!/usr/bin/env node

/**
 * Demo Data Reset Utility
 * 
 * Safely resets demo data between client presentations while preserving:
 * - Demo providers
 * - Demo distributors
 * - Demo products
 * - Provider-distributor relationships
 * - API credentials
 * 
 * Resets:
 * - Card statuses (SOLD → AVAILABLE)
 * - Transactions
 * - Ledger entries
 * - Account balances
 * 
 * Safety:
 * - Only affects demo records (identified by timestamp suffix 1777407398700)
 * - Requires explicit --confirm-demo-reset flag
 * - Validates before executing
 * - Provides detailed summary
 * 
 * Usage: node scripts/reset-demo-data.mjs --confirm-demo-reset
 */

import mysql from 'mysql2/promise';
import process from 'process';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// Demo data identifier
const DEMO_TIMESTAMP = '1777407398700';
const DEMO_IDENTIFIER = `%${DEMO_TIMESTAMP}%`;

// Check for confirmation flag
const hasConfirmation = process.argv.includes('--confirm-demo-reset');

if (!hasConfirmation) {
  console.log('⚠️  Demo Reset Utility\n');
  console.log('This utility will reset demo data between client presentations.');
  console.log('It will:');
  console.log('  • Reset card statuses to AVAILABLE');
  console.log('  • Clear transactions');
  console.log('  • Clear ledger entries');
  console.log('  • Restore account balances\n');
  console.log('It will NOT affect:');
  console.log('  • Demo providers');
  console.log('  • Demo distributors');
  console.log('  • Demo products');
  console.log('  • Provider-distributor relationships');
  console.log('  • API credentials\n');
  console.log('To proceed, run:');
  console.log('  node scripts/reset-demo-data.mjs --confirm-demo-reset\n');
  process.exit(0);
}

async function resetDemoData() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('🔄 Starting demo data reset...\n');
    
    // Step 1: Identify demo records
    console.log('STEP 1: Identifying demo records');
    
    const [demoProviders] = await conn.execute(
      'SELECT id FROM service_providers WHERE provider_code LIKE ?',
      [DEMO_IDENTIFIER]
    );
    
    const [demoDistributors] = await conn.execute(
      'SELECT id FROM distributors WHERE name LIKE ?',
      [DEMO_IDENTIFIER]
    );
    
    console.log(`✓ Found ${demoProviders.length} demo providers`);
    console.log(`✓ Found ${demoDistributors.length} demo distributors`);
    
    if (demoProviders.length === 0 || demoDistributors.length === 0) {
      console.log('⚠️  No demo data found. Aborting.');
      process.exit(0);
    }
    
    // Create ID lists for queries
    const providerIds = demoProviders.map(p => p.id);
    const distributorIds = demoDistributors.map(d => d.id);
    
    // Step 2: Count records before reset
    console.log('\nSTEP 2: Counting records before reset');
    
    const [soldCards] = await conn.execute(
      `SELECT COUNT(*) as count FROM cards
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND status = 'SOLD'`,
      providerIds
    );
    
    const [transactions] = await conn.execute(
      `SELECT COUNT(*) as count FROM transactions
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [...providerIds, ...distributorIds]
    );
    
    const [ledgerEntries] = await conn.execute(
      `SELECT COUNT(*) as count FROM provider_distributor_ledger
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [...providerIds, ...distributorIds]
    );
    
    console.log(`✓ Sold cards to reset: ${soldCards[0].count}`);
    console.log(`✓ Transactions to clear: ${transactions[0].count}`);
    console.log(`✓ Ledger entries to clear: ${ledgerEntries[0].count}`);
    
    // Step 3: Get original balances
    console.log('\nSTEP 3: Capturing original balance values');
    
    const originalBalance = 100000;
    const originalUsedCredit = 0;
    
    console.log(`✓ Original balance: ${originalBalance}`);
    console.log(`✓ Original used credit: ${originalUsedCredit}`);
    
    // Step 4: Reset cards
    console.log('\nSTEP 4: Resetting card statuses');
    
    const [cardReset] = await conn.execute(
      `UPDATE cards
       SET status = 'AVAILABLE', allocated_to_distributor_id = NULL, allocated_at = NULL
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND status = 'SOLD'`,
      providerIds
    );
    
    console.log(`✓ Reset ${cardReset.affectedRows} cards to AVAILABLE`);
    
    // Step 5: Clear transactions
    console.log('\nSTEP 5: Clearing transactions');
    
    const [txDelete] = await conn.execute(
      `DELETE FROM transactions
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [...providerIds, ...distributorIds]
    );
    
    console.log(`✓ Deleted ${txDelete.affectedRows} transactions`);
    
    // Step 6: Clear ledger entries
    console.log('\nSTEP 6: Clearing ledger entries');
    
    const [ledgerDelete] = await conn.execute(
      `DELETE FROM provider_distributor_ledger
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [...providerIds, ...distributorIds]
    );
    
    console.log(`✓ Deleted ${ledgerDelete.affectedRows} ledger entries`);
    
    // Step 7: Reset account balances
    console.log('\nSTEP 7: Restoring account balances');
    
    const [balanceReset] = await conn.execute(
      `UPDATE provider_distributor_accounts
       SET balance = ?, used_credit = ?, version = 1
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [originalBalance, originalUsedCredit, ...providerIds, ...distributorIds]
    );
    
    console.log(`✓ Reset ${balanceReset.affectedRows} account balances`);
    
    // Step 8: Verify reset
    console.log('\nSTEP 8: Verifying reset');
    
    const [soldCardsAfter] = await conn.execute(
      `SELECT COUNT(*) as count FROM cards
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND status = 'SOLD'`,
      providerIds
    );
    
    const [transactionsAfter] = await conn.execute(
      `SELECT COUNT(*) as count FROM transactions
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [...providerIds, ...distributorIds]
    );
    
    const [ledgerAfter] = await conn.execute(
      `SELECT COUNT(*) as count FROM provider_distributor_ledger
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})`,
      [...providerIds, ...distributorIds]
    );
    
    const [balancesAfter] = await conn.execute(
      `SELECT COUNT(*) as count FROM provider_distributor_accounts
       WHERE provider_id IN (${providerIds.map(() => '?').join(',')})
       AND distributor_id IN (${distributorIds.map(() => '?').join(',')})
       AND balance = ? AND used_credit = ?`,
      [...providerIds, ...distributorIds, originalBalance, originalUsedCredit]
    );
    
    console.log(`✓ Sold cards remaining: ${soldCardsAfter[0].count}`);
    console.log(`✓ Transactions remaining: ${transactionsAfter[0].count}`);
    console.log(`✓ Ledger entries remaining: ${ledgerAfter[0].count}`);
    console.log(`✓ Accounts with original balance: ${balancesAfter[0].count}`);
    
    // Summary
    console.log('\n=== RESET SUMMARY ===');
    console.log(`\n✅ Demo data reset completed successfully!\n`);
    console.log('Changes:');
    console.log(`  • ${cardReset.affectedRows} cards reset to AVAILABLE`);
    console.log(`  • ${txDelete.affectedRows} transactions cleared`);
    console.log(`  • ${ledgerDelete.affectedRows} ledger entries cleared`);
    console.log(`  • ${balanceReset.affectedRows} account balances restored`);
    console.log('\nPreserved:');
    console.log(`  • ${demoProviders.length} demo providers`);
    console.log(`  • ${demoDistributors.length} demo distributors`);
    console.log('  • Demo products');
    console.log('  • Provider-distributor relationships');
    console.log('  • API credentials');
    console.log('\n✓ Ready for next client demonstration');
    
  } catch (error) {
    console.error('\n❌ Error during reset:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

resetDemoData();
