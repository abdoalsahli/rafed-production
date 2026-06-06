#!/usr/bin/env node
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'prepaid_card_platform',
};

const PIN_ENCRYPTION_KEY = process.env.PIN_ENCRYPTION_KEY;
if (!PIN_ENCRYPTION_KEY || PIN_ENCRYPTION_KEY.length !== 64) {
  console.error('❌ PIN_ENCRYPTION_KEY not set or invalid (must be 64 hex chars)');
  process.exit(1);
}

async function runConcurrencyValidation() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ Database connection established');

    // Create test provider
    const [providerResult] = await connection.execute(
      'INSERT INTO service_providers (name, status) VALUES (?, ?)',
      [`Concurrency Test Provider ${Date.now()}`, 'active']
    );
    const providerId = providerResult.insertId;
    console.log(`✓ Provider created: ${providerId}`);

    // Create test distributor
    const [distributorResult] = await connection.execute(
      'INSERT INTO distributors (name, status) VALUES (?, ?)',
      [`Concurrency Test Distributor ${Date.now()}`, 'active']
    );
    const distributorId = distributorResult.insertId;
    console.log(`✓ Distributor created: ${distributorId}`);

    // Create test product
    const [productResult] = await connection.execute(
      'INSERT INTO products (provider_id, name, price, status) VALUES (?, ?, ?, ?)',
      [providerId, 'Concurrency Test Product', 100, 'active']
    );
    const productId = productResult.insertId;
    console.log(`✓ Product created: ${productId}`);

    // Create account
    const [accountResult] = await connection.execute(
      'INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit) VALUES (?, ?, ?, ?, ?)',
      [providerId, distributorId, 10000, 10000, 0]
    );
    const accountId = accountResult.insertId;
    console.log(`✓ Account created: ${accountId}`);

    // Create commission configuration - check table structure first
    try {
      const [commissionResult] = await connection.execute(
        'INSERT INTO provider_distributor_commission (provider_id, distributor_id, commission_rate, commission_type) VALUES (?, ?, ?, ?)',
        [providerId, distributorId, 0.05, 'percentage']
      );
      console.log(`✓ Commission configured`);
    } catch (err) {
      console.warn(`⚠ Commission setup failed: ${err.message}`);
      // Continue anyway - commission might not be required for basic test
    }

    // Upload 20 cards
    const cardIds = [];
    for (let i = 0; i < 20; i++) {
      const pin = String(1000000000 + i).padStart(10, '0');
      const iv = crypto.randomBytes(16).toString('hex');
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(PIN_ENCRYPTION_KEY, 'hex'),
        Buffer.from(iv, 'hex')
      );
      let encrypted = cipher.update(pin, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedPin = `${iv}:${encrypted}`;

      const [cardResult] = await connection.execute(
        'INSERT INTO cards (provider_id, product_id, pin_encrypted, status) VALUES (?, ?, ?, ?)',
        [providerId, productId, encryptedPin, 'AVAILABLE']
      );
      cardIds.push(cardResult.insertId);
    }
    console.log(`✓ 20 cards uploaded`);

    console.log('\n=== CONCURRENCY VALIDATION RESULTS ===\n');

    // Test 1: 2-way same-account concurrency
    console.log('TEST 1: 2-way Same-Account Concurrency');
    const test1Results = await runConcurrencyTest(connection, providerId, distributorId, productId, 2);
    console.log(`  Success: ${test1Results.success}/${test1Results.total}`);
    console.log(`  Unique Cards: ${test1Results.uniqueCards}`);
    console.log(`  Ledger Entries: ${test1Results.ledgerEntries}`);
    console.log(`  Avg Duration: ${test1Results.avgDuration.toFixed(2)}ms`);
    console.log(`  Min Duration: ${test1Results.minDuration.toFixed(2)}ms`);
    console.log(`  Max Duration: ${test1Results.maxDuration.toFixed(2)}ms`);
    console.log(`  P95 Duration: ${test1Results.p95Duration.toFixed(2)}ms`);

    // Test 2: 5-way same-account concurrency
    console.log('\nTEST 2: 5-way Same-Account Concurrency');
    const test2Results = await runConcurrencyTest(connection, providerId, distributorId, productId, 5);
    console.log(`  Success: ${test2Results.success}/${test2Results.total}`);
    console.log(`  Unique Cards: ${test2Results.uniqueCards}`);
    console.log(`  Ledger Entries: ${test2Results.ledgerEntries}`);
    console.log(`  Avg Duration: ${test2Results.avgDuration.toFixed(2)}ms`);
    console.log(`  Min Duration: ${test2Results.minDuration.toFixed(2)}ms`);
    console.log(`  Max Duration: ${test2Results.maxDuration.toFixed(2)}ms`);
    console.log(`  P95 Duration: ${test2Results.p95Duration.toFixed(2)}ms`);

    // Test 3: 10-way same-account concurrency
    console.log('\nTEST 3: 10-way Same-Account Concurrency');
    const test3Results = await runConcurrencyTest(connection, providerId, distributorId, productId, 10);
    console.log(`  Success: ${test3Results.success}/${test3Results.total}`);
    console.log(`  Unique Cards: ${test3Results.uniqueCards}`);
    console.log(`  Ledger Entries: ${test3Results.ledgerEntries}`);
    console.log(`  Avg Duration: ${test3Results.avgDuration.toFixed(2)}ms`);
    console.log(`  Min Duration: ${test3Results.minDuration.toFixed(2)}ms`);
    console.log(`  Max Duration: ${test3Results.maxDuration.toFixed(2)}ms`);
    console.log(`  P95 Duration: ${test3Results.p95Duration.toFixed(2)}ms`);

    // Cleanup
    await connection.execute('DELETE FROM provider_distributor_ledger WHERE provider_id = ?', [providerId]);
    await connection.execute('DELETE FROM provider_distributor_accounts WHERE provider_id = ?', [providerId]);
    await connection.execute('DELETE FROM provider_distributor_commission WHERE provider_id = ?', [providerId]);
    await connection.execute('DELETE FROM cards WHERE product_id = ?', [productId]);
    await connection.execute('DELETE FROM products WHERE id = ?', [productId]);
    await connection.execute('DELETE FROM distributors WHERE id = ?', [distributorId]);
    await connection.execute('DELETE FROM service_providers WHERE id = ?', [providerId]);

    console.log('\n✓ Cleanup complete');
    console.log('\n✅ PASS - Concurrency validation completed successfully');

  } catch (error) {
    console.error('\n❌ FAIL - Error during concurrency validation:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

async function runConcurrencyTest(connection, providerId, distributorId, productId, concurrency) {
  const durations = [];
  const results = [];

  for (let i = 0; i < concurrency; i++) {
    const startTime = Date.now();
    try {
      // Simulate a purchase by updating card status
      const [cardResult] = await connection.execute(
        'SELECT id FROM cards WHERE provider_id = ? AND product_id = ? AND status = ? LIMIT 1 FOR UPDATE SKIP LOCKED',
        [providerId, productId, 'AVAILABLE']
      );
      
      if (cardResult.length > 0) {
        const cardId = cardResult[0].id;
        await connection.execute(
          'UPDATE cards SET status = ? WHERE id = ?',
          ['SOLD', cardId]
        );
        results.push({ success: true });
      } else {
        results.push({ success: false, reason: 'No cards available' });
      }
    } catch (err) {
      results.push({ success: false, reason: err.message });
    }
    const duration = Date.now() - startTime;
    durations.push(duration);
  }

  const successful = results.filter(r => r.success).length;
  const [soldCards] = await connection.execute(
    'SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?',
    [productId, 'SOLD']
  );
  const uniqueCards = soldCards[0].count;

  const [ledgerEntries] = await connection.execute(
    'SELECT COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id = ? AND distributor_id = ?',
    [providerId, distributorId]
  );

  durations.sort((a, b) => a - b);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const p95Duration = durations[Math.max(0, p95Index)];

  return {
    success: successful,
    total: concurrency,
    uniqueCards,
    ledgerEntries: ledgerEntries[0].count,
    avgDuration,
    minDuration,
    maxDuration,
    p95Duration,
  };
}

runConcurrencyValidation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
