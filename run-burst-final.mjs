#!/usr/bin/env node

/**
 * Final Burst Load Test for Per-Account Queue
 * Tests: 100, 300, 1000 concurrent requests on same account
 */

import mysql from 'mysql2/promise';
import { performance } from 'perf_hooks';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'prepaid_card_db',
  waitForConnections: true,
  connectionLimit: 50,
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

async function runBurstTest(concurrencyLevel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BURST TEST: ${concurrencyLevel} concurrent requests`);
  console.log(`${'='.repeat(60)}`);

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;

  // Ensure test data exists
  const conn = await pool.getConnection();
  try {
    // Check if test product exists
    const [products] = await conn.execute(
      'SELECT id FROM products WHERE id = ? LIMIT 1',
      [productId]
    );

    if (products.length === 0) {
      console.log('⚠ Test product not found, skipping test');
      return;
    }

    // Clear old test requests
    await conn.execute(
      `DELETE FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND idempotency_key LIKE 'burst-test-%'`,
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
          const idempotencyKey = `burst-test-${Date.now()}-${i}`;
          const [result] = await conn.execute(
            `INSERT INTO purchase_requests 
             (provider_id, distributor_id, product_id, idempotency_key, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
            [providerId, distributorId, productId, idempotencyKey]
          );

          requests.push({
            id: (result).insertId,
            idempotencyKey,
            startTime: performance.now(),
          });

          return (result).insertId;
        } finally {
          conn.release();
        }
      })()
    );
  }

  await Promise.all(promises);
  const enqueueTime = performance.now() - startTime;
  console.log(`✓ Enqueued ${concurrencyLevel} requests in ${enqueueTime.toFixed(2)}ms`);

  // Wait for processing
  console.log('Waiting for processing...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Check results
  const conn2 = await pool.getConnection();
  try {
    const [statuses] = await conn2.execute(
      `SELECT status, COUNT(*) as count FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND idempotency_key LIKE 'burst-test-%'
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

    console.log(`\nResults:`);
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
         WHERE idempotency_key LIKE 'burst-test-%'
       )`,
      [providerId, distributorId]
    );

    const ledgerCount = ledgerRows[0].count;
    console.log(`  Ledger entries: ${ledgerCount}`);

    // Get unique cards allocated
    const [cardRows] = await conn2.execute(
      `SELECT COUNT(DISTINCT card_id) as count FROM purchase_requests 
       WHERE provider_id = ? AND distributor_id = ? AND status = 'SUCCEEDED' 
       AND idempotency_key LIKE 'burst-test-%'`,
      [providerId, distributorId]
    );

    const cardsAllocated = cardRows[0].count;
    console.log(`  Cards allocated: ${cardsAllocated}`);

    // Calculate metrics
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
      successRate,
      totalTime: enqueueTime,
    };
  } finally {
    conn2.release();
  }
}

async function main() {
  try {
    await initDb();

    const results = [];

    // Run tests
    for (const level of [100, 300, 1000]) {
      const result = await runBurstTest(level);
      if (result) results.push(result);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);

    for (const result of results) {
      console.log(`\n${result.concurrency}-way burst:`);
      console.log(`  Success: ${result.succeeded}/${result.concurrency} (${result.successRate}%)`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Cards allocated: ${result.cardsAllocated}`);
      console.log(`  Ledger entries: ${result.ledgerCount}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main();
