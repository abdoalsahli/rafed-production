/**
 * Webhook Alert System for Queue Metrics
 * Sends alerts to Slack, PagerDuty, and other webhook endpoints
 */

export interface AlertConfig {
  enabled: boolean;
  webhookUrl: string;
  minSeverity: 'warning' | 'critical';
  throttleSeconds: number; // Prevent alert spam
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  type: string;
  title: string;
  message: string;
  providerId: number;
  distributorId: number;
  metrics?: Record<string, any>;
}

// In-memory alert tracking to prevent duplicate alerts
const lastAlertSent = new Map<string, number>();
const ALERT_THROTTLE_SECONDS = 300; // 5 minutes default

/**
 * Send alert to Slack webhook
 */
export async function sendSlackAlert(alert: Alert, webhookUrl: string): Promise<void> {
  const color = alert.severity === 'critical' ? '#FF0000' : '#FFAA00';
  const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

  const payload = {
    attachments: [
      {
        color,
        title: `${emoji} ${alert.title}`,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Account',
            value: `Provider ${alert.providerId} / Distributor ${alert.distributorId}`,
            short: true,
          },
          {
            title: 'Type',
            value: alert.type,
            short: true,
          },
          {
            title: 'Time',
            value: new Date(alert.timestamp).toISOString(),
            short: true,
          },
        ],
        footer: 'Queue Monitoring System',
        ts: Math.floor(alert.timestamp / 1000),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

/**
 * Send alert to PagerDuty webhook
 */
export async function sendPagerDutyAlert(alert: Alert, webhookUrl: string): Promise<void> {
  const severity = alert.severity === 'critical' ? 'critical' : 'warning';

  const payload = {
    routing_key: webhookUrl.split('/').pop(), // Extract routing key from URL
    event_action: 'trigger',
    dedup_key: `${alert.providerId}-${alert.distributorId}-${alert.type}`,
    payload: {
      summary: alert.title,
      severity,
      source: 'Queue Monitoring System',
      custom_details: {
        message: alert.message,
        account: `Provider ${alert.providerId} / Distributor ${alert.distributorId}`,
        type: alert.type,
        timestamp: new Date(alert.timestamp).toISOString(),
        ...alert.metrics,
      },
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`PagerDuty webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to send PagerDuty alert:', error);
  }
}

/**
 * Send generic webhook alert
 */
export async function sendWebhookAlert(alert: Alert, webhookUrl: string): Promise<void> {
  const payload = {
    alert: {
      id: alert.id,
      timestamp: alert.timestamp,
      severity: alert.severity,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      account: {
        providerId: alert.providerId,
        distributorId: alert.distributorId,
      },
      metrics: alert.metrics,
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to send webhook alert:', error);
  }
}

/**
 * Send alert to configured webhooks with throttling
 */
export async function dispatchAlert(
  alert: Alert,
  webhookConfigs: AlertConfig[]
): Promise<void> {
  // Check throttle
  const alertKey = `${alert.providerId}-${alert.distributorId}-${alert.type}`;
  const lastSent = lastAlertSent.get(alertKey) || 0;
  const now = Date.now();

  if (now - lastSent < ALERT_THROTTLE_SECONDS * 1000) {
    console.log(`Alert throttled: ${alertKey}`);
    return;
  }

  lastAlertSent.set(alertKey, now);

  // Send to all configured webhooks
  for (const config of webhookConfigs) {
    if (!config.enabled) continue;
    if (alert.severity === 'warning' && config.minSeverity === 'critical') continue;

    try {
      if (config.webhookUrl.includes('slack.com')) {
        await sendSlackAlert(alert, config.webhookUrl);
      } else if (config.webhookUrl.includes('pagerduty.com')) {
        await sendPagerDutyAlert(alert, config.webhookUrl);
      } else {
        await sendWebhookAlert(alert, config.webhookUrl);
      }
    } catch (error) {
      console.error(`Failed to dispatch alert to ${config.webhookUrl}:`, error);
    }
  }
}

/**
 * Generate alerts from metrics
 */
export function generateAlertsFromMetrics(
  metrics: any,
  providerId: number,
  distributorId: number
): Alert[] {
  const alerts: Alert[] = [];
  const timestamp = Date.now();

  // Queue depth critical
  if (metrics.queueDepth > 8000) {
    alerts.push({
      id: `${timestamp}-queue-depth-critical`,
      timestamp,
      severity: 'critical',
      type: 'queue_depth_critical',
      title: 'Queue Depth Critical',
      message: `Queue depth ${metrics.queueDepth} exceeds critical threshold (8000)`,
      providerId,
      distributorId,
      metrics: { queueDepth: metrics.queueDepth },
    });
  } else if (metrics.queueDepth > 5000) {
    alerts.push({
      id: `${timestamp}-queue-depth-warning`,
      timestamp,
      severity: 'warning',
      type: 'queue_depth_warning',
      title: 'Queue Depth Warning',
      message: `Queue depth ${metrics.queueDepth} exceeds warning threshold (5000)`,
      providerId,
      distributorId,
      metrics: { queueDepth: metrics.queueDepth },
    });
  }

  // Processing duration P99 critical
  if (metrics.latencyMetrics.processingDurationP99 > 5000) {
    alerts.push({
      id: `${timestamp}-p99-duration-critical`,
      timestamp,
      severity: 'critical',
      type: 'processing_duration_critical',
      title: 'Processing Duration P99 Critical',
      message: `P99 processing duration ${metrics.latencyMetrics.processingDurationP99}ms exceeds critical threshold (5000ms)`,
      providerId,
      distributorId,
      metrics: { p99Duration: metrics.latencyMetrics.processingDurationP99 },
    });
  } else if (metrics.latencyMetrics.processingDurationP95 > 2000) {
    alerts.push({
      id: `${timestamp}-p95-duration-warning`,
      timestamp,
      severity: 'warning',
      type: 'processing_duration_warning',
      title: 'Processing Duration P95 Warning',
      message: `P95 processing duration ${metrics.latencyMetrics.processingDurationP95}ms exceeds warning threshold (2000ms)`,
      providerId,
      distributorId,
      metrics: { p95Duration: metrics.latencyMetrics.processingDurationP95 },
    });
  }

  // Ledger mismatch
  if (!metrics.ledgerVerification.isCorrect) {
    alerts.push({
      id: `${timestamp}-ledger-mismatch`,
      timestamp,
      severity: 'critical',
      type: 'ledger_mismatch',
      title: 'Ledger Mismatch Detected',
      message: `Ledger verification failed: ${metrics.ledgerVerification.successfulPurchases} purchases but ${metrics.ledgerVerification.debitEntries} debits and ${metrics.ledgerVerification.creditEntries} credits`,
      providerId,
      distributorId,
      metrics: metrics.ledgerVerification,
    });
  }

  // Stale heartbeat
  if (metrics.workerHeartbeatStale) {
    alerts.push({
      id: `${timestamp}-stale-heartbeat`,
      timestamp,
      severity: 'warning',
      type: 'stale_heartbeat',
      title: 'Worker Heartbeat Stale',
      message: 'Queue worker heartbeat is stale - worker may be unresponsive',
      providerId,
      distributorId,
    });
  }

  return alerts;
}
