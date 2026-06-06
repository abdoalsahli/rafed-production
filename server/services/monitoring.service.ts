import { Decimal } from "decimal.js";
import { monitoringAlerts } from "../../drizzle/schema";

/**
 * MonitoringService - Structured financial event logging
 * 
 * Logs all financial events (purchase, refund, adjustment, topup) for:
 * - Audit trail
 * - Operational monitoring
 * - Compliance
 * - Debugging
 * 
 * CRITICAL: This service logs events ONLY. It does not modify business logic.
 * All events are immutable (append-only).
 */

export interface FinancialEvent {
  eventType: "purchase" | "refund" | "adjustment" | "topup";
  providerId: number;
  distributorId: number;
  amount: Decimal;
  referenceId: string;
  metadata?: Record<string, any>;
}

export interface InvariantViolation {
  rule: "balance_negative" | "used_credit_negative" | "used_credit_exceeds_limit";
  providerId: number;
  distributorId: number;
  balance: Decimal;
  usedCredit: Decimal;
  creditLine: Decimal;
  referenceId?: string;
}

export class MonitoringService {
  /**
   * Log a financial event
   */
  static async logFinancialEvent(
    db: any,
    event: FinancialEvent,
  ): Promise<void> {
    try {
      const metadata = {
        eventType: event.eventType,
        amount: event.amount.toString(),
        ...(event.metadata || {}),
      };

      await db.insert(monitoringAlerts).values({
        severity: "info",
        ruleName: `financial_event_${event.eventType}`,
        providerId: event.providerId,
        distributorId: event.distributorId,
        referenceId: event.referenceId,
        message: `${event.eventType} event: ${event.amount} for distributor ${event.distributorId}`,
        metadata: JSON.stringify(metadata),
        status: "active",
      });
    } catch (error) {
      console.error("[Monitoring] Failed to log financial event:", error);
      // Don't throw - monitoring failures should not block business logic
    }
  }

  /**
   * Log an invariant violation
   */
  static async logInvariantViolation(
    db: any,
    violation: InvariantViolation,
  ): Promise<void> {
    try {
      const metadata = {
        rule: violation.rule,
        balance: violation.balance.toString(),
        usedCredit: violation.usedCredit.toString(),
        creditLine: violation.creditLine.toString(),
      };

      const messages: Record<string, string> = {
        balance_negative: `Balance is negative: ${violation.balance}`,
        used_credit_negative: `Used credit is negative: ${violation.usedCredit}`,
        used_credit_exceeds_limit: `Used credit (${violation.usedCredit}) exceeds limit (${violation.creditLine})`,
      };

      await db.insert(monitoringAlerts).values({
        severity: "critical",
        ruleName: `invariant_violation_${violation.rule}`,
        providerId: violation.providerId,
        distributorId: violation.distributorId,
        referenceId: violation.referenceId,
        message: messages[violation.rule],
        metadata: JSON.stringify(metadata),
        status: "active",
      });
    } catch (error) {
      console.error("[Monitoring] Failed to log invariant violation:", error);
      // Don't throw - monitoring failures should not block business logic
    }
  }

  /**
   * Check financial invariants for an account
   * Returns true if all invariants are satisfied, false if any violation detected
   */
  static validateInvariants(
    balance: Decimal,
    usedCredit: Decimal,
    creditLine: Decimal,
  ): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    if (balance.lessThan(0)) {
      violations.push(`balance_negative: ${balance}`);
    }

    if (usedCredit.lessThan(0)) {
      violations.push(`used_credit_negative: ${usedCredit}`);
    }

    if (usedCredit.greaterThan(creditLine)) {
      violations.push(`used_credit_exceeds_limit: ${usedCredit} > ${creditLine}`);
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Get active alerts for a provider-distributor pair
   */
  static async getActiveAlerts(
    db: any,
    providerId: number,
    distributorId: number,
  ): Promise<any[]> {
    try {
      const { eq, and } = await import("drizzle-orm");
      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(
          and(
            eq(monitoringAlerts.providerId, providerId),
            eq(monitoringAlerts.distributorId, distributorId),
            eq(monitoringAlerts.status, "active"),
          ),
        )
        .orderBy((t: any) => t.createdAt);

      return alerts || [];
    } catch (error) {
      console.error("[Monitoring] Failed to get active alerts:", error);
      return [];
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(db: any, alertId: number): Promise<void> {
    try {
      const { eq } = await import("drizzle-orm");
      await db
        .update(monitoringAlerts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
        })
        .where(eq(monitoringAlerts.id, alertId));
    } catch (error) {
      console.error("[Monitoring] Failed to resolve alert:", error);
      // Don't throw - monitoring failures should not block business logic
    }
  }
}
