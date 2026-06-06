/**
 * Final Integration Test - Using tRPC Client
 * Tests per-account queue with 100/300/1000 concurrent purchases
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { performance } from 'perf_hooks';

const DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'https://3000-it7b15ez9qjomfc5q6qbl-a4783f98.us1.manus.computer';

console.log(`Using dev server: ${DEV_SERVER_URL}`);

const client = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${DEV_SERVER_URL}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

/**
 * Run burst test with tRPC client
 */
async function runBurstTest(concurrency) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`BURST TEST: ${concurrency} concurrent purchases`);
  console.log('='.repeat(70));

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;

  const startTime = performance.now();
  const promises = [];
  const results = [];

  // Enqueue all requests concurrently
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        try {
          const idempotencyKey = `burst-${Date.now()}-${i}`;
          const reqStart = performance.now();

          const result = await client.purchases.enqueue.mutate({
            providerId,
            distributorId,
            productId,
            idempotencyKey,
          });

          const reqDuration = performance.now() - reqStart;

          return {
            success: true,
            requestId: result.requestId,
            status: result.status,
            duration: reqDuration,
            error: result.error || null,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            duration: 0,
          };
        }
      })()
    );
  }

  const responses = await Promise.all(promises);
  const enqueueTime = performance.now() - startTime;

  // Analyze results
  const accepted = responses.filter(r => r.success && r.status === 'PENDING').length;
  const rejected = responses.filter(r => r.success && r.error).length;
  const failed = responses.filter(r => !r.success).length;
  const durations = responses.filter(r => r.duration > 0).map(r => r.duration);

  console.log(`\n✓ Enqueued ${concurrency} requests in ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Accepted (PENDING): ${accepted}`);
  console.log(`  Rejected (capacity): ${rejected}`);
  console.log(`  Failed (errors): ${failed}`);

  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const p50Idx = Math.floor(durations.length * 0.50);
    const p95Idx = Math.floor(durations.length * 0.95);
    const p99Idx = Math.floor(durations.length * 0.99);

    console.log(`\n  Enqueue Duration Stats (ms):`);
    console.log(`    Min:  ${durations[0].toFixed(2)}`);
    console.log(`    P50:  ${durations[p50Idx].toFixed(2)}`);
    console.log(`    P95:  ${durations[p95Idx].toFixed(2)}`);
    console.log(`    P99:  ${durations[p99Idx].toFixed(2)}`);
    console.log(`    Max:  ${durations[durations.length - 1].toFixed(2)}`);
  }

  // Wait for processing
  if (accepted > 0) {
    console.log(`\n  Waiting for queue processing...`);
    let processed = 0;
    let maxWait = 120000; // 120 seconds max
    const pollStart = performance.now();
    let pollCount = 0;

    while (processed < accepted && performance.now() - pollStart < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      pollCount++;

      try {
        const metrics = await client.purchases.metrics.query({
          providerId,
          distributorId,
        });

        processed = metrics.successCount || 0;
        if (pollCount % 5 === 1) {
          console.log(`    [${(performance.now() - pollStart).toFixed(0)}ms] Processed: ${processed}/${accepted}`);
        }
      } catch (error) {
        // Metrics not available yet
      }
    }

    const totalTime = performance.now() - startTime;
    console.log(`\n  ✓ Total time: ${totalTime.toFixed(2)}ms`);

    // Get final metrics
    try {
      const finalMetrics = await client.purchases.metrics.query({
        providerId,
        distributorId,
      });

      console.log(`\n  Final Metrics:`);
      console.log(`    Queue Depth: ${finalMetrics.queueDepth}`);
      console.log(`    Success Count: ${finalMetrics.successCount}`);
      console.log(`    Failed Count: ${finalMetrics.failedCount}`);
      console.log(`    Avg Processing Duration: ${finalMetrics.avgProcessingDuration?.toFixed(2) || 'N/A'}ms`);
      console.log(`    Ledger Entries: ${finalMetrics.ledgerEntryCount}`);
    } catch (error) {
      console.log(`  Could not retrieve final metrics: ${error.message}`);
    }
  }

  return {
    concurrency,
    accepted,
    rejected,
    failed,
    enqueueTime,
  };
}

/**
 * Main
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('FINAL INTEGRATION TEST - PER-ACCOUNT QUEUE ARCHITECTURE');
  console.log('='.repeat(70));

  const results = [];

  // Run burst tests
  for (const concurrency of [100, 300, 1000]) {
    try {
      const result = await runBurstTest(concurrency);
      results.push(result);
    } catch (error) {
      console.error(`✗ Test failed: ${error.message}`);
      results.push({
        concurrency,
        accepted: 0,
        rejected: 0,
        failed: concurrency,
        enqueueTime: 0,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log('\nConcurrency | Accepted | Rejected | Failed | Enqueue Time');
  console.log('-'.repeat(70));
  for (const result of results) {
    console.log(
      `${result.concurrency.toString().padEnd(11)} | ${result.accepted.toString().padEnd(8)} | ${result.rejected.toString().padEnd(8)} | ${result.failed.toString().padEnd(6)} | ${result.enqueueTime.toFixed(2)}ms`
    );
  }

  console.log('\n✅ Integration test complete');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
