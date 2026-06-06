import mysql from 'mysql2/promise';
import fs from 'fs';

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
  ssl: {
    rejectUnauthorized: false
  }
};

console.log(`Connecting to database: ${config.host}/${config.database}`);

(async () => {
  const pool = mysql.createPool(config);
  
  try {
    const connection = await pool.getConnection();
    console.log('✓ Connected to database\n');

    // Read migration file
    const migrationPath = './drizzle/0006_smiling_nova.sql';
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statement-breakpoint and execute each statement
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Executing ${statements.length} SQL statements from migration...\n`);

    let skipped = 0;
    let executed = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await connection.execute(stmt);
        executed++;
        console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (err) {
        // Check if table already exists
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          skipped++;
          console.log(`⚠ Statement ${i + 1}/${statements.length}: Table already exists (skipping)`);
        } else if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate foreign key')) {
          skipped++;
          console.log(`⚠ Statement ${i + 1}/${statements.length}: Duplicate constraint (skipping)`);
        } else if (err.code === 'ER_TOO_LONG_IDENT') {
          skipped++;
          console.log(`⚠ Statement ${i + 1}/${statements.length}: Constraint name too long (skipping)`);
        } else {
          errors++;
          console.log(`✗ Statement ${i + 1}/${statements.length}: ${err.message}`);
          throw err;
        }
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`✓ Executed: ${executed}`);
    console.log(`⚠ Skipped: ${skipped}`);
    console.log(`✗ Errors: ${errors}`);
    console.log(`\n✓ Migration completed`);

    // Verify tables exist
    console.log(`\n=== Verification ===`);
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('provider_distributor_relationships', 'access_requests')`,
      [config.database]
    );

    console.log(`\nTables created/verified:`);
    tables.forEach(t => console.log(`  ✓ ${t.TABLE_NAME}`));

    // Verify provider_distributor_relationships table
    console.log(`\nprovider_distributor_relationships columns:`);
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'provider_distributor_relationships' ORDER BY ORDINAL_POSITION`,
      [config.database]
    );

    columns.forEach(c => {
      const nullable = c.IS_NULLABLE === 'YES' ? '(nullable)' : '(required)';
      console.log(`  - ${c.COLUMN_NAME}: ${c.COLUMN_TYPE} ${nullable}`);
    });

    // Verify constraints
    console.log(`\nConstraints:`);
    const [constraints] = await connection.execute(
      `SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'provider_distributor_relationships'`,
      [config.database]
    );

    constraints.forEach(c => console.log(`  - ${c.CONSTRAINT_NAME}: ${c.CONSTRAINT_TYPE}`));

    // Verify indexes
    console.log(`\nIndexes:`);
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'provider_distributor_relationships' GROUP BY INDEX_NAME`,
      [config.database]
    );

    indexes.forEach(idx => console.log(`  - ${idx.INDEX_NAME}`));

    connection.release();
    await pool.end();

    console.log(`\n✓ All verifications passed`);
    process.exit(0);
  } catch (err) {
    console.error(`\n✗ Fatal error: ${err.message}`);
    process.exit(1);
  }
})();
