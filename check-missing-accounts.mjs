import { getRawDb } from './server/db.ts';

async function checkMissingAccounts() {
  const pool = await getRawDb();
  const conn = await pool.getConnection();
  
  try {
    // Get all distributors
    console.log('\n=== ALL DISTRIBUTORS ===');
    const [distributors] = await conn.execute(
      `SELECT id, name FROM distributors ORDER BY id`
    );
    console.log(`Total distributors: ${distributors.length}`);
    distributors.forEach(d => console.log(`  - ${d.name} (ID: ${d.id})`));
    
    // Get all provider-distributor accounts
    console.log('\n=== PROVIDER-DISTRIBUTOR ACCOUNTS ===');
    const [accounts] = await conn.execute(
      `SELECT DISTINCT distributor_id FROM provider_distributor_accounts ORDER BY distributor_id`
    );
    console.log(`Distributors with accounts: ${accounts.length}`);
    const accountDistIds = new Set(accounts.map(a => a.distributor_id));
    accounts.forEach(a => console.log(`  - Distributor ID: ${a.distributor_id}`));
    
    // Get distributors with transactions
    console.log('\n=== DISTRIBUTORS WITH TRANSACTIONS ===');
    const [txDistributors] = await conn.execute(
      `SELECT DISTINCT distributor_id FROM transactions WHERE distributor_id IS NOT NULL ORDER BY distributor_id`
    );
    console.log(`Distributors with transactions: ${txDistributors.length}`);
    txDistributors.forEach(d => console.log(`  - Distributor ID: ${d.distributor_id}`));
    
    // Find missing accounts
    console.log('\n=== MISSING ACCOUNTS ===');
    const missingDistIds = txDistributors
      .map(d => d.distributor_id)
      .filter(id => !accountDistIds.has(id));
    
    if (missingDistIds.length === 0) {
      console.log('✓ All distributors with transactions have accounts');
    } else {
      console.log(`✗ ${missingDistIds.length} distributors missing accounts:`);
      missingDistIds.forEach(id => console.log(`  - Distributor ID: ${id}`));
    }
    
    // Get transaction counts per distributor
    console.log('\n=== TRANSACTION COUNTS ===');
    const [txCounts] = await conn.execute(
      `SELECT distributor_id, COUNT(*) as tx_count FROM transactions WHERE distributor_id IS NOT NULL GROUP BY distributor_id ORDER BY distributor_id`
    );
    txCounts.forEach(row => {
      const hasAccount = accountDistIds.has(row.distributor_id);
      console.log(`  - Distributor ${row.distributor_id}: ${row.tx_count} transactions ${hasAccount ? '✓' : '✗ NO ACCOUNT'}`);
    });
    
  } finally {
    conn.release();
    pool.end();
  }
}

checkMissingAccounts().catch(console.error);
