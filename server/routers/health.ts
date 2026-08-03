/**
 * Health Check Router - Debugging tRPC initialization
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { getInitializationStatus, initializeQueueManager } from '../queue-manager-debug';

export const healthRouter = router({
  /**
   * Root health check
   */
  root: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Root health check passed',
    };
  }),

  /**
   * Queue manager initialization status
   */
  queueManager: protectedProcedure.query(() => {
    const status = getInitializationStatus();
    return {
      dbReady: status.dbReady,
      queueManagerReady: status.queueManagerReady,
      error: status.initError,
    };
  }),

  /**
   * Initialize queue manager on demand
   */
  initializeQueueManager: protectedProcedure.mutation(async () => {
    try {
      const success = await initializeQueueManager();
      return {
        success,
        message: 'Queue manager initialized',
        status: getInitializationStatus(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        status: getInitializationStatus(),
      };
    }
  }),
});
