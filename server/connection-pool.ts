/**
 * Connection Pool Manager
 * Manages database connections and resources with proper cleanup
 */

import { Pool } from 'mysql2/promise';
import { getDb } from './db';

interface PoolStats {
  activeConnections: number;
  waitingConnections: number;
  totalConnections: number;
  maxConnections: number;
}

class ConnectionPoolManager {
  private pool: Pool | null = null;
  private activeConnections = new Set<any>();
  private maxConnections = 50;
  private connectionTimeout = 30000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      const db = await getDb();
      if (db && 'pool' in db) {
        this.pool = (db as any).pool;
        console.log('[CONNECTION-POOL] Pool initialized');
        
        // Start cleanup interval
        this.startCleanupInterval();
      }
    } catch (error) {
      console.error('[CONNECTION-POOL] Failed to initialize pool:', error);
    }
  }

  /**
   * Get a connection from the pool with timeout
   */
  async getConnection(): Promise<any> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    try {
      const connection = await Promise.race([
        this.pool.getConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        ),
      ]);

      this.activeConnections.add(connection);
      return connection;
    } catch (error) {
      console.error('[CONNECTION-POOL] Failed to get connection:', error);
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(connection: any): Promise<void> {
    if (!connection) return;

    try {
      this.activeConnections.delete(connection);
      await connection.release();
    } catch (error) {
      console.error('[CONNECTION-POOL] Failed to release connection:', error);
      try {
        await connection.destroy();
      } catch (destroyError) {
        console.error('[CONNECTION-POOL] Failed to destroy connection:', destroyError);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return {
      activeConnections: this.activeConnections.size,
      waitingConnections: this.pool ? (this.pool as any)._connectionQueue?.length || 0 : 0,
      totalConnections: this.pool ? (this.pool as any).pool?.length || 0 : 0,
      maxConnections: this.maxConnections,
    };
  }

  /**
   * Start periodic cleanup of stale connections
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const stats = this.getStats();
      
      if (stats.activeConnections > this.maxConnections * 0.8) {
        console.warn(
          `[CONNECTION-POOL] High connection usage: ${stats.activeConnections}/${this.maxConnections}`
        );
      }

      // Log stats periodically
      if (stats.activeConnections > 0) {
        console.debug('[CONNECTION-POOL] Stats:', stats);
      }
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all active connections
    const connections = Array.from(this.activeConnections);
    for (const connection of connections) {
      try {
        await this.releaseConnection(connection);
      } catch (error) {
        console.error('[CONNECTION-POOL] Error during shutdown:', error);
      }
    }

    if (this.pool) {
      try {
        await this.pool.end();
        console.log('[CONNECTION-POOL] Pool closed');
      } catch (error) {
        console.error('[CONNECTION-POOL] Error closing pool:', error);
      }
    }
  }
}

export const connectionPoolManager = new ConnectionPoolManager();

/**
 * Wrapper for safe connection usage with automatic cleanup
 */
export async function withConnection<T>(
  callback: (connection: any) => Promise<T>
): Promise<T> {
  const connection = await connectionPoolManager.getConnection();
  try {
    return await callback(connection);
  } finally {
    await connectionPoolManager.releaseConnection(connection);
  }
}

/**
 * Wrapper for safe transaction usage
 */
export async function withTransaction<T>(
  callback: (connection: any) => Promise<T>
): Promise<T> {
  return withConnection(async (connection) => {
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}
