/**
 * Purchases Router - tRPC procedures for purchase queue management
 * Final Hardening Phase
 */

import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getQueueManager } from '../queue-manager';
import { getQueueConfig, setAccountOverride, clearAccountOverride } from '../queue-config';

console.log('[PURCHASES-ROUTER] Module loading...');

console.log('[PURCHASES-ROUTER] Creating router...');

export const purchasesRouter = router({
  /**
   * Enqueue a purchase request
   */
  enqueue: publicProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        distributorId: z.number().int().positive(),
        productId: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      console.log('[PURCHASES-ENQUEUE] Request received:', input);
      const queueManager = getQueueManager();
      console.log('[PURCHASES-ENQUEUE] Queue manager obtained');
      console.log('[PURCHASES-ENQUEUE] Calling enqueueRequest...');
      const result = await queueManager.enqueueRequest(
        input.providerId,
        input.distributorId,
        input.productId,
        input.idempotencyKey
      );

      console.log('[PURCHASES-ENQUEUE] Result:', result);
      if (result.error) {
        console.log('[PURCHASES-ENQUEUE] Request rejected:', result.error);
        return {
          requestId: result.requestId,
          status: result.status,
          error: result.error,
          message: 'Request rejected due to queue capacity',
        };
      }

      console.log('[PURCHASES-ENQUEUE] Request accepted:', result.requestId);
      return {
        requestId: result.requestId,
        status: result.status,
        message: 'Purchase request queued. Check status endpoint for updates.',
      };
    }),

  /**
   * Get status of a purchase request
   */
  status: publicProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const queueManager = getQueueManager();
      const status = await queueManager.getRequestStatus(input.requestId);

      return {
        id: status.id,
        status: status.status,
        cardId: status.cardId,
        failureReason: status.failureReason,
        createdAt: status.createdAt,
        completedAt: status.completedAt,
      };
    }),

  /**
   * Get queue metrics with alerts and ledger verification
   */
  metrics: publicProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        distributorId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const queueManager = getQueueManager();
      const metrics = await queueManager.getMetrics(input.providerId, input.distributorId);

      return {
        // Queue status
        queueDepth: metrics.queueDepth,
        oldestPendingAge: metrics.oldestPendingAge,
        processingCount: metrics.processingCount,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
        // Latency metrics (percentiles)
        queueWaitP95: metrics.queueWaitP95,
        queueWaitP99: metrics.queueWaitP99,
        processingDurationP95: metrics.processingDurationP95,
        processingDurationP99: metrics.processingDurationP99,
        totalLatencyP95: metrics.totalLatencyP95,
        totalLatencyP99: metrics.totalLatencyP99,
        // Alert flags
        alerts: {
          queueDepthWarning: metrics.alerts.queueDepthWarning,
          queueDepthCritical: metrics.alerts.queueDepthCritical,
          processingTimeWarning: metrics.alerts.processingTimeWarning,
          processingTimeCritical: metrics.alerts.processingTimeCritical,
          ledgerMismatch: metrics.alerts.ledgerMismatch,
        },
        // Ledger verification
        ledger: {
          successfulPurchases: metrics.ledgerStatus.successfulPurchases,
          debitEntries: metrics.ledgerStatus.debitEntries,
          creditEntries: metrics.ledgerStatus.creditEntries,
          isCorrect: metrics.ledgerStatus.isCorrect,
        },
      };
    }),

  /**
   * Get queue configuration
   */
  config: publicProcedure
    .input(
      z.object({
        providerId: z.number().int().positive().optional(),
        distributorId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ input }) => {
      const config = getQueueConfig(input.providerId, input.distributorId);

      return {
        maxQueueDepth: config.maxQueueDepth,
        staleProcessingSeconds: config.staleProcessingSeconds,
        lockTimeoutSeconds: config.lockTimeoutSeconds,
        heartbeatIntervalSeconds: config.heartbeatIntervalSeconds,
        recoveryIntervalSeconds: config.recoveryIntervalSeconds,
        maxRecoveryAttempts: config.maxRecoveryAttempts,
        alertThresholds: {
          queueDepthWarning: config.alertThresholds.queueDepthWarning,
          queueDepthCritical: config.alertThresholds.queueDepthCritical,
          p95ProcessingWarningMs: config.alertThresholds.p95ProcessingWarningMs,
          p99ProcessingCriticalMs: config.alertThresholds.p99ProcessingCriticalMs,
        },
      };
    }),

  /**
   * Set per-account configuration override
   */
  setAccountConfig: publicProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        distributorId: z.number().int().positive(),
        maxQueueDepth: z.number().int().positive().optional(),
        staleProcessingSeconds: z.number().int().positive().optional(),
        lockTimeoutSeconds: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const override: any = {};
      if (input.maxQueueDepth) override.maxQueueDepth = input.maxQueueDepth;
      if (input.staleProcessingSeconds) override.staleProcessingSeconds = input.staleProcessingSeconds;
      if (input.lockTimeoutSeconds) override.lockTimeoutSeconds = input.lockTimeoutSeconds;

      setAccountOverride(input.providerId, input.distributorId, override);

      return {
        success: true,
        message: `Configuration override set for ${input.providerId}:${input.distributorId}`,
      };
    }),

  /**
   * Clear per-account configuration override
   */
  clearAccountConfig: publicProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        distributorId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      clearAccountOverride(input.providerId, input.distributorId);

      return {
        success: true,
        message: `Configuration override cleared for ${input.providerId}:${input.distributorId}`,
      };
    }),
});
