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

async function syncSchemas() {
  let sourceConn, targetConn;
  try {
    console.log('Connecting to databases...');
    sourceConn = await mysql.createConnection(sourceDb);
    targetConn = await mysql.createConnection(targetDb);
    
    // Get all tables from source
    const [sourceTables] = await sourceConn.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [sourceDb.database]);
    
    console.log(`\nFound ${sourceTables.length} tables in source database`);
    
    // Get all tables from target
    const [targetTables] = await targetConn.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [targetDb.database]);
    
    const targetTableNames = new Set(targetTables.map(t => t.TABLE_NAME));
    
    // Disable foreign key checks
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Step 1: Drop tables in target that don't exist in source
    console.log('\n--- Step 1: Removing tables not in source ---');
    for (const table of targetTables) {
      const tableName = table.TABLE_NAME;
      if (!sourceTables.find(t => t.TABLE_NAME === tableName)) {
        console.log(`Dropping table: ${tableName}`);
        await targetConn.query(`DROP TABLE ??`, [tableName]);
      }
    }
    
    // Step 2: Sync table schemas
    console.log('\n--- Step 2: Syncing table schemas ---');
    for (const table of sourceTables) {
      const tableName = table.TABLE_NAME;
      
      if (tableName === '__drizzle_migrations') {
        console.log(`Skipping migration table: ${tableName}`);
        continue;
      }
      
      try {
        // Get CREATE TABLE statement from source
        const result = await sourceConn.query(
          `SHOW CREATE TABLE ??`,
          [tableName]
        );
        
        const createTableStmt = result[0]?.[0]?.['Create Table'];
        
        if (!createTableStmt) {
          console.log(`Warning: Could not get CREATE TABLE for ${tableName}, skipping`);
          continue;
        }
        
        if (targetTableNames.has(tableName)) {
          console.log(`Updating table: ${tableName}`);
          
          // Drop and recreate to ensure schema matches exactly
          await targetConn.query(`DROP TABLE ??`, [tableName]);
          
          // Adjust the CREATE TABLE statement for target database
          let adjustedStmt = createTableStmt.replace(
            new RegExp(`\`${sourceDb.database}\`.`, 'g'),
            ''
          );
          
          await targetConn.query(adjustedStmt);
        } else {
          console.log(`Creating table: ${tableName}`);
          
          // Adjust the CREATE TABLE statement for target database
          let adjustedStmt = createTableStmt.replace(
            new RegExp(`\`${sourceDb.database}\`.`, 'g'),
            ''
          );
          
          await targetConn.query(adjustedStmt);
        }
      } catch (tableError) {
        console.error(`Error processing table ${tableName}:`, tableError.message);
      }
    }
    
    // Re-enable foreign key checks
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ Schema synchronization completed successfully!');
    console.log('You can now run the data migration.');
    
  } catch (error) {
    console.error('❌ Schema sync failed:', error.message);
    process.exit(1);
  } finally {
    if (sourceConn) await sourceConn.end();
    if (targetConn) await targetConn.end();
  }
}

syncSchemas();
