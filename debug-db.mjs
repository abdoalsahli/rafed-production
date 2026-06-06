#!/usr/bin/env node
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'prepaid_card_platform',
};

console.log('Database Config:');
console.log(`  Host: ${DB_CONFIG.host}`);
console.log(`  User: ${DB_CONFIG.user}`);
console.log(`  Database: ${DB_CONFIG.database}`);

try {
  const connection = await mysql.createConnection(DB_CONFIG);
  console.log('✓ Connection successful');

  // Check PIN_ENCRYPTION_KEY
  const pinKey = process.env.PIN_ENCRYPTION_KEY;
  console.log(`\nPIN_ENCRYPTION_KEY: ${pinKey ? pinKey.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`  Length: ${pinKey ? pinKey.length : 0}`);

  // Check tables
  const [tables] = await connection.execute("SHOW TABLES");
  console.log(`\n✓ Database has ${tables.length} tables`);

  // Check provider_distributor_commission schema
  const [schema] = await connection.execute("DESCRIBE provider_distributor_commission");
  console.log('\nProvider Distributor Commission Schema:');
  schema.forEach(col => {
    console.log(`  ${col.Field}: ${col.Type}`);
  });

  await connection.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
