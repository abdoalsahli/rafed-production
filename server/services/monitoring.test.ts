import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Decimal } from "decimal.js";
import { getDb } from "../db";
import { MonitoringService } from "./monitoring.service";
import { AlertService } from "./alert.service";
import { serviceProviders, distributors, monitoringAlerts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("Monitoring System Integration Tests", () => {
  let db: any;
  let providerId: number;
  let distributorId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Create test provider and distributor
    const providerResult = await db.insert(serviceProviders).values({
      name: "Test Provider",
      status: "active",
    });
    providerId = providerResult.insertId;

    const distributorResult = await db.insert(distributors).values({
      name: "Test Distributor",
      status: "active",
    });
    distributorId = distributorResult.insertId;
  });

  afterAll(async () => {
    // Clean up
    if (db) {
      await db
        .delete(monitoringAlerts)
        .where(
          and(
            eq(monitoringAlerts.providerId, providerId),
            eq(monitoringAlerts.distributorId, distributorId),
          ),
        );
    }
  });

  describe("MonitoringService", () => {
    it("should validate correct invariants", () => {
      const balance = new Decimal("100.00");
      const usedCredit = new Decimal("50.00");
      const creditLine = new Decimal("200.00");

      const result = MonitoringService.validateInvariants(balance, usedCredit, creditLine);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect negative balance invariant violation", () => {
      const balance = new Decimal("-10.00");
      const usedCredit = new Decimal("50.00");
      const creditLine = new Decimal("200.00");

      const result = MonitoringService.validateInvariants(balance, usedCredit, creditLine);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain(expect.stringContaining("balance_negative"));
    });

    it("should detect negative used_credit invariant violation", () => {
      const balance = new Decimal("100.00");
      const usedCredit = new Decimal("-10.00");
      const creditLine = new Decimal("200.00");

      const result = MonitoringService.validateInvariants(balance, usedCredit, creditLine);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain(expect.stringContaining("used_credit_negative"));
    });

    it("should detect used_credit exceeds limit invariant violation", () => {
      const balance = new Decimal("100.00");
      const usedCredit = new Decimal("250.00");
      const creditLine = new Decimal("200.00");

      const result = MonitoringService.validateInvariants(balance, usedCredit, creditLine);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain(expect.stringContaining("used_credit_exceeds_limit"));
    });

    it("should log financial event", async () => {
      await MonitoringService.logFinancialEvent(db, {
        eventType: "purchase",
        providerId,
        distributorId,
        amount: new Decimal("100.00"),
        referenceId: "TXN-123",
        metadata: { source: "test" },
      });

      // Verify alert was created
      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(
          and(
            eq(monitoringAlerts.providerId, providerId),
            eq(monitoringAlerts.distributorId, distributorId),
            eq(monitoringAlerts.ruleName, "financial_event_purchase"),
          ),
        );

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("info");
    });

    it("should log invariant violation", async () => {
      await MonitoringService.logInvariantViolation(db, {
        rule: "balance_negative",
        providerId,
        distributorId,
        balance: new Decimal("-50.00"),
        creditLine: new Decimal("200.00"),
        referenceId: "TXN-456",
      });

      // Verify alert was created
      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(
          and(
            eq(monitoringAlerts.providerId, providerId),
            eq(monitoringAlerts.distributorId, distributorId),
            eq(monitoringAlerts.ruleName, "invariant_violation_balance_negative"),
          ),
        );

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("critical");
    });

    it("should get active alerts for account", async () => {
      // Create a test alert
      await AlertService.createAlert(db, {
        severity: "warning",
        ruleName: "test_rule",
        providerId,
        distributorId,
        message: "Test alert",
      });

      // Get active alerts
      const alerts = await MonitoringService.getActiveAlerts(db, providerId, distributorId);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every((a: any) => a.status === "active")).toBe(true);
    });

    it("should resolve alert", async () => {
      // Create a test alert
      const alertId = await AlertService.createAlert(db, {
        severity: "info",
        ruleName: "test_resolve",
        providerId,
        distributorId,
        message: "Test alert to resolve",
      });

      // Resolve it
      await MonitoringService.resolveAlert(db, alertId);

      // Verify it's resolved
      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alertId));

      expect(alerts[0].status).toBe("resolved");
      expect(alerts[0].resolvedAt).not.toBeNull();
    });
  });

  describe("AlertService", () => {
    it("should create alert with info severity", async () => {
      const alertId = await AlertService.createAlert(db, {
        severity: "info",
        ruleName: "test_info_alert",
        providerId,
        distributorId,
        message: "Test info alert",
      });

      expect(alertId).toBeGreaterThan(0);

      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alertId));

      expect(alerts[0].severity).toBe("info");
      expect(alerts[0].status).toBe("active");
    });

    it("should create alert with warning severity", async () => {
      const alertId = await AlertService.createAlert(db, {
        severity: "warning",
        ruleName: "test_warning_alert",
        providerId,
        distributorId,
        message: "Test warning alert",
      });

      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alertId));

      expect(alerts[0].severity).toBe("warning");
    });

    it("should create alert with critical severity", async () => {
      const alertId = await AlertService.createAlert(db, {
        severity: "critical",
        ruleName: "test_critical_alert",
        providerId,
        distributorId,
        message: "Test critical alert",
      });

      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alertId));

      expect(alerts[0].severity).toBe("critical");
    });

    it("should get alerts with filtering", async () => {
      // Create multiple alerts
      await AlertService.createAlert(db, {
        severity: "info",
        ruleName: "filter_test_1",
        providerId,
        distributorId,
        message: "Alert 1",
      });

      await AlertService.createAlert(db, {
        severity: "warning",
        ruleName: "filter_test_2",
        providerId,
        distributorId,
        message: "Alert 2",
      });

      // Get only warning alerts
      const warnings = await AlertService.getAlerts(db, {
        severity: "warning",
        providerId,
        distributorId,
      });

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.every((a: any) => a.severity === "warning")).toBe(true);
    });

    it("should get critical alerts", async () => {
      // Create a critical alert
      await AlertService.createAlert(db, {
        severity: "critical",
        ruleName: "critical_test",
        providerId,
        distributorId,
        message: "Critical alert",
      });

      // Get critical alerts
      const criticalAlerts = await AlertService.getCriticalAlerts(db);

      expect(criticalAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts.every((a: any) => a.severity === "critical")).toBe(true);
    });

    it("should acknowledge alert", async () => {
      const alertId = await AlertService.createAlert(db, {
        severity: "info",
        ruleName: "ack_test",
        providerId,
        distributorId,
        message: "Test acknowledge",
      });

      await AlertService.acknowledgeAlert(db, alertId);

      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alertId));

      expect(alerts[0].status).toBe("acknowledged");
    });

    it("should get alert statistics", async () => {
      const stats = await AlertService.getAlertStats(db);

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.critical).toBeGreaterThanOrEqual(0);
      expect(typeof stats.byRule).toBe("object");
    });
  });
});
