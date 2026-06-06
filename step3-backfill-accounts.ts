import { getRawDb } from './server/db';

async function step3() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 3: BACKFILL PROVIDER_DISTRIBUTOR_ACCOUNTS ===\n');

  try {
    // Get all relationships without accounts
    const [relRows] = await pool.query(`
SELECT pdr.provider_id, pdr.distributor_id
FROM provider_distributor_relationships pdr
LEFT JOIN provider_distributor_accounts pda
  ON pda.provider_id = pdr.provider_id
 AND pda.distributor_id = pdr.distributor_id
WHERE pda.id IS NULL AND pdr.status = 'active'
    `);

    const relationships = relRows as any[];
    console.log(`Backfilling ${relationships.length} relationships...\n`);

    let inserted = 0;
    for (const rel of relationships) {
      const { provider_id, distributor_id } = rel;
      
      try {
        await pool.query(`
INSERT INTO provider_distributor_accounts 
  (provider_id, distributor_id, balance, credit_line, used_credit, version, created_at, updated_at)
VALUES (?, ?, '5000.00', '5000.00', '0.00', 1, NOW(), NOW())
        `, [provider_id, distributor_id]);
        
        inserted++;
        console.log(`✓ Inserted account for provider ${provider_id}, distributor ${distributor_id}`);
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⊘ Account already exists for provider ${provider_id}, distributor ${distributor_id}`);
        } else {
          console.log(`✗ Error inserting account for provider ${provider_id}, distributor ${distributor_id}: ${err.message}`);
        }
      }
    }

    console.log(`\nBackfill complete: ${inserted} rows inserted`);

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step3().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
