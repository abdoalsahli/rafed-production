import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

(async () => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, provider_id, distributor_id, commission_type, commission_percentage FROM provider_distributor_relationships WHERE distributor_id = 120014 LIMIT 5`
    );
    console.log('Commission values in database:');
    rows.forEach(row => {
      console.log(`  ID: ${row.id}, Provider: ${row.provider_id}, Type: ${row.commission_type}, Percentage: ${row.commission_percentage}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
