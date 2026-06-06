import { Decimal } from "decimal.js";
import { monitoringAlerts } from "../../drizzle/schema";
import { eq, and, gte } from "drizzle-orm";

/**
 * AlertService - Alert creation and management
 * 
 * Handles:
 * - Alert creation with severity levels
 * - Alert querying and filtering
 * - Alert resolution workflow
 * 
 * CRITICAL: Alerts are immutable. Resolution is tracked via status and resolvedAt.
 */

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertInput {
  severity: AlertSeverity;
  ruleName: string;
  providerId?: number;
  distributorId?: number;
  referenceId?: string;
  message: string;
  metadata?: Record<string, any>;
}

export class AlertService {
  /**
   * Create an alert
   */
  static async createAlert(db: any, input: AlertInput): Promise<number> {
    try {
      const result = await db.insert(monitoringAlerts).values({
        severity: input.severity,
        ruleName: input.ruleName,
        providerId: input.providerId || null,
        distributorId: input.distributorId || null,
        referenceId: input.referenceId || null,
        message: input.message,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        status: "active",
      });

      return result.insertId;
    } catch (error) {
      console.error("[AlertService] Failed to create alert:", error);
      throw error;
    }
  }

  /**
   * Get alerts with filtering
   */
  static async getAlerts(
    db: any,
    filters: {
      severity?: AlertSeverity;
      status?: "active" | "resolved" | "acknowledged";
      providerId?: number;
      distributorId?: number;
      ruleName?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<any[]> {
    try {
      let query = db.select().from(monitoringAlerts);

      const conditions: any[] = [];

      if (filters.severity) {
        conditions.push(eq(monitoringAlerts.severity, filters.severity));
      }

      if (filters.status) {
        conditions.push(eq(monitoringAlerts.status, filters.status));
      }

      if (filters.providerId !== undefined) {
        conditions.push(eq(monitoringAlerts.providerId, filters.providerId));
      }

      if (filters.distributorId !== undefined) {
        conditions.push(eq(monitoringAlerts.distributorId, filters.distributorId));
      }

      if (filters.ruleName) {
        conditions.push(eq(monitoringAlerts.ruleName, filters.ruleName));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy((t: any) => t.createdAt);

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      return await query;
    } catch (error) {
      console.error("[AlertService] Failed to get alerts:", error);
      return [];
    }
  }

  /**
   * Get critical alerts
   */
  static async getCriticalAlerts(db: any): Promise<any[]> {
    return this.getAlerts(db, {
      severity: "critical",
      status: "active",
      limit: 100,
    });
  }

  /**
   * Get alerts for a provider-distributor pair
   */
  static async getAlertsForAccount(
    db: any,
    providerId: number,
    distributorId: number,
  ): Promise<any[]> {
    return this.getAlerts(db, {
      providerId,
      distributorId,
      status: "active",
    });
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(db: any, alertId: number): Promise<void> {
    try {
      await db
        .update(monitoringAlerts)
        .set({
          status: "acknowledged",
        })
        .where(eq(monitoringAlerts.id, alertId));
    } catch (error) {
      console.error("[AlertService] Failed to acknowledge alert:", error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(db: any, alertId: number): Promise<void> {
    try {
      await db
        .update(monitoringAlerts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
        })
        .where(eq(monitoringAlerts.id, alertId));
    } catch (error) {
      console.error("[AlertService] Failed to resolve alert:", error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  static async getAlertStats(db: any): Promise<{
    total: number;
    active: number;
    critical: number;
    byRule: Record<string, number>;
  }> {
    try {
      const alerts = await db.select().from(monitoringAlerts);

      const stats = {
        total: alerts.length,
        active: alerts.filter((a: any) => a.status === "active").length,
        critical: alerts.filter((a: any) => a.severity === "critical" && a.status === "active").length,
        byRule: {} as Record<string, number>,
      };

      for (const alert of alerts) {
        if (alert.status === "active") {
          stats.byRule[alert.ruleName] = (stats.byRule[alert.ruleName] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error("[AlertService] Failed to get alert stats:", error);
      return { total: 0, active: 0, critical: 0, byRule: {} };
    }
  }
}
