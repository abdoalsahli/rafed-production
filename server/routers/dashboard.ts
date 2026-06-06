/**
 * Dashboard Data Endpoints
 * Read-only endpoints for operations dashboard
 * Admin-only access
 */

import { router, adminProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getQueueConfig } from '../queue-config';
import * as queueSql from '../queue-sql';

export const dashboardRouter = router({
  /**
   * Get queue health for a specific account
   */
  queueHealth: adminProcedure
    .input(
      z.object({
        providerId: z.number(),
        distributorId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const queueDepth = await queueSql.countQueueDepth(
        input.providerId,
        input.distributorId
      );
      const processingCount = await queueSql.countProcessingRequests(
        input.providerId,
        input.distributorId
      );
      const oldestPendingAge = await queueSql.getOldestPendingAge(
        input.providerId,
        input.distributorId
      );
      const lockHeld = await queueSql.isAccountLockHeld(
        input.providerId,
        input.distributorId
      );
      const heartbeat = queueSql.getWorkerHeartbeat(
        input.providerId,
        input.distributorId
      );
      const isStale = queueSql.isHeartbeatStale(
        input.providerId,
        input.distributorId
      );

      return {
        queueDepth: queueDepth || 0,
        processingCount: processingCount || 0,
        oldestPendingAgeSeconds: oldestPendingAge || 0,
        workerHeartbeatStale: isStale,
        lockHeld: lockHeld,
        lastWorkerInstanceId: heartbeat?.workerId || null,
        lastHeartbeatAt: heartbeat?.lastHeartbeatAt ? new Date(heartbeat.lastHeartbeatAt) : null,
      };
    }),

  /**
   * Get performance metrics for a specific account
   */
  performanceMetrics: adminProcedure
    .input(
      z.object({
        providerId: z.number(),
        distributorId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const latency = await queueSql.getQueueLatencyMetrics(
        input.providerId,
        input.distributorId
      );
      const successCount = await queueSql.countSucceededRequests(
        input.providerId,
        input.distributorId
      );
      const failureCount = await queueSql.countFailedRequests(
        input.providerId,
        input.distributorId
      );

      return {
        queueWait: {
          p50Ms: latency?.queueWaitP50 || 0,
          p95Ms: latency?.queueWaitP95 || 0,
          p99Ms: latency?.queueWaitP99 || 0,
        },
        processingDuration: {
          p50Ms: latency?.processingDurationP50 || 0,
          p95Ms: latency?.processingDurationP95 || 0,
          p99Ms: latency?.processingDurationP99 || 0,
        },
        totalLatency: {
          p50Ms: 0,
          p95Ms: latency?.totalLatencyP95 || 0,
          p99Ms: latency?.totalLatencyP99 || 0,
        },
        successCount: successCount || 0,
        failureCount: failureCount || 0,
        recoveryCount: 0,
      };
    }),

  /**
   * Get financial integrity status
   */
  financialIntegrity: adminProcedure
    .input(
      z.object({
        providerId: z.number(),
        distributorId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        const integrity = await queueSql.verifyLedgerCorrectness(
          input.providerId,
          input.distributorId
        );

        return {
          isCorrect: integrity?.isCorrect || false,
          successfulPurchases: integrity?.successfulPurchases || 0,
          purchaseDebitCount: integrity?.debitEntries || 0,
          commissionCreditCount: integrity?.creditEntries || 0,
          mismatchFlag: !integrity?.isCorrect,
          lastVerifiedAt: new Date(),
        };
      } catch (error) {
        console.error('Financial integrity check failed:', error);
        return {
          isCorrect: false,
          successfulPurchases: 0,
          purchaseDebitCount: 0,
          commissionCreditCount: 0,
          mismatchFlag: true,
          lastVerifiedAt: new Date(),
        };
      }
    }),

  /**
   * Get alert status
   */
  alertStatus: adminProcedure
    .input(
      z.object({
        providerId: z.number(),
        distributorId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        const config = getQueueConfig(input.providerId, input.distributorId);
        const queueDepth = await queueSql.countQueueDepth(
          input.providerId,
          input.distributorId
        );
        const latency = await queueSql.getQueueLatencyMetrics(
          input.providerId,
          input.distributorId
        );
        const integrity = await queueSql.verifyLedgerCorrectness(
          input.providerId,
          input.distributorId
        );

        const alerts: any[] = [];

        // Queue depth warnings
        if ((queueDepth || 0) > config.alertThresholds.queueDepthCritical) {
          alerts.push({
            level: 'critical',
            type: 'queue_depth_critical',
            message: `Queue depth ${queueDepth} exceeds critical threshold ${config.alertThresholds.queueDepthCritical}`,
          });
        } else if ((queueDepth || 0) > config.alertThresholds.queueDepthWarning) {
          alerts.push({
            level: 'warning',
            type: 'queue_depth_warning',
            message: `Queue depth ${queueDepth} exceeds warning threshold ${config.alertThresholds.queueDepthWarning}`,
          });
        }

        // Processing duration warnings
        if ((latency?.processingDurationP99 || 0) > config.alertThresholds.p99ProcessingCriticalMs) {
          alerts.push({
            level: 'critical',
            type: 'processing_duration_critical',
            message: `P99 processing duration ${latency?.processingDurationP99}ms exceeds critical threshold`,
          });
        } else if ((latency?.processingDurationP95 || 0) > config.alertThresholds.p95ProcessingWarningMs) {
          alerts.push({
            level: 'warning',
            type: 'processing_duration_warning',
            message: `P95 processing duration ${latency?.processingDurationP95}ms exceeds warning threshold`,
          });
        }

        // Ledger mismatch
        if (!integrity?.isCorrect) {
          alerts.push({
            level: 'critical',
            type: 'ledger_mismatch',
            message: `Ledger mismatch detected: ${integrity?.successfulPurchases} purchases but ${integrity?.debitEntries} debits and ${integrity?.creditEntries} credits`,
          });
        }

        return {
          alerts,
          hasWarnings: alerts.some(a => a.level === 'warning'),
          hasCritical: alerts.some(a => a.level === 'critical'),
        };
      } catch (error) {
        console.error('Alert status check failed:', error);
        return {
          alerts: [{
            level: 'critical',
            type: 'system_error',
            message: 'Failed to check alert status',
          }],
          hasWarnings: false,
          hasCritical: true,
        };
      }
    }),

  /**
   * Get time-series data for charts (placeholder)
   */
  timeSeries: adminProcedure
    .input(
      z.object({
        providerId: z.number(),
        distributorId: z.number(),
        metric: z.enum(['queue_depth', 'processing_duration', 'success_rate']),
        intervalMinutes: z.number().default(5),
        hoursBack: z.number().default(24),
      })
    )
    .query(async ({ input }) => {
      // TODO: Implement time-series data collection
      // For now, return empty array
      return [];
    }),

  /**
   * Get configuration for an account
   */
  accountConfig: adminProcedure
    .input(
      z.object({
        providerId: z.number(),
        distributorId: z.number(),
      })
    )
    .query(({ input }) => {
      const config = getQueueConfig(input.providerId, input.distributorId);
      return config;
    }),
});
