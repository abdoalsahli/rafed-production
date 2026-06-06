import { getRawDb } from './db.js';

async function cleanupBatches() {
  const pool = await getRawDb();
  if (!pool) {
    console.error('Database connection not available');
    process.exit(1);
  }

  const conn = await pool.getConnection();
  try {
    // Execute DELETE
    console.log('=== EXECUTING CLEANUP ===');
    const [deleteResult] = await conn.execute(`
      DELETE FROM card_batches
      WHERE id IN (90001, 90002, 90003, 90004)
        AND id NOT IN (
          SELECT DISTINCT batch_id FROM cards WHERE batch_id IS NOT NULL
        )
    `);

    console.log(`Rows deleted: ${deleteResult.affectedRows}`);

    // Verify cleanup
    console.log('\n=== VERIFICATION ===');
    const [verifyResult] = await conn.execute(`
      SELECT COUNT(*) AS remaining_bad_batches
      FROM card_batches
      WHERE id IN (90001, 90002, 90003, 90004)
    `);

    console.log(`Remaining batches: ${verifyResult[0].remaining_bad_batches}`);
    
    if (verifyResult[0].remaining_bad_batches === 0) {
      console.log('✅ CLEANUP SUCCESSFUL - All empty batches deleted');
    } else {
      console.log('⚠️ WARNING - Some batches still exist');
    }
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

cleanupBatches().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
