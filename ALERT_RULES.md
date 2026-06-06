# Alert Rules Documentation

This document describes all alert rules for the per-account queue system, their thresholds, and recommended actions.

## Overview

The alerting system monitors four categories:

1. **Infrastructure Stability** - System health, resource usage, crashes
2. **Queue Operations** - Queue depth, worker health, recovery attempts
3. **Performance** - Processing latency, queue wait times
4. **Financial Integrity** - Ledger correctness, purchase failures

All alerts support multiple notification channels: Slack, PagerDuty, Email, and custom webhooks.

---

## 1. Infrastructure Stability Alerts

### Connection Pool Saturation Warning
- **Severity**: Warning
- **Threshold**: Connection pool > 80% saturated
- **Duration**: 2 minutes
- **Action**: Monitor connection usage, consider scaling or investigating slow queries
- **Early Production**: 70%

```yaml
alert: ConnectionPoolSaturation
expr: (queue_connection_pool_active / queue_connection_pool_max) > 0.8
for: 2m
```

### Connection Pool Critical
- **Severity**: Critical
- **Threshold**: Connection pool > 95% saturated
- **Duration**: 1 minute
- **Action**: IMMEDIATE - Investigate connection leaks, restart if necessary
- **Early Production**: 85%

```yaml
alert: ConnectionPoolCritical
expr: (queue_connection_pool_active / queue_connection_pool_max) > 0.95
for: 1m
```

### High Memory Usage
- **Severity**: Warning
- **Threshold**: Process memory > 500MB
- **Duration**: 5 minutes
- **Action**: Monitor memory trends, investigate memory leaks
- **Early Production**: 400MB

```yaml
alert: HighMemoryUsage
expr: process_resident_memory_bytes > 500000000
for: 5m
```

### Critical Memory Usage
- **Severity**: Critical
- **Threshold**: Process memory > 800MB
- **Duration**: 2 minutes
- **Action**: IMMEDIATE - Potential OOM, restart server
- **Early Production**: 600MB

```yaml
alert: CriticalMemoryUsage
expr: process_resident_memory_bytes > 800000000
for: 2m
```

### Repeated Server Errors
- **Severity**: Warning
- **Threshold**: > 10 errors in 5 minutes
- **Duration**: 2 minutes
- **Action**: Check logs, investigate error patterns
- **Early Production**: > 5 errors

```yaml
alert: RepeatedServerErrors
expr: increase(queue_server_errors_total[5m]) > 10
for: 2m
```

### Server Crash/Restart Loop
- **Severity**: Critical
- **Threshold**: > 2 restarts in 10 minutes
- **Duration**: 1 minute
- **Action**: IMMEDIATE - Investigate startup issues, check logs
- **Early Production**: > 1 restart

```yaml
alert: ServerCrashRestart
expr: increase(queue_server_restarts_total[10m]) > 2
for: 1m
```

---

## 2. Queue Operations Alerts

### Queue Depth Warning
- **Severity**: Warning
- **Threshold**: Queue depth > 5000
- **Duration**: 5 minutes
- **Account-Specific**: Yes, can be adjusted per account
- **Action**: Monitor processing rate, check for stalled workers
- **Early Production**: > 3000

```yaml
alert: QueueDepthWarning
expr: queue_depth > 5000
for: 5m
labels:
  provider_id: "{{ $labels.provider_id }}"
  distributor_id: "{{ $labels.distributor_id }}"
```

### Queue Depth Critical
- **Severity**: Critical
- **Threshold**: Queue depth > 8000
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - Queue approaching max (10000), investigate backlog
- **Early Production**: > 5000

```yaml
alert: QueueDepthCritical
expr: queue_depth > 8000
for: 2m
```

### Oldest Pending Age Too High
- **Severity**: Warning
- **Threshold**: Oldest pending > 300 seconds (5 minutes)
- **Duration**: 5 minutes
- **Account-Specific**: Yes
- **Action**: Check worker health, verify no stalled requests
- **Early Production**: > 180 seconds (3 minutes)

```yaml
alert: OldestPendingAgeTooHigh
expr: queue_oldest_pending_age_seconds > 300
for: 5m
```

### Oldest Pending Age Critical
- **Severity**: Critical
- **Threshold**: Oldest pending > 600 seconds (10 minutes)
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - Request stuck, investigate worker state
- **Early Production**: > 300 seconds (5 minutes)

```yaml
alert: OldestPendingAgeCritical
expr: queue_oldest_pending_age_seconds > 600
for: 2m
```

### Stale Worker Heartbeat
- **Severity**: Critical
- **Threshold**: Heartbeat not updated for > 30 seconds
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - Worker dead/hung, recovery will trigger
- **Note**: Automatic recovery will attempt to restart processing

```yaml
alert: StaleWorkerHeartbeat
expr: queue_worker_heartbeat_stale == 1
for: 2m
```

### Recovery Count Spike
- **Severity**: Warning
- **Threshold**: > 5 recovery attempts in 10 minutes
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: Investigate why workers keep failing, check logs for patterns
- **Early Production**: > 3 recoveries

```yaml
alert: RecoveryCountSpike
expr: increase(queue_recovery_count[10m]) > 5
for: 2m
```

---

## 3. Performance Alerts

### P95 Processing Duration High
- **Severity**: Warning
- **Threshold**: P95 > 2000ms (2 seconds)
- **Duration**: 5 minutes
- **Account-Specific**: Yes
- **Action**: Monitor trends, investigate slow purchases
- **Early Production**: > 1000ms (1 second)

```yaml
alert: P95ProcessingDurationHigh
expr: queue_processing_duration_p95_ms > 2000
for: 5m
```

### P99 Processing Duration Critical
- **Severity**: Critical
- **Threshold**: P99 > 5000ms (5 seconds)
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - Tail latencies unacceptable, investigate bottlenecks
- **Early Production**: > 2000ms (2 seconds)

```yaml
alert: P99ProcessingDurationCritical
expr: queue_processing_duration_p99_ms > 5000
for: 2m
```

### P95 Queue Wait High
- **Severity**: Warning
- **Threshold**: P95 > 1000ms (1 second)
- **Duration**: 5 minutes
- **Account-Specific**: Yes
- **Action**: Queue is experiencing delays, check throughput
- **Early Production**: > 500ms

```yaml
alert: P95QueueWaitHigh
expr: queue_wait_p95_ms > 1000
for: 5m
```

### P99 Queue Wait Critical
- **Severity**: Critical
- **Threshold**: P99 > 3000ms (3 seconds)
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - Queue wait unacceptable, scale or optimize
- **Early Production**: > 1500ms (1.5 seconds)

```yaml
alert: P99QueueWaitCritical
expr: queue_wait_p99_ms > 3000
for: 2m
```

---

## 4. Financial Integrity Alerts

### Ledger Mismatch (CRITICAL)
- **Severity**: Critical
- **Threshold**: Ledger verification fails
- **Duration**: 1 minute
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - Financial data inconsistency, stop purchases, investigate
- **Impact**: Indicates debit/credit count mismatch or balance errors

```yaml
alert: LedgerMismatch
expr: queue_ledger_mismatch == 1
for: 1m
```

**Investigation Steps:**
1. Check recent purchase logs for errors
2. Verify all ledger entries match purchase count
3. Ensure 2 entries per purchase (debit + commission)
4. Check for orphaned or duplicate entries
5. Restore from backup if necessary

### Failed Purchases Spike
- **Severity**: Warning
- **Threshold**: > 20 failures in 10 minutes
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: Investigate failure patterns, check card inventory
- **Early Production**: > 10 failures

```yaml
alert: FailedPurchasesSpike
expr: increase(queue_failed_purchases_total[10m]) > 20
for: 2m
```

### Failed Purchase Rate Critical
- **Severity**: Critical
- **Threshold**: Failure rate > 10%
- **Duration**: 2 minutes
- **Account-Specific**: Yes
- **Action**: IMMEDIATE - High failure rate, stop accepting purchases, investigate
- **Early Production**: > 5% failure rate

```yaml
alert: FailedPurchasesCritical
expr: (increase(queue_failed_purchases_total[10m]) / (increase(queue_total_purchases[10m]) + 1)) > 0.1
for: 2m
```

**Common Causes:**
- Card inventory exhausted
- Card allocation failures
- Database connection issues
- PIN encryption failures
- Commission calculation errors

---

## Threshold Recommendations

### For Early Production Rollout

Use **EARLY_PRODUCTION_THRESHOLDS** for the first 1-2 weeks:

```typescript
import { useEarlyProductionThresholds } from './server/alert-thresholds';

// In server startup
useEarlyProductionThresholds();
```

**Key Differences:**
- Infrastructure alerts trigger earlier (70% pool vs 80%)
- Queue depth limits lower (3000 vs 5000)
- Performance thresholds tighter (1s vs 2s for P95)
- Financial failure thresholds lower (10 vs 20 failures)

**Rationale:** Catch issues early before they impact production, then gradually relax thresholds as confidence grows.

### Transition to Production Thresholds

After 1-2 weeks of stable operation:

```typescript
import { getThresholdManager, DEFAULT_THRESHOLDS } from './server/alert-thresholds';

// Switch to production thresholds
getThresholdManager().setDefaults(DEFAULT_THRESHOLDS);
```

### Per-Account Customization

For high-volume accounts, customize thresholds:

```typescript
import { getThresholdManager } from './server/alert-thresholds';

const manager = getThresholdManager();

// Increase limits for high-volume account
manager.setAccountOverrides('provider-1', 'distributor-1', {
  queueDepth: {
    warning: 8000,
    critical: 12000,
  },
  processingDuration: {
    p95Warning: 3000,
    p99Critical: 8000,
  },
});
```

---

## Notification Configuration

### Slack Integration

```typescript
import { initializeAlertNotifier } from './server/alert-notifier';

initializeAlertNotifier({
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    channel: '#alerts',
  },
});
```

**Webhook Format:**
```
https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### PagerDuty Integration

```typescript
initializeAlertNotifier({
  pagerduty: {
    integrationKey: process.env.PAGERDUTY_KEY,
  },
});
```

**Integration Key Format:**
```
Routing Key from PagerDuty Events API v2
```

### Custom Webhook

```typescript
initializeAlertNotifier({
  webhook: {
    url: process.env.CUSTOM_ALERT_WEBHOOK,
    headers: {
      'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`,
    },
  },
});
```

---

## Alert Integration

Alerts are checked automatically every 30 seconds:

```typescript
import { initializeAlertIntegration, startAlertChecking } from './server/alert-integration';

// In server startup
initializeAlertIntegration({
  enabled: true,
  checkInterval: 30000, // 30 seconds
});

startAlertChecking();
```

---

## Runbook: Responding to Alerts

### Critical Infrastructure Alerts

**Connection Pool Critical**
1. Check active connections: `SELECT COUNT(*) FROM information_schema.processlist`
2. Kill slow queries: `KILL QUERY <id>`
3. If persists, restart server
4. Investigate connection leaks in code

**Server Crash Loop**
1. Check logs: `tail -f .manus-logs/devserver.log`
2. Look for startup errors
3. Verify environment variables set correctly
4. Check database connectivity
5. Restart with: `pnpm run dev`

### Critical Queue Alerts

**Stale Worker Heartbeat**
1. Automatic recovery will trigger
2. Monitor queue depth for recovery success
3. If recovery fails, manually restart queue processing
4. Check worker logs for errors

**Queue Depth Critical**
1. Check queue status: `/queue-dashboard`
2. Verify worker is running and healthy
3. Check for stalled purchases
4. Monitor processing rate
5. If stuck, trigger manual recovery

### Critical Financial Alerts

**Ledger Mismatch**
1. STOP accepting new purchases immediately
2. Query ledger verification: Check debit/credit counts
3. Identify mismatched transactions
4. Restore from backup if necessary
5. Investigate root cause before resuming

**Failed Purchase Rate Critical**
1. Check card inventory levels
2. Verify card allocation is working
3. Check PIN encryption service
4. Review recent error logs
5. Pause purchases if needed

---

## Metrics Export

All metrics are exported at `/metrics` endpoint in Prometheus format:

```bash
curl http://localhost:3000/metrics
```

Key metrics:
- `queue_depth` - Current queue size
- `queue_processing_duration_p95_ms` - 95th percentile processing time
- `queue_failed_purchases_total` - Total failed purchases
- `queue_ledger_mismatch` - Ledger verification status

---

## Testing Alerts

### Simulate High Queue Depth

```bash
# Enqueue many purchases to trigger queue depth alert
for i in {1..6000}; do
  curl -X POST http://localhost:3000/api/trpc/purchases.enqueue \
    -H "Content-Type: application/json" \
    -d '{"providerId":"test","distributorId":"test","amount":100}'
done
```

### Simulate Memory Pressure

```bash
# Generate large objects to increase memory usage
# This would require custom test code
```

### Verify Alert Notifications

1. Check Slack channel for alert messages
2. Verify PagerDuty incident creation
3. Check webhook logs for custom notifications

---

## Maintenance

### Weekly Review

- [ ] Check alert frequency and adjust thresholds if needed
- [ ] Review false positives and tune durations
- [ ] Verify all notification channels working
- [ ] Check for any missed alerts

### Monthly Review

- [ ] Analyze alert patterns and trends
- [ ] Update thresholds based on observed behavior
- [ ] Document any custom per-account overrides
- [ ] Plan capacity based on queue metrics

### Quarterly Review

- [ ] Audit alert rules against business requirements
- [ ] Update runbooks based on incident learnings
- [ ] Review notification routing effectiveness
- [ ] Plan for scaling needs

---

## Related Documentation

- [Prometheus Metrics](./PROMETHEUS_METRICS.md) - Detailed metrics reference
- [Queue System Architecture](./QUEUE_ARCHITECTURE.md) - Queue design and operation
- [Operations Guide](./OPERATIONS_GUIDE.md) - Daily operational procedures
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment
