/**
 * Error Handler & Graceful Shutdown
 * Prevents unhandled errors from crashing the server
 */

import { connectionPoolManager } from './connection-pool';
import { metricsCache } from './metrics-cache';

let isShuttingDown = false;

/**
 * Setup global error handlers
 */
export function setupErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[ERROR-HANDLER] Uncaught Exception:', error);
    gracefulShutdown(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR-HANDLER] Unhandled Rejection:', reason);
    console.error('[ERROR-HANDLER] Promise:', promise);
  });

  // Handle SIGTERM and SIGINT
  process.on('SIGTERM', () => {
    console.log('[ERROR-HANDLER] SIGTERM received, shutting down gracefully');
    gracefulShutdown(0);
  });

  process.on('SIGINT', () => {
    console.log('[ERROR-HANDLER] SIGINT received, shutting down gracefully');
    gracefulShutdown(0);
  });
}

/**
 * Graceful shutdown
 */
export async function gracefulShutdown(exitCode: number = 0): Promise<void> {
  if (isShuttingDown) {
    console.log('[ERROR-HANDLER] Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  console.log('[ERROR-HANDLER] Starting graceful shutdown...');

  try {
    // Stop accepting new requests
    console.log('[ERROR-HANDLER] Stopping request acceptance');

    // Close metrics cache
    console.log('[ERROR-HANDLER] Clearing metrics cache');
    metricsCache.clear();

    // Close database connections
    console.log('[ERROR-HANDLER] Closing database connections');
    await connectionPoolManager.shutdown();

    console.log('[ERROR-HANDLER] Graceful shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    console.error('[ERROR-HANDLER] Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('[ERROR-HANDLER] Error in wrapped function:', error);
      throw error;
    }
  };
}

/**
 * Wrap Express middleware with error handling
 */
export function withMiddlewareErrorHandling(
  middleware: (req: any, res: any, next: any) => void | Promise<void>
) {
  return async (req: any, res: any, next: any) => {
    try {
      await middleware(req, res, next);
    } catch (error) {
      console.error('[ERROR-HANDLER] Middleware error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
