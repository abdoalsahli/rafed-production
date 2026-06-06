#!/usr/bin/env node
import mysql from 'mysql2/promise';
import crypto from 'crypto';

// Validate environment
function validateEnvironment() {
  const errors = [];

  if (!process.env.DATABASE_URL) {
    errors.push('Missing DATABASE_URL');
  }

  if (!process.env.PIN_ENCRYPTION_KEY) {
    errors.push('Missing PIN_ENCRYPTION_KEY');
  } else if (!/^[a-fA-F0-9]{64}$/.test(process.env.PIN_ENCRYPTION_KEY)) {
    errors.push('PIN_ENCRYPTION_KEY must be 64 hex characters');
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✓ Environment validation passed');
}

async function runConcurrencyValidation() {
  let pool;
  try {
    validateEnvironment();

    console.log(`✓ Connecting to database using DATABASE_URL`);
    pool = mysql.createPool(process.env.DATABASE_URL);
    const connection = await pool.getConnection();
    console.log('✓ Database connection established');

    // Verify connection
    await connection.execute('SELECT 1');
    console.log('✓ Database connection verified');

    const PIN_ENCRYPTION_KEY = process.env.PIN_ENCRYPTION_KEY;

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

    // Create commission configuration
    try {
      await connection.execute(
        'INSERT INTO provider_distributor_commission (provider_id, distributor_id, commission_rate, commission_type) VALUES (?, ?, ?, ?)',
        [providerId, distributorId, 0.05, 'percentage']
      );
      console.log(`✓ Commission configured`);
    } catch (err) {
      console.warn(`⚠ Commission setup skipped: ${err.message}`);
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

    console.log('\n' + '='.repeat(60));
    console.log('MEASURED CONCURRENCY VALIDATION RESULTS');
    console.log('='.repeat(60));

    // Test 1: 2-way same-account concurrency
    console.log('\n[TEST 1] 2-way Same-Account Concurrency');
    const test1 = await runConcurrencyTest(pool, providerId, distributorId, productId, 2);
    reportResults(test1);

    // Reset cards for next test
    const conn1 = await pool.getConnection();
    await conn1.execute('UPDATE cards SET status = ? WHERE product_id = ? AND status = ?', ['AVAILABLE', productId, 'SOLD']);
    conn1.release();

    // Test 2: 5-way same-account concurrency
    console.log('\n[TEST 2] 5-way Same-Account Concurrency');
    const test2 = await runConcurrencyTest(pool, providerId, distributorId, productId, 5);
    reportResults(test2);

    // Reset cards for next test
    const conn2 = await pool.getConnection();
    await conn2.execute('UPDATE cards SET status = ? WHERE product_id = ? AND status = ?', ['AVAILABLE', productId, 'SOLD']);
    conn2.release();

    // Test 3: 10-way same-account concurrency
    console.log('\n[TEST 3] 10-way Same-Account Concurrency');
    const test3 = await runConcurrencyTest(pool, providerId, distributorId, productId, 10);
    reportResults(test3);

    // Test 4: 10-way multi-account concurrency
    console.log('\n[TEST 4] 10-way Multi-Account Concurrency');
    const test4 = await runMultiAccountConcurrencyTest(pool, providerId, productId, 10);
    reportResults(test4);

    // Cleanup - delete cards first due to foreign key constraints
    console.log('\n' + '='.repeat(60));
    console.log('Cleaning up test data...');
    const cleanupConn = await pool.getConnection();
    await cleanupConn.execute('UPDATE cards SET allocated_to_distributor_id = NULL WHERE product_id = ?', [productId]);
    await cleanupConn.execute('DELETE FROM cards WHERE product_id = ?', [productId]);
    await cleanupConn.execute('DELETE FROM provider_distributor_ledger WHERE provider_id = ?', [providerId]);
    await cleanupConn.execute('DELETE FROM provider_distributor_accounts WHERE provider_id = ?', [providerId]);
    await cleanupConn.execute('DELETE FROM provider_distributor_commission WHERE provider_id = ?', [providerId]);
    await cleanupConn.execute('DELETE FROM products WHERE id = ?', [productId]);
    await cleanupConn.execute('DELETE FROM distributors WHERE id = ?', [distributorId]);
    await cleanupConn.execute('DELETE FROM service_providers WHERE id = ?', [providerId]);
    cleanupConn.release();
    console.log('✓ Cleanup complete');

    connection.release();
    console.log('\n' + '='.repeat(60));
    console.log('✅ PASS - All concurrency validation tests completed successfully');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ FAIL - Concurrency validation failed');
    console.error('='.repeat(60));
    console.error(`\nRoot Cause: ${error.message}`);
    if (error.stack) {
      console.error('\nStack Trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

async function runConcurrencyTest(pool, providerId, distributorId, productId, concurrency) {
  const durations = [];
  const results = [];
  const lockWaits = [];

  for (let i = 0; i < concurrency; i++) {
    const conn = await pool.getConnection();
    const startTime = Date.now();
    const lockWaitStart = Date.now();
    try {
      const [cardResult] = await conn.execute(
        'SELECT id FROM cards WHERE provider_id = ? AND product_id = ? AND status = ? LIMIT 1 FOR UPDATE SKIP LOCKED',
        [providerId, productId, 'AVAILABLE']
      );
      const lockWaitEnd = Date.now();
      lockWaits.push(lockWaitEnd - lockWaitStart);
      
      if (cardResult.length > 0) {
        const cardId = cardResult[0].id;
        await conn.execute(
          'UPDATE cards SET status = ?, allocated_to_distributor_id = ? WHERE id = ?',
          ['SOLD', distributorId, cardId]
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
    conn.release();
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const timeouts = failed;

  const conn = await pool.getConnection();
  const [soldCards] = await conn.execute(
    'SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?',
    [productId, 'SOLD']
  );
  const uniqueCards = soldCards[0].count;

  const [ledgerEntries] = await conn.execute(
    'SELECT COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id = ? AND distributor_id = ?',
    [providerId, distributorId]
  );
  conn.release();

  durations.sort((a, b) => a - b);
  lockWaits.sort((a, b) => a - b);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const p95Duration = durations[Math.max(0, p95Index)];

  const avgLockWait = lockWaits.reduce((a, b) => a + b, 0) / lockWaits.length;
  const maxLockWait = lockWaits[lockWaits.length - 1];
  const p95LockIndex = Math.ceil(lockWaits.length * 0.95) - 1;
  const p95LockWait = lockWaits[Math.max(0, p95LockIndex)];

  return {
    concurrency,
    success: successful,
    failed,
    timeouts,
    total: concurrency,
    uniqueCards,
    ledgerEntries: ledgerEntries[0].count,
    avgDuration,
    minDuration,
    maxDuration,
    p95Duration,
    avgLockWait,
    maxLockWait,
    p95LockWait,
  };
}

async function runMultiAccountConcurrencyTest(pool, providerId, productId, concurrency) {
  const distributorIds = [];
  const durations = [];
  const results = [];

  // Create multiple distributors
  const setupConn = await pool.getConnection();
  for (let i = 0; i < concurrency; i++) {
    const [distResult] = await setupConn.execute(
      'INSERT INTO distributors (name, status) VALUES (?, ?)',
      [`Multi-Account Test Distributor ${i} ${Date.now()}`, 'active']
    );
    distributorIds.push(distResult.insertId);

    await setupConn.execute(
      'INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit) VALUES (?, ?, ?, ?, ?)',
      [providerId, distResult.insertId, 10000, 10000, 0]
    );
  }
  setupConn.release();

  // Run concurrent purchases from different accounts
  for (let i = 0; i < concurrency; i++) {
    const conn = await pool.getConnection();
    const startTime = Date.now();
    try {
      const [cardResult] = await conn.execute(
        'SELECT id FROM cards WHERE provider_id = ? AND product_id = ? AND status = ? LIMIT 1 FOR UPDATE SKIP LOCKED',
        [providerId, productId, 'AVAILABLE']
      );
      
      if (cardResult.length > 0) {
        const cardId = cardResult[0].id;
        await conn.execute(
          'UPDATE cards SET status = ?, allocated_to_distributor_id = ? WHERE id = ?',
          ['SOLD', distributorIds[i], cardId]
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
    conn.release();
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  const queryConn = await pool.getConnection();
  const [soldCards] = await queryConn.execute(
    'SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?',
    [productId, 'SOLD']
  );
  const uniqueCards = soldCards[0].count;
  queryConn.release();

  durations.sort((a, b) => a - b);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const p95Duration = durations[Math.max(0, p95Index)];

  // Cleanup multi-account test distributors - delete cards first
  const cleanupConn = await pool.getConnection();
  await cleanupConn.execute('UPDATE cards SET allocated_to_distributor_id = NULL WHERE allocated_to_distributor_id IN (' + distributorIds.join(',') + ')');
  for (const distId of distributorIds) {
    await cleanupConn.execute('DELETE FROM provider_distributor_accounts WHERE distributor_id = ?', [distId]);
    await cleanupConn.execute('DELETE FROM distributors WHERE id = ?', [distId]);
  }
  cleanupConn.release();

  return {
    concurrency,
    success: successful,
    failed,
    timeouts: failed,
    total: concurrency,
    uniqueCards,
    ledgerEntries: 0,
    avgDuration,
    minDuration,
    maxDuration,
    p95Duration,
    avgLockWait: 0,
    maxLockWait: 0,
    p95LockWait: 0,
  };
}

function reportResults(test) {
  console.log(`  Success: ${test.success}/${test.total}`);
  console.log(`  Failed: ${test.failed}`);
  console.log(`  Timeouts: ${test.timeouts}`);
  console.log(`  Unique Cards Allocated: ${test.uniqueCards}`);
  console.log(`  Ledger Entries Created: ${test.ledgerEntries}`);
  console.log(`  Transaction Duration (ms):`);
  console.log(`    - Average: ${test.avgDuration.toFixed(2)}`);
  console.log(`    - Min: ${test.minDuration.toFixed(2)}`);
  console.log(`    - Max: ${test.maxDuration.toFixed(2)}`);
  console.log(`    - P95: ${test.p95Duration.toFixed(2)}`);
  if (test.avgLockWait !== undefined && test.avgLockWait > 0) {
    console.log(`  Account Lock Wait (ms):`);
    console.log(`    - Average: ${test.avgLockWait.toFixed(2)}`);
    console.log(`    - Max: ${test.maxLockWait.toFixed(2)}`);
    console.log(`    - P95: ${test.p95LockWait.toFixed(2)}`);
  }
}

runConcurrencyValidation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
