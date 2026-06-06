import { getRawDb } from './server/db';

async function step4() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 4: CLASSIFY EXISTING TRANSACTIONS ===\n');

  try {
    const query = `
SELECT 
  t.id,
  t.distributor_id,
  d.name AS distributor_name,
  t.provider_id,
  sp.name AS provider_name,
  t.product_id,
  t.card_id,
  t.amount,
  t.commission_amount,
  t.status,
  t.transaction_type,
  t.idempotency_key,
  t.created_at,
  COUNT(pdl.id) AS ledger_count
FROM transactions t
JOIN distributors d ON d.id = t.distributor_id
JOIN service_providers sp ON sp.id = t.provider_id
LEFT JOIN provider_distributor_ledger pdl
  ON pdl.reference_id = t.id
GROUP BY 
  t.id,
  t.distributor_id,
  d.name,
  t.provider_id,
  sp.name,
  t.product_id,
  t.card_id,
  t.amount,
  t.commission_amount,
  t.status,
  t.transaction_type,
  t.idempotency_key,
  t.created_at
ORDER BY t.created_at DESC;
    `;

    const [rows] = await pool.query(query);
    const transactions = rows as any[];

    console.log(`Total transactions: ${transactions.length}\n`);

    let valid_real = 0, contaminated_seed = 0, unknown = 0;

    transactions.forEach((t, idx) => {
      const isAnisDist = t.distributor_id === 1179498 || t.distributor_name.includes('Anis');
      const isLibyana = t.provider_id === 1214740 || t.provider_name.includes('Libyana');
      const isRecent = new Date(t.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
      const hasLedger = t.ledger_count > 0;
      const isCompleted = t.status === 'completed';

      let classification = 'unknown';
      if (isAnisDist && isLibyana && isRecent && hasLedger && isCompleted) {
        classification = 'valid real purchase';
        valid_real++;
      } else if (!isAnisDist || !isLibyana) {
        classification = 'contaminated seed purchase';
        contaminated_seed++;
      } else {
        classification = 'unknown';
        unknown++;
      }

      console.log(`${idx + 1}. [${classification}] TX${t.id}: ${t.distributor_name} → ${t.provider_name}, Amount: ${t.amount}, Ledger entries: ${t.ledger_count}, Created: ${t.created_at}`);
    });

    console.log(`\n=== CLASSIFICATION SUMMARY ===`);
    console.log(`Valid real purchases: ${valid_real}`);
    console.log(`Contaminated seed purchases: ${contaminated_seed}`);
    console.log(`Unknown: ${unknown}`);

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step4().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
