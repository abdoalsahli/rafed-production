import { getRawDb } from './server/db';

async function step4() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 4: IMMEDIATE POST-PURCHASE VERIFICATION ===\n');

  try {
    // Count queries
    const [txCount] = await pool.query('SELECT COUNT(*) AS transactions_after FROM transactions');
    console.log('Transactions after:');
    console.log(JSON.stringify(txCount, null, 2));

    const [ledgerCount] = await pool.query('SELECT COUNT(*) AS ledger_entries_after FROM provider_distributor_ledger');
    console.log('\nLedger entries after:');
    console.log(JSON.stringify(ledgerCount, null, 2));

    const [prCount] = await pool.query('SELECT COUNT(*) AS purchase_requests_after FROM purchase_requests');
    console.log('\nPurchase requests after:');
    console.log(JSON.stringify(prCount, null, 2));

    // Latest transactions
    const [latestTx] = await pool.query(`
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
ORDER BY created_at DESC
LIMIT 5
    `);
    console.log('\nLatest 5 transactions:');
    console.log(JSON.stringify(latestTx, null, 2));

    // Latest ledger entries
    const [latestLedger] = await pool.query(`
SELECT 
  type,
  amount,
  balance_before,
  balance_after,
  reference_type,
  reference_id,
  description,
  created_at
FROM provider_distributor_ledger
ORDER BY created_at DESC
LIMIT 10
    `);
    console.log('\nLatest 10 ledger entries:');
    console.log(JSON.stringify(latestLedger, null, 2));

    // Latest purchase requests
    const [latestPr] = await pool.query(`
SELECT 
  id,
  idempotency_key,
  status,
  card_id,
  failure_reason,
  processing_started_at,
  completed_at,
  created_at,
  updated_at
FROM purchase_requests
ORDER BY created_at DESC
LIMIT 5
    `);
    console.log('\nLatest 5 purchase requests:');
    console.log(JSON.stringify(latestPr, null, 2));

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
    console.log('\nAccount state after:');
    console.log(JSON.stringify(accounts, null, 2));

    // Get the card from latest transaction
    const [latestCard] = await pool.query(`
SELECT 
  c.id,
  c.batch_id,
  c.product_id,
  c.status,
  c.allocated_to_distributor_id,
  c.allocated_at
FROM cards c
WHERE c.batch_id = 60007
ORDER BY c.allocated_at DESC
LIMIT 1
    `);
    console.log('\nLatest card from batch 60007:');
    console.log(JSON.stringify(latestCard, null, 2));

    console.log('\n=== STEP 4 COMPLETE ===');

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step4().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
