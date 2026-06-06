/**
 * Final Comprehensive Load Test - 100/300/1000 Concurrent with Full Results
 */

import mysql from 'mysql2/promise';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { performance } from 'perf_hooks';

const dbUrl = process.env.DATABASE_URL;
const DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'https://3000-it7b15ez9qjomfc5q6qbl-a4783f98.us1.manus.computer';

const client = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${DEV_SERVER_URL}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

async function setupCards(concurrency) {
  const url = new URL(dbUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`Setting up ${concurrency} cards for test...`);
    
    // Clear existing cards for this test
    await connection.execute(
      `DELETE FROM prepaid_cards WHERE provider_id = 1 AND product_id = 1`
    );

    // Insert cards
    for (let i = 0; i < concurrency; i++) {
      await connection.execute(
        `INSERT INTO prepaid_cards (provider_id, product_id, card_number, pin, status, balance, createdAt, updatedAt)
         VALUES (1, 1, ?, ?, 'AVAILABLE', 100.00, NOW(), NOW())`,
        [`CARD-${Date.now()}-${i}`, `PIN-${i}`]
      );
    }

    console.log(`✓ Created ${concurrency} cards\n`);
  } finally {
    await connection.end();
  }
}

async function runBurstTest(concurrency) {
  console.log(`${'='.repeat(80)}`);
  console.log(`LOAD TEST: ${concurrency} concurrent purchases`);
  console.log('='.repeat(80));

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;
  const testStartTime = performance.now();

  // Setup cards
  await setupCards(concurrency);

  // Phase 1: Enqueue
  console.log(`[PHASE 1] Enqueueing ${concurrency} requests...`);
  const enqueueStartTime = performance.now();
  const promises = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        try {
          const result = await client.purchases.enqueue.mutate({
            providerId,
            distributorId,
            productId,
            idempotencyKey: `test-${Date.now()}-${i}`,
          });

          return { success: true, status: result.status };
        } catch (error) {
          return { success: false, error: error.message };
        }
      })()
    );
  }

  const enqueueResults = await Promise.all(promises);
  const enqueueTime = performance.now() - enqueueStartTime;
  const accepted = enqueueResults.filter(r => r.success && r.status === 'PENDING').length;

  console.log(`✓ Enqueued in ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Accepted: ${accepted}/${concurrency}`);

  if (accepted === 0) {
    console.log('✗ No requests accepted');
    return { concurrency, accepted: 0, succeeded: 0, failed: 0, totalTime: performance.now() - testStartTime };
  }

  // Phase 2: Wait for processing
  console.log(`\n[PHASE 2] Waiting for queue processing...`);
  const processingStartTime = performance.now();
  let lastSuccessCount = 0;
  let maxWait = 600000; // 10 minutes

  while (performance.now() - processingStartTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const metrics = await client.purchases.metrics.query({ providerId, distributorId });
      const successCount = metrics.successCount || 0;

      if (successCount > lastSuccessCount) {
        const elapsed = ((performance.now() - processingStartTime) / 1000).toFixed(1);
        const rate = ((successCount - lastSuccessCount) / 3).toFixed(1);
        console.log(`  [${elapsed}s] Succeeded: ${successCount}/${accepted} (${rate} req/s)`);
        lastSuccessCount = successCount;
      }

      if (successCount >= accepted) {
        console.log(`✓ All requests processed`);
        break;
      }
    } catch (error) {
      // Ignore errors
    }
  }

  const processingTime = performance.now() - processingStartTime;

  // Phase 3: Get final metrics
  console.log(`\n[PHASE 3] Final Results...`);
  const metrics = await client.purchases.metrics.query({ providerId, distributorId });

  console.log(`  Succeeded: ${metrics.successCount}`);
  console.log(`  Failed: ${metrics.failedCount}`);
  console.log(`  Queue Depth: ${metrics.queueDepth}`);
  console.log(`  Avg Processing: ${metrics.avgProcessingDuration?.toFixed(2) || 'N/A'}ms`);
  console.log(`  P95 Processing: ${metrics.p95ProcessingDuration?.toFixed(2) || 'N/A'}ms`);
  console.log(`  Ledger Entries: ${metrics.ledgerEntryCount}`);

  const totalTime = performance.now() - testStartTime;
  console.log(`\n  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${((metrics.successCount || 0) / (processingTime / 1000)).toFixed(2)} req/s`);

  return {
    concurrency,
    accepted,
    succeeded: metrics.successCount || 0,
    failed: metrics.failedCount || 0,
    totalTime,
    enqueueTime,
    processingTime,
    avgProcessing: metrics.avgProcessingDuration,
    p95Processing: metrics.p95ProcessingDuration,
    ledgerEntries: metrics.ledgerEntryCount,
  };
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('FINAL COMPREHENSIVE LOAD TEST - 100/300/1000 CONCURRENT');
  console.log('='.repeat(80) + '\n');

  const results = [];

  for (const concurrency of [100, 300, 1000]) {
    try {
      const result = await runBurstTest(concurrency);
      results.push(result);
      console.log();
    } catch (error) {
      console.error(`✗ Test failed: ${error.message}\n`);
    }
  }

  // Summary
  console.log('='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log('\nConcurrency | Accepted | Succeeded | Failed | Throughput | Total Time');
  console.log('-'.repeat(80));

  for (const result of results) {
    const throughput = result.processingTime > 0 ? (result.succeeded / (result.processingTime / 1000)).toFixed(2) : 'N/A';
    console.log(
      `${result.concurrency.toString().padEnd(11)} | ${result.accepted.toString().padEnd(8)} | ${result.succeeded.toString().padEnd(9)} | ${result.failed.toString().padEnd(6)} | ${throughput.toString().padEnd(10)} | ${(result.totalTime / 1000).toFixed(2)}s`
    );
  }

  console.log('\n✅ Load test complete');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
