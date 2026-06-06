import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'prepaid_card_platform',
  });

  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '../drizzle/0014_violet_azazel.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration...');
    const statements = sql.split('-->').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.startsWith('statement-breakpoint')) continue;
      try {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        await connection.execute(statement);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`  → Already exists, skipping`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✓ Migration applied successfully');

    // Verify tables
    console.log('\nVerifying tables...');
    const tables = ['organizations', 'organization_users', 'users_extended'];
    
    for (const table of tables) {
      const [rows] = await connection.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [process.env.DB_NAME || 'prepaid_card_platform', table]
      );
      if (rows.length > 0) {
        console.log(`✓ ${table} exists`);
      } else {
        console.log(`✗ ${table} NOT FOUND`);
      }
    }

    console.log('\n✓ All tables verified');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

applyMigration();
