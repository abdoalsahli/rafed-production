#!/usr/bin/env node

/**
 * Final Hardening Validation Test
 * Tests: 100, 300, 1000 concurrent purchases with metrics
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

async function runFinalValidation(concurrencyLevel) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FINAL VALIDATION: ${concurrencyLevel} concurrent purchases`);
  console.log(`${'='.repeat(70)}`);

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;

  const conn = await pool.getConnection();
  try {
    // Clear old test requests
    await conn.execute(
      `DELETE FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND idempotency_key LIKE 'final-test-%'`,
      [providerId, distributorId]
    );
  } finally {
    conn.release();
  }

  const requests = [];
  const startTime = performance.now();
  const requestTimestamps = [];

  // Enqueue requests
  console.log(`Enqueueing ${concurrencyLevel} requests...`);
  const promises = [];
  for (let i = 0; i < concurrencyLevel; i++) {
    promises.push(
      (async () => {
        const conn = await pool.getConnection();
        try {
          const idempotencyKey = `final-test-${Date.now()}-${i}`;
          const enqueueStart = performance.now();
          const [result] = await conn.execute(
            `INSERT INTO purchase_requests 
             (provider_id, distributor_id, product_id, idempotency_key, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
            [providerId, distributorId, productId, idempotencyKey]
          );

          const enqueueTime = performance.now() - enqueueStart;
          requests.push({
            id: result.insertId,
            idempotencyKey,
            enqueueTime,
          });
          requestTimestamps.push(enqueueTime);

          return result.insertId;
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

  console.log(`✓ Enqueued ${successfulEnqueues}/${concurrencyLevel} in ${enqueueTime.toFixed(2)}ms`);

  // Calculate enqueue time percentiles
  requestTimestamps.sort((a, b) => a - b);
  const p50Enqueue = requestTimestamps[Math.floor(requestTimestamps.length * 0.5)];
  const p95Enqueue = requestTimestamps[Math.floor(requestTimestamps.length * 0.95)];
  const p99Enqueue = requestTimestamps[Math.floor(requestTimestamps.length * 0.99)];

  // Wait for processing
  console.log('Waiting for processing (15 seconds)...');
  await new Promise((resolve) => setTimeout(resolve, 15000));

  // Check results
  const conn2 = await pool.getConnection();
  try {
    const [statuses] = await conn2.execute(
      `SELECT status, COUNT(*) as count FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND idempotency_key LIKE 'final-test-%'
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

    console.log(`\nRequest Status:`);
    console.log(`  SUCCEEDED:  ${succeeded}`);
    console.log(`  FAILED:     ${failed}`);
    console.log(`  PENDING:    ${pending}`);
    console.log(`  PROCESSING: ${processing}`);

    // Get queue wait times (P95, P99)
    const [waitMetrics] = await conn2.execute(
      `SELECT 
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY wait_ms) as p95,
         PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY wait_ms) as p99,
         AVG(wait_ms) as avg,
         MAX(wait_ms) as max
       FROM (
         SELECT (UNIX_TIMESTAMP(processing_started_at) - UNIX_TIMESTAMP(createdAt)) * 1000 as wait_ms
         FROM purchase_requests
         WHERE provider_id = ? AND distributor_id = ? 
         AND processing_started_at IS NOT NULL
         AND idempotency_key LIKE 'final-test-%'
       ) t`,
      [providerId, distributorId]
    );

    const waitMetricsData = (waitMetrics)[0] || {};

    // Get processing duration (P95, P99)
    const [procMetrics] = await conn2.execute(
      `SELECT 
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
         PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99,
         AVG(duration_ms) as avg,
         MAX(duration_ms) as max
       FROM (
         SELECT (UNIX_TIMESTAMP(completed_at) - UNIX_TIMESTAMP(processing_started_at)) * 1000 as duration_ms
         FROM purchase_requests
         WHERE provider_id = ? AND distributor_id = ? 
         AND completed_at IS NOT NULL
         AND idempotency_key LIKE 'final-test-%'
       ) t`,
      [providerId, distributorId]
    );

    const procMetricsData = (procMetrics)[0] || {};

    // Get total latency
    const [totalMetrics] = await conn2.execute(
      `SELECT 
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_ms) as p95,
         PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_ms) as p99,
         AVG(total_ms) as avg,
         MAX(total_ms) as max
       FROM (
         SELECT (UNIX_TIMESTAMP(completed_at) - UNIX_TIMESTAMP(createdAt)) * 1000 as total_ms
         FROM purchase_requests
         WHERE provider_id = ? AND distributor_id = ? 
         AND completed_at IS NOT NULL
         AND idempotency_key LIKE 'final-test-%'
       ) t`,
      [providerId, distributorId]
    );

    const totalMetricsData = (totalMetrics)[0] || {};

    console.log(`\nQueue Wait Time (ms):`);
    console.log(`  P95:  ${Math.floor(waitMetricsData.p95 || 0)}`);
    console.log(`  P99:  ${Math.floor(waitMetricsData.p99 || 0)}`);
    console.log(`  Avg:  ${Math.floor(waitMetricsData.avg || 0)}`);
    console.log(`  Max:  ${Math.floor(waitMetricsData.max || 0)}`);

    console.log(`\nProcessing Duration (ms):`);
    console.log(`  P95:  ${Math.floor(procMetricsData.p95 || 0)}`);
    console.log(`  P99:  ${Math.floor(procMetricsData.p99 || 0)}`);
    console.log(`  Avg:  ${Math.floor(procMetricsData.avg || 0)}`);
    console.log(`  Max:  ${Math.floor(procMetricsData.max || 0)}`);

    console.log(`\nTotal Latency (ms):`);
    console.log(`  P95:  ${Math.floor(totalMetricsData.p95 || 0)}`);
    console.log(`  P99:  ${Math.floor(totalMetricsData.p99 || 0)}`);
    console.log(`  Avg:  ${Math.floor(totalMetricsData.avg || 0)}`);
    console.log(`  Max:  ${Math.floor(totalMetricsData.max || 0)}`);

    // Get ledger entries
    const [ledgerRows] = await conn2.execute(
      `SELECT COUNT(*) as count FROM provider_distributor_ledger 
       WHERE provider_id = ? AND distributor_id = ? AND reference_type IN ('purchase_debit', 'commission_credit')
       AND reference_id IN (
         SELECT id FROM purchase_requests 
         WHERE idempotency_key LIKE 'final-test-%'
       )`,
      [providerId, distributorId]
    );

    const ledgerCount = ledgerRows[0].count;

    // Get unique cards allocated
    const [cardRows] = await conn2.execute(
      `SELECT COUNT(DISTINCT card_id) as count FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND status = 'SUCCEEDED' 
       AND idempotency_key LIKE 'final-test-%'`,
      [providerId, distributorId]
    );

    const cardsAllocated = cardRows[0].count;

    // Verify ledger correctness
    const expectedLedgerCount = succeeded * 2;
    const ledgerCorrect = ledgerCount === expectedLedgerCount;

    console.log(`\nLedger Verification:`);
    console.log(`  Successful purchases: ${succeeded}`);
    console.log(`  Ledger entries: ${ledgerCount} (expected: ${expectedLedgerCount})`);
    console.log(`  Ledger correct: ${ledgerCorrect ? '✓' : '✗'}`);
    console.log(`  Cards allocated: ${cardsAllocated}`);

    const totalProcessed = succeeded + failed;
    const successRate = totalProcessed > 0 ? ((succeeded / totalProcessed) * 100).toFixed(1) : 0;
    console.log(`  Success rate: ${successRate}%`);

    return {
      concurrency: concurrencyLevel,
      succeeded,
      failed,
      pending,
      processing,
      successRate,
      queueWaitP95: Math.floor(waitMetricsData.p95 || 0),
      queueWaitP99: Math.floor(waitMetricsData.p99 || 0),
      processingDurationP95: Math.floor(procMetricsData.p95 || 0),
      processingDurationP99: Math.floor(procMetricsData.p99 || 0),
      totalLatencyP95: Math.floor(totalMetricsData.p95 || 0),
      totalLatencyP99: Math.floor(totalMetricsData.p99 || 0),
      ledgerCount,
      cardsAllocated,
      ledgerCorrect,
      totalTime: enqueueTime,
    };
  } finally {
    conn2.release();
  }
}

async function main() {
  try {
    await initDb();

    console.log('\n' + '='.repeat(70));
    console.log('FINAL HARDENING VALIDATION SUITE');
    console.log('='.repeat(70));

    const results = [];
    for (const level of [100, 300, 1000]) {
      const result = await runFinalValidation(level);
      if (result) results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(70));

    console.log('\nConcurrency     Success         P95 Wait        P95 Proc        Ledger');
    console.log('-'.repeat(70));

    for (const result of results) {
      const ledgerStatus = result.ledgerCorrect ? '✓' : '✗';
      const concStr = String(result.concurrency).padEnd(15);
      const successStr = `${result.successRate}% (${result.succeeded}/${result.concurrency})`.padEnd(16);
      const waitStr = `${result.queueWaitP95}ms`.padEnd(16);
      const procStr = `${result.processingDurationP95}ms`.padEnd(16);
      console.log(`${concStr} ${successStr} ${waitStr} ${procStr} ${ledgerStatus}`);
    }

    const allPassed = results.every((r) => r.ledgerCorrect && r.successRate === '100');
    console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '⚠️  REVIEW RESULTS'}`);

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Validation error:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main();
