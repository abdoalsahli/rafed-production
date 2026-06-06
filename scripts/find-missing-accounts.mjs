import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function findMissingAccounts() {
  const conn = await pool.getConnection();
  try {
    console.log('=== Missing Provider Accounts ===\n');
    
    const [missing] = await conn.execute(`
      SELECT
        pdr.id as relationship_id,
        pdr.provider_id,
        pdr.distributor_id,
        sp.name as provider_name,
        d.name as distributor_name,
        pda.id AS account_id
      FROM provider_distributor_relationships pdr
      LEFT JOIN service_providers sp ON sp.id = pdr.provider_id
      LEFT JOIN distributors d ON d.id = pdr.distributor_id
      LEFT JOIN provider_distributor_accounts pda
        ON pda.provider_id = pdr.provider_id
       AND pda.distributor_id = pdr.distributor_id
      WHERE pda.id IS NULL
      ORDER BY pdr.distributor_id, pdr.provider_id
    `);
    
    console.log(`Found ${missing.length} relationships without matching accounts:\n`);
    missing.forEach(row => {
      console.log(`  Relationship ${row.relationship_id}: ${row.distributor_name} (ID: ${row.distributor_id}) <-> ${row.provider_name} (ID: ${row.provider_id})`);
    });
    
    // Group by distributor
    console.log('\n=== Summary by Distributor ===');
    const byDistributor = {};
    missing.forEach(row => {
      if (!byDistributor[row.distributor_id]) {
        byDistributor[row.distributor_id] = { name: row.distributor_name, count: 0 };
      }
      byDistributor[row.distributor_id].count++;
    });
    
    Object.entries(byDistributor).forEach(([distId, data]) => {
      console.log(`  Distributor ${data.name} (${distId}): ${data.count} missing accounts`);
    });
    
    // Check for transactions without matching accounts
    console.log('\n=== Transactions Without Matching Accounts ===');
    const [orphanTxns] = await conn.execute(`
      SELECT
        t.id as txn_id,
        t.distributor_id,
        t.provider_id,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN provider_distributor_accounts pda
        ON pda.distributor_id = t.distributor_id
       AND pda.provider_id = t.provider_id
      WHERE pda.id IS NULL
      GROUP BY t.distributor_id, t.provider_id
    `);
    
    console.log(`Found ${orphanTxns.length} distributor/provider combinations with transactions but no accounts:\n`);
    orphanTxns.forEach(row => {
      console.log(`  Distributor ${row.distributor_id}, Provider ${row.provider_id}: ${row.count} transactions`);
    });
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

findMissingAccounts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
