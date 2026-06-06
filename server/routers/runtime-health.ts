/**
 * Runtime Health Router
 * tRPC procedures for runtime health metrics
 * Admin-only access
 */

import { router, adminProcedure } from '../_core/trpc';
import { collectRuntimeHealth } from '../runtime-health';

export const runtimeHealthRouter = router({
  /**
   * Get complete runtime health snapshot
   */
  getRuntimeHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting runtime health:', error);
      return {
        success: false,
        error: 'Failed to collect runtime health',
      };
    }
  }),

  /**
   * Get memory health specifically
   */
  getMemoryHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health.memory,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting memory health:', error);
      return {
        success: false,
        error: 'Failed to collect memory health',
      };
    }
  }),

  /**
   * Get connection pool health specifically
   */
  getConnectionPoolHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health.connectionPool,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting connection pool health:', error);
      return {
        success: false,
        error: 'Failed to collect connection pool health',
      };
    }
  }),

  /**
   * Get cache health specifically
   */
  getCacheHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health.cache,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting cache health:', error);
      return {
        success: false,
        error: 'Failed to collect cache health',
      };
    }
  }),

  /**
   * Get worker health specifically
   */
  getWorkerHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health.worker,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting worker health:', error);
      return {
        success: false,
        error: 'Failed to collect worker health',
      };
    }
  }),

  /**
   * Get error health specifically
   */
  getErrorHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health.error,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting error health:', error);
      return {
        success: false,
        error: 'Failed to collect error health',
      };
    }
  }),

  /**
   * Get process health specifically
   */
  getProcessHealth: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();
      return {
        success: true,
        data: health.process,
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting process health:', error);
      return {
        success: false,
        error: 'Failed to collect process health',
      };
    }
  }),

  /**
   * Get health summary (quick overview)
   */
  getHealthSummary: adminProcedure.query(async () => {
    try {
      const health = collectRuntimeHealth();

      return {
        success: true,
        data: {
          timestamp: health.timestamp,
          memoryStatus: health.memory.heapUsedPercent > 80 ? 'warning' : 'healthy',
          heapUsedPercent: health.memory.heapUsedPercent,
          poolStatus:
            health.connectionPool.saturationPercent > 80 ? 'warning' : 'healthy',
          poolSaturation: health.connectionPool.saturationPercent,
          errorCount24h: health.error.errorCount24h,
          errorRate: health.error.errorRate,
          uptime: health.process.uptime,
          eventLoopLag: health.process.eventLoopLag,
        },
      };
    } catch (error) {
      console.error('[HEALTH-ROUTER] Error collecting health summary:', error);
      return {
        success: false,
        error: 'Failed to collect health summary',
      };
    }
  }),
});
