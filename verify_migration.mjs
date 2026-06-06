import mysql from 'mysql2/promise';

const sourceDb = {
  host: 'gateway04.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4Ub8kQFzJe2Qy9S.e75c30de1bd1',
  password: 'rNx87fkp7tz8Kin1BQf7',
  database: 'VYhhGCXTFjqcfzyNfH8rpM',
  ssl: { rejectUnauthorized: false }
};

const targetDb = {
  host: 'gateway04.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4Ub8kQFzJe2Qy9S.6490c4b92f5c',
  password: '37OmID8OCY4wkh5QbF6Q',
  database: 'LHofqToGEWe5qqsuTSLzUJ',
  ssl: { rejectUnauthorized: false }
};

async function verifyMigration() {
  let sourceConn, targetConn;
  try {
    console.log('Connecting to databases for verification...\n');
    sourceConn = await mysql.createConnection(sourceDb);
    targetConn = await mysql.createConnection(targetDb);
    
    // Get all tables
    const [tables] = await sourceConn.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [sourceDb.database]);
    
    let allMatch = true;
    let mismatches = [];
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      if (tableName === '__drizzle_migrations') continue;
      
      // Get row counts
      const [[sourceCount]] = await sourceConn.query(
        `SELECT COUNT(*) as count FROM ??`,
        [tableName]
      );
      
      const [[targetCount]] = await targetConn.query(
        `SELECT COUNT(*) as count FROM ??`,
        [tableName]
      );
      
      const sourceRows = sourceCount.count;
      const targetRows = targetCount.count;
      
      if (sourceRows === targetRows) {
        console.log(`✓ ${tableName.padEnd(40)} ${sourceRows} rows`);
      } else {
        console.log(`✗ ${tableName.padEnd(40)} Source: ${sourceRows}, Target: ${targetRows}`);
        allMatch = false;
        mismatches.push(tableName);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    if (allMatch) {
      console.log('✅ All tables verified successfully!');
    } else {
      console.log(`❌ ${mismatches.length} table(s) have mismatched row counts:`);
      mismatches.forEach(t => console.log(`   - ${t}`));
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    if (sourceConn) await sourceConn.end();
    if (targetConn) await targetConn.end();
  }
}

verifyMigration();
