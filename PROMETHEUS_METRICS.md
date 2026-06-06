# Prometheus Metrics Export & Alert Integration

## Overview

The per-account queue system exports comprehensive Prometheus metrics for monitoring, alerting, and observability. Metrics are available at the `/metrics` endpoint and support per-account filtering.

---

## Metrics Endpoint

**URL:** `GET /metrics`

**Query Parameters:**
- `provider_id` (optional): Filter by provider ID
- `distributor_id` (optional): Filter by distributor ID

**Example Requests:**
```bash
# Get metrics for specific account
curl http://localhost:3000/metrics?provider_id=1&distributor_id=1

# Get global metrics (no account specified)
curl http://localhost:3000/metrics
```

**Response Format:** Prometheus text format (text/plain)

---

## Exported Metrics

### Queue Health Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `queue_depth` | Gauge | provider_id, distributor_id | Current depth of the queue |
| `queue_oldest_pending_age_seconds` | Gauge | provider_id, distributor_id | Age of oldest pending request in seconds |
| `queue_processing_count` | Gauge | provider_id, distributor_id | Number of requests currently being processed |
| `queue_worker_heartbeat_stale` | Gauge | provider_id, distributor_id | Whether worker heartbeat is stale (0=fresh, 1=stale) |

### Success/Failure Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `queue_success_count` | Counter | provider_id, distributor_id | Total successful purchases |
| `queue_failure_count` | Counter | provider_id, distributor_id | Total failed purchases |
| `queue_recovery_count` | Counter | provider_id, distributor_id | Total recovered requests |

### Queue Wait Time Metrics (milliseconds)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `queue_wait_time_p50_ms` | Gauge | provider_id, distributor_id | P50 queue wait time |
| `queue_wait_time_p95_ms` | Gauge | provider_id, distributor_id | P95 queue wait time |
| `queue_wait_time_p99_ms` | Gauge | provider_id, distributor_id | P99 queue wait time |

### Processing Duration Metrics (milliseconds)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `processing_duration_p50_ms` | Gauge | provider_id, distributor_id | P50 processing duration |
| `processing_duration_p95_ms` | Gauge | provider_id, distributor_id | P95 processing duration |
| `processing_duration_p99_ms` | Gauge | provider_id, distributor_id | P99 processing duration |

### Total Latency Metrics (milliseconds)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `total_latency_p50_ms` | Gauge | provider_id, distributor_id | P50 total latency (queue wait + processing) |
| `total_latency_p95_ms` | Gauge | provider_id, distributor_id | P95 total latency |
| `total_latency_p99_ms` | Gauge | provider_id, distributor_id | P99 total latency |

### Financial Integrity Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `ledger_verification_correct` | Gauge | provider_id, distributor_id | Whether ledger verification passed (0=failed, 1=passed) |
| `ledger_successful_purchases` | Gauge | provider_id, distributor_id | Number of successful purchases |
| `ledger_debit_entries` | Gauge | provider_id, distributor_id | Number of debit ledger entries |
| `ledger_credit_entries` | Gauge | provider_id, distributor_id | Number of credit ledger entries |

### Alert Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `alert_count_warning` | Gauge | provider_id, distributor_id | Number of active warning alerts |
| `alert_count_critical` | Gauge | provider_id, distributor_id | Number of active critical alerts |

---

## Example Prometheus Output

```
# HELP queue_depth Current depth of the queue for account
# TYPE queue_depth gauge
queue_depth{provider_id="1",distributor_id="1"} 42

# HELP queue_oldest_pending_age_seconds Age of oldest pending request in seconds
# TYPE queue_oldest_pending_age_seconds gauge
queue_oldest_pending_age_seconds{provider_id="1",distributor_id="1"} 123

# HELP queue_processing_count Number of requests currently being processed
# TYPE queue_processing_count gauge
queue_processing_count{provider_id="1",distributor_id="1"} 1

# HELP queue_worker_heartbeat_stale Whether the worker heartbeat is stale
# TYPE queue_worker_heartbeat_stale gauge
queue_worker_heartbeat_stale{provider_id="1",distributor_id="1"} 0

# HELP queue_success_count Total number of successful purchases
# TYPE queue_success_count counter
queue_success_count{provider_id="1",distributor_id="1"} 1000

# HELP queue_failure_count Total number of failed purchases
# TYPE queue_failure_count counter
queue_failure_count{provider_id="1",distributor_id="1"} 5

# HELP processing_duration_p95_ms P95 processing duration in milliseconds
# TYPE processing_duration_p95_ms gauge
processing_duration_p95_ms{provider_id="1",distributor_id="1"} 1250

# HELP ledger_verification_correct Whether ledger verification passed
# TYPE ledger_verification_correct gauge
ledger_verification_correct{provider_id="1",distributor_id="1"} 1

# HELP ledger_successful_purchases Number of successful purchases
# TYPE ledger_successful_purchases gauge
ledger_successful_purchases{provider_id="1",distributor_id="1"} 1000

# HELP ledger_debit_entries Number of debit ledger entries
# TYPE ledger_debit_entries gauge
ledger_debit_entries{provider_id="1",distributor_id="1"} 1000

# HELP ledger_credit_entries Number of credit ledger entries
# TYPE ledger_credit_entries gauge
ledger_credit_entries{provider_id="1",distributor_id="1"} 1000
```

---

## Cardinality Considerations

### Label Strategy

The metrics use two labels: `provider_id` and `distributor_id`. This creates bounded cardinality:

- **Safe Cardinality:** With 1000 providers and 100 distributors per provider = 100,000 label combinations
- **Prometheus Recommendation:** Stay below 1 million label combinations for typical setups

### Recommendations

1. **Scrape Specific Accounts:** Instead of scraping `/metrics` without parameters, scrape specific accounts:
   ```
   - job_name: 'queue-metrics'
     static_configs:
       - targets: ['localhost:3000']
         params:
           provider_id: ['1']
           distributor_id: ['1']
   ```

2. **Use Service Discovery:** Dynamically discover active accounts and scrape only those

3. **Monitor Label Cardinality:** Track the number of unique label combinations in Prometheus

---

## Prometheus Configuration

### Scrape Configuration

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'queue-metrics'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    params:
      provider_id: ['1']
      distributor_id: ['1']
```

### Recommended Scrape Interval

- **Default:** 30 seconds
- **High-frequency:** 15 seconds (for critical accounts)
- **Low-frequency:** 60 seconds (for non-critical accounts)

---

## Alert Rules

### Prometheus Alert Rules (YAML)

```yaml
groups:
  - name: queue_alerts
    interval: 30s
    rules:
      # Queue Depth Alerts
      - alert: QueueDepthCritical
        expr: queue_depth > 8000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Queue depth critical for account {{ $labels.provider_id }}/{{ $labels.distributor_id }}"
          description: "Queue depth is {{ $value }}, exceeds critical threshold (8000)"

      - alert: QueueDepthWarning
        expr: queue_depth > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue depth warning for account {{ $labels.provider_id }}/{{ $labels.distributor_id }}"
          description: "Queue depth is {{ $value }}, exceeds warning threshold (5000)"

      # Processing Duration Alerts
      - alert: ProcessingDurationP99Critical
        expr: processing_duration_p99_ms > 5000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "P99 processing duration critical"
          description: "P99 processing duration is {{ $value }}ms, exceeds critical threshold (5000ms)"

      - alert: ProcessingDurationP95Warning
        expr: processing_duration_p95_ms > 2000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 processing duration warning"
          description: "P95 processing duration is {{ $value }}ms, exceeds warning threshold (2000ms)"

      # Ledger Verification Alerts
      - alert: LedgerMismatch
        expr: ledger_verification_correct == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Ledger verification failed for account {{ $labels.provider_id }}/{{ $labels.distributor_id }}"
          description: "Ledger verification failed - financial consistency compromised"

      # Worker Heartbeat Alerts
      - alert: WorkerHeartbeatStale
        expr: queue_worker_heartbeat_stale == 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Worker heartbeat stale for account {{ $labels.provider_id }}/{{ $labels.distributor_id }}"
          description: "Queue worker heartbeat is stale - worker may be unresponsive"

      # Failure Rate Alerts
      - alert: HighFailureRate
        expr: |
          (
            rate(queue_failure_count[5m]) /
            (rate(queue_success_count[5m]) + rate(queue_failure_count[5m]))
          ) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High failure rate for account {{ $labels.provider_id }}/{{ $labels.distributor_id }}"
          description: "Failure rate is {{ $value | humanizePercentage }}, exceeds threshold (10%)"
```

---

## Webhook Alert Integration

### Slack Integration

Configure webhook URL in environment:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Alert format:
- **Critical:** Red attachment with 🚨 emoji
- **Warning:** Orange attachment with ⚠️ emoji

### PagerDuty Integration

Configure webhook URL in environment:
```bash
PAGERDUTY_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
```

Alert format:
- **Critical:** Severity = critical
- **Warning:** Severity = warning

### Custom Webhook Integration

Send POST requests to custom webhook URLs with standardized JSON format:

```json
{
  "alert": {
    "id": "1234567890-queue-depth-critical",
    "timestamp": 1234567890000,
    "severity": "critical",
    "type": "queue_depth_critical",
    "title": "Queue Depth Critical",
    "message": "Queue depth 8500 exceeds critical threshold (8000)",
    "account": {
      "providerId": 1,
      "distributorId": 1
    },
    "metrics": {
      "queueDepth": 8500
    }
  }
}
```

---

## Monitoring Dashboard

### Key Metrics to Display

1. **Queue Health (Real-time)**
   - Queue depth (gauge)
   - Processing count (gauge)
   - Oldest pending age (gauge)
   - Worker heartbeat status (indicator)

2. **Performance (Time-series)**
   - P50/P95/P99 processing duration
   - P50/P95/P99 total latency
   - Success/failure rate

3. **Financial Integrity**
   - Ledger verification status (indicator)
   - Purchase/debit/credit counts (counters)
   - Mismatch alerts (indicator)

4. **Alerts**
   - Active warning count
   - Active critical count
   - Recent alerts (table)

---

## Troubleshooting

### Metrics Not Appearing

1. Check endpoint is accessible: `curl http://localhost:3000/metrics?provider_id=1&distributor_id=1`
2. Verify provider_id and distributor_id are correct
3. Check Prometheus scrape logs for errors

### High Cardinality Issues

1. Limit the number of unique account combinations being scraped
2. Use service discovery to dynamically select accounts
3. Monitor Prometheus cardinality with: `topk(10, count by (__name__) (count by (provider_id, distributor_id) (queue_depth)))`

### Alert Spam

1. Adjust alert thresholds in Prometheus rules
2. Increase `for` duration to reduce flapping
3. Use alert throttling in webhook integration (default: 5 minutes)

---

## Production Deployment

### Recommended Setup

1. **Prometheus Scrape Interval:** 30 seconds
2. **Alert Evaluation Interval:** 30 seconds
3. **Webhook Throttle:** 5 minutes (prevent duplicate alerts)
4. **Cardinality Limit:** Monitor and keep below 100,000 label combinations
5. **Retention:** 15 days for metrics, 7 days for alerts

### Scaling Considerations

- For 1000+ accounts, use service discovery to dynamically select which accounts to scrape
- Consider using Prometheus federation or remote storage for long-term retention
- Use Grafana for visualization and alerting
