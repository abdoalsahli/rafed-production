import mysql from 'mysql2/promise';
import fs from 'fs';

async function applyMigration() {
  let pool;
  try {
    console.log('Connecting to database...');
    pool = mysql.createPool(process.env.DATABASE_URL);
    const connection = await pool.getConnection();
    
    const sql = fs.readFileSync('/home/ubuntu/prepaid-card-platform/drizzle/0009_huge_warstar.sql', 'utf8');
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s);
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await connection.execute(statement);
    }
    
    console.log('✓ Migration applied successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

applyMigration();
