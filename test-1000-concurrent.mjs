/**
 * 1000 Concurrent Purchases Test
 * Uses existing card inventory
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

async function test1000Concurrent() {
  console.log('\n' + '='.repeat(80));
  console.log('1000 CONCURRENT PURCHASES TEST');
  console.log('='.repeat(80) + '\n');

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;
  const concurrency = 1000;
  const testStartTime = performance.now();

  // Phase 1: Enqueue all 1000 requests
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
            idempotencyKey: `1k-test-${Date.now()}-${i}`,
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
  const failed = enqueueResults.filter(r => !r.success).length;

  console.log(`✓ Enqueued in ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Accepted: ${accepted}/${concurrency}`);
  console.log(`  Failed: ${failed}/${concurrency}`);

  if (accepted === 0) {
    console.log('✗ No requests accepted');
    return;
  }

  // Phase 2: Monitor processing
  console.log(`\n[PHASE 2] Monitoring queue processing (max 20 minutes)...`);
  const processingStartTime = performance.now();
  let lastSuccessCount = 0;
  let lastFailureCount = 0;
  let maxWait = 1200000; // 20 minutes
  let pollCount = 0;

  while (performance.now() - processingStartTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    pollCount++;

    try {
      const metrics = await client.purchases.metrics.query({ providerId, distributorId });
      const successCount = metrics.successCount || 0;
      const failureCount = metrics.failedCount || 0;
      const queueDepth = metrics.queueDepth || 0;

      const newSuccess = successCount - lastSuccessCount;
      const newFailure = failureCount - lastFailureCount;
      const totalProcessed = successCount + failureCount;

      if (newSuccess > 0 || newFailure > 0 || pollCount % 12 === 1) {
        const elapsed = ((performance.now() - processingStartTime) / 1000).toFixed(1);
        const successRate = ((newSuccess + newFailure) / 5).toFixed(1);
        console.log(
          `  [${elapsed}s] Processed: ${totalProcessed}/${accepted} | Success: ${successCount} | Failed: ${failureCount} | Queue: ${queueDepth} | Rate: ${successRate} req/s`
        );
        lastSuccessCount = successCount;
        lastFailureCount = failureCount;
      }

      if (queueDepth === 0 && totalProcessed >= accepted) {
        console.log(`✓ All requests processed`);
        break;
      }
    } catch (error) {
      // Ignore errors
    }
  }

  const processingTime = performance.now() - processingStartTime;

  // Phase 3: Final results
  console.log(`\n[PHASE 3] Final Results...`);
  const finalMetrics = await client.purchases.metrics.query({ providerId, distributorId });

  console.log(`  Total Succeeded: ${finalMetrics.successCount}`);
  console.log(`  Total Failed: ${finalMetrics.failedCount}`);
  console.log(`  Queue Depth: ${finalMetrics.queueDepth}`);
  console.log(`  Avg Processing Duration: ${finalMetrics.avgProcessingDuration?.toFixed(2) || 'N/A'}ms`);
  console.log(`  P95 Processing Duration: ${finalMetrics.p95ProcessingDuration?.toFixed(2) || 'N/A'}ms`);
  console.log(`  Ledger Entries: ${finalMetrics.ledgerEntryCount}`);
  console.log(`  Ledger Correct: ${finalMetrics.ledger?.isCorrect ? '✓ YES' : '✗ NO'}`);

  const totalTime = performance.now() - testStartTime;

  console.log(`\n[SUMMARY]`);
  console.log(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  Enqueue Time: ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Processing Time: ${(processingTime / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${((finalMetrics.successCount || 0) / (processingTime / 1000)).toFixed(2)} req/s`);
  console.log(`  Success Rate: ${(((finalMetrics.successCount || 0) / accepted) * 100).toFixed(1)}%`);

  console.log('\n✅ 1000 concurrent test complete');
}

test1000Concurrent().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
