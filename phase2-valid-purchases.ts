import { getRawDb } from './server/db';

async function phase2() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== PHASE 2: VALID REAL PURCHASES WITH LEDGER ENTRIES ===\n');

  try {
    // Query: Transactions WITH ledger entries (valid real purchases)
    console.log('Valid real purchases (with ledger entries):');
    const [rows] = await pool.query(`
SELECT 
  t.id AS transaction_id,
  t.card_id,
  d.name AS distributor_name,
  sp.name AS provider_name,
  p.name AS product_name,
  t.amount,
  t.commission_amount,
  COUNT(pdl.id) AS ledger_entries_count,
  GROUP_CONCAT(pdl.type ORDER BY pdl.type) AS ledger_types,
  t.status,
  t.idempotency_key,
  t.created_at
FROM transactions t
JOIN provider_distributor_ledger pdl
  ON pdl.reference_id = t.id
LEFT JOIN distributors d ON d.id = t.distributor_id
LEFT JOIN service_providers sp ON sp.id = t.provider_id
LEFT JOIN products p ON p.id = t.product_id
GROUP BY t.id, t.card_id, d.name, sp.name, p.name, t.amount, t.commission_amount, t.status, t.idempotency_key, t.created_at
ORDER BY t.created_at
    `);

    console.log(`Total valid real purchases: ${(rows as any[]).length}\n`);

    if ((rows as any[]).length === 0) {
      console.log('No valid real purchases found with ledger entries.\n');
    } else {
      console.log('Valid real purchases:');
      (rows as any[]).forEach((row: any) => {
        console.log(`  TX ${row.transaction_id}: ${row.distributor_name} → ${row.provider_name}, Amount: ${row.amount}, Commission: ${row.commission_amount}, Ledger Entries: ${row.ledger_entries_count} (${row.ledger_types}), Status: ${row.status}`);
      });
    }

    console.log('\n=== PHASE 2 COMPLETE ===');

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

phase2().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
