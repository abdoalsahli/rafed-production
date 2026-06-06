import { getRawDb } from "../db";

/**
 * Rate Limiter Service (Phase 15)
 * 
 * Implements distributor API protection with:
 * - Request throttling (60 req/min per distributor)
 * - Burst protection
 * - Webhook replay protection
 * - Queue flooding prevention
 */

export enum RateLimitEndpoint {
  PRODUCTS = "products",
  PURCHASES = "purchases",
  POLLING = "polling",
  WEBHOOK_REPLAY = "webhook_replay",
}

/**
 * Rate limit configuration (requests per minute)
 */
const RATE_LIMITS: Record<RateLimitEndpoint, number> = {
  [RateLimitEndpoint.PRODUCTS]: 60,
  [RateLimitEndpoint.PURCHASES]: 60,
  [RateLimitEndpoint.POLLING]: 120,
  [RateLimitEndpoint.WEBHOOK_REPLAY]: 30,
};

/**
 * Burst protection: allow 20% burst over 1 minute limit
 */
const BURST_MULTIPLIER = 1.2;

/**
 * Rate limit window in seconds
 */
const RATE_LIMIT_WINDOW = 60;

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
}

export class RateLimiterService {
  /**
   * Check if request should be allowed
   */
  static async checkRateLimit(
    distributorId: number,
    endpoint: RateLimitEndpoint
  ): Promise<RateLimitCheckResult> {
    const pool = await getRawDb();
    if (!pool) throw new Error("Database connection not available");

    const limit = RATE_LIMITS[endpoint];
    const burstLimit = Math.ceil(limit * BURST_MULTIPLIER);
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW * 1000);

    const conn = await pool.getConnection();
    try {
      await conn.execute("START TRANSACTION");

      // Count requests in current window
      const [rows] = await conn.execute(
        `SELECT COUNT(*) as count FROM rate_limit_events
         WHERE distributor_id = ? AND endpoint = ? AND timestamp > ?
         FOR UPDATE`,
        [distributorId, endpoint, windowStart]
      );

      const count = (rows[0] as any).count || 0;
      const allowed = count < burstLimit;
      const remaining = Math.max(0, burstLimit - count);

      if (allowed) {
        await conn.execute(
          `INSERT INTO rate_limit_events (distributor_id, endpoint, timestamp)
           VALUES (?, ?, ?)`,
          [distributorId, endpoint, now]
        );
      }

      await conn.execute("COMMIT");

      const resetAt = new Date(
        windowStart.getTime() + RATE_LIMIT_WINDOW * 1000
      );
      const retryAfter = allowed
        ? undefined
        : Math.ceil((resetAt.getTime() - now.getTime()) / 1000);

      return {
        allowed,
        remaining,
        limit: burstLimit,
        resetAt,
        retryAfter,
      };
    } catch (error) {
      await conn.execute("ROLLBACK");
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Check webhook replay rate limit
   */
  static async checkWebhookReplayLimit(
    distributorId: number
  ): Promise<RateLimitCheckResult> {
    return this.checkRateLimit(distributorId, RateLimitEndpoint.WEBHOOK_REPLAY);
  }

  /**
   * Check purchase endpoint rate limit
   */
  static async checkPurchaseLimit(
    distributorId: number
  ): Promise<RateLimitCheckResult> {
    return this.checkRateLimit(distributorId, RateLimitEndpoint.PURCHASES);
  }

  /**
   * Check products endpoint rate limit
   */
  static async checkProductsLimit(
    distributorId: number
  ): Promise<RateLimitCheckResult> {
    return this.checkRateLimit(distributorId, RateLimitEndpoint.PRODUCTS);
  }

  /**
   * Check polling endpoint rate limit
   */
  static async checkPollingLimit(
    distributorId: number
  ): Promise<RateLimitCheckResult> {
    return this.checkRateLimit(distributorId, RateLimitEndpoint.POLLING);
  }

  /**
   * Get current rate limit status for distributor
   */
  static async getDistributorStatus(
    distributorId: number
  ): Promise<Record<RateLimitEndpoint, RateLimitCheckResult>> {
    const results: Record<RateLimitEndpoint, RateLimitCheckResult> = {} as any;

    for (const endpoint of Object.values(RateLimitEndpoint)) {
      results[endpoint] = await this.checkRateLimit(distributorId, endpoint);
    }

    return results;
  }

  /**
   * Reset rate limit for distributor (admin only)
   */
  static async resetDistributorLimits(distributorId: number): Promise<void> {
    const pool = await getRawDb();
    if (!pool) throw new Error("Database connection not available");

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        `DELETE FROM rate_limit_events WHERE distributor_id = ?`,
        [distributorId]
      );
    } finally {
      conn.release();
    }
  }

  /**
   * Clean up old rate limit events (called periodically)
   */
  static async cleanupOldEvents(): Promise<number> {
    const pool = await getRawDb();
    if (!pool) throw new Error("Database connection not available");

    const conn = await pool.getConnection();
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [result] = await conn.execute(
        `DELETE FROM rate_limit_events WHERE timestamp < ?`,
        [oneHourAgo]
      );

      return (result as any).affectedRows || 0;
    } finally {
      conn.release();
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  static async getStatistics(): Promise<{
    totalEvents: number;
    distributorsRateLimited: number;
    topDistributors: Array<{
      distributorId: number;
      requestCount: number;
      endpoints: Record<string, number>;
    }>;
  }> {
    const pool = await getRawDb();
    if (!pool) throw new Error("Database connection not available");

    const conn = await pool.getConnection();
    try {
      // Total events
      const [totalRows] = await conn.execute(
        `SELECT COUNT(*) as count FROM rate_limit_events
         WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );
      const totalEvents = (totalRows[0] as any).count || 0;

      // Distributors currently rate limited
      const [limitedRows] = await conn.execute(
        `SELECT DISTINCT distributor_id FROM rate_limit_events
         WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
         GROUP BY distributor_id
         HAVING COUNT(*) >= 72`
      );
      const distributorsRateLimited = (limitedRows as any).length || 0;

      // Top distributors by request count
      const [topRows] = await conn.execute(
        `SELECT distributor_id, endpoint, COUNT(*) as count
         FROM rate_limit_events
         WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
         GROUP BY distributor_id, endpoint
         ORDER BY count DESC
         LIMIT 10`
      );

      const topDistributors: Record<number, any> = {};
      for (const row of topRows as any[]) {
        if (!topDistributors[row.distributor_id]) {
          topDistributors[row.distributor_id] = {
            distributorId: row.distributor_id,
            requestCount: 0,
            endpoints: {},
          };
        }
        topDistributors[row.distributor_id].requestCount += row.count;
        topDistributors[row.distributor_id].endpoints[row.endpoint] = row.count;
      }

      return {
        totalEvents,
        distributorsRateLimited,
        topDistributors: Object.values(topDistributors),
      };
    } finally {
      conn.release();
    }
  }
}
