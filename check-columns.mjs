import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

(async () => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`DESCRIBE service_providers`);
    console.log('service_providers columns:', JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
