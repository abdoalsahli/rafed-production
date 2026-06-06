import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

(async () => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`DESCRIBE provider_distributor_relationships`);
    console.log('provider_distributor_relationships columns:');
    rows.forEach(r => console.log(`  - ${r.Field}: ${r.Type}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
