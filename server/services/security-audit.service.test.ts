import { describe, it, expect } from "vitest";
import {
  SecurityAuditService,
  SecurityCheckType,
} from "./security-audit.service";

describe("SecurityAuditService", () => {
  describe("runFullAudit", () => {
    it("should run full security audit and return results", async () => {
      const results = await SecurityAuditService.runFullAudit();

      expect(results).toHaveLength(9);
      expect(results.every((r) => r.checkType)).toBe(true);
      expect(results.every((r) => r.status)).toBe(true);
      expect(results.every((r) => r.severity)).toBe(true);
    });

    it("should include all security check types", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const checkTypes = results.map((r) => r.checkType);

      expect(checkTypes).toContain(SecurityCheckType.INJECTION_PREVENTION);
      expect(checkTypes).toContain(SecurityCheckType.AUTHENTICATION);
      expect(checkTypes).toContain(SecurityCheckType.AUTHORIZATION);
      expect(checkTypes).toContain(SecurityCheckType.ENCRYPTION);
      expect(checkTypes).toContain(SecurityCheckType.RATE_LIMITING);
      expect(checkTypes).toContain(SecurityCheckType.INPUT_VALIDATION);
      expect(checkTypes).toContain(SecurityCheckType.LOGGING);
      expect(checkTypes).toContain(SecurityCheckType.ERROR_HANDLING);
      expect(checkTypes).toContain(SecurityCheckType.API_VERSIONING);
    });

    it("should mark all checks as PASS", async () => {
      const results = await SecurityAuditService.runFullAudit();

      expect(results.every((r) => r.status === "PASS")).toBe(true);
    });

    it("should include recommendations for all checks", async () => {
      const results = await SecurityAuditService.runFullAudit();

      expect(results.every((r) => r.recommendation)).toBe(true);
    });
  });

  describe("calculateSecurityScore", () => {
    it("should calculate 100% score when all pass", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const score = SecurityAuditService.calculateSecurityScore(results);

      expect(score).toBe(100);
    });

    it("should calculate lower score with failures", () => {
      const results = [
        {
          checkType: SecurityCheckType.AUTHENTICATION,
          status: "PASS" as const,
          message: "Test",
          severity: "HIGH" as const,
        },
        {
          checkType: SecurityCheckType.ENCRYPTION,
          status: "FAIL" as const,
          message: "Test",
          severity: "CRITICAL" as const,
        },
      ];

      const score = SecurityAuditService.calculateSecurityScore(results);

      expect(score).toBe(50);
    });
  });

  describe("getCriticalIssues", () => {
    it("should return empty array when no critical issues", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const critical = SecurityAuditService.getCriticalIssues(results);

      expect(critical).toHaveLength(0);
    });

    it("should return critical issues when present", () => {
      const results = [
        {
          checkType: SecurityCheckType.AUTHENTICATION,
          status: "FAIL" as const,
          message: "Auth failed",
          severity: "CRITICAL" as const,
        },
        {
          checkType: SecurityCheckType.ENCRYPTION,
          status: "FAIL" as const,
          message: "Encryption failed",
          severity: "HIGH" as const,
        },
      ];

      const critical = SecurityAuditService.getCriticalIssues(results);

      expect(critical).toHaveLength(1);
      expect(critical[0].checkType).toBe(SecurityCheckType.AUTHENTICATION);
    });
  });

  describe("getRecommendations", () => {
    it("should extract all recommendations", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const recommendations = SecurityAuditService.getRecommendations(results);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.every((r) => typeof r === "string")).toBe(true);
    });

    it("should skip results without recommendations", () => {
      const results = [
        {
          checkType: SecurityCheckType.AUTHENTICATION,
          status: "PASS" as const,
          message: "Test",
          severity: "HIGH" as const,
          recommendation: "Do this",
        },
        {
          checkType: SecurityCheckType.ENCRYPTION,
          status: "PASS" as const,
          message: "Test",
          severity: "HIGH" as const,
        },
      ];

      const recommendations = SecurityAuditService.getRecommendations(results);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toBe("Do this");
    });
  });

  describe("generateReport", () => {
    it("should generate security report with score", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const report = SecurityAuditService.generateReport(results);

      expect(report).toContain("Security Audit Report");
      expect(report).toContain("Security Score: 100/100");
    });

    it("should include detailed results in report", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const report = SecurityAuditService.generateReport(results);

      expect(report).toContain("Detailed Results");
      expect(report).toContain("injection_prevention");
      expect(report).toContain("authentication");
    });

    it("should include recommendations section", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const report = SecurityAuditService.generateReport(results);

      expect(report).toContain("Recommendations");
    });

    it("should include critical issues section when present", () => {
      const results = [
        {
          checkType: SecurityCheckType.AUTHENTICATION,
          status: "FAIL" as const,
          message: "Auth failed",
          severity: "CRITICAL" as const,
          recommendation: "Fix auth",
        },
      ];

      const report = SecurityAuditService.generateReport(results);

      expect(report).toContain("Critical Issues");
      expect(report).toContain("Auth failed");
    });

    it("should format report as markdown", async () => {
      const results = await SecurityAuditService.runFullAudit();
      const report = SecurityAuditService.generateReport(results);

      expect(report).toContain("#");
      expect(report).toContain("**");
      expect(report).toContain("✓");
    });
  });

  describe("security check coverage", () => {
    it("should cover OWASP Top 10 concerns", async () => {
      const results = await SecurityAuditService.runFullAudit();

      // Injection prevention
      expect(
        results.some((r) => r.checkType === SecurityCheckType.INJECTION_PREVENTION)
      ).toBe(true);

      // Authentication
      expect(
        results.some((r) => r.checkType === SecurityCheckType.AUTHENTICATION)
      ).toBe(true);

      // Authorization
      expect(
        results.some((r) => r.checkType === SecurityCheckType.AUTHORIZATION)
      ).toBe(true);

      // Encryption
      expect(
        results.some((r) => r.checkType === SecurityCheckType.ENCRYPTION)
      ).toBe(true);

      // Input validation
      expect(
        results.some((r) => r.checkType === SecurityCheckType.INPUT_VALIDATION)
      ).toBe(true);

      // Error handling
      expect(
        results.some((r) => r.checkType === SecurityCheckType.ERROR_HANDLING)
      ).toBe(true);

      // Logging
      expect(
        results.some((r) => r.checkType === SecurityCheckType.LOGGING)
      ).toBe(true);
    });
  });
});
