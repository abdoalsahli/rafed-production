/**
 * Apply pending migrations to database
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigrations() {
  // Parse DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const url = new URL(dbUrl);
  console.log(`Connecting to: ${url.hostname}:${url.port || 3306}/${url.pathname.slice(1)}\n`);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Applying pending migrations...\n');

    // Read and apply the latest migration
    const migrationFile = path.join(__dirname, 'drizzle/0010_equal_sway.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    console.log(`Executing: ${path.basename(migrationFile)}`);
    console.log(`SQL: ${sql.trim()}\n`);

    await connection.execute(sql);
    console.log('✓ Migration applied successfully');
  } finally {
    await connection.end();
  }
}

applyMigrations().catch(error => {
  console.error('✗ Migration failed:', error.message);
  process.exit(1);
});
