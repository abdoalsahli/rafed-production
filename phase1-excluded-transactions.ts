import { getRawDb } from './server/db';

async function phase1() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== PHASE 1: EXCLUDED SEED TRANSACTIONS ===\n');

  try {
    // Query: Transactions without ledger entries
    console.log('Excluded seed transactions (without ledger entries):');
    const [rows] = await pool.query(`
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
  t.idempotency_key,
  t.created_at,
  'seed-created transaction bypassed QueueManager/account/ledger logic' AS reason_excluded
FROM transactions t
LEFT JOIN provider_distributor_ledger pdl
  ON pdl.reference_id = t.id
LEFT JOIN distributors d ON d.id = t.distributor_id
LEFT JOIN service_providers sp ON sp.id = t.provider_id
WHERE pdl.id IS NULL
ORDER BY t.created_at
    `);

    console.log(`Total excluded: ${(rows as any[]).length}\n`);
    
    // Group by distributor for summary
    const byDistributor: Record<string, number> = {};
    (rows as any[]).forEach(row => {
      const key = row.distributor_name || `Distributor ${row.distributor_id}`;
      byDistributor[key] = (byDistributor[key] || 0) + 1;
    });

    console.log('Excluded by distributor:');
    Object.entries(byDistributor).forEach(([dist, count]) => {
      console.log(`  ${dist}: ${count}`);
    });

    console.log('\nFirst 10 excluded transactions:');
    (rows as any[]).slice(0, 10).forEach((row: any) => {
      console.log(`  ID ${row.id}: ${row.distributor_name} → ${row.provider_name}, Amount: ${row.amount}, Status: ${row.status}, Created: ${row.created_at}`);
    });

    console.log('\n=== PHASE 1 COMPLETE ===');

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

phase1().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
