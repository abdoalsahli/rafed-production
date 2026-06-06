import { nanoid } from "nanoid";

/**
 * Purchase Response Service (Phase 14)
 * 
 * Standardizes ALL API responses with:
 * 1. Unified Status Model
 * 2. Machine-Readable Failure Codes
 * 3. Correlation IDs for distributed debugging
 */

/**
 * Unified purchase status model
 * 
 * Lifecycle:
 * PENDING -> PROCESSING -> SUCCEEDED
 *        -> PROCESSING -> FAILED
 */
export enum PurchaseStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
}

/**
 * Machine-readable failure codes
 * Enables programmatic error handling on client side
 */
export enum FailureCode {
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  NO_INVENTORY = "NO_INVENTORY",
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",
  UNAUTHORIZED_PROVIDER = "UNAUTHORIZED_PROVIDER",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  INVALID_IDEMPOTENCY_KEY = "INVALID_IDEMPOTENCY_KEY",
  DUPLICATE_REQUEST = "DUPLICATE_REQUEST",
  WEBHOOK_DELIVERY_FAILED = "WEBHOOK_DELIVERY_FAILED",
  INVALID_PRODUCT_CODE = "INVALID_PRODUCT_CODE",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
}

/**
 * Standardized purchase response
 */
export interface PurchaseResponse {
  // Unique identifier for this purchase
  purchaseId: string;

  // Correlation ID for tracing across systems
  correlationId: string;

  // Unified status
  status: PurchaseStatus;

  // Failure details (only if status === FAILED)
  failureCode?: FailureCode;
  failureMessage?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Optional: when purchase will be retried (for transient failures)
  retryAfter?: Date;

  // Optional: webhook event ID for tracking delivery
  webhookEventId?: string;

  // Optional: idempotency key for deduplication
  idempotencyKey?: string;
}

/**
 * Standardized error response
 */
export interface ErrorResponse {
  correlationId: string;
  failureCode: FailureCode;
  failureMessage: string;
  timestamp: Date;
  requestId?: string;
}

export class PurchaseResponseService {
  /**
   * Generate correlation ID for request tracing
   * Used across API requests, purchase processing, webhook deliveries, and retries
   */
  static generateCorrelationId(): string {
    return `corr_${nanoid(16)}`;
  }

  /**
   * Generate purchase ID
   */
  static generatePurchaseId(): string {
    return `purch_${nanoid(16)}`;
  }

  /**
   * Create success response
   */
  static createSuccessResponse(
    purchaseId: string,
    correlationId: string,
    idempotencyKey?: string,
    webhookEventId?: string
  ): PurchaseResponse {
    return {
      purchaseId,
      correlationId,
      status: PurchaseStatus.SUCCEEDED,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(idempotencyKey && { idempotencyKey }),
      ...(webhookEventId && { webhookEventId }),
    };
  }

  /**
   * Create pending response
   * Used when purchase is queued for processing
   */
  static createPendingResponse(
    purchaseId: string,
    correlationId: string,
    idempotencyKey?: string
  ): PurchaseResponse {
    return {
      purchaseId,
      correlationId,
      status: PurchaseStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(idempotencyKey && { idempotencyKey }),
    };
  }

  /**
   * Create processing response
   * Used when purchase is actively being processed
   */
  static createProcessingResponse(
    purchaseId: string,
    correlationId: string,
    idempotencyKey?: string
  ): PurchaseResponse {
    return {
      purchaseId,
      correlationId,
      status: PurchaseStatus.PROCESSING,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(idempotencyKey && { idempotencyKey }),
    };
  }

  /**
   * Create failure response with machine-readable code
   */
  static createFailureResponse(
    purchaseId: string,
    correlationId: string,
    failureCode: FailureCode,
    failureMessage: string,
    idempotencyKey?: string,
    retryAfter?: Date
  ): PurchaseResponse {
    return {
      purchaseId,
      correlationId,
      status: PurchaseStatus.FAILED,
      failureCode,
      failureMessage,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(idempotencyKey && { idempotencyKey }),
      ...(retryAfter && { retryAfter }),
    };
  }

  /**
   * Create error response for API errors
   */
  static createErrorResponse(
    correlationId: string,
    failureCode: FailureCode,
    failureMessage: string,
    requestId?: string
  ): ErrorResponse {
    return {
      correlationId,
      failureCode,
      failureMessage,
      timestamp: new Date(),
      ...(requestId && { requestId }),
    };
  }

  /**
   * Map internal error to failure code
   * Useful for converting exceptions to standardized codes
   */
  static mapErrorToFailureCode(error: Error | string): FailureCode {
    const message = typeof error === "string" ? error : error.message;

    if (message.includes("insufficient balance")) {
      return FailureCode.INSUFFICIENT_BALANCE;
    }
    if (message.includes("no inventory") || message.includes("out of stock")) {
      return FailureCode.NO_INVENTORY;
    }
    if (message.includes("product not found")) {
      return FailureCode.PRODUCT_NOT_FOUND;
    }
    if (message.includes("unauthorized") || message.includes("forbidden")) {
      return FailureCode.UNAUTHORIZED_PROVIDER;
    }
    if (message.includes("rate limit")) {
      return FailureCode.RATE_LIMITED;
    }
    if (message.includes("timeout")) {
      return FailureCode.TIMEOUT;
    }
    if (message.includes("network")) {
      return FailureCode.NETWORK_ERROR;
    }
    if (message.includes("unavailable")) {
      return FailureCode.PROVIDER_UNAVAILABLE;
    }
    if (message.includes("idempotency")) {
      return FailureCode.INVALID_IDEMPOTENCY_KEY;
    }
    if (message.includes("duplicate")) {
      return FailureCode.DUPLICATE_REQUEST;
    }
    if (message.includes("webhook")) {
      return FailureCode.WEBHOOK_DELIVERY_FAILED;
    }

    return FailureCode.INTERNAL_ERROR;
  }

  /**
   * Get human-readable message for failure code
   */
  static getFailureMessage(failureCode: FailureCode): string {
    const messages: Record<FailureCode, string> = {
      [FailureCode.INSUFFICIENT_BALANCE]:
        "Distributor account has insufficient balance for this purchase",
      [FailureCode.NO_INVENTORY]:
        "Product is currently out of inventory",
      [FailureCode.PRODUCT_NOT_FOUND]:
        "Product not found or not available",
      [FailureCode.UNAUTHORIZED_PROVIDER]:
        "Provider is not authorized for this operation",
      [FailureCode.RATE_LIMITED]:
        "Too many requests. Please retry after some time",
      [FailureCode.INTERNAL_ERROR]:
        "Internal server error. Please contact support",
      [FailureCode.INVALID_IDEMPOTENCY_KEY]:
        "Invalid or missing idempotency key",
      [FailureCode.DUPLICATE_REQUEST]:
        "Duplicate request detected",
      [FailureCode.WEBHOOK_DELIVERY_FAILED]:
        "Webhook delivery failed after retries",
      [FailureCode.INVALID_PRODUCT_CODE]:
        "Invalid product code provided",
      [FailureCode.PROVIDER_UNAVAILABLE]:
        "Provider service is temporarily unavailable",
      [FailureCode.NETWORK_ERROR]:
        "Network error occurred during processing",
      [FailureCode.TIMEOUT]:
        "Request timeout. Please retry",
    };

    return messages[failureCode] || "Unknown error";
  }

  /**
   * Check if failure is transient (can be retried)
   */
  static isTransientFailure(failureCode: FailureCode): boolean {
    const transientCodes = [
      FailureCode.RATE_LIMITED,
      FailureCode.PROVIDER_UNAVAILABLE,
      FailureCode.NETWORK_ERROR,
      FailureCode.TIMEOUT,
      FailureCode.WEBHOOK_DELIVERY_FAILED,
    ];

    return transientCodes.includes(failureCode);
  }

  /**
   * Calculate retry delay based on failure code and attempt number
   * Implements exponential backoff for transient failures
   */
  static calculateRetryDelay(
    failureCode: FailureCode,
    attemptNumber: number
  ): number | null {
    if (!this.isTransientFailure(failureCode)) {
      return null;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 60 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);

    return delay;
  }

  /**
   * Format response for API output
   * Ensures consistent JSON structure across all endpoints
   */
  static formatForApi(response: PurchaseResponse): Record<string, any> {
    return {
      purchaseId: response.purchaseId,
      correlationId: response.correlationId,
      status: response.status,
      ...(response.failureCode && { failureCode: response.failureCode }),
      ...(response.failureMessage && {
        failureMessage: response.failureMessage,
      }),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
      ...(response.retryAfter && {
        retryAfter: response.retryAfter.toISOString(),
      }),
      ...(response.webhookEventId && {
        webhookEventId: response.webhookEventId,
      }),
      ...(response.idempotencyKey && {
        idempotencyKey: response.idempotencyKey,
      }),
    };
  }

  /**
   * Format error response for API output
   */
  static formatErrorForApi(error: ErrorResponse): Record<string, any> {
    return {
      correlationId: error.correlationId,
      failureCode: error.failureCode,
      failureMessage: error.failureMessage,
      timestamp: error.timestamp.toISOString(),
      ...(error.requestId && { requestId: error.requestId }),
    };
  }
}
