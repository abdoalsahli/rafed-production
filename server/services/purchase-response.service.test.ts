import { describe, it, expect } from "vitest";
import {
  PurchaseResponseService,
  PurchaseStatus,
  FailureCode,
} from "./purchase-response.service";

describe("PurchaseResponseService", () => {
  describe("generateCorrelationId", () => {
    it("should generate unique correlation IDs", () => {
      const id1 = PurchaseResponseService.generateCorrelationId();
      const id2 = PurchaseResponseService.generateCorrelationId();

      expect(id1).toMatch(/^corr_/);
      expect(id2).toMatch(/^corr_/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("generatePurchaseId", () => {
    it("should generate unique purchase IDs", () => {
      const id1 = PurchaseResponseService.generatePurchaseId();
      const id2 = PurchaseResponseService.generatePurchaseId();

      expect(id1).toMatch(/^purch_/);
      expect(id2).toMatch(/^purch_/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("createSuccessResponse", () => {
    it("should create success response with required fields", () => {
      const purchaseId = "purch_123";
      const correlationId = "corr_456";

      const response = PurchaseResponseService.createSuccessResponse(
        purchaseId,
        correlationId
      );

      expect(response.purchaseId).toBe(purchaseId);
      expect(response.correlationId).toBe(correlationId);
      expect(response.status).toBe(PurchaseStatus.SUCCEEDED);
      expect(response.createdAt).toBeInstanceOf(Date);
      expect(response.updatedAt).toBeInstanceOf(Date);
      expect(response.failureCode).toBeUndefined();
      expect(response.failureMessage).toBeUndefined();
    });

    it("should include optional fields when provided", () => {
      const response = PurchaseResponseService.createSuccessResponse(
        "purch_123",
        "corr_456",
        "idempotency_key_789",
        "webhook_event_000"
      );

      expect(response.idempotencyKey).toBe("idempotency_key_789");
      expect(response.webhookEventId).toBe("webhook_event_000");
    });
  });

  describe("createFailureResponse", () => {
    it("should create failure response with failure code", () => {
      const response = PurchaseResponseService.createFailureResponse(
        "purch_123",
        "corr_456",
        FailureCode.INSUFFICIENT_BALANCE,
        "Account balance is too low"
      );

      expect(response.status).toBe(PurchaseStatus.FAILED);
      expect(response.failureCode).toBe(FailureCode.INSUFFICIENT_BALANCE);
      expect(response.failureMessage).toBe("Account balance is too low");
    });

    it("should include retry after when provided", () => {
      const retryAfter = new Date(Date.now() + 5000);
      const response = PurchaseResponseService.createFailureResponse(
        "purch_123",
        "corr_456",
        FailureCode.RATE_LIMITED,
        "Rate limit exceeded",
        undefined,
        retryAfter
      );

      expect(response.retryAfter).toBe(retryAfter);
    });
  });

  describe("mapErrorToFailureCode", () => {
    it("should map error messages to failure codes", () => {
      expect(
        PurchaseResponseService.mapErrorToFailureCode(
          "insufficient balance"
        )
      ).toBe(FailureCode.INSUFFICIENT_BALANCE);

      expect(
        PurchaseResponseService.mapErrorToFailureCode("no inventory")
      ).toBe(FailureCode.NO_INVENTORY);

      expect(
        PurchaseResponseService.mapErrorToFailureCode("product not found")
      ).toBe(FailureCode.PRODUCT_NOT_FOUND);

      expect(
        PurchaseResponseService.mapErrorToFailureCode("unauthorized")
      ).toBe(FailureCode.UNAUTHORIZED_PROVIDER);

      expect(
        PurchaseResponseService.mapErrorToFailureCode("rate limit")
      ).toBe(FailureCode.RATE_LIMITED);

      expect(
        PurchaseResponseService.mapErrorToFailureCode("timeout")
      ).toBe(FailureCode.TIMEOUT);
    });

    it("should return INTERNAL_ERROR for unknown errors", () => {
      expect(
        PurchaseResponseService.mapErrorToFailureCode("unknown error")
      ).toBe(FailureCode.INTERNAL_ERROR);
    });

    it("should handle Error objects", () => {
      const error = new Error("insufficient balance");
      expect(PurchaseResponseService.mapErrorToFailureCode(error)).toBe(
        FailureCode.INSUFFICIENT_BALANCE
      );
    });
  });

  describe("getFailureMessage", () => {
    it("should return human-readable message for failure code", () => {
      expect(
        PurchaseResponseService.getFailureMessage(
          FailureCode.INSUFFICIENT_BALANCE
        )
      ).toContain("insufficient balance");

      expect(
        PurchaseResponseService.getFailureMessage(FailureCode.NO_INVENTORY)
      ).toContain("out of inventory");

      expect(
        PurchaseResponseService.getFailureMessage(FailureCode.RATE_LIMITED)
      ).toContain("Too many requests");
    });
  });

  describe("isTransientFailure", () => {
    it("should identify transient failures", () => {
      expect(
        PurchaseResponseService.isTransientFailure(FailureCode.RATE_LIMITED)
      ).toBe(true);

      expect(
        PurchaseResponseService.isTransientFailure(
          FailureCode.PROVIDER_UNAVAILABLE
        )
      ).toBe(true);

      expect(
        PurchaseResponseService.isTransientFailure(FailureCode.NETWORK_ERROR)
      ).toBe(true);

      expect(
        PurchaseResponseService.isTransientFailure(FailureCode.TIMEOUT)
      ).toBe(true);
    });

    it("should identify permanent failures", () => {
      expect(
        PurchaseResponseService.isTransientFailure(
          FailureCode.INSUFFICIENT_BALANCE
        )
      ).toBe(false);

      expect(
        PurchaseResponseService.isTransientFailure(FailureCode.PRODUCT_NOT_FOUND)
      ).toBe(false);

      expect(
        PurchaseResponseService.isTransientFailure(
          FailureCode.UNAUTHORIZED_PROVIDER
        )
      ).toBe(false);
    });
  });

  describe("calculateRetryDelay", () => {
    it("should calculate exponential backoff for transient failures", () => {
      const delay1 = PurchaseResponseService.calculateRetryDelay(
        FailureCode.RATE_LIMITED,
        1
      );
      const delay2 = PurchaseResponseService.calculateRetryDelay(
        FailureCode.RATE_LIMITED,
        2
      );
      const delay3 = PurchaseResponseService.calculateRetryDelay(
        FailureCode.RATE_LIMITED,
        3
      );

      expect(delay1).toBe(1000); // 1s
      expect(delay2).toBe(2000); // 2s
      expect(delay3).toBe(4000); // 4s
    });

    it("should cap retry delay at maximum", () => {
      const delay = PurchaseResponseService.calculateRetryDelay(
        FailureCode.RATE_LIMITED,
        10
      );

      expect(delay).toBeLessThanOrEqual(60000); // 60s max
    });

    it("should return null for permanent failures", () => {
      const delay = PurchaseResponseService.calculateRetryDelay(
        FailureCode.INSUFFICIENT_BALANCE,
        1
      );

      expect(delay).toBeNull();
    });
  });

  describe("formatForApi", () => {
    it("should format success response for API output", () => {
      const response = PurchaseResponseService.createSuccessResponse(
        "purch_123",
        "corr_456"
      );

      const formatted = PurchaseResponseService.formatForApi(response);

      expect(formatted.purchaseId).toBe("purch_123");
      expect(formatted.correlationId).toBe("corr_456");
      expect(formatted.status).toBe("SUCCEEDED");
      expect(formatted.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(formatted.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(formatted.failureCode).toBeUndefined();
    });

    it("should format failure response for API output", () => {
      const response = PurchaseResponseService.createFailureResponse(
        "purch_123",
        "corr_456",
        FailureCode.INSUFFICIENT_BALANCE,
        "Account balance is too low"
      );

      const formatted = PurchaseResponseService.formatForApi(response);

      expect(formatted.status).toBe("FAILED");
      expect(formatted.failureCode).toBe("INSUFFICIENT_BALANCE");
      expect(formatted.failureMessage).toBe("Account balance is too low");
    });

    it("should include optional fields in formatted output", () => {
      const retryAfter = new Date(Date.now() + 5000);
      const response = PurchaseResponseService.createFailureResponse(
        "purch_123",
        "corr_456",
        FailureCode.RATE_LIMITED,
        "Rate limit exceeded",
        "idempotency_key_789",
        retryAfter
      );

      const formatted = PurchaseResponseService.formatForApi(response);

      expect(formatted.idempotencyKey).toBe("idempotency_key_789");
      expect(formatted.retryAfter).toBeDefined();
    });
  });

  describe("formatErrorForApi", () => {
    it("should format error response for API output", () => {
      const error = PurchaseResponseService.createErrorResponse(
        "corr_456",
        FailureCode.INSUFFICIENT_BALANCE,
        "Account balance is too low"
      );

      const formatted = PurchaseResponseService.formatErrorForApi(error);

      expect(formatted.correlationId).toBe("corr_456");
      expect(formatted.failureCode).toBe("INSUFFICIENT_BALANCE");
      expect(formatted.failureMessage).toBe("Account balance is too low");
      expect(formatted.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("createPendingResponse", () => {
    it("should create pending response", () => {
      const response = PurchaseResponseService.createPendingResponse(
        "purch_123",
        "corr_456"
      );

      expect(response.status).toBe(PurchaseStatus.PENDING);
      expect(response.purchaseId).toBe("purch_123");
      expect(response.correlationId).toBe("corr_456");
    });
  });

  describe("createProcessingResponse", () => {
    it("should create processing response", () => {
      const response = PurchaseResponseService.createProcessingResponse(
        "purch_123",
        "corr_456"
      );

      expect(response.status).toBe(PurchaseStatus.PROCESSING);
      expect(response.purchaseId).toBe("purch_123");
      expect(response.correlationId).toBe("corr_456");
    });
  });
});
