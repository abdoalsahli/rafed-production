import { getRawDb } from './server/db';

async function step2() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 2: IDENTIFY RELATIONSHIPS NEEDING ACCOUNTS ===\n');

  try {
    const query = `
SELECT
  pdr.provider_id,
  sp.name AS provider_name,
  pdr.distributor_id,
  d.name AS distributor_name,
  pdr.status,
  pda.id AS account_id
FROM provider_distributor_relationships pdr
JOIN service_providers sp ON sp.id = pdr.provider_id
JOIN distributors d ON d.id = pdr.distributor_id
LEFT JOIN provider_distributor_accounts pda
  ON pda.provider_id = pdr.provider_id
 AND pda.distributor_id = pdr.distributor_id
WHERE pda.id IS NULL
ORDER BY d.name, sp.name;
    `;

    const [rows] = await pool.query(query);
    console.log(`Found ${rows.length} relationships without accounts:\n`);
    
    (rows as any[]).forEach((row, idx) => {
      console.log(`${idx + 1}. Provider: ${row.provider_id} (${row.provider_name}), Distributor: ${row.distributor_id} (${row.distributor_name}), Status: ${row.status}`);
    });

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step2().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
