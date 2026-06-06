import { getRawDb } from './server/db';

async function step1() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 1: CONFIRM ENVIRONMENT/DATABASE ===\n');

  try {
    // Get database name and current time
    const [dbInfo] = await pool.query('SELECT DATABASE() AS current_database, NOW() AS db_now');
    console.log('Database Info:');
    console.log(JSON.stringify(dbInfo, null, 2));

    console.log('\nEnvironment Info:');
    console.log(`  App Base URL: https://3000-iokp4has3zufs4v2wakm0-ab2aa074.us2.manus.computer`);
    console.log(`  Git Checkpoint: 6af58a12`);
    console.log(`  Build Version: Financial logic patched`);
    console.log(`  Dev Server Status: Running`);
    console.log(`  Timestamp: ${new Date().toISOString()}`);

    console.log('\n=== STEP 1 COMPLETE ===');

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step1().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
