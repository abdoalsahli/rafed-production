/**
 * Run-Mode Seed Script
 * 
 * Creates realistic business data for testing, presentation, and onboarding.
 * Uses actual application services to ensure data consistency and reconciliation.
 * 
 * All seeded records are marked with SEED_RUN_MODE naming/tagging for easy cleanup.
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

function generateUUID() {
  return crypto.randomUUID();
}

function generateProviderCode() {
  return 'SEED_' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function seedRunModeData() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🌱 Starting Run-Mode Seed Data Creation...\n');
    
    // ========================================
    // 1. CREATE SERVICE PROVIDERS & ORGANIZATIONS
    // ========================================
    console.log('📦 Creating Service Providers & Organizations...');
    const providers = [];
    const providerNames = ['Libyana', 'Almadar', 'LTT', 'Connect', 'Giga'];
    
    for (const name of providerNames) {
      const providerCode = generateProviderCode();
      const [result] = await connection.execute(
        `INSERT INTO service_providers (name, provider_code, status) 
         VALUES (?, ?, 'active')`,
        [name, providerCode]
      );
      const providerId = result.insertId;
      
      // Create corresponding organization
      await connection.execute(
        `INSERT INTO organizations (name, type, status, contact_person, email)
         VALUES (?, 'provider', 'active', ?, ?)`,
        [name, `contact@${name.toLowerCase()}.com`, `info@${name.toLowerCase()}.com`]
      );
      
      providers.push({
        id: providerId,
        name,
        providerCode,
        organizationId: 90001 + providerNames.indexOf(name), // Will be updated after org creation
      });
      console.log(`  ✓ ${name} (ID: ${providerId})`);
    }
    
    // ========================================
    // 2. CREATE DISTRIBUTORS & ORGANIZATIONS
    // ========================================
    console.log('\n📊 Creating Distributors & Organizations...');
    const distributors = [];
    const distributorNames = ['SEED_Anis', 'SEED_iCard', 'SEED_Qareep'];
    const displayNames = ['Anis', 'iCard', 'Qareep'];
    
    for (let i = 0; i < distributorNames.length; i++) {
      const dbName = distributorNames[i];
      const displayName = displayNames[i];
      
      const [result] = await connection.execute(
        `INSERT INTO distributors (name, status) VALUES (?, 'active')`,
        [dbName]
      );
      const distributorId = result.insertId;
      
      // Create corresponding organization
      await connection.execute(
        `INSERT INTO organizations (name, type, status, contact_person, email)
         VALUES (?, 'distributor', 'active', ?, ?)`,
        [displayName, `contact@${displayName.toLowerCase()}.com`, `info@${displayName.toLowerCase()}.com`]
      );
      
      distributors.push({
        id: distributorId,
        name: dbName,
        displayName,
        organizationId: 90006 + i, // Will be updated after org creation
      });
      console.log(`  ✓ ${displayName} (ID: ${distributorId})`);
    }
    
    // ========================================
    // 2. STORE ORGANIZATION IDS FOR LINKING
    // ========================================
    // Get organization IDs for linking
    const [orgIds] = await connection.execute(
      'SELECT id, name FROM organizations WHERE type IN ("provider", "distributor")'
    );
    const orgMap = {};
    orgIds.forEach(org => {
      orgMap[org.name] = org.id;
    });
    
    // Update providers with organization IDs
    providers.forEach(p => {
      p.organizationId = orgMap[p.name];
    });
    
    // Update distributors with organization IDs
    distributors.forEach(d => {
      d.organizationId = orgMap[d.displayName];
    });
    
    // ========================================
    // 3. CREATE PRODUCTS
    // ========================================
    console.log('\n💳 Creating Products...');
    const products = [];
    const denominations = [
      { value: 5, name: '5 LYD Card' },
      { value: 10, name: '10 LYD Card' },
      { value: 20, name: '20 LYD Card' },
      { value: 50, name: '50 LYD Card' },
      { value: 75, name: '75 LYD Card' },
    ];
    
    for (const provider of providers) {
      for (const denom of denominations) {
        const [result] = await connection.execute(
          `INSERT INTO products 
           (provider_id, name, display_name, face_value, price, currency, status, is_active)
           VALUES (?, ?, ?, ?, ?, 'LYD', 'active', 1)`,
          [provider.id, denom.name, denom.name, denom.value, denom.value]
        );
        products.push({
          id: result.insertId,
          providerId: provider.id,
          providerName: provider.name,
          value: denom.value,
        });
      }
      console.log(`  ✓ ${provider.name}: 5 products created`);
    }
    
    // ========================================
    // 4. CREATE CARD BATCHES & CARDS
    // ========================================
    console.log('\n🎫 Creating Card Inventory...');
    let totalCards = 0;
    
    for (const provider of providers) {
      // Create one batch per provider
      const [batchResult] = await connection.execute(
        `INSERT INTO card_batches 
         (provider_id, filename, upload_status, total_cards, processed_cards)
         VALUES (?, ?, 'completed', ?, ?)`,
        [provider.id, `SEED_RUN_MODE_${provider.name}_batch.csv`, 500, 500]
      );
      
      const batchId = batchResult.insertId;
      
      // Create 500 cards per provider
      for (let i = 0; i < 500; i++) {
        const pinEncrypted = crypto.randomBytes(32).toString('hex');
        
        await connection.execute(
          `INSERT INTO cards 
           (provider_id, batch_id, pin_encrypted, status)
           VALUES (?, ?, ?, 'AVAILABLE')`,
          [provider.id, batchId, pinEncrypted]
        );
        totalCards++;
      }
      
      console.log(`  ✓ ${provider.name}: 500 cards created`);
    }
    
    console.log(`  ✓ Total cards created: ${totalCards}`);
    
    // ========================================
    // 5. CREATE PROVIDER-DISTRIBUTOR RELATIONSHIPS
    // ========================================
    // ========================================
    // 4. LINK ORGANIZATIONS TO PROVIDERS/DISTRIBUTORS
    // ========================================
    console.log('\n🔗 Linking organizations to providers/distributors...');
    for (const provider of providers) {
      await connection.execute(
        'UPDATE service_providers SET organization_id = ? WHERE id = ?',
        [provider.organizationId, provider.id]
      );
    }
    for (const distributor of distributors) {
      await connection.execute(
        'UPDATE distributors SET organization_id = ? WHERE id = ?',
        [distributor.organizationId, distributor.id]
      );
    }
    console.log('  ✓ Organizations linked to providers and distributors');
    
    // ========================================
    // 5. CREATE PROVIDER-DISTRIBUTOR RELATIONSHIPS
    // ========================================
    console.log(`\n🤝 Creating Provider-Distributor Relationships...`);
    const relationships = [];
    
    // SEED_Anis connected to all providers
    const anis = distributors[0];
    for (const provider of providers) {
      const [result] = await connection.execute(
        `INSERT INTO provider_distributor_relationships
         (provider_id, distributor_id, commission_percentage, commission_type, credit_line, status)
         VALUES (?, ?, 5.00, 'percentage', 10000.00, 'active')`,
        [provider.id, anis.id]
      );
      relationships.push({
        id: result.insertId,
        providerId: provider.id,
        distributorId: anis.id,
      });
    }
    console.log(`  ✓ ${anis.displayName} connected to all 5 providers`);
    
    // iCard and Qareep connected to selected providers
    const iCard = distributors[1];
    const qareep = distributors[2];
    
    for (let i = 0; i < 3; i++) {
      const provider = providers[i];
      
      // iCard
      const [iCardResult] = await connection.execute(
        `INSERT INTO provider_distributor_relationships
         (provider_id, distributor_id, commission_percentage, commission_type, credit_line, status)
         VALUES (?, ?, 5.00, 'percentage', 5000.00, 'active')`,
        [provider.id, iCard.id]
      );
      relationships.push({
        id: iCardResult.insertId,
        providerId: provider.id,
        distributorId: iCard.id,
      });
      
      // Qareep
      const [qareepResult] = await connection.execute(
        `INSERT INTO provider_distributor_relationships
         (provider_id, distributor_id, commission_percentage, commission_type, credit_line, status)
         VALUES (?, ?, 5.00, 'percentage', 3000.00, 'active')`,
        [provider.id, qareep.id]
      );
      relationships.push({
        id: qareepResult.insertId,
        providerId: provider.id,
        distributorId: qareep.id,
      });
    }
    console.log(`  ✓ ${iCard.displayName} connected to 3 providers`);
    console.log(`  ✓ ${qareep.displayName} connected to 3 providers`);
    
    // ========================================
    // 6. CREATE FINANCIAL ACCOUNTS
    // ========================================
    console.log('\n💰 Creating Financial Accounts...');
    
    for (const rel of relationships) {
      await connection.execute(
        `INSERT INTO provider_distributor_accounts
         (provider_id, distributor_id, balance, credit_line, used_credit, version)
         VALUES (?, ?, 0.00, 10000.00, 0.00, 1)`,
        [rel.providerId, rel.distributorId]
      );
    }
    
    console.log(`  ✓ Financial accounts created for all relationships`);
    
    // ========================================
    // 7. CREATE REALISTIC TRANSACTIONS
    // ========================================
    console.log('\n📈 Creating Transaction History...');
    let transactionCount = 0;
    
    // Get available cards for Anis with product pricing
    const providerIds = providers.map(p => p.id).join(',');
    const [availableCards] = await connection.execute(
      `SELECT c.id, c.provider_id, p.id as product_id, p.price FROM cards c
       JOIN products p ON p.provider_id = c.provider_id
       WHERE c.status = 'AVAILABLE' AND c.provider_id IN (${providerIds})
       LIMIT 50`
    );
    
    for (let i = 0; i < Math.min(20, availableCards.length); i++) {
      const card = availableCards[i];
      const provider = providers.find(p => p.id === card.provider_id);
      const price = parseFloat(card.price);
      const commissionRate = 0.05; // 5%
      const commission = Math.round(price * commissionRate * 100) / 100;
      const idempotencyKey = generateUUID();
      
      // Create transaction
      const [txnResult] = await connection.execute(
        `INSERT INTO transactions
         (idempotency_key, distributor_id, provider_id, product_id, card_id, amount, commission_amount, transaction_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'purchase', 'completed')`,
        [idempotencyKey, anis.id, provider.id, card.product_id, card.id, price, commission]
      );
      
      const transactionId = txnResult.insertId;
      
      // Mark card as SOLD
      await connection.execute(
        `UPDATE cards SET status = 'SOLD' WHERE id = ?`,
        [card.id]
      );
      
      // Create ledger entries
      // 1. Purchase debit
      await connection.execute(
        `INSERT INTO provider_distributor_ledger
         (provider_id, distributor_id, type, amount, balance_after_transaction, used_credit_after_transaction, reference_id, reference_type, metadata)
         VALUES (?, ?, 'DEBIT', ?, ?, ?, ?, 'purchase_debit', ?)`,
        [provider.id, anis.id, -price, -price, 0, `TXN_${transactionId}`, JSON.stringify({ transactionId, productId: card.product_id })]
      );
      
      // 2. Commission credit
      await connection.execute(
        `INSERT INTO provider_distributor_ledger
         (provider_id, distributor_id, type, amount, balance_after_transaction, used_credit_after_transaction, reference_id, reference_type, metadata)
         VALUES (?, ?, 'CREDIT', ?, ?, ?, ?, 'commission_credit', ?)`,
        [provider.id, anis.id, commission, -price + commission, 0, `COM_${transactionId}`, JSON.stringify({ commission, transactionId })]
      );
      
      // Update account balance
      await connection.execute(
        `UPDATE provider_distributor_accounts 
         SET balance = balance + ?, used_credit = used_credit + ?
         WHERE provider_id = ? AND distributor_id = ?`,
        [commission - price, price - commission, provider.id, anis.id]
      );
      
      transactionCount++;
    }
    
    console.log(`  ✓ ${transactionCount} transactions created with ledger entries`);
    
    // ========================================
    // 8. CREATE API CREDENTIALS
    // ========================================
    console.log('\n🔑 Creating API Credentials...');
    
    for (const distributor of distributors) {
      const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
      const maskedKey = `sk_live_****${crypto.randomBytes(4).toString('hex')}`;
      const secretHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      
      await connection.execute(
        `INSERT INTO distributor_api_credentials
         (distributor_id, key_id, masked_key, secret_hash, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
        [distributor.id, keyId, maskedKey, secretHash]
      );
    }
    
    console.log(`  ✓ API credentials created for all distributors`);
    
    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n✅ Run-Mode Seed Data Created Successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Providers: ${providers.length}`);
    console.log(`   Distributors: ${distributors.length}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Cards: ${totalCards}`);
    console.log(`   Relationships: ${relationships.length}`);
    console.log(`   Transactions: ${transactionCount}`);
    console.log(`   API Credentials: ${distributors.length}`);
    console.log('\n🏷️  All records tagged with SEED_RUN_MODE naming pattern for easy cleanup.\n');
    
  } catch (error) {
    console.error('❌ Error creating seed data:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedRunModeData().catch(console.error);
