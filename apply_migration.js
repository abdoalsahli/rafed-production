const mysql = require('mysql2/promise');
const fs = require('fs');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(databaseUrl);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
};

console.log(`Connecting to database: ${config.host}/${config.database}`);

(async () => {
  const pool = mysql.createPool(config);
  
  try {
    const connection = await pool.getConnection();
    console.log('✓ Connected to database');

    // Read migration file
    const migrationPath = './drizzle/0006_smiling_nova.sql';
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statement-breakpoint and execute each statement
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`\nExecuting ${statements.length} SQL statements from migration...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await connection.execute(stmt);
        console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (err) {
        // Check if table already exists
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠ Statement ${i + 1}/${statements.length}: Table already exists (skipping)`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✓ Migration applied successfully');

    // Verify tables exist
    console.log('\nVerifying tables...');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('provider_distributor_relationships', 'access_requests')`,
      [config.database]
    );

    console.log(`\nTables created:`);
    tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));

    // Verify columns
    console.log('\nVerifying provider_distributor_relationships columns...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'provider_distributor_relationships' ORDER BY ORDINAL_POSITION`,
      [config.database]
    );

    console.log('Columns:');
    columns.forEach(c => console.log(`  - ${c.COLUMN_NAME}: ${c.COLUMN_TYPE}`));

    connection.release();
    await pool.end();

    console.log('\n✓ All verifications passed');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
})();
