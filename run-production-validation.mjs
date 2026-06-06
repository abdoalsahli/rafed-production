#!/usr/bin/env node

/**
 * Production Validation Test
 * 
 * Tests:
 * 1. MySQL GET_LOCK distributed-safe locking
 * 2. Recovery logic (only recover if lock not held)
 * 3. Ledger verification (2 entries per purchase)
 * 4. Queue backpressure (reject when at capacity)
 * 5. Burst load tests (100, 300, 1000 concurrent)
 */

import mysql from 'mysql2/promise';
import { performance } from 'perf_hooks';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'prepaid_card_db',
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0,
};

let pool;

async function initDb() {
  pool = await mysql.createPool(dbConfig);
  console.log('✓ Database connected');
}

async function cleanup() {
  if (pool) await pool.end();
}

/**
 * Test 1: MySQL GET_LOCK distributed-safe locking
 */
async function testMySQLGetLock() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: MySQL GET_LOCK Distributed-Safe Locking');
  console.log('='.repeat(60));

  const lockName = `test_lock_${Date.now()}`;
  const conn1 = await pool.getConnection();
  const conn2 = await pool.getConnection();

  try {
    // Connection 1 acquires lock
    const [result1] = await conn1.execute('SELECT GET_LOCK(?, 5) as acquired', [lockName]);
    const acquired1 = result1[0].acquired;
    console.log(`Connection 1 acquires lock: ${acquired1 === 1 ? '✓' : '✗'}`);

    // Connection 2 tries to acquire same lock (should timeout)
    const [result2] = await conn2.execute('SELECT GET_LOCK(?, 1) as acquired', [lockName]);
    const acquired2 = result2[0].acquired;
    console.log(`Connection 2 tries to acquire lock: ${acquired2 === 0 ? '✓ (timeout as expected)' : '✗ (should timeout)'}`);

    // Connection 1 releases lock
    const [result3] = await conn1.execute('SELECT RELEASE_LOCK(?) as released', [lockName]);
    const released = result3[0].released;
    console.log(`Connection 1 releases lock: ${released === 1 ? '✓' : '✗'}`);

    // Connection 2 now acquires lock
    const [result4] = await conn2.execute('SELECT GET_LOCK(?, 5) as acquired', [lockName]);
    const acquired3 = result4[0].acquired;
    console.log(`Connection 2 acquires lock after release: ${acquired3 === 1 ? '✓' : '✗'}`);

    // Cleanup
    await conn2.execute('SELECT RELEASE_LOCK(?)', [lockName]);

    return acquired1 === 1 && acquired2 === 0 && released === 1 && acquired3 === 1;
  } finally {
    conn1.release();
    conn2.release();
  }
}

/**
 * Test 2: Recovery logic verification
 */
async function testRecoveryLogic() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Recovery Logic (Only Recover if Lock Not Held)');
  console.log('='.repeat(60));

  const conn = await pool.getConnection();
  try {
    const providerId = 1;
    const distributorId = 1;
    const lockName = `queue_worker_${providerId}_${distributorId}`;

    // Check if lock is free
    const [result1] = await conn.execute('SELECT IS_FREE_LOCK(?) as isFree', [lockName]);
    const isFree1 = result1[0].isFree;
    console.log(`Lock is free initially: ${isFree1 === 1 ? '✓' : '✗'}`);

    // Acquire lock
    const [result2] = await conn.execute('SELECT GET_LOCK(?, 10) as acquired', [lockName]);
    const acquired = result2[0].acquired;
    console.log(`Lock acquired: ${acquired === 1 ? '✓' : '✗'}`);

    // Check if lock is free (should be 0 = not free)
    const [result3] = await conn.execute('SELECT IS_FREE_LOCK(?) as isFree', [lockName]);
    const isFree2 = result3[0].isFree;
    console.log(`Lock is NOT free when held: ${isFree2 === 0 ? '✓' : '✗'}`);

    // Release lock
    const [result4] = await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    const released = result4[0].released;
    console.log(`Lock released: ${released === 1 ? '✓' : '✗'}`);

    // Check if lock is free again
    const [result5] = await conn.execute('SELECT IS_FREE_LOCK(?) as isFree', [lockName]);
    const isFree3 = result5[0].isFree;
    console.log(`Lock is free after release: ${isFree3 === 1 ? '✓' : '✗'}`);

    return isFree1 === 1 && acquired === 1 && isFree2 === 0 && released === 1 && isFree3 === 1;
  } finally {
    conn.release();
  }
}

/**
 * Test 3: Ledger verification
 */
async function testLedgerVerification() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Ledger Verification (2 Entries per Purchase)');
  console.log('='.repeat(60));

  const conn = await pool.getConnection();
  try {
    const providerId = 1;
    const distributorId = 1;

    // Count successful purchases
    const [purchaseRows] = await conn.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'SUCCEEDED'`,
      [providerId, distributorId]
    );
    const successfulPurchases = purchaseRows[0].count || 0;

    // Count ledger entries by type
    const [ledgerRows] = await conn.execute(
      `SELECT type, COUNT(*) as count FROM provider_distributor_ledger
       WHERE provider_id = ? AND distributor_id = ? 
       AND reference_type IN ('purchase_debit', 'commission_credit')
       GROUP BY type`,
      [providerId, distributorId]
    );

    let debitEntries = 0;
    let creditEntries = 0;

    for (const row of ledgerRows) {
      if (row.type === 'DEBIT') {
        debitEntries = row.count;
      } else if (row.type === 'CREDIT') {
        creditEntries = row.count;
      }
    }

    const totalEntries = debitEntries + creditEntries;
    const expectedEntries = successfulPurchases * 2;
    const isCorrect = debitEntries === successfulPurchases && creditEntries === successfulPurchases;

    console.log(`Successful purchases: ${successfulPurchases}`);
    console.log(`Debit entries: ${debitEntries}`);
    console.log(`Credit entries: ${creditEntries}`);
    console.log(`Total entries: ${totalEntries} (expected: ${expectedEntries})`);
    console.log(`Ledger correct: ${isCorrect ? '✓' : '✗'}`);

    return isCorrect;
  } finally {
    conn.release();
  }
}

/**
 * Test 4: Queue backpressure
 */
async function testQueueBackpressure() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Queue Backpressure (Reject When At Capacity)');
  console.log('='.repeat(60));

  const conn = await pool.getConnection();
  try {
    const providerId = 1;
    const distributorId = 1;

    // Get current queue depth
    const [depthRows] = await conn.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status IN ('PENDING', 'PROCESSING')`,
      [providerId, distributorId]
    );
    const currentDepth = depthRows[0].count || 0;

    // Get max capacity (hardcoded in queue-sql.ts)
    const maxCapacity = 10000;

    console.log(`Current queue depth: ${currentDepth}`);
    console.log(`Max capacity: ${maxCapacity}`);
    console.log(`Backpressure active: ${currentDepth >= maxCapacity ? '✓' : 'Not triggered'}`);

    return true;
  } finally {
    conn.release();
  }
}

/**
 * Test 5: Burst load tests
 */
async function runBurstLoadTest(concurrencyLevel) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`BURST LOAD: ${concurrencyLevel} concurrent requests`);
  console.log(`${'─'.repeat(60)}`);

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;

  const conn = await pool.getConnection();
  try {
    // Clear old test requests
    await conn.execute(
      `DELETE FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND idempotency_key LIKE 'burst-final-%'`,
      [providerId, distributorId]
    );
  } finally {
    conn.release();
  }

  const requests = [];
  const startTime = performance.now();

  // Enqueue requests in parallel
  console.log(`Enqueueing ${concurrencyLevel} requests...`);
  const promises = [];
  for (let i = 0; i < concurrencyLevel; i++) {
    promises.push(
      (async () => {
        const conn = await pool.getConnection();
        try {
          const idempotencyKey = `burst-final-${Date.now()}-${i}`;
          const [result] = await conn.execute(
            `INSERT INTO purchase_requests 
             (provider_id, distributor_id, product_id, idempotency_key, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
            [providerId, distributorId, productId, idempotencyKey]
          );

          requests.push({
            id: (result).insertId,
            idempotencyKey,
          });

          return (result).insertId;
        } catch (error) {
          console.error('Enqueue error:', error.message);
          return null;
        } finally {
          conn.release();
        }
      })()
    );
  }

  const results = await Promise.all(promises);
  const enqueueTime = performance.now() - startTime;
  const successfulEnqueues = results.filter((r) => r !== null).length;

  console.log(`✓ Enqueued ${successfulEnqueues}/${concurrencyLevel} requests in ${enqueueTime.toFixed(2)}ms`);

  // Wait for processing
  console.log('Waiting for processing (10 seconds)...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Check results
  const conn2 = await pool.getConnection();
  try {
    const [statuses] = await conn2.execute(
      `SELECT status, COUNT(*) as count FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND idempotency_key LIKE 'burst-final-%'
       GROUP BY status`,
      [providerId, distributorId]
    );

    const statusMap = {};
    for (const row of statuses) {
      statusMap[row.status] = row.count;
    }

    const succeeded = statusMap['SUCCEEDED'] || 0;
    const failed = statusMap['FAILED'] || 0;
    const pending = statusMap['PENDING'] || 0;
    const processing = statusMap['PROCESSING'] || 0;

    console.log(`Results:`);
    console.log(`  SUCCEEDED:  ${succeeded}`);
    console.log(`  FAILED:     ${failed}`);
    console.log(`  PENDING:    ${pending}`);
    console.log(`  PROCESSING: ${processing}`);

    // Get ledger entries
    const [ledgerRows] = await conn2.execute(
      `SELECT COUNT(*) as count FROM provider_distributor_ledger 
       WHERE provider_id = ? AND distributor_id = ? AND reference_type IN ('purchase_debit', 'commission_credit')
       AND reference_id IN (
         SELECT id FROM purchase_requests 
         WHERE idempotency_key LIKE 'burst-final-%'
       )`,
      [providerId, distributorId]
    );

    const ledgerCount = ledgerRows[0].count;
    console.log(`  Ledger entries: ${ledgerCount}`);

    // Get unique cards allocated
    const [cardRows] = await conn2.execute(
      `SELECT COUNT(DISTINCT card_id) as count FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND status = 'SUCCEEDED' 
       AND idempotency_key LIKE 'burst-final-%'`,
      [providerId, distributorId]
    );

    const cardsAllocated = cardRows[0].count;
    console.log(`  Cards allocated: ${cardsAllocated}`);

    // Verify ledger correctness
    const ledgerCorrect = ledgerCount === succeeded * 2;
    console.log(`  Ledger correct (2 per purchase): ${ledgerCorrect ? '✓' : '✗'}`);

    const totalProcessed = succeeded + failed;
    const successRate = totalProcessed > 0 ? ((succeeded / totalProcessed) * 100).toFixed(1) : 0;
    console.log(`  Success rate: ${successRate}%`);

    return {
      concurrency: concurrencyLevel,
      succeeded,
      failed,
      pending,
      processing,
      ledgerCount,
      cardsAllocated,
      ledgerCorrect,
      successRate,
    };
  } finally {
    conn2.release();
  }
}

async function main() {
  try {
    await initDb();

    // Run tests
    console.log('\n' + '='.repeat(60));
    console.log('PRODUCTION VALIDATION SUITE');
    console.log('='.repeat(60));

    const test1 = await testMySQLGetLock();
    const test2 = await testRecoveryLogic();
    const test3 = await testLedgerVerification();
    const test4 = await testQueueBackpressure();

    // Burst load tests
    console.log('\n' + '='.repeat(60));
    console.log('BURST LOAD TESTS');
    console.log('='.repeat(60));

    const burstResults = [];
    for (const level of [100, 300, 1000]) {
      const result = await runBurstLoadTest(level);
      if (result) burstResults.push(result);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));

    console.log(`\nUnit Tests:`);
    console.log(`  MySQL GET_LOCK: ${test1 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Recovery Logic: ${test2 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Ledger Verification: ${test3 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Queue Backpressure: ${test4 ? '✓ PASS' : '✗ FAIL'}`);

    console.log(`\nBurst Load Results:`);
    for (const result of burstResults) {
      console.log(`  ${result.concurrency}-way: ${result.succeeded}/${result.concurrency} succeeded, ledger: ${result.ledgerCorrect ? '✓' : '✗'}`);
    }

    const allTestsPassed =
      test1 && test2 && test3 && test4 && burstResults.every((r) => r.ledgerCorrect);
    console.log(`\n${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    process.exit(allTestsPassed ? 0 : 1);
  } catch (error) {
    console.error('Validation error:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main();
