/**
 * Alert Integration
 * Integrates alert checking into the metrics collection loop
 * Runs periodically to evaluate metrics and trigger alerts
 */

import { getAlertChecker, MetricSnapshot } from './alert-checker';
import { collectAllMetrics, QueueMetrics } from './metrics';
import { connectionPoolManager } from './connection-pool';

export interface AlertIntegrationConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  accounts?: Array<{
    providerId: string;
    distributorId: string;
  }>;
}

class AlertIntegration {
  private config: AlertIntegrationConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: AlertIntegrationConfig) {
    this.config = config;
  }

  /**
   * Start the alert checking loop
   */
  start(): void {
    if (this.isRunning) {
      console.log('[ALERT-INTEGRATION] Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[ALERT-INTEGRATION] Disabled, skipping start');
      return;
    }

    this.isRunning = true;
    console.log(
      `[ALERT-INTEGRATION] Starting alert checks every ${this.config.checkInterval}ms`
    );

    // Run immediately, then periodically
    this.runCheck();
    this.checkInterval = setInterval(() => this.runCheck(), this.config.checkInterval);
  }

  /**
   * Stop the alert checking loop
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[ALERT-INTEGRATION] Stopped');
  }

  /**
   * Run a single check cycle
   */
  private async runCheck(): Promise<void> {
    try {
      const checker = getAlertChecker();

      // Get infrastructure metrics
      const infra = await this.getInfrastructureMetrics();

      // Get queue metrics for each account
      const allMetrics = await collectAllMetrics();

      for (const [accountKey, queueMetrics] of Array.from(allMetrics.entries())) {
        try {
          const [providerId, distributorId] = accountKey.split(':');

          const snapshot: MetricSnapshot = {
            timestamp: Date.now(),
            providerId,
            distributorId,
            ...infra,
            queueDepth: queueMetrics.queueDepth,
            oldestPendingAge: queueMetrics.oldestPendingAgeSeconds,
            workerHeartbeatStale: queueMetrics.workerHeartbeatStale,
            recoveryCount: queueMetrics.recoveryCount,
            processingDurationP95: queueMetrics.latencyMetrics.processingDurationP95,
            processingDurationP99: queueMetrics.latencyMetrics.processingDurationP99,
            queueWaitP95: queueMetrics.latencyMetrics.queueWaitP95,
            queueWaitP99: queueMetrics.latencyMetrics.queueWaitP99,
            ledgerMismatch: !queueMetrics.ledgerVerification.isCorrect,
            failedPurchases: queueMetrics.failureCount,
            totalPurchases: queueMetrics.successCount + queueMetrics.failureCount,
          };

          await checker.checkMetrics(snapshot);
        } catch (error) {
          console.error(
            `[ALERT-INTEGRATION] Error checking metrics for ${accountKey}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('[ALERT-INTEGRATION] Error during check cycle:', error);
    }
  }

  /**
   * Get infrastructure metrics
   */
  private async getInfrastructureMetrics(): Promise<Partial<MetricSnapshot>> {
    try {
      const memUsage = process.memoryUsage();

      return {
        memoryUsage: memUsage.rss,
      };
    } catch (error) {
      console.error('[ALERT-INTEGRATION] Error getting infrastructure metrics:', error);
      return {};
    }
  }

  /**
   * Get list of active accounts
   */
  private async getActiveAccounts(): Promise<
    Array<{ providerId: string; distributorId: string }>
  > {
    // This would query the database to get active accounts
    // For now, return empty array - should be implemented based on schema
    return [];
  }
}

// Singleton instance
let alertIntegration: AlertIntegration | null = null;

export function initializeAlertIntegration(config: AlertIntegrationConfig): AlertIntegration {
  alertIntegration = new AlertIntegration(config);
  return alertIntegration;
}

export function getAlertIntegration(): AlertIntegration {
  if (!alertIntegration) {
    throw new Error('Alert integration not initialized. Call initializeAlertIntegration first.');
  }
  return alertIntegration;
}

export function startAlertChecking(): void {
  const integration = getAlertIntegration();
  integration.start();
}

export function stopAlertChecking(): void {
  const integration = getAlertIntegration();
  integration.stop();
}
