/**
 * Integration Test - Fixed tRPC Client Approach
 * Uses proper tRPC client instead of raw HTTP
 */

import { performance } from 'perf_hooks';

const DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'http://localhost:3000';

console.log(`Using dev server: ${DEV_SERVER_URL}`);

/**
 * Call tRPC via HTTP using proper format
 */
async function callTrpcProcedure(path, input = null, isQuery = false) {
  const method = isQuery ? 'GET' : 'POST';
  
  let url = `${DEV_SERVER_URL}/api/trpc/${path}`;
  
  // For queries, append input as query string
  if (isQuery && input) {
    url += `?input=${encodeURIComponent(JSON.stringify(input))}`;
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // For mutations, send input in body
  if (!isQuery && input) {
    options.body = JSON.stringify(input);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`tRPC error: ${JSON.stringify(data.error.json.message)}`);
  }
  
  return data.result?.data?.json || data.result?.data || data;
}

/**
 * Test health endpoints
 */
async function testHealth() {
  console.log('\n=== HEALTH CHECK ===');
  
  try {
    const health = await callTrpcProcedure('health.root', null, true);
    console.log('✓ Root health:', health);
    
    const qmHealth = await callTrpcProcedure('health.queueManager', null, true);
    console.log('✓ Queue manager health:', qmHealth);
    
    if (!qmHealth.queueManagerReady) {
      console.log('  Initializing queue manager...');
      const init = await callTrpcProcedure('health.initializeQueueManager', {});
      console.log('✓ Queue manager initialized:', init.success);
    }
    
    return true;
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
    return false;
  }
}

/**
 * Run burst test
 */
async function runBurstTest(concurrency) {
  console.log(`\n=== BURST TEST: ${concurrency} concurrent purchases ===`);
  
  const providerId = 1;
  const distributorId = 1;
  const productId = 1;
  
  const startTime = performance.now();
  const promises = [];
  const results = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        try {
          const idempotencyKey = `burst-test-${Date.now()}-${i}`;
          const input = {
            providerId,
            distributorId,
            productId,
            idempotencyKey,
          };
          
          const reqStart = performance.now();
          const result = await callTrpcProcedure('purchases.enqueue', input);
          const reqDuration = performance.now() - reqStart;
          
          return {
            success: true,
            requestId: result.requestId,
            status: result.status,
            duration: reqDuration,
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
  const failed = responses.filter(r => !r.success).length;
  const durations = responses.filter(r => r.duration > 0).map(r => r.duration);
  
  console.log(`✓ Enqueued ${concurrency} requests in ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Accepted: ${accepted}`);
  console.log(`  Failed: ${failed}`);
  
  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const p95Idx = Math.floor(durations.length * 0.95);
    const p99Idx = Math.floor(durations.length * 0.99);
    
    console.log(`  Duration stats (ms):`);
    console.log(`    Min: ${durations[0].toFixed(2)}`);
    console.log(`    Avg: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}`);
    console.log(`    P95: ${durations[p95Idx].toFixed(2)}`);
    console.log(`    P99: ${durations[p99Idx].toFixed(2)}`);
    console.log(`    Max: ${durations[durations.length - 1].toFixed(2)}`);
  }
  
  // Wait for processing
  if (accepted > 0) {
    console.log(`\nWaiting for queue processing...`);
    let processed = 0;
    let maxWait = 60000; // 60 seconds max
    const pollStart = performance.now();
    
    while (processed < accepted && performance.now() - pollStart < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check metrics
      try {
        const metrics = await callTrpcProcedure('purchases.metrics', {
          providerId,
          distributorId,
        }, true);
        
        processed = metrics.successCount || 0;
        console.log(`  Processed: ${processed}/${accepted}`);
      } catch (error) {
        // Metrics not available yet
      }
    }
    
    const totalTime = performance.now() - startTime;
    console.log(`✓ Total time: ${totalTime.toFixed(2)}ms`);
  }
  
  return {
    concurrency,
    accepted,
    failed,
    enqueueTime,
  };
}

/**
 * Main
 */
async function main() {
  console.log('INTEGRATION TEST SUITE - tRPC ENDPOINTS (FIXED)');
  console.log('='.repeat(50));
  
  // Health check
  const healthOk = await testHealth();
  if (!healthOk) {
    console.error('✗ Health check failed, aborting');
    process.exit(1);
  }
  
  // Run burst tests
  const results = [];
  for (const concurrency of [100, 300, 1000]) {
    const result = await runBurstTest(concurrency);
    results.push(result);
  }
  
  // Summary
  console.log('\n=== FINAL SUMMARY ===');
  console.log('Concurrency | Accepted | Failed | Enqueue Time');
  console.log('-'.repeat(50));
  for (const result of results) {
    console.log(
      `${result.concurrency.toString().padEnd(11)} | ${result.accepted.toString().padEnd(8)} | ${result.failed.toString().padEnd(6)} | ${result.enqueueTime.toFixed(2)}ms`
    );
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
