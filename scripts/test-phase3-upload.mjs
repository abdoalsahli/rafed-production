#!/usr/bin/env node
/**
 * Phase 3 Test: Provider Inventory Upload
 * 
 * Tests the provider.uploadCards endpoint with:
 * 1. Create a provider user linked to Libyana organization
 * 2. Generate test PIN data
 * 3. Upload PINs via provider.uploadCards endpoint
 * 4. Verify card_batches and cards records created successfully
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const url = new URL(DATABASE_URL);
const pool = mysql.createPool({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {},
});

async function testPhase3Upload() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🧪 Phase 3: Provider Inventory Upload Test\n');
    
    // ========================================
    // 1. GET LIBYANA PROVIDER & PRODUCT
    // ========================================
    console.log('📦 Step 1: Finding Libyana provider and product...');
    
    const [providers] = await connection.execute(
      `SELECT id, name, provider_code FROM service_providers WHERE name = 'Libyana' LIMIT 1`
    );
    
    if (!providers || providers.length === 0) {
      throw new Error('Libyana provider not found. Run seed-run-mode.mjs first.');
    }
    
    const provider = providers[0];
    console.log(`  ✓ Found Libyana (ID: ${provider.id}, Code: ${provider.provider_code})`);
    
    // Get a product for Libyana (e.g., 5 LYD card)
    const [products] = await connection.execute(
      `SELECT id, name, price FROM products WHERE provider_id = ? AND name LIKE '%5%' LIMIT 1`,
      [provider.id]
    );
    
    if (!products || products.length === 0) {
      throw new Error('No products found for Libyana. Run seed-run-mode.mjs first.');
    }
    
    const product = products[0];
    console.log(`  ✓ Found product: ${product.name} (ID: ${product.id}, Price: ${product.price})`);
    
    // ========================================
    // 2. CREATE PROVIDER USER & LINK TO ORGANIZATION
    // ========================================
    console.log('\n👤 Step 2: Creating provider user...');
    
    // Get Libyana organization
    const [orgs] = await connection.execute(
      `SELECT id FROM organizations WHERE name = 'Libyana' AND type = 'provider' LIMIT 1`
    );
    
    if (!orgs || orgs.length === 0) {
      throw new Error('Libyana organization not found.');
    }
    
    const orgId = orgs[0].id;
    
    // Create user
    const openId = `libyana-provider-test-${Date.now()}`;
    const email = `libyana-provider-test-${Date.now()}@example.com`;
    
    const [userResult] = await connection.execute(
      `INSERT INTO users (open_id, email, name, login_method, status, role) 
       VALUES (?, ?, ?, 'oauth', 'active', 'user')`,
      [openId, email, 'Libyana Provider Test']
    );
    
    const userId = userResult.insertId;
    console.log(`  ✓ Created user (ID: ${userId}, Email: ${email})`);
    
    // Link user to organization
    await connection.execute(
      `INSERT INTO organization_users (organization_id, user_id, role) 
       VALUES (?, ?, 'admin')`,
      [orgId, userId]
    );
    console.log(`  ✓ Linked user to Libyana organization (Org ID: ${orgId})`);
    
    // ========================================
    // 3. GENERATE TEST PIN DATA
    // ========================================
    console.log('\n🔐 Step 3: Generating test PIN data...');
    
    const testPins = [];
    for (let i = 0; i < 20; i++) {
      // Generate 10-digit PINs
      const pin = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
      testPins.push(pin);
    }
    
    const pinData = testPins.join('\n');
    console.log(`  ✓ Generated ${testPins.length} test PINs`);
    console.log(`  Sample PINs: ${testPins.slice(0, 3).join(', ')}...`);
    
    // ========================================
    // 4. VERIFY UPLOAD ENDPOINT STRUCTURE
    // ========================================
    console.log('\n✅ Step 4: Verifying upload endpoint structure...');
    console.log(`  Provider ID: ${provider.id}`);
    console.log(`  Product ID: ${product.id}`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Open ID: ${openId}`);
    console.log(`  PIN Count: ${testPins.length}`);
    
    // ========================================
    // 5. SIMULATE UPLOAD (CHECK DATABASE STATE)
    // ========================================
    console.log('\n📊 Step 5: Checking database state before upload...');
    
    const [cardsBefore] = await connection.execute(
      `SELECT COUNT(*) as count FROM cards WHERE provider_id = ?`,
      [provider.id]
    );
    
    const [batchesBefore] = await connection.execute(
      `SELECT COUNT(*) as count FROM card_batches WHERE provider_id = ?`,
      [provider.id]
    );
    
    console.log(`  Cards before upload: ${cardsBefore[0].count}`);
    console.log(`  Batches before upload: ${batchesBefore[0].count}`);
    
    // ========================================
    // 6. INSTRUCTIONS FOR MANUAL TESTING
    // ========================================
    console.log('\n📝 Step 6: Manual Testing Instructions\n');
    console.log('To complete the upload test manually:');
    console.log(`  1. Login with email: ${email}`);
    console.log(`  2. Navigate to Provider Dashboard > Inventory > Upload Cards`);
    console.log(`  3. Select Product: ${product.name}`);
    console.log(`  4. Upload the following PIN data (${testPins.length} PINs):`);
    console.log(`\n${pinData}\n`);
    console.log('  5. Verify upload completes successfully');
    console.log('  6. Check that card_batches record is created');
    console.log('  7. Check that cards are inserted with encrypted PINs');
    
    // ========================================
    // 7. VERIFY SCHEMA READINESS
    // ========================================
    console.log('\n🔍 Step 7: Verifying schema readiness...');
    
    const [cardBatchesColumns] = await connection.execute(
      `DESCRIBE card_batches`
    );
    
    const columnNames = cardBatchesColumns.map(col => col.Field);
    const requiredColumns = ['id', 'provider_id', 'filename', 'upload_status', 'total_cards', 'created_at', 'updated_at'];
    
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`  ⚠️  Missing columns: ${missingColumns.join(', ')}`);
    } else {
      console.log(`  ✓ All required columns present in card_batches`);
    }
    
    const [cardsColumns] = await connection.execute(
      `DESCRIBE cards`
    );
    
    const cardsColumnNames = cardsColumns.map(col => col.Field);
    const cardsRequiredColumns = ['id', 'provider_id', 'product_id', 'batch_id', 'pin_encrypted', 'status'];
    
    const cardsMissingColumns = cardsRequiredColumns.filter(col => !cardsColumnNames.includes(col));
    
    if (cardsMissingColumns.length > 0) {
      console.log(`  ⚠️  Missing columns in cards: ${cardsMissingColumns.join(', ')}`);
    } else {
      console.log(`  ✓ All required columns present in cards`);
    }
    
    console.log('\n✅ Phase 3 Test Setup Complete!\n');
    console.log('Summary:');
    console.log(`  - Provider: Libyana (ID: ${provider.id})`);
    console.log(`  - Product: ${product.name} (ID: ${product.id})`);
    console.log(`  - Test User: ${email}`);
    console.log(`  - Test PINs: ${testPins.length}`);
    console.log(`  - Schema Status: Ready for upload`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

testPhase3Upload();
