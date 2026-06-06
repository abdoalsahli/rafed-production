#!/usr/bin/env node
import mysql from 'mysql2/promise';
import crypto from 'crypto';

function validateEnvironment() {
  const errors = [];
  if (!process.env.DATABASE_URL) errors.push('Missing DATABASE_URL');
  if (!process.env.PIN_ENCRYPTION_KEY) errors.push('Missing PIN_ENCRYPTION_KEY');
  else if (!/^[a-fA-F0-9]{64}$/.test(process.env.PIN_ENCRYPTION_KEY)) errors.push('PIN_ENCRYPTION_KEY must be 64 hex characters');

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('✓ Environment validation passed');
}

async function main() {
  let pool;
  try {
    validateEnvironment();

    console.log(`✓ Connecting to database using DATABASE_URL`);
    pool = mysql.createPool(process.env.DATABASE_URL);
    const connection = await pool.getConnection();
    console.log('✓ Database connection established');

    await connection.execute('SELECT 1');
    console.log('✓ Database connection verified');

    const PIN_ENCRYPTION_KEY = process.env.PIN_ENCRYPTION_KEY;

    // Create test provider
    const [providerResult] = await connection.execute(
      'INSERT INTO service_providers (name, status) VALUES (?, ?)',
      [`Full Allocation Burst Test Provider ${Date.now()}`, 'active']
    );
    const providerId = providerResult.insertId;
    console.log(`✓ Provider created: ${providerId}`);

    // Create test distributor
    const [distributorResult] = await connection.execute(
      'INSERT INTO distributors (name, status) VALUES (?, ?)',
      [`Full Allocation Burst Test Distributor ${Date.now()}`, 'active']
    );
    const distributorId = distributorResult.insertId;
    console.log(`✓ Distributor created: ${distributorId}`);

    // Create test product
    const [productResult] = await connection.execute(
      'INSERT INTO products (provider_id, name, price, status) VALUES (?, ?, ?, ?)',
      [providerId, 'Full Allocation Burst Test Product', 100, 'active']
    );
    const productId = productResult.insertId;
    console.log(`✓ Product created: ${productId}`);

    // Create account
    const [accountResult] = await connection.execute(
      'INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit) VALUES (?, ?, ?, ?, ?)',
      [providerId, distributorId, 10000000, 10000000, 0]
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

    connection.release();

    console.log('\n' + '='.repeat(70));
    console.log('FULL ALLOCATION BURST TEST: SAME-ACCOUNT CONCURRENT PURCHASES');
    console.log('='.repeat(70));

    // Test scenarios
    const scenarios = [25, 50, 100, 200, 300];

    for (const concurrency of scenarios) {
      // Upload fresh cards for each test (ensure all requests can allocate)
      const cardsNeeded = concurrency + 50;
      console.log(`\nUploading ${cardsNeeded} cards for ${concurrency}-way test...`);
      
      const uploadConn = await pool.getConnection();
      for (let i = 0; i < cardsNeeded; i++) {
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

        await uploadConn.execute(
          'INSERT INTO cards (provider_id, product_id, pin_encrypted, status) VALUES (?, ?, ?, ?)',
          [providerId, productId, encryptedPin, 'AVAILABLE']
        );
      }
      uploadConn.release();
      console.log(`✓ ${cardsNeeded} cards uploaded`);

      console.log(`\n[TEST] ${concurrency}-way Same-Account Burst (Full Allocation)`);
      const testResult = await runBurstWithFullAllocation(pool, providerId, distributorId, productId, concurrency);
      reportResults(testResult);

      // Cleanup cards for next test
      const cleanupConn = await pool.getConnection();
      await cleanupConn.execute('UPDATE cards SET allocated_to_distributor_id = NULL WHERE product_id = ?', [productId]);
      await cleanupConn.execute('DELETE FROM cards WHERE product_id = ?', [productId]);
      cleanupConn.release();
    }

    // Final cleanup
    console.log('\n' + '='.repeat(70));
    console.log('Cleaning up test data...');
    const finalCleanupConn = await pool.getConnection();
    await finalCleanupConn.execute('DELETE FROM provider_distributor_ledger WHERE provider_id = ?', [providerId]);
    await finalCleanupConn.execute('DELETE FROM provider_distributor_accounts WHERE provider_id = ?', [providerId]);
    await finalCleanupConn.execute('DELETE FROM provider_distributor_commission WHERE provider_id = ?', [providerId]);
    await finalCleanupConn.execute('DELETE FROM products WHERE id = ?', [productId]);
    await finalCleanupConn.execute('DELETE FROM distributors WHERE id = ?', [distributorId]);
    await finalCleanupConn.execute('DELETE FROM service_providers WHERE id = ?', [providerId]);
    finalCleanupConn.release();
    console.log('✓ Cleanup complete');

    console.log('\n' + '='.repeat(70));
    console.log('✅ FULL ALLOCATION BURST TEST COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ FULL ALLOCATION BURST TEST FAILED');
    console.error('='.repeat(70));
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

async function runBurstWithFullAllocation(pool, providerId, distributorId, productId, concurrency) {
  const durations = [];
  const lockWaits = [];
  const results = [];
  const startTime = Date.now();
  const connErrors = [];

  // Launch all concurrent requests simultaneously
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        let conn;
        try {
          conn = await pool.getConnection();
          const txnStart = Date.now();
          const lockWaitStart = Date.now();

          // Get first available card (will wait for lock if needed)
          const [cardResult] = await conn.execute(
            'SELECT id FROM cards WHERE provider_id = ? AND product_id = ? AND status = ? LIMIT 1 FOR UPDATE',
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
            results.push({ success: true, cardId });
          } else {
            results.push({ success: false, reason: 'No cards available' });
          }

          const txnDuration = Date.now() - txnStart;
          durations.push(txnDuration);
        } catch (err) {
          connErrors.push(err.message);
          results.push({ success: false, reason: err.message });
        } finally {
          if (conn) conn.release();
        }
      })()
    );
  }

  // Wait for all to complete
  await Promise.allSettled(promises);
  const totalDuration = Date.now() - startTime;

  // Query results
  const queryConn = await pool.getConnection();
  const [soldCards] = await queryConn.execute(
    'SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = ?',
    [productId, 'SOLD']
  );
  const uniqueCards = soldCards[0].count;

  const [ledgerEntries] = await queryConn.execute(
    'SELECT COUNT(*) as count FROM provider_distributor_ledger WHERE provider_id = ? AND distributor_id = ?',
    [providerId, distributorId]
  );
  queryConn.release();

  // Calculate statistics
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const successRate = ((successful / concurrency) * 100).toFixed(2);

  durations.sort((a, b) => a - b);
  lockWaits.sort((a, b) => a - b);

  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const p95Duration = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)];
  const p99Duration = durations[Math.max(0, Math.ceil(durations.length * 0.99) - 1)];

  const avgLockWait = lockWaits.length > 0 ? lockWaits.reduce((a, b) => a + b, 0) / lockWaits.length : 0;
  const p95LockWait = lockWaits[Math.max(0, Math.ceil(lockWaits.length * 0.95) - 1)];
  const p99LockWait = lockWaits[Math.max(0, Math.ceil(lockWaits.length * 0.99) - 1)];

  return {
    concurrency,
    successful,
    failed,
    successRate,
    totalDuration,
    avgDuration,
    p95Duration,
    p99Duration,
    avgLockWait,
    p95LockWait,
    p99LockWait,
    uniqueCards,
    ledgerEntries: ledgerEntries[0].count,
    connErrors: connErrors.length,
  };
}

function reportResults(test) {
  console.log(`  Concurrency: ${test.concurrency}`);
  console.log(`  Success: ${test.successful}/${test.concurrency} (${test.successRate}%)`);
  console.log(`  Failed: ${test.failed}`);
  console.log(`  Total Duration: ${test.totalDuration}ms`);
  console.log(`  Unique Cards Allocated: ${test.uniqueCards}`);
  console.log(`  Ledger Entries: ${test.ledgerEntries}`);
  console.log(`  Transaction Duration (ms):`);
  console.log(`    - Average: ${test.avgDuration.toFixed(2)}`);
  console.log(`    - P95: ${test.p95Duration.toFixed(2)}`);
  console.log(`    - P99: ${test.p99Duration.toFixed(2)}`);
  console.log(`  Account Lock Wait (ms):`);
  console.log(`    - Average: ${test.avgLockWait.toFixed(2)}`);
  console.log(`    - P95: ${test.p95LockWait.toFixed(2)}`);
  console.log(`    - P99: ${test.p99LockWait.toFixed(2)}`);
  console.log(`  Connection Errors: ${test.connErrors}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
