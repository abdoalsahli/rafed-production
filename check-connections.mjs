import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

(async () => {
  const conn = await pool.getConnection();
  try {
    console.log('=== Checking for provider connections for distributor 120014 ===\n');
    
    // Check provider_distributor_relationships
    const [pdr] = await conn.execute(
      `SELECT COUNT(*) as count FROM provider_distributor_relationships WHERE distributor_id = 120014`
    );
    console.log(`provider_distributor_relationships: ${pdr[0].count} rows`);
    
    // Check if there's a provider_connections or similar table
    const [tables] = await conn.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE '%provider%' OR TABLE_NAME LIKE '%connection%'`
    );
    console.log('\nTables with "provider" or "connection":');
    tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));
    
    // Check provider_distributor_accounts for this distributor
    const [pda] = await conn.execute(
      `SELECT id, provider_id, distributor_id, balance, used_credit FROM provider_distributor_accounts WHERE distributor_id = 120014 LIMIT 5`
    );
    console.log(`\nprovider_distributor_accounts for distributor 120014: ${pda.length} rows`);
    pda.forEach(row => {
      console.log(`  Provider: ${row.provider_id}, Balance: ${row.balance}, UsedCredit: ${row.used_credit}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
