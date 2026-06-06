import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function createTestTransactions() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating test transactions for distributor 1179498...');
    
    // Get a provider connected to this distributor
    const [providers] = await conn.execute(
      'SELECT provider_id FROM provider_distributor_relationships WHERE distributor_id = 1179498 LIMIT 1'
    );
    
    if (!providers || providers.length === 0) {
      console.log('No providers connected to distributor 1179498');
      process.exit(0);
    }
    
    const providerId = providers[0].provider_id;
    console.log('Using provider:', providerId);
    
    // Get a product from this provider
    const [products] = await conn.execute(
      'SELECT id FROM products WHERE provider_id = ? LIMIT 1',
      [providerId]
    );
    
    if (!products || products.length === 0) {
      console.log('No products found for provider');
      process.exit(0);
    }
    
    const productId = products[0].id;
    console.log('Using product:', productId);
    
    // Create 5 test transactions
    for (let i = 0; i < 5; i++) {
      const txId = 90100 + i;
      const idempotencyKey = `test-tx-${Date.now()}-${i}`;
      const amount = '5.00';
      const commission = '0.25';
      
      await conn.execute(
        `INSERT INTO transactions (
          id, idempotency_key, distributor_id, provider_id, product_id, card_id,
          amount, commission_amount, transaction_type, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [txId, idempotencyKey, 1179498, providerId, productId, 150000 + i, amount, commission, 'purchase', 'completed']
      );
    }
    
    console.log('Created 5 test transactions');
    
    // Verify
    const [count] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM transactions WHERE distributor_id = 1179498'
    );
    console.log('Total transactions for distributor 1179498:', count[0].cnt);
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

createTestTransactions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
