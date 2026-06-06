/**
 * Structured Error Handling for Production
 * 
 * CRITICAL: All errors are structured with:
 * 1. Error code (machine-readable)
 * 2. Safe message (client-safe, no internal details)
 * 3. Internal log (full details for debugging)
 * 4. HTTP status code
 */

/**
 * Error codes for all purchase-related failures
 * Used for structured error responses and client handling
 */
export enum PurchaseErrorCode {
  // Wallet errors
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",

  // Inventory errors
  NO_INVENTORY = "NO_INVENTORY",
  CARD_NOT_FOUND = "CARD_NOT_FOUND",

  // PIN errors
  PIN_ALREADY_VIEWED = "PIN_ALREADY_VIEWED",
  PIN_DECRYPTION_FAILED = "PIN_DECRYPTION_FAILED",

  // Transaction errors
  TRANSACTION_TIMEOUT = "TRANSACTION_TIMEOUT",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  DUPLICATE_REQUEST = "DUPLICATE_REQUEST",

  // Validation errors
  INVALID_DISTRIBUTOR = "INVALID_DISTRIBUTOR",
  INVALID_PRODUCT = "INVALID_PRODUCT",
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",

  // System errors
  DATABASE_ERROR = "DATABASE_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Structured error response for clients
 * Safe to return to frontend - no internal details
 */
export interface StructuredErrorResponse {
  code: PurchaseErrorCode;
  message: string; // Safe, client-friendly message
  statusCode: number; // HTTP status code
}

/**
 * Internal error with full details for logging
 * NEVER sent to client
 */
export interface InternalError {
  code: PurchaseErrorCode;
  message: string; // Safe message for client
  internalDetails: string; // Full error details for logging
  originalError?: Error; // Original error object
  statusCode: number;
}

/**
 * Error message mapping: code -> safe client message
 * Maps error codes to user-friendly messages
 * 
 * CRITICAL: These messages do NOT leak internal details
 * Examples of what NOT to include:
 * - SQL error messages
 * - Database column names
 * - System file paths
 * - Internal API details
 */
export const ERROR_MESSAGES: Record<PurchaseErrorCode, string> = {
  // Wallet errors
  [PurchaseErrorCode.INSUFFICIENT_BALANCE]:
    "Insufficient wallet balance. Please top up your account.",
  [PurchaseErrorCode.WALLET_NOT_FOUND]:
    "Wallet not found. Please contact support.",
  [PurchaseErrorCode.CONCURRENT_MODIFICATION]:
    "Another purchase is in progress. Please try again.",

  // Inventory errors
  [PurchaseErrorCode.NO_INVENTORY]:
    "This product is currently out of stock. Please try another product.",
  [PurchaseErrorCode.CARD_NOT_FOUND]:
    "Card not found. Please contact support.",

  // PIN errors
  [PurchaseErrorCode.PIN_ALREADY_VIEWED]:
    "PIN has already been retrieved. For security, PINs can only be retrieved once.",
  [PurchaseErrorCode.PIN_DECRYPTION_FAILED]:
    "Failed to retrieve PIN. Please contact support.",

  // Transaction errors
  [PurchaseErrorCode.TRANSACTION_TIMEOUT]:
    "Transaction took too long. Please retry your purchase. Your wallet has not been charged.",
  [PurchaseErrorCode.TRANSACTION_FAILED]:
    "Transaction failed. Your wallet has not been charged. Please try again.",
  [PurchaseErrorCode.DUPLICATE_REQUEST]:
    "This request has already been processed.",

  // Validation errors
  [PurchaseErrorCode.INVALID_DISTRIBUTOR]:
    "Invalid distributor. Please check your credentials.",
  [PurchaseErrorCode.INVALID_PRODUCT]:
    "Invalid product. Please select a valid product.",
  [PurchaseErrorCode.PRODUCT_NOT_FOUND]:
    "Product not found. Please select another product.",

  // System errors
  [PurchaseErrorCode.DATABASE_ERROR]:
    "A system error occurred. Please try again later.",
  [PurchaseErrorCode.INTERNAL_ERROR]:
    "An unexpected error occurred. Please try again later.",
};

/**
 * HTTP status code mapping: code -> status code
 * Maps error codes to appropriate HTTP status codes
 */
export const ERROR_STATUS_CODES: Record<PurchaseErrorCode, number> = {
  // 400 Bad Request
  [PurchaseErrorCode.INVALID_DISTRIBUTOR]: 400,
  [PurchaseErrorCode.INVALID_PRODUCT]: 400,

  // 402 Payment Required
  [PurchaseErrorCode.INSUFFICIENT_BALANCE]: 402,

  // 404 Not Found
  [PurchaseErrorCode.WALLET_NOT_FOUND]: 404,
  [PurchaseErrorCode.CARD_NOT_FOUND]: 404,
  [PurchaseErrorCode.PRODUCT_NOT_FOUND]: 404,

  // 409 Conflict
  [PurchaseErrorCode.CONCURRENT_MODIFICATION]: 409,
  [PurchaseErrorCode.PIN_ALREADY_VIEWED]: 409,
  [PurchaseErrorCode.DUPLICATE_REQUEST]: 409,
  [PurchaseErrorCode.NO_INVENTORY]: 409,

  // 408 Request Timeout
  [PurchaseErrorCode.TRANSACTION_TIMEOUT]: 408,

  // 500 Internal Server Error
  [PurchaseErrorCode.TRANSACTION_FAILED]: 500,
  [PurchaseErrorCode.PIN_DECRYPTION_FAILED]: 500,
  [PurchaseErrorCode.DATABASE_ERROR]: 500,
  [PurchaseErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Create a structured error response
 * 
 * Usage:
 * throw createStructuredError(
 *   PurchaseErrorCode.INSUFFICIENT_BALANCE,
 *   "Wallet balance 50.00 < amount 100.00"
 * );
 */
export function createStructuredError(
  code: PurchaseErrorCode,
  internalDetails: string,
  originalError?: Error,
): InternalError {
  const message = ERROR_MESSAGES[code];
  const statusCode = ERROR_STATUS_CODES[code];

  return {
    code,
    message, // Safe message for client
    internalDetails, // Full details for logging
    originalError,
    statusCode,
  };
}

/**
 * Convert internal error to client response
 * CRITICAL: Only returns code and message, no internal details
 */
export function toClientResponse(error: InternalError): StructuredErrorResponse {
  return {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  };
}

/**
 * Log error internally with full details
 * CRITICAL: This is called server-side only
 */
export function logError(error: InternalError, context: string): void {
  console.error(`[${context}] Error: ${error.code}`, {
    code: error.code,
    message: error.message,
    internalDetails: error.internalDetails,
    originalError: error.originalError?.message,
    stack: error.originalError?.stack,
  });
}

/**
 * Type guard to check if error is a structured error
 */
export function isStructuredError(error: unknown): error is InternalError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "internalDetails" in error
  );
}
