import { getRawDb } from './server/db';

async function phase1() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== PHASE 1: FINAL DATA INTEGRITY CHECK ===\n');

  try {
    // Query 1: Relationships/accounts consistency
    console.log('1. Relationships/accounts consistency:');
    const [q1] = await pool.query(`
SELECT COUNT(*) AS relationships_without_accounts
FROM provider_distributor_relationships pdr
LEFT JOIN provider_distributor_accounts pda
  ON pda.provider_id = pdr.provider_id
 AND pda.distributor_id = pdr.distributor_id
WHERE pda.id IS NULL
    `);
    console.log(`   Result: ${(q1 as any[])[0].relationships_without_accounts}\n`);

    // Query 2: Transactions without ledger (fixed)
    console.log('2. Transactions without ledger:');
    const [q2] = await pool.query(`
SELECT COUNT(DISTINCT t.id) AS transactions_without_ledger
FROM transactions t
LEFT JOIN provider_distributor_ledger pdl
  ON pdl.reference_id = t.id
WHERE pdl.id IS NULL
    `);
    console.log(`   Result: ${(q2 as any[])[0].transactions_without_ledger}\n`);

    // Query 3: Incompatible seeded cards still AVAILABLE
    console.log('3. Incompatible seeded cards still AVAILABLE:');
    const [q3] = await pool.query(`
SELECT COUNT(*) AS available_untrusted_cards
FROM cards
WHERE status = 'AVAILABLE'
  AND batch_id NOT IN (
    SELECT id FROM card_batches
    WHERE upload_status = 'completed'
  )
    `);
    console.log(`   Result: ${(q3 as any[])[0].available_untrusted_cards}\n`);

    // Query 4: Trusted inventory remaining
    console.log('4. Trusted inventory remaining:');
    const [q4] = await pool.query(`
SELECT 
  cb.id AS batch_id,
  cb.filename,
  cb.upload_status,
  COUNT(c.id) AS total_cards,
  SUM(CASE WHEN c.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_cards,
  SUM(CASE WHEN c.status = 'SOLD' THEN 1 ELSE 0 END) AS sold_cards
FROM card_batches cb
LEFT JOIN cards c ON c.batch_id = cb.id
GROUP BY cb.id, cb.filename, cb.upload_status
ORDER BY cb.created_at DESC
LIMIT 10
    `);
    console.log('   Results:');
    (q4 as any[]).forEach((row: any) => {
      console.log(`   - Batch ${row.batch_id}: ${row.filename} (${row.upload_status})`);
      console.log(`     Total: ${row.total_cards}, Available: ${row.available_cards}, Sold: ${row.sold_cards}`);
    });
    console.log();

    // Query 5: Account balances
    console.log('5. Account balances:');
    const [q5] = await pool.query(`
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
ORDER BY d.name, sp.name
    `);
    console.log('   Results:');
    (q5 as any[]).forEach((row: any) => {
      console.log(`   - ${row.distributor_name} ← ${row.provider_name}`);
      console.log(`     Balance: ${row.balance}, Credit: ${row.credit_line}, Used: ${row.used_credit}, Available: ${row.available_to_spend}, Version: ${row.version}`);
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
