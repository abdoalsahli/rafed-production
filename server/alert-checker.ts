/**
 * Alert Checker
 * Evaluates metrics against thresholds and triggers notifications
 * Runs periodically to check for alert conditions
 */

import { getThresholdManager } from './alert-thresholds';
import { getAlertNotifier, Alert } from './alert-notifier';

export interface MetricSnapshot {
  timestamp: number;
  providerId: string;
  distributorId: string;

  // Infrastructure
  connectionPoolActive?: number;
  connectionPoolMax?: number;
  memoryUsage?: number;
  serverErrors?: number;
  serverRestarts?: number;

  // Queue Operations
  queueDepth?: number;
  oldestPendingAge?: number;
  workerHeartbeatStale?: boolean;
  recoveryCount?: number;

  // Performance
  processingDurationP95?: number;
  processingDurationP99?: number;
  queueWaitP95?: number;
  queueWaitP99?: number;

  // Financial Integrity
  ledgerMismatch?: boolean;
  failedPurchases?: number;
  totalPurchases?: number;
}

class AlertChecker {
  private previousAlerts = new Map<string, number>();
  private alertCooldown = 5 * 60 * 1000; // 5 minutes between same alerts

  /**
   * Check all metrics and trigger alerts
   */
  async checkMetrics(snapshot: MetricSnapshot): Promise<void> {
    const thresholds = getThresholdManager().getThresholds(
      snapshot.providerId,
      snapshot.distributorId
    );
    const notifier = getAlertNotifier();

    // Check infrastructure alerts
    await this.checkInfrastructureAlerts(snapshot, thresholds, notifier);

    // Check queue operation alerts
    await this.checkQueueOperationAlerts(snapshot, thresholds, notifier);

    // Check performance alerts
    await this.checkPerformanceAlerts(snapshot, thresholds, notifier);

    // Check financial integrity alerts
    await this.checkFinancialIntegrityAlerts(snapshot, thresholds, notifier);
  }

  /**
   * Check infrastructure alerts
   */
  private async checkInfrastructureAlerts(
    snapshot: MetricSnapshot,
    thresholds: any,
    notifier: any
  ): Promise<void> {
    // Connection pool saturation
    if (
      snapshot.connectionPoolActive &&
      snapshot.connectionPoolMax &&
      snapshot.connectionPoolActive / snapshot.connectionPoolMax >
        thresholds.connectionPoolSaturation.critical
    ) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'infrastructure',
        title: 'Connection pool critical saturation',
        description: `Connection pool is ${(
          (snapshot.connectionPoolActive / snapshot.connectionPoolMax) *
          100
        ).toFixed(1)}% saturated (${snapshot.connectionPoolActive}/${snapshot.connectionPoolMax})`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.connectionPoolActive / snapshot.connectionPoolMax,
        threshold: thresholds.connectionPoolSaturation.critical,
      });
    } else if (
      snapshot.connectionPoolActive &&
      snapshot.connectionPoolMax &&
      snapshot.connectionPoolActive / snapshot.connectionPoolMax >
        thresholds.connectionPoolSaturation.warning
    ) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'infrastructure',
        title: 'Connection pool saturation warning',
        description: `Connection pool is ${(
          (snapshot.connectionPoolActive / snapshot.connectionPoolMax) *
          100
        ).toFixed(1)}% saturated`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.connectionPoolActive / snapshot.connectionPoolMax,
        threshold: thresholds.connectionPoolSaturation.warning,
      });
    }

    // Memory usage
    if (snapshot.memoryUsage && snapshot.memoryUsage > thresholds.memoryUsage.critical) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'infrastructure',
        title: 'Critical memory usage - potential OOM',
        description: `Process memory: ${(snapshot.memoryUsage / 1024 / 1024).toFixed(1)}MB (threshold: ${(
          thresholds.memoryUsage.critical /
          1024 /
          1024
        ).toFixed(1)}MB)`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.memoryUsage,
        threshold: thresholds.memoryUsage.critical,
      });
    } else if (snapshot.memoryUsage && snapshot.memoryUsage > thresholds.memoryUsage.warning) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'infrastructure',
        title: 'High memory usage detected',
        description: `Process memory: ${(snapshot.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.memoryUsage,
        threshold: thresholds.memoryUsage.warning,
      });
    }

    // Server errors
    if (snapshot.serverErrors && snapshot.serverErrors > thresholds.serverErrors.critical) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'infrastructure',
        title: 'Critical server error rate',
        description: `${snapshot.serverErrors} server errors in last 5 minutes`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.serverErrors,
        threshold: thresholds.serverErrors.critical,
      });
    } else if (snapshot.serverErrors && snapshot.serverErrors > thresholds.serverErrors.warning) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'infrastructure',
        title: 'Repeated server errors detected',
        description: `${snapshot.serverErrors} server errors in last 5 minutes`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.serverErrors,
        threshold: thresholds.serverErrors.warning,
      });
    }

    // Server restarts
    if (snapshot.serverRestarts && snapshot.serverRestarts > thresholds.serverRestarts.critical) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'infrastructure',
        title: 'Server crash/restart loop detected',
        description: `${snapshot.serverRestarts} server restarts in last 10 minutes`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.serverRestarts,
        threshold: thresholds.serverRestarts.critical,
      });
    }
  }

  /**
   * Check queue operation alerts
   */
  private async checkQueueOperationAlerts(
    snapshot: MetricSnapshot,
    thresholds: any,
    notifier: any
  ): Promise<void> {
    // Queue depth
    if (snapshot.queueDepth && snapshot.queueDepth > thresholds.queueDepth.critical) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'queue_operations',
        title: 'Queue depth critical',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} queue depth: ${snapshot.queueDepth} (max: 10000)`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.queueDepth,
        threshold: thresholds.queueDepth.critical,
      });
    } else if (snapshot.queueDepth && snapshot.queueDepth > thresholds.queueDepth.warning) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'queue_operations',
        title: 'Queue depth warning',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} queue depth: ${snapshot.queueDepth}`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.queueDepth,
        threshold: thresholds.queueDepth.warning,
      });
    }

    // Oldest pending age
    if (
      snapshot.oldestPendingAge &&
      snapshot.oldestPendingAge > thresholds.oldestPendingAge.critical
    ) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'queue_operations',
        title: 'Oldest pending request critically old',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} oldest pending: ${(
          snapshot.oldestPendingAge / 60
        ).toFixed(1)} minutes`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.oldestPendingAge,
        threshold: thresholds.oldestPendingAge.critical,
      });
    } else if (
      snapshot.oldestPendingAge &&
      snapshot.oldestPendingAge > thresholds.oldestPendingAge.warning
    ) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'queue_operations',
        title: 'Oldest pending request too old',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} oldest pending: ${(
          snapshot.oldestPendingAge / 60
        ).toFixed(1)} minutes`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.oldestPendingAge,
        threshold: thresholds.oldestPendingAge.warning,
      });
    }

    // Stale worker heartbeat
    if (snapshot.workerHeartbeatStale) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'queue_operations',
        title: 'Worker heartbeat stale',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} worker heartbeat is stale`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
      });
    }

    // Recovery count spike
    if (snapshot.recoveryCount && snapshot.recoveryCount > thresholds.recoveryCount.warning) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'queue_operations',
        title: 'Recovery count spike detected',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} had ${snapshot.recoveryCount} recoveries in 10m`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.recoveryCount,
        threshold: thresholds.recoveryCount.warning,
      });
    }
  }

  /**
   * Check performance alerts
   */
  private async checkPerformanceAlerts(
    snapshot: MetricSnapshot,
    thresholds: any,
    notifier: any
  ): Promise<void> {
    // P99 processing duration
    if (
      snapshot.processingDurationP99 &&
      snapshot.processingDurationP99 > thresholds.processingDuration.p99Critical
    ) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'performance',
        title: 'P99 processing duration critical',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} P99 duration: ${snapshot.processingDurationP99.toFixed(
          0
        )}ms (threshold: ${thresholds.processingDuration.p99Critical}ms)`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.processingDurationP99,
        threshold: thresholds.processingDuration.p99Critical,
      });
    } else if (
      snapshot.processingDurationP95 &&
      snapshot.processingDurationP95 > thresholds.processingDuration.p95Warning
    ) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'performance',
        title: 'P95 processing duration high',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} P95 duration: ${snapshot.processingDurationP95.toFixed(
          0
        )}ms`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.processingDurationP95,
        threshold: thresholds.processingDuration.p95Warning,
      });
    }

    // P99 queue wait
    if (snapshot.queueWaitP99 && snapshot.queueWaitP99 > thresholds.queueWait.p99Critical) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'performance',
        title: 'P99 queue wait time critical',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} P99 wait: ${snapshot.queueWaitP99.toFixed(
          0
        )}ms`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.queueWaitP99,
        threshold: thresholds.queueWait.p99Critical,
      });
    } else if (snapshot.queueWaitP95 && snapshot.queueWaitP95 > thresholds.queueWait.p95Warning) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'performance',
        title: 'P95 queue wait time high',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} P95 wait: ${snapshot.queueWaitP95.toFixed(
          0
        )}ms`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.queueWaitP95,
        threshold: thresholds.queueWait.p95Warning,
      });
    }
  }

  /**
   * Check financial integrity alerts
   */
  private async checkFinancialIntegrityAlerts(
    snapshot: MetricSnapshot,
    thresholds: any,
    notifier: any
  ): Promise<void> {
    // Ledger mismatch
    if (snapshot.ledgerMismatch) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'financial_integrity',
        title: 'CRITICAL: Ledger mismatch detected',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} ledger mismatch. Immediate investigation required.`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
      });
    }

    // Failed purchases spike
    if (snapshot.failedPurchases && snapshot.failedPurchases > thresholds.failedPurchases.warning) {
      await this.triggerAlert(notifier, {
        severity: 'warning',
        category: 'financial_integrity',
        title: 'Failed purchases spike',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} had ${snapshot.failedPurchases} failed purchases in 10m`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.failedPurchases,
        threshold: thresholds.failedPurchases.warning,
      });
    }

    // Failed purchase rate critical
    if (
      snapshot.failedPurchases &&
      snapshot.totalPurchases &&
      snapshot.totalPurchases > 0 &&
      snapshot.failedPurchases / snapshot.totalPurchases > thresholds.failedPurchases.criticalRate
    ) {
      await this.triggerAlert(notifier, {
        severity: 'critical',
        category: 'financial_integrity',
        title: 'Failed purchase rate critical',
        description: `Account ${snapshot.providerId}/${snapshot.distributorId} failure rate: ${(
          (snapshot.failedPurchases / snapshot.totalPurchases) *
          100
        ).toFixed(1)}%`,
        timestamp: snapshot.timestamp,
        labels: {
          provider_id: snapshot.providerId,
          distributor_id: snapshot.distributorId,
        },
        value: snapshot.failedPurchases / snapshot.totalPurchases,
        threshold: thresholds.failedPurchases.criticalRate,
      });
    }
  }

  /**
   * Trigger alert with cooldown to prevent spam
   */
  private async triggerAlert(notifier: any, alert: Alert): Promise<void> {
    const key = `${alert.category}:${alert.title}:${alert.labels?.provider_id}:${alert.labels?.distributor_id}`;
    const lastTime = this.previousAlerts.get(key) || 0;
    const now = Date.now();

    if (now - lastTime < this.alertCooldown) {
      return; // Still in cooldown
    }

    this.previousAlerts.set(key, now);
    await notifier.notify(alert);
  }
}

// Singleton instance
let alertChecker: AlertChecker | null = null;

export function getAlertChecker(): AlertChecker {
  if (!alertChecker) {
    alertChecker = new AlertChecker();
  }
  return alertChecker;
}
