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

async function migrateData() {
  let sourceConn, targetConn;
  try {
    console.log('Connecting to databases...');
    sourceConn = await mysql.createConnection(sourceDb);
    targetConn = await mysql.createConnection(targetDb);
    
    // Get all tables
    const [tables] = await sourceConn.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [sourceDb.database]);
    
    console.log(`\nFound ${tables.length} tables to migrate`);
    
    // Disable foreign key checks
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    let totalRows = 0;
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      if (tableName === '__drizzle_migrations') {
        console.log(`\nSkipping: ${tableName}`);
        continue;
      }
      
      // Get row count from source
      const [[{ count }]] = await sourceConn.query(
        `SELECT COUNT(*) as count FROM ??`,
        [tableName]
      );
      
      if (count === 0) {
        console.log(`\nSkipping: ${tableName} (empty)`);
        continue;
      }
      
      console.log(`\nMigrating: ${tableName} (${count} rows)`);
      
      // Clear target table
      await targetConn.query(`DELETE FROM ??`, [tableName]);
      
      // Get all data from source
      const [rows] = await sourceConn.query(`SELECT * FROM ??`, [tableName]);
      
      if (rows.length > 0) {
        // Get column names
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const columnNames = columns.map(c => `\`${c}\``).join(', ');
        
        // Insert in batches
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const values = [];
          const batchPlaceholders = batch.map(() => `(${placeholders})`).join(', ');
          
          batch.forEach(row => {
            columns.forEach(col => values.push(row[col]));
          });
          
          const query = `INSERT INTO ?? (${columnNames}) VALUES ${batchPlaceholders}`;
          await targetConn.query(query, [tableName, ...values]);
        }
        
        totalRows += count;
        console.log(`  ✓ Migrated ${count} rows`);
      }
    }
    
    // Re-enable foreign key checks
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log(`\n✅ Data migration completed successfully!`);
    console.log(`Total rows migrated: ${totalRows}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (sourceConn) await sourceConn.end();
    if (targetConn) await targetConn.end();
  }
}

migrateData();
