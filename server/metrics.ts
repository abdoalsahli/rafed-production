/**
 * Prometheus Metrics Collector for Per-Account Queue System
 * Exports queue health, performance, and financial integrity metrics
 */

import * as queueSql from './queue-sql';
import { getQueueConfig } from './queue-config';
import { metricsCache } from './metrics-cache';

// Metric types
export interface QueueMetrics {
  timestamp: number;
  queueDepth: number;
  oldestPendingAgeSeconds: number;
  processingCount: number;
  workerHeartbeatStale: boolean;
  successCount: number;
  failureCount: number;
  recoveryCount: number;
  latencyMetrics: {
    queueWaitP50: number;
    queueWaitP95: number;
    queueWaitP99: number;
    processingDurationP50: number;
    processingDurationP95: number;
    processingDurationP99: number;
    totalLatencyP50: number;
    totalLatencyP95: number;
    totalLatencyP99: number;
  };
  ledgerVerification: {
    isCorrect: boolean;
    successfulPurchases: number;
    debitEntries: number;
    creditEntries: number;
  };
  alerts: {
    warning: number;
    critical: number;
  };
}

/**
 * Collect metrics for all active accounts
 * Note: In production, this should be called periodically (e.g., every 30 seconds)
 * and cached to avoid excessive database queries
 */
export async function collectAllMetrics(): Promise<Map<string, QueueMetrics>> {
  const metricsMap = new Map<string, QueueMetrics>();

  // Get list of all active accounts (provider_id, distributor_id pairs)
  // For now, we'll return an empty map - in production, query active accounts from DB
  // This prevents unbounded cardinality explosion

  return metricsMap;
}

/**
 * Collect metrics for a specific account with caching
 */
export async function collectAccountMetrics(
  providerId: number,
  distributorId: number
): Promise<QueueMetrics> {
  const cacheKey = `metrics:${providerId}:${distributorId}`;
  return metricsCache.get(
    cacheKey,
    () => collectAccountMetricsUncached(providerId, distributorId),
    45000 // 45 second TTL
  );
}

/**
 * Collect metrics for a specific account (uncached)
 */
async function collectAccountMetricsUncached(
  providerId: number,
  distributorId: number
): Promise<QueueMetrics> {
  const [
    queueDepth,
    processingCount,
    oldestPendingAge,
    successCount,
    failureCount,
    latency,
    integrity,
  ] = await Promise.all([
    queueSql.countQueueDepth(providerId, distributorId),
    queueSql.countProcessingRequests(providerId, distributorId),
    queueSql.getOldestPendingAge(providerId, distributorId),
    queueSql.countSucceededRequests(providerId, distributorId),
    queueSql.countFailedRequests(providerId, distributorId),
    queueSql.getQueueLatencyMetrics(providerId, distributorId),
    queueSql.verifyLedgerCorrectness(providerId, distributorId),
  ]);

  const heartbeat = queueSql.getWorkerHeartbeat(providerId, distributorId);
  const isStale = queueSql.isHeartbeatStale(providerId, distributorId);

  return {
    timestamp: Date.now(),
    queueDepth: queueDepth || 0,
    oldestPendingAgeSeconds: oldestPendingAge || 0,
    processingCount: processingCount || 0,
    workerHeartbeatStale: isStale,
    successCount: successCount || 0,
    failureCount: failureCount || 0,
    recoveryCount: 0, // TODO: Track recovery count
    latencyMetrics: {
      queueWaitP50: latency?.queueWaitP50 || 0,
      queueWaitP95: latency?.queueWaitP95 || 0,
      queueWaitP99: latency?.queueWaitP99 || 0,
      processingDurationP50: latency?.processingDurationP50 || 0,
      processingDurationP95: latency?.processingDurationP95 || 0,
      processingDurationP99: latency?.processingDurationP99 || 0,
      totalLatencyP50: (latency?.queueWaitP50 || 0) + (latency?.processingDurationP50 || 0),
      totalLatencyP95: (latency?.queueWaitP95 || 0) + (latency?.processingDurationP95 || 0),
      totalLatencyP99: (latency?.queueWaitP99 || 0) + (latency?.processingDurationP99 || 0),
    },
    ledgerVerification: {
      isCorrect: integrity?.isCorrect || false,
      successfulPurchases: integrity?.successfulPurchases || 0,
      debitEntries: integrity?.debitEntries || 0,
      creditEntries: integrity?.creditEntries || 0,
    },
    alerts: {
      warning: 0,
      critical: 0,
    },
  };
}

/**
 * Format metrics in Prometheus text format
 */
export function formatPrometheusMetrics(metrics: QueueMetrics, providerId: number, distributorId: number): string {
  const labels = `provider_id="${providerId}",distributor_id="${distributorId}"`;
  const lines: string[] = [];

  // Queue health metrics
  lines.push(`# HELP queue_depth Current depth of the queue for account`);
  lines.push(`# TYPE queue_depth gauge`);
  lines.push(`queue_depth{${labels}} ${metrics.queueDepth}`);

  lines.push(`# HELP queue_oldest_pending_age_seconds Age of oldest pending request in seconds`);
  lines.push(`# TYPE queue_oldest_pending_age_seconds gauge`);
  lines.push(`queue_oldest_pending_age_seconds{${labels}} ${metrics.oldestPendingAgeSeconds}`);

  lines.push(`# HELP queue_processing_count Number of requests currently being processed`);
  lines.push(`# TYPE queue_processing_count gauge`);
  lines.push(`queue_processing_count{${labels}} ${metrics.processingCount}`);

  lines.push(`# HELP queue_worker_heartbeat_stale Whether the worker heartbeat is stale`);
  lines.push(`# TYPE queue_worker_heartbeat_stale gauge`);
  lines.push(`queue_worker_heartbeat_stale{${labels}} ${metrics.workerHeartbeatStale ? 1 : 0}`);

  // Success/failure metrics
  lines.push(`# HELP queue_success_count Total number of successful purchases`);
  lines.push(`# TYPE queue_success_count counter`);
  lines.push(`queue_success_count{${labels}} ${metrics.successCount}`);

  lines.push(`# HELP queue_failure_count Total number of failed purchases`);
  lines.push(`# TYPE queue_failure_count counter`);
  lines.push(`queue_failure_count{${labels}} ${metrics.failureCount}`);

  lines.push(`# HELP queue_recovery_count Total number of recovered requests`);
  lines.push(`# TYPE queue_recovery_count counter`);
  lines.push(`queue_recovery_count{${labels}} ${metrics.recoveryCount}`);

  // Latency metrics (queue wait)
  lines.push(`# HELP queue_wait_time_p50_ms P50 queue wait time in milliseconds`);
  lines.push(`# TYPE queue_wait_time_p50_ms gauge`);
  lines.push(`queue_wait_time_p50_ms{${labels}} ${metrics.latencyMetrics.queueWaitP50}`);

  lines.push(`# HELP queue_wait_time_p95_ms P95 queue wait time in milliseconds`);
  lines.push(`# TYPE queue_wait_time_p95_ms gauge`);
  lines.push(`queue_wait_time_p95_ms{${labels}} ${metrics.latencyMetrics.queueWaitP95}`);

  lines.push(`# HELP queue_wait_time_p99_ms P99 queue wait time in milliseconds`);
  lines.push(`# TYPE queue_wait_time_p99_ms gauge`);
  lines.push(`queue_wait_time_p99_ms{${labels}} ${metrics.latencyMetrics.queueWaitP99}`);

  // Latency metrics (processing duration)
  lines.push(`# HELP processing_duration_p50_ms P50 processing duration in milliseconds`);
  lines.push(`# TYPE processing_duration_p50_ms gauge`);
  lines.push(`processing_duration_p50_ms{${labels}} ${metrics.latencyMetrics.processingDurationP50}`);

  lines.push(`# HELP processing_duration_p95_ms P95 processing duration in milliseconds`);
  lines.push(`# TYPE processing_duration_p95_ms gauge`);
  lines.push(`processing_duration_p95_ms{${labels}} ${metrics.latencyMetrics.processingDurationP95}`);

  lines.push(`# HELP processing_duration_p99_ms P99 processing duration in milliseconds`);
  lines.push(`# TYPE processing_duration_p99_ms gauge`);
  lines.push(`processing_duration_p99_ms{${labels}} ${metrics.latencyMetrics.processingDurationP99}`);

  // Latency metrics (total)
  lines.push(`# HELP total_latency_p50_ms P50 total latency in milliseconds`);
  lines.push(`# TYPE total_latency_p50_ms gauge`);
  lines.push(`total_latency_p50_ms{${labels}} ${metrics.latencyMetrics.totalLatencyP50}`);

  lines.push(`# HELP total_latency_p95_ms P95 total latency in milliseconds`);
  lines.push(`# TYPE total_latency_p95_ms gauge`);
  lines.push(`total_latency_p95_ms{${labels}} ${metrics.latencyMetrics.totalLatencyP95}`);

  lines.push(`# HELP total_latency_p99_ms P99 total latency in milliseconds`);
  lines.push(`# TYPE total_latency_p99_ms gauge`);
  lines.push(`total_latency_p99_ms{${labels}} ${metrics.latencyMetrics.totalLatencyP99}`);

  // Financial integrity metrics
  lines.push(`# HELP ledger_verification_correct Whether ledger verification passed`);
  lines.push(`# TYPE ledger_verification_correct gauge`);
  lines.push(`ledger_verification_correct{${labels}} ${metrics.ledgerVerification.isCorrect ? 1 : 0}`);

  lines.push(`# HELP ledger_successful_purchases Number of successful purchases`);
  lines.push(`# TYPE ledger_successful_purchases gauge`);
  lines.push(`ledger_successful_purchases{${labels}} ${metrics.ledgerVerification.successfulPurchases}`);

  lines.push(`# HELP ledger_debit_entries Number of debit ledger entries`);
  lines.push(`# TYPE ledger_debit_entries gauge`);
  lines.push(`ledger_debit_entries{${labels}} ${metrics.ledgerVerification.debitEntries}`);

  lines.push(`# HELP ledger_credit_entries Number of credit ledger entries`);
  lines.push(`# TYPE ledger_credit_entries gauge`);
  lines.push(`ledger_credit_entries{${labels}} ${metrics.ledgerVerification.creditEntries}`);

  // Alert metrics
  lines.push(`# HELP alert_count_warning Number of active warning alerts`);
  lines.push(`# TYPE alert_count_warning gauge`);
  lines.push(`alert_count_warning{${labels}} ${metrics.alerts.warning}`);

  lines.push(`# HELP alert_count_critical Number of active critical alerts`);
  lines.push(`# TYPE alert_count_critical gauge`);
  lines.push(`alert_count_critical{${labels}} ${metrics.alerts.critical}`);

  return lines.join('\n') + '\n';
}
