#!/usr/bin/env node

/**
 * Integration Test Suite - Real tRPC Endpoints
 * Tests purchase queue through the running dev server
 */

import { performance } from 'perf_hooks';

// Use native fetch (available in Node 18+)

// Dev server URL (use http for local, https for remote)
const DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'http://localhost:3000';
const TRPC_URL = `${DEV_SERVER_URL}/api/trpc`;

console.log(`Using dev server: ${DEV_SERVER_URL}`);

/**
 * Call tRPC procedure
 */
async function callTrpc(procedure, input) {
  const url = `${TRPC_URL}/${procedure}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`tRPC error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // tRPC returns { result: { data: ... } } or { error: ... }
  if (data.error) {
    throw new Error(`tRPC error: ${JSON.stringify(data.error)}`);
  }

  return data.result?.data || data.result || data;
}

/**
 * Enqueue purchase request
 */
async function enqueuePurchase(providerId, distributorId, productId, idempotencyKey) {
  return callTrpc('purchases.enqueue', {
    providerId,
    distributorId,
    productId,
    idempotencyKey,
  });
}

/**
 * Get request status
 */
async function getRequestStatus(requestId) {
  return callTrpc('purchases.status', { requestId });
}

/**
 * Get queue metrics
 */
async function getMetrics(providerId, distributorId) {
  return callTrpc('purchases.metrics', { providerId, distributorId });
}

/**
 * Run burst test
 */
async function runBurstTest(concurrencyLevel) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`INTEGRATION TEST: ${concurrencyLevel} concurrent purchases`);
  console.log(`${'='.repeat(70)}`);

  const providerId = 1;
  const distributorId = 1;
  const productId = 1;

  const requests = [];
  const startTime = performance.now();

  // Enqueue requests in parallel
  console.log(`Enqueueing ${concurrencyLevel} requests...`);
  const promises = [];
  for (let i = 0; i < concurrencyLevel; i++) {
    promises.push(
      (async () => {
        try {
          const idempotencyKey = `integration-test-${Date.now()}-${i}`;
          const result = await enqueuePurchase(
            providerId,
            distributorId,
            productId,
            idempotencyKey
          );

          return {
            success: true,
            requestId: result?.requestId || 0,
            status: result?.status || 'UNKNOWN',
            error: result?.error || null,
          };
        } catch (error) {
          console.error(`Enqueue error for ${i}:`, error.message);
          return {
            success: false,
            error: error.message,
          };
        }
      })()
    );
  }

  const enqueueResults = await Promise.all(promises);
  const enqueueTime = performance.now() - startTime;

  const accepted = enqueueResults.filter((r) => r.success && !r.error).length;
  const rejected = enqueueResults.filter((r) => r.success && r.error).length;
  const failed = enqueueResults.filter((r) => !r.success).length;

  console.log(`✓ Enqueued in ${enqueueTime.toFixed(2)}ms`);
  console.log(`  Accepted: ${accepted}`);
  console.log(`  Rejected (capacity): ${rejected}`);
  console.log(`  Failed (errors): ${failed}`);

  // Get request IDs for accepted requests
  const requestIds = enqueueResults
    .filter((r) => r.success && r.requestId)
    .map((r) => r.requestId);

  if (requestIds.length === 0) {
    console.log('No requests accepted, skipping wait');
    return {
      concurrency: concurrencyLevel,
      accepted: 0,
      rejected,
      failed,
      succeeded: 0,
      failedRequests: 0,
      totalTime: enqueueTime,
    };
  }

  // Wait for processing
  console.log(`Waiting for ${requestIds.length} requests to complete...`);
  const maxWaitTime = 60000; // 60 seconds max
  const pollInterval = 1000; // 1 second
  const startWait = performance.now();

  let completed = 0;
  let succeeded = 0;
  let failedRequests = 0;

  while (performance.now() - startWait < maxWaitTime) {
    const statuses = await Promise.all(requestIds.map((id) => getRequestStatus(id)));

    succeeded = statuses.filter((s) => s.status === 'SUCCEEDED').length;
    failedRequests = statuses.filter((s) => s.status === 'FAILED').length;
    completed = succeeded + failedRequests;

    if (completed === requestIds.length) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  const totalTime = performance.now() - startTime;

  console.log(`Completed in ${totalTime.toFixed(2)}ms`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failedRequests}`);
  console.log(`  Pending: ${requestIds.length - completed}`);

  // Get metrics
  console.log('Fetching metrics...');
  const metrics = await getMetrics(providerId, distributorId);

  console.log(`\nQueue Metrics:`);
  console.log(`  Queue depth: ${metrics.queueDepth}`);
  console.log(`  Processing count: ${metrics.processingCount}`);
  console.log(`  Success count: ${metrics.successCount}`);
  console.log(`  Failure count: ${metrics.failureCount}`);

  console.log(`\nLatency (ms):`);
  console.log(`  Queue wait P95: ${metrics.queueWaitP95}`);
  console.log(`  Queue wait P99: ${metrics.queueWaitP99}`);
  console.log(`  Processing P95: ${metrics.processingDurationP95}`);
  console.log(`  Processing P99: ${metrics.processingDurationP99}`);
  console.log(`  Total latency P95: ${metrics.totalLatencyP95}`);
  console.log(`  Total latency P99: ${metrics.totalLatencyP99}`);

  console.log(`\nAlerts:`);
  console.log(`  Queue depth warning: ${metrics.alerts.queueDepthWarning ? '🔴' : '✓'}`);
  console.log(`  Queue depth critical: ${metrics.alerts.queueDepthCritical ? '🔴' : '✓'}`);
  console.log(`  Processing time warning: ${metrics.alerts.processingTimeWarning ? '🔴' : '✓'}`);
  console.log(`  Processing time critical: ${metrics.alerts.processingTimeCritical ? '🔴' : '✓'}`);
  console.log(`  Ledger mismatch: ${metrics.alerts.ledgerMismatch ? '🔴 CRITICAL' : '✓'}`);

  console.log(`\nLedger Verification:`);
  console.log(`  Successful purchases: ${metrics.ledger.successfulPurchases}`);
  console.log(`  Debit entries: ${metrics.ledger.debitEntries}`);
  console.log(`  Credit entries: ${metrics.ledger.creditEntries}`);
  console.log(`  Ledger correct: ${metrics.ledger.isCorrect ? '✓' : '✗ MISMATCH'}`);

  return {
    concurrency: concurrencyLevel,
    accepted,
    rejected,
    failed,
    succeeded,
    failedRequests,
    queueWaitP95: metrics.queueWaitP95,
    queueWaitP99: metrics.queueWaitP99,
    processingDurationP95: metrics.processingDurationP95,
    processingDurationP99: metrics.processingDurationP99,
    totalLatencyP95: metrics.totalLatencyP95,
    totalLatencyP99: metrics.totalLatencyP99,
    totalTime,
    ledgerCorrect: metrics.ledger.isCorrect,
    alertsTriggered: {
      queueDepthWarning: metrics.alerts.queueDepthWarning,
      queueDepthCritical: metrics.alerts.queueDepthCritical,
      processingTimeWarning: metrics.alerts.processingTimeWarning,
      processingTimeCritical: metrics.alerts.processingTimeCritical,
      ledgerMismatch: metrics.alerts.ledgerMismatch,
    },
  };
}

/**
 * Main
 */
async function main() {
  try {
    // Wait for dev server to be ready
    console.log('Waiting for dev server to be ready...');
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        await fetch(`${DEV_SERVER_URL}/`);
        ready = true;
        break;
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!ready) {
      throw new Error('Dev server not ready after 30 seconds');
    }

    console.log('✓ Dev server ready');

    console.log('\n' + '='.repeat(70));
    console.log('INTEGRATION TEST SUITE - tRPC ENDPOINTS');
    console.log('='.repeat(70));

    const results = [];
    for (const level of [100, 300, 1000]) {
      try {
        const result = await runBurstTest(level);
        results.push(result);
      } catch (error) {
        console.error(`Test failed for ${level}-way: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(70));

    console.log('\nTest Results:');
    console.log('Concurrency     Accepted        Succeeded       P95 Wait        P95 Proc        Ledger');
    console.log('-'.repeat(70));

    for (const result of results) {
      const ledgerStatus = result.ledgerCorrect ? '✓' : '✗';
      const concStr = String(result.concurrency).padEnd(15);
      const acceptedStr = String(result.accepted).padEnd(12);
      const succeededStr = String(result.succeeded).padEnd(12);
      const waitStr = `${result.queueWaitP95}ms`.padEnd(12);
      const procStr = `${result.processingDurationP95}ms`.padEnd(12);
      console.log(`${concStr} ${acceptedStr} ${succeededStr} ${waitStr} ${procStr} ${ledgerStatus}`);
    }

    const allPassed = results.every((r) => r.ledgerCorrect);
    console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '⚠️  REVIEW RESULTS'}`);

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

main();
