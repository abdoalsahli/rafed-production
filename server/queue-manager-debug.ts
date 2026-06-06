/**
 * Queue Manager Debug - Explicit Error Surfacing
 * Tests initialization chain with detailed logging
 */

import { getDb } from './db';
import { getQueueConfig } from './queue-config';

console.log('[QUEUE-MANAGER-DEBUG] Module loading started');

let dbReady = false;
let queueManagerReady = false;
let initError: Error | null = null;

/**
 * Test DB initialization
 */
export async function testDbInitialization(): Promise<boolean> {
  try {
    console.log('[QUEUE-MANAGER-DEBUG] Testing DB initialization...');
    const db = await getDb();
    if (!db) {
      throw new Error('getDb() returned null/undefined');
    }
    console.log('[QUEUE-MANAGER-DEBUG] ✓ DB initialized successfully');
    dbReady = true;
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[QUEUE-MANAGER-DEBUG] ✗ DB initialization failed:', err.message);
    console.error('[QUEUE-MANAGER-DEBUG] Stack:', err.stack);
    initError = err;
    return false;
  }
}

/**
 * Test queue config loading
 */
export function testQueueConfigLoading(): boolean {
  try {
    console.log('[QUEUE-MANAGER-DEBUG] Testing queue config loading...');
    const config = getQueueConfig();
    console.log('[QUEUE-MANAGER-DEBUG] ✓ Queue config loaded:', {
      maxQueueDepth: config.maxQueueDepth,
      staleProcessingSeconds: config.staleProcessingSeconds,
      lockTimeoutSeconds: config.lockTimeoutSeconds,
    });
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[QUEUE-MANAGER-DEBUG] ✗ Queue config loading failed:', err.message);
    console.error('[QUEUE-MANAGER-DEBUG] Stack:', err.stack);
    initError = err;
    return false;
  }
}

/**
 * Get initialization status
 */
export function getInitializationStatus() {
  return {
    dbReady,
    queueManagerReady,
    initError: initError ? { message: initError.message, stack: initError.stack } : null,
  };
}

/**
 * Initialize queue manager
 */
export async function initializeQueueManager(): Promise<boolean> {
  try {
    console.log('[QUEUE-MANAGER-DEBUG] Initializing queue manager...');

    // Test DB
    const dbOk = await testDbInitialization();
    if (!dbOk) {
      throw new Error('DB initialization failed');
    }

    // Test config
    const configOk = testQueueConfigLoading();
    if (!configOk) {
      throw new Error('Queue config loading failed');
    }

    console.log('[QUEUE-MANAGER-DEBUG] ✓ Queue manager initialized successfully');
    queueManagerReady = true;
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[QUEUE-MANAGER-DEBUG] ✗ Queue manager initialization failed:', err.message);
    console.error('[QUEUE-MANAGER-DEBUG] Stack:', err.stack);
    initError = err;
    throw err;
  }
}

console.log('[QUEUE-MANAGER-DEBUG] Module loaded');
