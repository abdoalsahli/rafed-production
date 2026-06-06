/**
 * Comprehensive Load Test - 300/1000 Concurrent Purchases
 * Measures queue processing, latency, and ledger correctness
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { performance } from 'perf_hooks';

const DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'https://3000-it7b15ez9qjomfc5q6qbl-a4783f98.us1.manus.computer';

const client = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${DEV_SERVER_URL}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

/**
 * Run comprehensive burst test
 */
async function runBurstTest(concurrency) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`LOAD TEST: ${concurrency} concurrent purchases`);
  console.log('='.repeat(80));

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;
  const testStartTime = performance.now();

  // Phase 1: Enqueue all requests
  console.log(`\n[PHASE 1] Enqueueing ${concurrency} requests...`);
  const enqueueStartTime = performance.now();
  const promises = [];
  const requestIds = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        try {
          const idempotencyKey = `load-test-${Date.now()}-${i}`;
          const result = await client.purchases.enqueue.mutate({
            providerId,
            distributorId,
            productId,
            idempotencyKey,
          });

          return {
            success: true,
            requestId: result.requestId,
            status: result.status,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      })()
    );
  }

  const enqueueResults = await Promise.all(promises);
  const enqueueTime = performance.now() - enqueueStartTime;

  const accepted = enqueueResults.filter(r => r.success && r.status === 'PENDING').length;
  const failed = enqueueResults.filter(r => !r.success).length;

  for (const result of enqueueResults) {
    if (result.success && result.requestId) {
      requestIds.push(result.requestId);
    }
  }

  console.log(`✓ Enqueued in ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Accepted: ${accepted}/${concurrency}`);
  console.log(`  Failed: ${failed}/${concurrency}`);

  if (accepted === 0) {
    console.log('✗ No requests accepted, aborting');
    return {
      concurrency,
      accepted: 0,
      processed: 0,
      totalTime: performance.now() - testStartTime,
      enqueueTime,
    };
  }

  // Phase 2: Wait for queue processing
  console.log(`\n[PHASE 2] Waiting for queue processing (max 5 minutes)...`);
  const processingStartTime = performance.now();
  let processed = 0;
  let lastProcessed = 0;
  let maxWait = 300000; // 5 minutes
  let pollCount = 0;

  while (processed < accepted && performance.now() - processingStartTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    pollCount++;

    try {
      const metrics = await client.purchases.metrics.query({
        providerId,
        distributorId,
      });

      processed = metrics.successCount || 0;
      const rate = ((processed - lastProcessed) / 2).toFixed(1); // requests per second

      if (pollCount % 10 === 1 || processed > lastProcessed) {
        const elapsed = ((performance.now() - processingStartTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] Processed: ${processed}/${accepted} (${rate} req/s)`);
        lastProcessed = processed;
      }
    } catch (error) {
      // Metrics not available yet
    }
  }

  const processingTime = performance.now() - processingStartTime;

  // Phase 3: Verify results
  console.log(`\n[PHASE 3] Verifying results...`);

  try {
    const finalMetrics = await client.purchases.metrics.query({
      providerId,
      distributorId,
    });

    console.log(`✓ Final Metrics:`);
    console.log(`  Queue Depth: ${finalMetrics.queueDepth}`);
    console.log(`  Success Count: ${finalMetrics.successCount}`);
    console.log(`  Failed Count: ${finalMetrics.failedCount}`);
    console.log(`  Ledger Entries: ${finalMetrics.ledgerEntryCount}`);
    console.log(`  Avg Processing Duration: ${finalMetrics.avgProcessingDuration?.toFixed(2) || 'N/A'}ms`);
    console.log(`  P95 Processing Duration: ${finalMetrics.p95ProcessingDuration?.toFixed(2) || 'N/A'}ms`);
    console.log(`  P99 Processing Duration: ${finalMetrics.p99ProcessingDuration?.toFixed(2) || 'N/A'}ms`);

    // Verify ledger correctness
    const expectedLedgerEntries = finalMetrics.successCount * 2; // 2 entries per purchase
    const ledgerCorrect = finalMetrics.ledgerEntryCount === expectedLedgerEntries;
    console.log(`\n  Ledger Verification:`);
    console.log(`    Expected Entries: ${expectedLedgerEntries}`);
    console.log(`    Actual Entries: ${finalMetrics.ledgerEntryCount}`);
    console.log(`    Status: ${ledgerCorrect ? '✓ CORRECT' : '✗ MISMATCH'}`);
  } catch (error) {
    console.log(`✗ Could not retrieve final metrics: ${error.message}`);
  }

  const totalTime = performance.now() - testStartTime;

  // Summary
  console.log(`\n[SUMMARY]`);
  console.log(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  Enqueue Time: ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Processing Time: ${(processingTime / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${(accepted / (processingTime / 1000)).toFixed(2)} req/s`);

  return {
    concurrency,
    accepted,
    processed,
    totalTime,
    enqueueTime,
    processingTime,
  };
}

/**
 * Main
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('COMPREHENSIVE LOAD TEST - 300/1000 CONCURRENT PURCHASES');
  console.log('='.repeat(80));

  const results = [];

  // Run tests
  for (const concurrency of [300, 1000]) {
    try {
      const result = await runBurstTest(concurrency);
      results.push(result);
    } catch (error) {
      console.error(`✗ Test failed: ${error.message}`);
      results.push({
        concurrency,
        accepted: 0,
        processed: 0,
        totalTime: 0,
        enqueueTime: 0,
        processingTime: 0,
      });
    }
  }

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log('\nConcurrency | Accepted | Processed | Enqueue (ms) | Processing (s) | Throughput');
  console.log('-'.repeat(80));

  for (const result of results) {
    const throughput = result.processingTime > 0 ? (result.processed / (result.processingTime / 1000)).toFixed(2) : 'N/A';
    console.log(
      `${result.concurrency.toString().padEnd(11)} | ${result.accepted.toString().padEnd(8)} | ${result.processed.toString().padEnd(9)} | ${result.enqueueTime.toFixed(2).padEnd(12)} | ${(result.processingTime / 1000).toFixed(2).padEnd(14)} | ${throughput} req/s`
    );
  }

  console.log('\n✅ Load test complete');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
