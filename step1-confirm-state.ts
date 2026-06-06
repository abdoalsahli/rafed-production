import { getRawDb } from './server/db';

async function step1() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 1: CONFIRM CURRENT STATE ===\n');

  try {
    const queries = [
      ['relationships', 'SELECT COUNT(*) AS relationships FROM provider_distributor_relationships'],
      ['accounts', 'SELECT COUNT(*) AS accounts FROM provider_distributor_accounts'],
      ['transactions_count', 'SELECT COUNT(*) AS transactions_count FROM transactions'],
      ['purchase_requests_count', 'SELECT COUNT(*) AS purchase_requests_count FROM purchase_requests'],
      ['ledger_entries', 'SELECT COUNT(*) AS ledger_entries FROM provider_distributor_ledger'],
    ];

    for (const [name, query] of queries) {
      const [rows] = await pool.query(query);
      const result = (rows as any[])[0];
      console.log(`${name}: ${Object.values(result)[0]}`);
    }

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step1().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
