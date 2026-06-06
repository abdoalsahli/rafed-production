import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function applyMigration() {
  try {
    const pool = createPool(DATABASE_URL);
    const conn = await pool.getConnection();

    // Read migration SQL
    const migrationPath = path.join(__dirname, '../drizzle/0013_old_stephen_strange.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by statement breakpoint and execute
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await conn.execute(stmt);
        console.log('✓ Executed:', stmt.substring(0, 60) + '...');
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('✓ Table already exists, skipping');
        } else {
          console.error('✗ Error:', error.message);
          throw error;
        }
      }
    }

    await conn.release();
    await pool.end();

    console.log('\n✓ Migration applied successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
