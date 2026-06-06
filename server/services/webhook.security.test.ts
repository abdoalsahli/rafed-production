import { describe, it, expect } from "vitest";
import { WebhookSecurityService } from "./webhook.security";

describe("WebhookSecurityService", () => {
  const secret = "test_webhook_secret_12345";

  describe("generateSignature", () => {
    it("should generate consistent signatures for same input", () => {
      const timestamp = "2026-05-18T12:00:00Z";
      const body = '{"event":"purchase.succeeded","requestId":123}';

      const sig1 = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        secret
      );
      const sig2 = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        secret
      );

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex is 64 chars
    });

    it("should generate different signatures for different bodies", () => {
      const timestamp = "2026-05-18T12:00:00Z";
      const body1 = '{"event":"purchase.succeeded"}';
      const body2 = '{"event":"purchase.failed"}';

      const sig1 = WebhookSecurityService.generateSignature(
        timestamp,
        body1,
        secret
      );
      const sig2 = WebhookSecurityService.generateSignature(
        timestamp,
        body2,
        secret
      );

      expect(sig1).not.toBe(sig2);
    });

    it("should generate different signatures for different secrets", () => {
      const timestamp = "2026-05-18T12:00:00Z";
      const body = '{"event":"purchase.succeeded"}';

      const sig1 = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        secret
      );
      const sig2 = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        "different_secret"
      );

      expect(sig1).not.toBe(sig2);
    });
  });

  describe("verifySignature", () => {
    it("should verify valid signatures", () => {
      const timestamp = new Date().toISOString();
      const body = '{"event":"purchase.succeeded"}';

      const signature = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        secret
      );

      const isValid = WebhookSecurityService.verifySignature(
        signature,
        timestamp,
        body,
        secret
      );

      expect(isValid).toBe(true);
    });

    it("should reject invalid signatures", () => {
      const timestamp = new Date().toISOString();
      const body = '{"event":"purchase.succeeded"}';
      const invalidSignature = "0".repeat(64);

      const isValid = WebhookSecurityService.verifySignature(
        invalidSignature,
        timestamp,
        body,
        secret
      );

      expect(isValid).toBe(false);
    });

    it("should reject signatures with wrong secret", () => {
      const timestamp = new Date().toISOString();
      const body = '{"event":"purchase.succeeded"}';

      const signature = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        secret
      );

      const isValid = WebhookSecurityService.verifySignature(
        signature,
        timestamp,
        body,
        "wrong_secret"
      );

      expect(isValid).toBe(false);
    });

    it("should reject signatures with tampered body", () => {
      const timestamp = new Date().toISOString();
      const body = '{"event":"purchase.succeeded"}';

      const signature = WebhookSecurityService.generateSignature(
        timestamp,
        body,
        secret
      );

      const tamperedBody = '{"event":"purchase.failed"}';
      const isValid = WebhookSecurityService.verifySignature(
        signature,
        timestamp,
        tamperedBody,
        secret
      );

      expect(isValid).toBe(false);
    });

    it("should reject old timestamps", () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const body = '{"event":"purchase.succeeded"}';

      const signature = WebhookSecurityService.generateSignature(
        oldTimestamp,
        body,
        secret
      );

      const isValid = WebhookSecurityService.verifySignature(
        signature,
        oldTimestamp,
        body,
        secret,
        300
      );

      expect(isValid).toBe(false);
    });

    it("should accept recent timestamps", () => {
      const recentTimestamp = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      const body = '{"event":"purchase.succeeded"}';

      const signature = WebhookSecurityService.generateSignature(
        recentTimestamp,
        body,
        secret
      );

      const isValid = WebhookSecurityService.verifySignature(
        signature,
        recentTimestamp,
        body,
        secret,
        300
      );

      expect(isValid).toBe(true);
    });

    it("should reject future timestamps", () => {
      const futureTimestamp = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const body = '{"event":"purchase.succeeded"}';

      const signature = WebhookSecurityService.generateSignature(
        futureTimestamp,
        body,
        secret
      );

      const isValid = WebhookSecurityService.verifySignature(
        signature,
        futureTimestamp,
        body,
        secret,
        300
      );

      expect(isValid).toBe(false);
    });
  });

  describe("isTimestampRecent", () => {
    it("should accept current timestamp", () => {
      const now = new Date().toISOString();
      const isRecent = WebhookSecurityService.isTimestampRecent(now, 300);
      expect(isRecent).toBe(true);
    });

    it("should accept timestamp within max age", () => {
      const timestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const isRecent = WebhookSecurityService.isTimestampRecent(timestamp, 300);
      expect(isRecent).toBe(true);
    });

    it("should reject timestamp older than max age", () => {
      const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const isRecent = WebhookSecurityService.isTimestampRecent(timestamp, 300);
      expect(isRecent).toBe(false);
    });

    it("should reject future timestamps", () => {
      const timestamp = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const isRecent = WebhookSecurityService.isTimestampRecent(timestamp, 300);
      expect(isRecent).toBe(false);
    });

    it("should reject invalid timestamp format", () => {
      const isRecent = WebhookSecurityService.isTimestampRecent(
        "invalid-date",
        300
      );
      expect(isRecent).toBe(false);
    });
  });

  describe("generateHeaders", () => {
    it("should generate valid headers", () => {
      const body = '{"event":"purchase.succeeded"}';

      const headers = WebhookSecurityService.generateHeaders(body, secret);

      expect(headers).toHaveProperty("X-Webhook-Timestamp");
      expect(headers).toHaveProperty("X-Webhook-Signature");
      expect(headers["X-Webhook-Signature"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should generate headers with recent timestamp", () => {
      const body = '{"event":"purchase.succeeded"}';

      const headers = WebhookSecurityService.generateHeaders(body, secret);
      const timestamp = headers["X-Webhook-Timestamp"];

      const isRecent = WebhookSecurityService.isTimestampRecent(timestamp, 5);
      expect(isRecent).toBe(true);
    });

    it("should generate verifiable headers", () => {
      const body = '{"event":"purchase.succeeded"}';

      const headers = WebhookSecurityService.generateHeaders(body, secret);

      const isValid = WebhookSecurityService.verifySignature(
        headers["X-Webhook-Signature"],
        headers["X-Webhook-Timestamp"],
        body,
        secret
      );

      expect(isValid).toBe(true);
    });
  });
});
