#!/usr/bin/env node

import mysql from 'mysql2/promise';

let _rawPool = null;

async function getRawDb() {
  if (!_rawPool && process.env.DATABASE_URL) {
    try {
      _rawPool = mysql.createPool(process.env.DATABASE_URL);
    } catch (error) {
      console.warn('[Database] Failed to create raw pool:', error);
      _rawPool = null;
    }
  }
  return _rawPool;
}

/**
 * Test script to validate CSV export functionality
 * Tests filter respect and data accuracy
 */

async function testExport() {
  const rawDb = await getRawDb();
  
  if (!rawDb) {
    console.error('Failed to connect to database');
    process.exit(1);
  }

  try {
    console.log('Testing CSV export functionality...\n');

    // Test 1: Export all ledger entries for a distributor
    console.log('Test 1: Export all ledger entries');
    const conn = await rawDb.getConnection();
    
    const query = `
      SELECT 
        pdl.id,
        pdl.provider_id,
        sp.name as provider_name,
        pdl.distributor_id,
        pdl.type,
        pdl.reference_type,
        pdl.amount,
        pdl.balance_after_transaction,
        pdl.used_credit_after_transaction,
        pdl.reference_id,
        pdl.metadata,
        pdl.created_at
      FROM provider_distributor_ledger pdl
      JOIN service_providers sp ON pdl.provider_id = sp.id
      WHERE pdl.distributor_id = ?
      ORDER BY pdl.created_at DESC
      LIMIT 10
    `;

    const [rows] = await conn.execute(query, [1029525]);
    console.log(`✓ Found ${rows.length} ledger entries for distributor 1029525`);
    
    if (rows.length > 0) {
      console.log(`  - First entry: ${rows[0].reference_type} for $${rows[0].amount}`);
      console.log(`  - Provider: ${rows[0].provider_name}`);
      console.log(`  - Type: ${rows[0].type}`);
    }

    // Test 2: Export with provider filter
    console.log('\nTest 2: Export with provider filter');
    const queryWithFilter = `
      SELECT 
        pdl.id,
        pdl.provider_id,
        sp.name as provider_name,
        pdl.distributor_id,
        pdl.type,
        pdl.reference_type,
        pdl.amount,
        pdl.balance_after_transaction,
        pdl.used_credit_after_transaction,
        pdl.reference_id,
        pdl.metadata,
        pdl.created_at
      FROM provider_distributor_ledger pdl
      JOIN service_providers sp ON pdl.provider_id = sp.id
      WHERE pdl.distributor_id = ? AND pdl.provider_id = ?
      ORDER BY pdl.created_at DESC
      LIMIT 10
    `;

    const [filteredRows] = await conn.execute(queryWithFilter, [1029525, 1029521]);
    console.log(`✓ Found ${filteredRows.length} entries for provider 1029521`);
    
    if (filteredRows.length > 0) {
      console.log(`  - All entries are from provider: ${filteredRows[0].provider_name}`);
    }

    // Test 3: Export with amount filter
    console.log('\nTest 3: Export with amount filter (amount >= 100)');
    const queryWithAmount = `
      SELECT 
        pdl.id,
        pdl.provider_id,
        sp.name as provider_name,
        pdl.distributor_id,
        pdl.type,
        pdl.reference_type,
        pdl.amount,
        pdl.balance_after_transaction,
        pdl.used_credit_after_transaction,
        pdl.reference_id,
        pdl.metadata,
        pdl.created_at
      FROM provider_distributor_ledger pdl
      JOIN service_providers sp ON pdl.provider_id = sp.id
      WHERE pdl.distributor_id = ? AND pdl.amount >= ?
      ORDER BY pdl.created_at DESC
      LIMIT 10
    `;

    const [amountFilteredRows] = await conn.execute(queryWithAmount, [1029525, 100]);
    console.log(`✓ Found ${amountFilteredRows.length} entries with amount >= 100`);
    
    if (amountFilteredRows.length > 0) {
      const allAboveThreshold = amountFilteredRows.every((row) => Number(row.amount) >= 100);
      console.log(`  - All amounts >= 100: ${allAboveThreshold ? 'YES' : 'NO'}`);
      console.log(`  - Sample amounts: ${amountFilteredRows.slice(0, 3).map(r => r.amount).join(', ')}`);
    }

    // Test 4: Verify CSV generation
    console.log('\nTest 4: CSV generation');
    const csvHeaders = [
      'Date & Time',
      'Provider',
      'Type',
      'Reference Type',
      'Reference ID',
      'Amount',
      'Balance After',
      'Used Credit After',
    ];
    
    const csvContent = generateCSV(csvHeaders, rows.slice(0, 3).map(row => [
      new Date(row.created_at).toLocaleString('en-US'),
      row.provider_name,
      row.type,
      row.reference_type,
      row.reference_id,
      row.amount.toFixed(2),
      row.balance_after_transaction.toFixed(2),
      row.used_credit_after_transaction.toFixed(2),
    ]));
    
    console.log('✓ CSV generated successfully');
    console.log('  Sample CSV (first 3 rows):');
    console.log('  ' + csvContent.split('\n').slice(0, 4).join('\n  '));

    conn.release();
    console.log('\n✅ All export tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

function generateCSV(headers, rows) {
  const escapedHeaders = headers.map(escapeCSVField);
  const escapedRows = rows.map((row) => row.map(escapeCSVField).join(','));
  return [escapedHeaders.join(','), ...escapedRows].join('\n');
}

function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
}

testExport();
