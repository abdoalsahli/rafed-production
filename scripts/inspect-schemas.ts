import mysql from 'mysql2/promise';

async function inspectSchemas() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Use createPool like the app does
  const pool = mysql.createPool(databaseUrl);
  const connection = await pool.getConnection();

  const tables = [
    'provider_distributor_commission',
    'distributor_api_credentials',
    'card_batches',
    'cards',
    'service_providers',
    'distributors',
    'products',
    'provider_distributor_relationships',
    'provider_distributor_accounts',
  ];

  console.log('=== DATABASE SCHEMA INSPECTION ===\n');

  for (const table of tables) {
    try {
      const [rows] = await connection.execute(`SHOW CREATE TABLE ${table}`);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`TABLE: ${table}`);
      console.log('='.repeat(80));
      console.log((rows as any)[0]['Create Table']);
    } catch (err) {
      console.log(`\nERROR for ${table}:`, (err as Error).message);
    }
  }

  connection.release();
  await pool.end();
}

inspectSchemas().catch(console.error);
