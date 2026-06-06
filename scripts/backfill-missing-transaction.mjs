import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function backfillMissingTransaction() {
  const conn = await pool.getConnection();
  try {
    console.log('Backfilling missing transaction for SUCCEEDED purchase_request...');
    
    // Get the SUCCEEDED purchase request
    const [pr] = await conn.execute(
      'SELECT id, distributor_id, provider_id, product_id FROM purchase_requests WHERE distributor_id = 1179498 AND status = "SUCCEEDED" LIMIT 1'
    );
    
    if (!pr || pr.length === 0) {
      console.log('No SUCCEEDED purchase request found');
      process.exit(0);
    }
    
    const purchaseRequest = pr[0];
    console.log('Found purchase request:', purchaseRequest.id);
    
    // Get product details for amount
    const [product] = await conn.execute(
      'SELECT price FROM products WHERE id = ?',
      [purchaseRequest.product_id]
    );
    
    if (!product || product.length === 0) {
      console.log('Product not found');
      process.exit(0);
    }
    
    const price = parseFloat(product[0].price);
    const commission = price * 0.05;
    
    console.log('Product price:', price, 'Commission:', commission);
    
    // Create transaction record
    await conn.execute(
      `INSERT INTO transactions (
        idempotency_key, distributor_id, provider_id, product_id, card_id,
        amount, commission_amount, transaction_type, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(purchaseRequest.id),
        purchaseRequest.distributor_id,
        purchaseRequest.provider_id,
        purchaseRequest.product_id,
        0, // card_id unknown, use 0
        String(price),
        String(commission),
        'purchase',
        'completed'
      ]
    );
    
    console.log('Created transaction for purchase_request ID:', purchaseRequest.id);
    
    // Verify
    const [txn] = await conn.execute(
      'SELECT id FROM transactions WHERE idempotency_key = ?',
      [String(purchaseRequest.id)]
    );
    console.log('Transaction created:', txn.length > 0 ? 'SUCCESS' : 'FAILED');
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

backfillMissingTransaction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
