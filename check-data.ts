import { getDb, getRawDb } from './server/db';

async function checkData() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  try {
    // Check provider_distributor_accounts
    const [rows1] = await pool.query('SELECT COUNT(*) as cnt FROM provider_distributor_accounts');
    console.log('provider_distributor_accounts count:', (rows1 as any)[0].cnt);

    // Check transactions
    const [rows2] = await pool.query('SELECT COUNT(*) as cnt FROM transactions');
    console.log('transactions count:', (rows2 as any)[0].cnt);

    // Check purchase_requests
    const [rows3] = await pool.query('SELECT COUNT(*) as cnt FROM purchase_requests');
    console.log('purchase_requests count:', (rows3 as any)[0].cnt);

    // Get sample account
    const [rows4] = await pool.query('SELECT * FROM provider_distributor_accounts LIMIT 1');
    console.log('\nSample account:', rows4);

    // Get sample transaction
    const [rows5] = await pool.query('SELECT * FROM transactions LIMIT 1');
    console.log('\nSample transaction:', rows5);

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

checkData().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
