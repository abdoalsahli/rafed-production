#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse DATABASE_URL and extract connection config
 * Handles SSL parameter as JSON string in URL
 */
function parseConnectionConfig() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const url = new URL(dbUrl);
  
  // Parse SSL parameter from URL
  const sslParam = url.searchParams.get('ssl');
  let ssl = true;
  
  if (sslParam) {
    try {
      ssl = JSON.parse(sslParam);
    } catch (e) {
      console.warn('Failed to parse SSL parameter, using default SSL');
      ssl = true;
    }
  }

  return {
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    port: parseInt(url.port) || 3306,
    ssl: ssl,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  };
}

/**
 * Read and parse migration SQL file
 * Splits by semicolon and filters empty statements
 * Removes SQL comments (lines starting with --)
 */
function readMigrationSQL(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Remove SQL comment lines
  const sqlWithoutComments = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  // Split by semicolon, filter empty statements
  const statements = sqlWithoutComments
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt && stmt.length > 0);

  return statements;
}

/**
 * Execute migration statements sequentially
 */
async function executeMigration(connection, statements) {
  const results = {
    succeeded: [],
    failed: [],
  };

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const statementNum = i + 1;
    const preview = statement.substring(0, 80).replace(/\n/g, ' ');
    
    try {
      console.log(`[${statementNum}/${statements.length}] Executing: ${preview}...`);
      await connection.execute(statement);
      console.log(`  ✓ Success`);
      results.succeeded.push(statement);
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      results.failed.push({
        statement,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Verify tables were created
 */
async function verifyTables(connection) {
  console.log('\n--- Verifying Tables ---');
  
  const tables = ['provider_distributor_accounts', 'provider_distributor_ledger'];
  const verification = {};

  for (const tableName of tables) {
    try {
      const [result] = await connection.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`,
        [tableName]
      );
      
      if (result.length > 0) {
        console.log(`✓ Table ${tableName} exists`);
        
        // Get table structure
        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        console.log(`  Columns: ${columns.map(c => c.Field).join(', ')}`);
        verification[tableName] = true;
      } else {
        console.log(`✗ Table ${tableName} NOT FOUND`);
        verification[tableName] = false;
      }
    } catch (error) {
      console.log(`✗ Error checking ${tableName}: ${error.message}`);
      verification[tableName] = false;
    }
  }

  return verification;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Financial Architecture Migration ===\n');

  // Parse connection config
  console.log('--- Parsing Connection Config ---');
  let config;
  try {
    config = parseConnectionConfig();
    console.log(`Host: ${config.host}:${config.port}`);
    console.log(`Database: ${config.database}`);
    console.log(`SSL: ${JSON.stringify(config.ssl)}`);
  } catch (error) {
    console.error('Error parsing connection config:', error.message);
    process.exit(1);
  }

  // Connect to database
  console.log('\n--- Connecting to Database ---');
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Connected to database');
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    process.exit(1);
  }

  // Read migration SQL
  console.log('\n--- Reading Migration SQL ---');
  let statements;
  try {
    const migrationPath = path.join(__dirname, '../drizzle/0008_minimal_financial_tables.sql');
    statements = readMigrationSQL(migrationPath);
    console.log(`✓ Read ${statements.length} SQL statements`);
  } catch (error) {
    console.error('✗ Error reading migration file:', error.message);
    await connection.end();
    process.exit(1);
  }

  // Execute migration
  console.log('\n--- Executing Migration ---');
  let results;
  try {
    results = await executeMigration(connection, statements);
  } catch (error) {
    console.error('✗ Error during migration:', error.message);
    await connection.end();
    process.exit(1);
  }

  // Verify tables
  let verification;
  try {
    verification = await verifyTables(connection);
  } catch (error) {
    console.error('✗ Error verifying tables:', error.message);
  }

  // Summary
  console.log('\n--- Migration Summary ---');
  console.log(`Succeeded: ${results.succeeded.length}/${statements.length}`);
  console.log(`Failed: ${results.failed.length}/${statements.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed Statements:');
    results.failed.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.statement.substring(0, 60)}...`);
      console.log(`     Error: ${item.error}`);
    });
  }

  if (verification) {
    const allTablesExist = Object.values(verification).every(v => v);
    if (allTablesExist) {
      console.log('\n✓ All tables created successfully!');
    } else {
      console.log('\n✗ Some tables are missing');
    }
  }

  // Cleanup
  await connection.end();
  console.log('\n✓ Migration complete');

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run migration
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
