import { getRawDb } from './server/db';

async function step2() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 2: PRE-PURCHASE BASELINE ===\n');

  try {
    // Count queries
    const [txCount] = await pool.query('SELECT COUNT(*) AS transactions_before FROM transactions');
    console.log('Transactions before:');
    console.log(JSON.stringify(txCount, null, 2));

    const [ledgerCount] = await pool.query('SELECT COUNT(*) AS ledger_entries_before FROM provider_distributor_ledger');
    console.log('\nLedger entries before:');
    console.log(JSON.stringify(ledgerCount, null, 2));

    const [prCount] = await pool.query('SELECT COUNT(*) AS purchase_requests_before FROM purchase_requests');
    console.log('\nPurchase requests before:');
    console.log(JSON.stringify(prCount, null, 2));

    // Account state
    const [accounts] = await pool.query(`
SELECT 
  sp.name AS provider_name,
  d.name AS distributor_name,
  pda.balance,
  pda.credit_line,
  pda.used_credit,
  (pda.balance + (pda.credit_line - pda.used_credit)) AS available_to_spend,
  pda.version
FROM provider_distributor_accounts pda
JOIN service_providers sp ON sp.id = pda.provider_id
JOIN distributors d ON d.id = pda.distributor_id
WHERE sp.name = 'Libyana Telecom'
  AND d.name IN ('SEED_Anis Distribution', 'SEED_Anis Operator')
    `);
    console.log('\nAccount state before:');
    console.log(JSON.stringify(accounts, null, 2));

    // Find available cards
    const [batches] = await pool.query(`
SELECT 
  cb.id AS batch_id,
  cb.filename,
  cb.upload_status,
  c.product_id,
  p.display_name,
  COUNT(*) AS available_cards
FROM cards c
JOIN card_batches cb ON cb.id = c.batch_id
JOIN products p ON p.id = c.product_id
WHERE c.status = 'AVAILABLE'
  AND cb.upload_status = 'completed'
GROUP BY cb.id, cb.filename, cb.upload_status, c.product_id, p.display_name
ORDER BY cb.created_at DESC
LIMIT 10
    `);
    console.log('\nAvailable batches/products:');
    console.log(JSON.stringify(batches, null, 2));

    console.log('\n=== STEP 2 COMPLETE ===');

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step2().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
