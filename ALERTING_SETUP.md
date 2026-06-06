# Production Alerting Setup Guide

This guide walks through setting up the complete alerting system for the per-account queue system.

## Overview

The alerting system consists of:

1. **Prometheus Alert Rules** - Define conditions that trigger alerts
2. **Alert Notifier** - Sends alerts to multiple channels (Slack, PagerDuty, Email, Webhooks)
3. **Alert Checker** - Evaluates metrics against thresholds
4. **Alert Integration** - Runs periodic checks and triggers notifications
5. **Threshold Manager** - Centralized configuration for alert limits

---

## Phase 1: Initialize Alert System in Server

### 1.1 Server Startup Integration

Update `server/_core/index.ts` to initialize alerting:

```typescript
import { initializeAlertNotifier } from '../alert-notifier';
import { initializeThresholdManager, useEarlyProductionThresholds } from '../alert-thresholds';
import { initializeAlertIntegration, startAlertChecking } from '../alert-integration';

// In your server startup function:
async function startServer() {
  // ... existing setup ...

  // Initialize alert system
  const alertConfig = {
    slack: process.env.SLACK_WEBHOOK_URL ? {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
    } : undefined,
    pagerduty: process.env.PAGERDUTY_KEY ? {
      integrationKey: process.env.PAGERDUTY_KEY,
    } : undefined,
    webhook: process.env.CUSTOM_ALERT_WEBHOOK ? {
      url: process.env.CUSTOM_ALERT_WEBHOOK,
      headers: {
        'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN || ''}`,
      },
    } : undefined,
  };

  initializeAlertNotifier(alertConfig);

  // Use early production thresholds for first 1-2 weeks
  if (process.env.EARLY_PRODUCTION_MODE === 'true') {
    useEarlyProductionThresholds();
  } else {
    initializeThresholdManager();
  }

  // Start alert checking loop
  initializeAlertIntegration({
    enabled: process.env.ALERTS_ENABLED !== 'false',
    checkInterval: parseInt(process.env.ALERT_CHECK_INTERVAL || '30000'),
  });

  startAlertChecking();

  console.log('[SERVER] Alert system initialized');
}
```

### 1.2 Environment Variables

Add to `.env` or via `webdev_request_secrets`:

```bash
# Alert Notification Channels
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERT_CHANNEL=#alerts

PAGERDUTY_KEY=your-pagerduty-routing-key

CUSTOM_ALERT_WEBHOOK=https://your-webhook-endpoint.com/alerts
WEBHOOK_TOKEN=your-webhook-auth-token

# Alert Configuration
ALERTS_ENABLED=true
ALERT_CHECK_INTERVAL=30000
EARLY_PRODUCTION_MODE=true
```

---

## Phase 2: Configure Notification Channels

### 2.1 Slack Integration

**Setup Steps:**

1. Go to your Slack workspace settings
2. Create a new app or use existing one
3. Enable "Incoming Webhooks"
4. Create a new webhook for your alerts channel
5. Copy the webhook URL

**Test Webhook:**

```bash
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Test alert from prepaid card platform",
    "attachments": [{
      "color": "warning",
      "title": "Test Alert",
      "text": "This is a test notification"
    }]
  }'
```

### 2.2 PagerDuty Integration

**Setup Steps:**

1. Go to PagerDuty Events API v2
2. Create a new integration
3. Copy the routing key
4. Set as `PAGERDUTY_KEY` environment variable

**Test Integration:**

```bash
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_ROUTING_KEY",
    "event_action": "trigger",
    "dedup_key": "test-alert",
    "payload": {
      "summary": "Test alert from prepaid card platform",
      "severity": "warning",
      "source": "queue-system"
    }
  }'
```

### 2.3 Custom Webhook

For integration with custom systems:

```bash
curl -X POST https://your-webhook-endpoint.com/alerts \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "alert": {
      "severity": "warning",
      "category": "queue_operations",
      "title": "Queue Depth Warning",
      "description": "Queue depth exceeded threshold"
    },
    "timestamp": "2026-04-20T21:00:00Z"
  }'
```

---

## Phase 3: Configure Alert Thresholds

### 3.1 Early Production Setup (Recommended for First 1-2 Weeks)

Use conservative thresholds to catch issues early:

```typescript
import { useEarlyProductionThresholds } from './server/alert-thresholds';

// In server startup
useEarlyProductionThresholds();

// Thresholds will be:
// - Connection pool warning: 70% (vs 80%)
// - Queue depth warning: 3000 (vs 5000)
// - P95 processing: 1s (vs 2s)
// - Failure rate: 5% (vs 10%)
```

### 3.2 Transition to Production Thresholds

After 1-2 weeks of stable operation:

```typescript
import { getThresholdManager, DEFAULT_THRESHOLDS } from './server/alert-thresholds';

const manager = getThresholdManager();
manager.setDefaults(DEFAULT_THRESHOLDS);
```

### 3.3 Per-Account Customization

For high-volume accounts, adjust thresholds:

```typescript
import { getThresholdManager } from './server/alert-thresholds';

const manager = getThresholdManager();

// Increase limits for high-volume distributor
manager.setAccountOverrides('provider-1', 'high-volume-distributor', {
  queueDepth: {
    warning: 8000,
    critical: 12000,
  },
  processingDuration: {
    p95Warning: 3000,
    p99Critical: 8000,
  },
  failedPurchases: {
    warning: 50,
    criticalRate: 0.15,
  },
});
```

---

## Phase 4: Verify Alert System

### 4.1 Check Alert Initialization

```bash
# Check server logs for initialization messages
tail -f .manus-logs/devserver.log | grep -i alert

# Expected output:
# [SERVER] Alert system initialized
# [ALERT-NOTIFIER] Alert notifier configured
# [ALERT-INTEGRATION] Starting alert checks every 30000ms
```

### 4.2 Verify Metrics Collection

```bash
# Check metrics endpoint
curl http://localhost:3000/metrics | grep queue_

# Should see metrics like:
# queue_depth{provider_id="...",distributor_id="..."} 100
# queue_processing_duration_p95_ms{...} 1500
# queue_failed_purchases_total{...} 5
```

### 4.3 Test Alert Triggering

**Simulate High Queue Depth:**

```bash
# Enqueue many purchases to trigger alert
for i in {1..6000}; do
  curl -X POST http://localhost:3000/api/trpc/purchases.enqueue \
    -H "Content-Type: application/json" \
    -d '{
      "providerId":"test-provider",
      "distributorId":"test-distributor",
      "amount":100
    }' &
done
wait

# Monitor alert in Slack channel or check logs
tail -f .manus-logs/devserver.log | grep ALERT
```

**Simulate High Memory Usage:**

```bash
# This requires custom test code to allocate memory
# For now, monitor with:
ps aux | grep node | grep prepaid-card-platform
# Check RSS column for memory usage
```

### 4.4 Test Notification Channels

**Slack:**
```bash
# Check Slack channel for test messages
# Should see alerts formatted with color, title, and description
```

**PagerDuty:**
```bash
# Check PagerDuty incidents dashboard
# Should see incidents created for critical alerts
```

**Webhooks:**
```bash
# Monitor webhook endpoint logs
# Should see POST requests with alert payloads
```

---

## Phase 5: Monitoring Dashboard Integration

### 5.1 Display Alert Status in Dashboard

The internal operations dashboard (`/queue-dashboard`) displays:

- Current alert count by severity
- Alert history for the account
- Alert threshold configuration

```typescript
// In your dashboard component
const { data: alertStatus } = trpc.dashboard.alertStatus.useQuery({
  providerId: selectedAccount.providerId,
  distributorId: selectedAccount.distributorId,
});

// Display alert badges
<div className="alert-status">
  <Badge severity="critical">{alertStatus.critical} Critical</Badge>
  <Badge severity="warning">{alertStatus.warning} Warnings</Badge>
</div>
```

### 5.2 Add Alert History View

```typescript
// Query recent alerts
const { data: alerts } = trpc.dashboard.recentAlerts.useQuery({
  providerId: selectedAccount.providerId,
  distributorId: selectedAccount.distributorId,
  limit: 20,
});

// Display in timeline
<AlertTimeline alerts={alerts} />
```

---

## Phase 6: Production Deployment

### 6.1 Pre-Deployment Checklist

- [ ] All notification channels configured and tested
- [ ] Alert thresholds reviewed and approved
- [ ] Early production mode enabled for first week
- [ ] Runbooks prepared for each alert type
- [ ] On-call rotation established
- [ ] Alert escalation policy defined

### 6.2 Deployment Steps

1. **Deploy with Early Production Thresholds:**
   ```bash
   EARLY_PRODUCTION_MODE=true pnpm run deploy
   ```

2. **Monitor for 24 hours:**
   - Check alert frequency
   - Verify all notification channels working
   - Look for false positives

3. **Adjust thresholds if needed:**
   ```typescript
   manager.setAccountOverrides(...);
   ```

4. **After 1-2 weeks, switch to production thresholds:**
   ```bash
   EARLY_PRODUCTION_MODE=false pnpm run deploy
   ```

### 6.3 Post-Deployment Validation

```bash
# Verify alert system is running
curl http://localhost:3000/metrics | grep queue_alert

# Check alert logs
tail -f .manus-logs/devserver.log | grep ALERT

# Verify notification delivery
# Check Slack, PagerDuty, and webhook logs
```

---

## Troubleshooting

### Alerts Not Triggering

**Check 1: Alert system initialized**
```bash
grep "Alert system initialized" .manus-logs/devserver.log
```

**Check 2: Metrics being collected**
```bash
curl http://localhost:3000/metrics | head -20
```

**Check 3: Alert checker running**
```bash
grep "ALERT-INTEGRATION" .manus-logs/devserver.log
```

**Check 4: Thresholds configured**
```typescript
import { getThresholdManager } from './server/alert-thresholds';
const thresholds = getThresholdManager().getAll();
console.log(thresholds);
```

### Notifications Not Sent

**Check 1: Webhook URLs valid**
```bash
# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"test"}'

# Test PagerDuty
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -d "{\"routing_key\":\"$PAGERDUTY_KEY\",...}"
```

**Check 2: Check notifier logs**
```bash
grep "ALERT-NOTIFIER" .manus-logs/devserver.log
```

**Check 3: Verify environment variables**
```bash
echo $SLACK_WEBHOOK_URL
echo $PAGERDUTY_KEY
echo $CUSTOM_ALERT_WEBHOOK
```

### False Positive Alerts

**Solution 1: Increase threshold**
```typescript
manager.setAccountOverrides('provider', 'distributor', {
  queueDepth: { warning: 6000, critical: 9000 },
});
```

**Solution 2: Increase duration**
```yaml
# In prometheus-alerts.yml
for: 5m  # Increase from 2m to 5m
```

**Solution 3: Review business requirements**
- Are thresholds aligned with SLA?
- Is alert useful for operations?
- Can it be combined with other alerts?

---

## Maintenance

### Weekly Tasks

- [ ] Review alert frequency
- [ ] Check for patterns in false positives
- [ ] Verify all notification channels working
- [ ] Review runbook effectiveness

### Monthly Tasks

- [ ] Analyze alert trends
- [ ] Adjust thresholds based on observed behavior
- [ ] Update documentation
- [ ] Plan capacity based on metrics

### Quarterly Tasks

- [ ] Audit all alert rules
- [ ] Review incident response effectiveness
- [ ] Update runbooks
- [ ] Plan for scaling

---

## Related Documentation

- [Alert Rules](./ALERT_RULES.md) - Complete alert reference
- [Prometheus Metrics](./PROMETHEUS_METRICS.md) - Metrics documentation
- [Operations Guide](./OPERATIONS_GUIDE.md) - Daily operations
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review alert logs: `grep ALERT .manus-logs/devserver.log`
3. Test notification channels manually
4. Consult the runbooks in [Alert Rules](./ALERT_RULES.md)
