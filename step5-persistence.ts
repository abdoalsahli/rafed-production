import { getRawDb } from './server/db';

async function step5() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 5: PERSISTENCE CHECK ===\n');

  try {
    // Recount all tables
    const [txCount] = await pool.query('SELECT COUNT(*) AS transactions_persisted FROM transactions');
    console.log('Transactions persisted:');
    console.log(JSON.stringify(txCount, null, 2));

    const [ledgerCount] = await pool.query('SELECT COUNT(*) AS ledger_entries_persisted FROM provider_distributor_ledger');
    console.log('\nLedger entries persisted:');
    console.log(JSON.stringify(ledgerCount, null, 2));

    const [prCount] = await pool.query('SELECT COUNT(*) AS purchase_requests_persisted FROM purchase_requests');
    console.log('\nPurchase requests persisted:');
    console.log(JSON.stringify(prCount, null, 2));

    // Fetch by idempotency key
    const [byIdempotency] = await pool.query(`
SELECT 
  id,
  distributor_id,
  provider_id,
  product_id,
  card_id,
  amount,
  commission_amount,
  status,
  idempotency_key,
  created_at
FROM transactions
WHERE idempotency_key = '60217'
    `);
    console.log('\nTransaction by idempotency key (60217):');
    console.log(JSON.stringify(byIdempotency, null, 2));

    console.log('\n=== STEP 5 COMPLETE ===');

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step5().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
