import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

(async () => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT 
        pdr.id as relationship_id,
        sp.id as provider_id,
        sp.name as provider_name,
        sp.provider_code as provider_code,
        pdr.status,
        pdr.commission_type,
        pdr.commission_value,
        pdr.created_at as connected_at,
        pda.balance as available_credit,
        pda.used_credit
      FROM provider_distributor_relationships pdr
      JOIN service_providers sp ON pdr.provider_id = sp.id
      LEFT JOIN provider_distributor_accounts pda ON pdr.provider_id = pda.provider_id AND pdr.distributor_id = pda.distributor_id
      WHERE pdr.distributor_id = ?
      ORDER BY pdr.created_at DESC`,
      [120014]
    );
    console.log('Query result:', JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Query error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
