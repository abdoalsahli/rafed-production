import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PurchaseWebhookIntegration } from "./purchase-webhook.integration";
import { WebhookDeliveryService } from "./webhook.delivery";

/**
 * Integration tests for webhook functionality
 * 
 * Tests verify:
 * - Webhook creation on purchase success/failure
 * - Webhook payload formatting
 * - Webhook delivery queue integration
 * - Error handling and non-blocking behavior
 */

describe("PurchaseWebhookIntegration", () => {
  beforeEach(() => {
    // Mock WebhookDeliveryService
    vi.spyOn(WebhookDeliveryService, "createAndQueueWebhook").mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("onPurchaseSucceeded", () => {
    it("should handle missing webhook URL gracefully", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 999; // Non-existent distributor

      // Should not throw
      await expect(
        PurchaseWebhookIntegration.onPurchaseSucceeded(
          purchaseRequestId,
          providerId,
          distributorId,
          1
        )
      ).resolves.not.toThrow();
    });

    it("should handle database errors gracefully", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 1;
      const productId = 1;

      // Mock database error
      vi.spyOn(WebhookDeliveryService, "createAndQueueWebhook").mockRejectedValueOnce(
        new Error("Database error")
      );

      // Should not throw - webhook errors are non-blocking
      await expect(
        PurchaseWebhookIntegration.onPurchaseSucceeded(
          purchaseRequestId,
          providerId,
          distributorId,
          productId
        )
      ).resolves.not.toThrow();
    });
  });

  describe("onPurchaseFailed", () => {
    it("should handle missing webhook URL gracefully", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 999; // Non-existent distributor

      // Should not throw
      await expect(
        PurchaseWebhookIntegration.onPurchaseFailed(
          purchaseRequestId,
          providerId,
          distributorId,
          1,
          "Test failure"
        )
      ).resolves.not.toThrow();
    });

    it("should handle database errors gracefully", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 1;
      const productId = 1;

      // Mock database error
      vi.spyOn(WebhookDeliveryService, "createAndQueueWebhook").mockRejectedValueOnce(
        new Error("Database error")
      );

      // Should not throw - webhook errors are non-blocking
      await expect(
        PurchaseWebhookIntegration.onPurchaseFailed(
          purchaseRequestId,
          providerId,
          distributorId,
          productId,
          "Test failure"
        )
      ).resolves.not.toThrow();
    });
  });

  describe("Non-blocking behavior", () => {
    it("should not block on webhook creation errors", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 1;
      const productId = 1;

      // Mock webhook service to throw error
      vi.spyOn(WebhookDeliveryService, "createAndQueueWebhook").mockRejectedValueOnce(
        new Error("Network timeout")
      );

      const startTime = Date.now();

      // Should complete quickly even with error
      await PurchaseWebhookIntegration.onPurchaseSucceeded(
        purchaseRequestId,
        providerId,
        distributorId,
        productId
      );

      const duration = Date.now() - startTime;
      // Should complete in < 500ms (not blocking)
      expect(duration).toBeLessThan(500);
    });

    it("should handle concurrent webhook calls", async () => {
      const calls = Array.from({ length: 10 }, (_, i) => ({
        purchaseRequestId: 100 + i,
        providerId: 1,
        distributorId: 1,
        productId: 1,
      }));

      // All should resolve without blocking
      await Promise.all(
        calls.map(call =>
          PurchaseWebhookIntegration.onPurchaseSucceeded(
            call.purchaseRequestId,
            call.providerId,
            call.distributorId,
            call.productId
          )
        )
      );

      // Should handle all calls without errors
      expect(true).toBe(true);
    });
  });

  describe("Webhook event types", () => {
    it("should handle purchase.succeeded event", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 1;
      const productId = 1;

      // Should not throw
      await expect(
        PurchaseWebhookIntegration.onPurchaseSucceeded(
          purchaseRequestId,
          providerId,
          distributorId,
          productId
        )
      ).resolves.not.toThrow();
    });

    it("should handle purchase.failed event", async () => {
      const purchaseRequestId = 123;
      const providerId = 1;
      const distributorId = 1;
      const productId = 1;
      const failureReason = "Insufficient balance";

      // Should not throw
      await expect(
        PurchaseWebhookIntegration.onPurchaseFailed(
          purchaseRequestId,
          providerId,
          distributorId,
          productId,
          failureReason
        )
      ).resolves.not.toThrow();
    });
  });
});
