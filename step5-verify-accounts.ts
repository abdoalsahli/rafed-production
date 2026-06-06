import { getRawDb } from './server/db';

async function step5() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 5: VERIFY ACCOUNTS AFTER BACKFILL ===\n');

  try {
    // Count accounts
    const [countRows] = await pool.query('SELECT COUNT(*) AS accounts FROM provider_distributor_accounts');
    const accountCount = (countRows as any[])[0].accounts;
    console.log(`Total accounts: ${accountCount}\n`);

    // Get account details
    const [accRows] = await pool.query(`
SELECT
  pda.provider_id,
  sp.name AS provider_name,
  pda.distributor_id,
  d.name AS distributor_name,
  pda.balance,
  pda.credit_line,
  pda.used_credit,
  (pda.balance + (pda.credit_line - pda.used_credit)) AS available_to_spend,
  pda.version
FROM provider_distributor_accounts pda
JOIN service_providers sp ON sp.id = pda.provider_id
JOIN distributors d ON d.id = pda.distributor_id
ORDER BY d.name, sp.name;
    `);

    console.log('Account Details:');
    (accRows as any[]).forEach((acc, idx) => {
      console.log(`${idx + 1}. ${acc.distributor_name} ← ${acc.provider_name}`);
      console.log(`   Balance: ${acc.balance}, Credit: ${acc.credit_line}, Used: ${acc.used_credit}`);
      console.log(`   Available: ${acc.available_to_spend}, Version: ${acc.version}\n`);
    });

    // Check for relationships without accounts
    const [relRows] = await pool.query(`
SELECT COUNT(*) AS relationships_without_accounts
FROM provider_distributor_relationships pdr
LEFT JOIN provider_distributor_accounts pda
  ON pda.provider_id = pdr.provider_id
 AND pda.distributor_id = pdr.distributor_id
WHERE pda.id IS NULL;
    `);

    const relWithoutAcc = (relRows as any[])[0].relationships_without_accounts;
    console.log(`Relationships without accounts: ${relWithoutAcc}`);

    if (relWithoutAcc === 0) {
      console.log('✓ All relationships have accounts');
    } else {
      console.log(`✗ ${relWithoutAcc} relationships still missing accounts`);
    }

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step5().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
