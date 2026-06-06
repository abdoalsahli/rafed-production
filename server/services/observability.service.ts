import { getRawDb } from "../db";

/**
 * Observability Service (Phase 16)
 * 
 * Implements production-grade observability with:
 * - Structured metrics tracking
 * - Structured logging
 * - Alert monitoring hooks
 */

export interface StructuredLog {
  timestamp: Date;
  level: "INFO" | "WARN" | "ERROR";
  requestId: string;
  correlationId: string;
  distributorId?: number;
  providerId?: number;
  webhookEventId?: string;
  retryAttempt?: number;
  message: string;
  metadata?: Record<string, any>;
}

export interface MetricsSnapshot {
  timestamp: Date;
  purchaseLatencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  queueLatencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  webhookLatencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  retryCount: number;
  deadLetterCount: number;
  failedPurchaseRate: number;
  webhookSuccessRate: number;
  rateLimitViolations: number;
}

export interface AlertCondition {
  name: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  condition: boolean;
  message: string;
  timestamp: Date;
}

export class ObservabilityService {
  /**
   * Record structured log entry
   */
  static async recordLog(log: StructuredLog): Promise<void> {
    const pool = await getRawDb();
    if (!pool) {
      console.error("Database connection not available for logging");
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        `INSERT INTO structured_logs
         (timestamp, level, request_id, correlation_id, distributor_id, provider_id,
          webhook_event_id, retry_attempt, message, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.timestamp,
          log.level,
          log.requestId,
          log.correlationId,
          log.distributorId || null,
          log.providerId || null,
          log.webhookEventId || null,
          log.retryAttempt || null,
          log.message,
          log.metadata ? JSON.stringify(log.metadata) : null,
        ]
      );
    } catch (error) {
      console.error("Failed to record log:", error);
    } finally {
      conn.release();
    }
  }

  /**
   * Record purchase latency metric
   */
  static async recordPurchaseLatency(
    distributorId: number,
    latencyMs: number,
    status: "success" | "failure"
  ): Promise<void> {
    const pool = await getRawDb();
    if (!pool) return;

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        `INSERT INTO metrics_purchase_latency
         (distributor_id, latency_ms, status, timestamp)
         VALUES (?, ?, ?, NOW())`,
        [distributorId, latencyMs, status]
      );
    } catch (error) {
      console.error("Failed to record purchase latency:", error);
    } finally {
      conn.release();
    }
  }

  /**
   * Record webhook latency metric
   */
  static async recordWebhookLatency(
    distributorId: number,
    latencyMs: number,
    status: "delivered" | "failed"
  ): Promise<void> {
    const pool = await getRawDb();
    if (!pool) return;

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        `INSERT INTO metrics_webhook_latency
         (distributor_id, latency_ms, status, timestamp)
         VALUES (?, ?, ?, NOW())`,
        [distributorId, latencyMs, status]
      );
    } catch (error) {
      console.error("Failed to record webhook latency:", error);
    } finally {
      conn.release();
    }
  }

  /**
   * Get current metrics snapshot
   */
  static async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    const pool = await getRawDb();
    if (!pool) throw new Error("Database connection not available");

    const conn = await pool.getConnection();
    try {
      // Failure rate
      const [failureRows] = await conn.execute(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failures
         FROM metrics_purchase_latency
         WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );

      const failureData = (failureRows[0] as any) || { total: 0, failures: 0 };
      const failedPurchaseRate =
        failureData.total > 0 ? failureData.failures / failureData.total : 0;

      // Webhook success rate
      const [webhookSuccessRows] = await conn.execute(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
         FROM metrics_webhook_latency
         WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );

      const webhookSuccessData = (webhookSuccessRows[0] as any) || {
        total: 0,
        delivered: 0,
      };
      const webhookSuccessRate =
        webhookSuccessData.total > 0
          ? webhookSuccessData.delivered / webhookSuccessData.total
          : 0;

      // Dead letter count
      const [dlqRows] = await conn.execute(
        `SELECT COUNT(*) as count FROM webhook_events
         WHERE delivery_status = 'FAILED_DELIVERY'
         AND updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );

      const dlqCount = ((dlqRows[0] as any)?.count || 0) as number;

      // Rate limit violations
      const [rateLimitRows] = await conn.execute(
        `SELECT COUNT(*) as count FROM rate_limit_events
         WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );

      const rateLimitViolations = ((rateLimitRows[0] as any)?.count || 0) as number;

      return {
        timestamp: new Date(),
        purchaseLatencyMs: {
          p50: 0,
          p95: 0,
          p99: 0,
        },
        queueLatencyMs: {
          p50: 0,
          p95: 0,
          p99: 0,
        },
        webhookLatencyMs: {
          p50: 0,
          p95: 0,
          p99: 0,
        },
        retryCount: 0,
        deadLetterCount: dlqCount,
        failedPurchaseRate,
        webhookSuccessRate,
        rateLimitViolations,
      };
    } finally {
      conn.release();
    }
  }

  /**
   * Check alert conditions
   */
  static async checkAlerts(): Promise<AlertCondition[]> {
    const alerts: AlertCondition[] = [];
    const metrics = await this.getMetricsSnapshot();

    if (metrics.failedPurchaseRate > 0.05) {
      alerts.push({
        name: "HIGH_PURCHASE_FAILURE_RATE",
        severity: "HIGH",
        condition: true,
        message: `Purchase failure rate is ${(metrics.failedPurchaseRate * 100).toFixed(2)}%`,
        timestamp: new Date(),
      });
    }

    if (metrics.deadLetterCount > 100) {
      alerts.push({
        name: "DEAD_LETTER_SPIKE",
        severity: "CRITICAL",
        condition: true,
        message: `Dead letter queue has ${metrics.deadLetterCount} messages`,
        timestamp: new Date(),
      });
    }

    if (metrics.webhookSuccessRate < 0.95) {
      alerts.push({
        name: "WEBHOOK_OUTAGE",
        severity: "HIGH",
        condition: true,
        message: `Webhook success rate is ${(metrics.webhookSuccessRate * 100).toFixed(2)}%`,
        timestamp: new Date(),
      });
    }

    if (metrics.rateLimitViolations > 1000) {
      alerts.push({
        name: "RATE_LIMIT_VIOLATIONS",
        severity: "MEDIUM",
        condition: true,
        message: `${metrics.rateLimitViolations} rate limit violations in last hour`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Get logs for debugging
   */
  static async getLogs(
    correlationId: string,
    limit: number = 100
  ): Promise<StructuredLog[]> {
    const pool = await getRawDb();
    if (!pool) throw new Error("Database connection not available");

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT * FROM structured_logs
         WHERE correlation_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [correlationId, limit]
      );

      return (rows as any[]).map((row) => ({
        timestamp: new Date(row.timestamp),
        level: row.level,
        requestId: row.request_id,
        correlationId: row.correlation_id,
        distributorId: row.distributor_id,
        providerId: row.provider_id,
        webhookEventId: row.webhook_event_id,
        retryAttempt: row.retry_attempt,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } finally {
      conn.release();
    }
  }
}
