import { getRawDb } from './db.js';

async function checkBatches() {
  const pool = await getRawDb();
  if (!pool) {
    console.error('Database connection not available');
    process.exit(1);
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT 
        cb.id,
        cb.provider_id,
        sp.name AS provider_name,
        cb.filename,
        cb.upload_status,
        cb.total_cards,
        cb.processed_cards,
        cb.failed_cards,
        cb.created_at,
        COUNT(c.id) AS cards_count
      FROM card_batches cb
      LEFT JOIN cards c ON c.batch_id = cb.id
      LEFT JOIN service_providers sp ON sp.id = cb.provider_id
      WHERE cb.id IN (90001, 90002, 90003, 90004)
      GROUP BY 
        cb.id,
        cb.provider_id,
        sp.name,
        cb.filename,
        cb.upload_status,
        cb.total_cards,
        cb.processed_cards,
        cb.failed_cards,
        cb.created_at
    `);

    console.log('=== BATCH INSPECTION RESULTS ===');
    console.log(JSON.stringify(rows, null, 2));
    
    const allEmpty = rows.every(row => row.cards_count === 0);
    console.log(`\n=== SAFETY CHECK ===`);
    console.log(`All batches empty: ${allEmpty}`);
    console.log(`Rows inspected: ${rows.length}`);
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

checkBatches().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
