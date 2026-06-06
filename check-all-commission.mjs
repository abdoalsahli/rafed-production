import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

(async () => {
  const conn = await pool.getConnection();
  try {
    console.log('=== All Provider-Distributor Relationships ===');
    const [rows] = await conn.execute(
      `SELECT id, provider_id, distributor_id, commission_type, commission_percentage FROM provider_distributor_relationships LIMIT 10`
    );
    if (rows.length === 0) {
      console.log('No relationships found');
    } else {
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Provider: ${row.provider_id}, Distributor: ${row.distributor_id}, Type: ${row.commission_type}, Percentage: ${row.commission_percentage}`);
      });
    }
    
    console.log('\n=== For Distributor 120014 ===');
    const [dist120014] = await conn.execute(
      `SELECT id, provider_id, distributor_id, commission_type, commission_percentage FROM provider_distributor_relationships WHERE distributor_id = 120014`
    );
    console.log(`Found ${dist120014.length} relationships`);
    dist120014.forEach(row => {
      console.log(`ID: ${row.id}, Provider: ${row.provider_id}, Type: ${row.commission_type}, Percentage: ${row.commission_percentage}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
