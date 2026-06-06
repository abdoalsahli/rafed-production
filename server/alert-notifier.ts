/**
 * Alert Notification System
 * Sends alerts to multiple targets (Slack, PagerDuty, Email, Webhooks)
 */

export interface AlertConfig {
  slack?: {
    webhookUrl: string;
    channel?: string;
  };
  pagerduty?: {
    integrationKey: string;
  };
  email?: {
    recipients: string[];
    smtpConfig?: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
}

export interface Alert {
  severity: 'warning' | 'critical';
  category: string;
  title: string;
  description: string;
  timestamp: number;
  labels?: Record<string, string>;
  value?: number;
  threshold?: number;
}

class AlertNotifier {
  private config: AlertConfig;
  private rateLimitMap = new Map<string, number>();
  private rateLimitWindow = 60000; // 1 minute

  constructor(config: AlertConfig) {
    this.config = config;
  }

  /**
   * Send alert to all configured targets
   */
  async notify(alert: Alert): Promise<void> {
    // Rate limit alerts to prevent spam
    if (this.isRateLimited(alert)) {
      console.log('[ALERT-NOTIFIER] Alert rate limited:', alert.title);
      return;
    }

    const promises: Promise<void>[] = [];

    if (this.config.slack) {
      promises.push(this.notifySlack(alert));
    }

    if (this.config.pagerduty) {
      promises.push(this.notifyPagerDuty(alert));
    }

    if (this.config.email) {
      promises.push(this.notifyEmail(alert));
    }

    if (this.config.webhook) {
      promises.push(this.notifyWebhook(alert));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send alert to Slack
   */
  private async notifySlack(alert: Alert): Promise<void> {
    if (!this.config.slack) return;

    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const fields = Object.entries(alert.labels || {}).map(([key, value]) => ({
      title: key,
      value,
      short: true,
    }));

    const payload = {
      channel: this.config.slack.channel,
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.description,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Category',
              value: alert.category,
              short: true,
            },
            ...fields,
            {
              title: 'Timestamp',
              value: new Date(alert.timestamp).toISOString(),
              short: false,
            },
          ],
          ts: Math.floor(alert.timestamp / 1000),
        },
      ],
    };

    try {
      const response = await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.statusText}`);
      }

      console.log('[ALERT-NOTIFIER] Slack alert sent:', alert.title);
    } catch (error) {
      console.error('[ALERT-NOTIFIER] Slack notification error:', error);
    }
  }

  /**
   * Send alert to PagerDuty
   */
  private async notifyPagerDuty(alert: Alert): Promise<void> {
    if (!this.config.pagerduty) return;

    const severity = alert.severity === 'critical' ? 'critical' : 'warning';
    const payload = {
      routing_key: this.config.pagerduty.integrationKey,
      event_action: 'trigger',
      dedup_key: `${alert.category}:${alert.title}`,
      payload: {
        summary: alert.title,
        severity,
        source: 'queue-system',
        timestamp: new Date(alert.timestamp).toISOString(),
        custom_details: {
          description: alert.description,
          labels: alert.labels,
          value: alert.value,
          threshold: alert.threshold,
        },
      },
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty notification failed: ${response.statusText}`);
      }

      console.log('[ALERT-NOTIFIER] PagerDuty alert sent:', alert.title);
    } catch (error) {
      console.error('[ALERT-NOTIFIER] PagerDuty notification error:', error);
    }
  }

  /**
   * Send alert via email
   */
  private async notifyEmail(alert: Alert): Promise<void> {
    if (!this.config.email) return;

    const html = `
      <h2>${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
      <p><strong>Category:</strong> ${alert.category}</p>
      <p><strong>Description:</strong> ${alert.description}</p>
      ${alert.labels ? `<p><strong>Labels:</strong> ${JSON.stringify(alert.labels)}</p>` : ''}
      ${alert.value ? `<p><strong>Value:</strong> ${alert.value}</p>` : ''}
      ${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
      <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toISOString()}</p>
    `;

    console.log('[ALERT-NOTIFIER] Email alert would be sent to:', this.config.email.recipients);
    // Email implementation would go here
  }

  /**
   * Send alert to custom webhook
   */
  private async notifyWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhook) return;

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.statusText}`);
      }

      console.log('[ALERT-NOTIFIER] Webhook alert sent:', alert.title);
    } catch (error) {
      console.error('[ALERT-NOTIFIER] Webhook notification error:', error);
    }
  }

  /**
   * Check if alert should be rate limited
   */
  private isRateLimited(alert: Alert): boolean {
    const key = `${alert.category}:${alert.title}`;
    const lastTime = this.rateLimitMap.get(key) || 0;
    const now = Date.now();

    if (now - lastTime < this.rateLimitWindow) {
      return true;
    }

    this.rateLimitMap.set(key, now);
    return false;
  }

  /**
   * Get alert notifier instance
   */
  static getInstance(config: AlertConfig): AlertNotifier {
    return new AlertNotifier(config);
  }
}

// Export singleton instance
let notifierInstance: AlertNotifier | null = null;

export function initializeAlertNotifier(config: AlertConfig): AlertNotifier {
  notifierInstance = AlertNotifier.getInstance(config);
  return notifierInstance;
}

export function getAlertNotifier(): AlertNotifier {
  if (!notifierInstance) {
    throw new Error('Alert notifier not initialized. Call initializeAlertNotifier first.');
  }
  return notifierInstance;
}
