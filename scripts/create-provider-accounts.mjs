import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function createProviderAccounts() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating provider_distributor_accounts for distributor 1179498...');
    
    // Get all provider relationships for this distributor
    const [relationships] = await conn.execute(
      'SELECT provider_id, credit_line FROM provider_distributor_relationships WHERE distributor_id = 1179498'
    );
    
    console.log('Found', relationships.length, 'provider relationships');
    
    if (relationships.length === 0) {
      console.log('No provider relationships found');
      process.exit(0);
    }
    
    // Create account for each provider with initial balance
    for (const rel of relationships) {
      const providerId = rel.provider_id;
      const creditLine = rel.credit_line || 5000;
      const balance = 5000; // Initial balance
      const usedCredit = 0; // No credit used initially
      
      await conn.execute(
        `INSERT INTO provider_distributor_accounts (
          distributor_id, provider_id, balance, credit_line, used_credit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [1179498, providerId, balance, creditLine, usedCredit]
      );
      
      console.log(`Created account for provider ${providerId}: balance=${balance}, creditLine=${creditLine}`);
    }
    
    // Verify
    const [count] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM provider_distributor_accounts WHERE distributor_id = 1179498'
    );
    console.log('Total accounts created:', count[0].cnt);
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

createProviderAccounts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
