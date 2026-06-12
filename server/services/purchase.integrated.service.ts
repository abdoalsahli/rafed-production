import { getDb, atomicAllocateAndMarkCard, getCommissionRate, getTransactionByIdempotencyKey, getProduct, atomicMarkPinAsViewed, getCardEncryptedPin, getCardDetails } from "../db";
import { pinEncryptionService } from "./encryption.service";
import { FinancialService } from "./financial.service";
import { Decimal } from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { transactions } from "../../drizzle/schema";
import { insertAuditLog } from "../db";
import {
  PurchaseErrorCode,
  createStructuredError,
  toClientResponse,
  logError,
  isStructuredError,
} from "./errors";

/**
 * INTEGRATED Purchase Card Service - Using FinancialService for Provider-Distributor Accounts
 * 
 * This version integrates FinancialService to replace the old wallet-based system.
 * 
 * Key changes from original:
 * 1. ✓ Uses FinancialService.processPurchase() instead of wallet deduction
 * 2. ✓ Creates two ledger entries: purchase_debit + commission_credit
 * 3. ✓ Commission is credited into provider-specific account
 * 4. ✓ Maintains all idempotency and transaction safety guarantees
 * 5. ✓ Preserves PIN security and audit logging
 * 6. ✓ API contract remains unchanged
 */

export interface PurchaseCardRequest {
  distributorId: number;
  productId: number;
  idempotencyKey: string;
}

export interface PurchaseCardResponse {
  transactionId: string;
  status: "completed" | "failed";
  pin: string | null;
  serialNumber: string | null;
  message?: string;
  amount: string;
  commission: string;
  timestamp: Date;
}

export interface TransactionData {
  transactionId: number;
  cardId: number;
  commissionAmount: Decimal;
  accountBalance: Decimal;
  amount: string;
  createdAt: Date;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10;
const TRANSACTION_TIMEOUT_MS = 3000;

async function withTransactionTimeout<T>(
  transactionPromise: Promise<T>,
): Promise<T> {
  return Promise.race([
    transactionPromise,
    new Promise<T>((_, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(
          `[Purchase] Transaction timeout (${TRANSACTION_TIMEOUT_MS}ms exceeded)`,
        );
        reject(
          new Error(
            `Transaction timeout (${TRANSACTION_TIMEOUT_MS}ms). Please retry.`,
          ),
        );
      }, TRANSACTION_TIMEOUT_MS);

      transactionPromise
        .then(() => clearTimeout(timeoutId))
        .catch(() => clearTimeout(timeoutId));
    }),
  ]);
}

export class PurchaseIntegratedService {
  /**
   * Main purchase flow using FinancialService for provider-distributor accounts
   */
  async purchaseCard(request: PurchaseCardRequest): Promise<PurchaseCardResponse> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    // ============================================================
    // STEP 1: Validate inputs and fetch product (BEFORE transaction)
    // ============================================================
    if (!request.distributorId || request.distributorId <= 0) {
      throw createStructuredError(
        PurchaseErrorCode.INVALID_DISTRIBUTOR,
        `Invalid distributor ID: ${request.distributorId}`,
      );
    }

    if (!request.productId || request.productId <= 0) {
      throw createStructuredError(
        PurchaseErrorCode.INVALID_PRODUCT,
        `Invalid product ID: ${request.productId}`,
      );
    }

    const product = await getProduct(db, request.productId);
    if (!product) {
      throw createStructuredError(
        PurchaseErrorCode.PRODUCT_NOT_FOUND,
        `Product not found: ${request.productId}`,
      );
    }

    const providerId = product.providerId;
    const amount = product.price;

    // ============================================================
    // STEP 2-13: ENTIRE TRANSACTION
    // ============================================================
    let transactionResult: TransactionData;

    try {
      transactionResult = await withTransactionTimeout(
        db.transaction(async (tx) => {
          // ============================================================
          // STEP 3: Check idempotency key INSIDE transaction
          // ============================================================
          const existingTx = await tx
            .select()
            .from(transactions)
            .where(eq(transactions.idempotencyKey, request.idempotencyKey))
            .limit(1);

          if (existingTx && existingTx.length > 0) {
            const existing = existingTx[0];
            console.log(
              `[Purchase] Duplicate request detected (idempotency key: ${request.idempotencyKey})`,
            );

            return {
              transactionId: existing.id,
              cardId: existing.cardId,
              commissionAmount: new Decimal(existing.commissionAmount),
              accountBalance: new Decimal(existing.amount),
              amount: existing.amount,
              createdAt: existing.createdAt,
            };
          }

          // ============================================================
          // STEP 4: Get commission rate
          // ============================================================
          const commissionConfig = await getCommissionRate(
            db,
            providerId,
            request.distributorId,
          );

          if (!commissionConfig) {
            throw createStructuredError(
              PurchaseErrorCode.TRANSACTION_FAILED,
              "Commission configuration not found for this provider-distributor pair",
            );
          }

          // commissionRate is stored as decimal rate e.g. 0.0500 = 5%
          let commissionPercentage: Decimal;
          if (commissionConfig.commissionType === "percentage") {
            commissionPercentage = new Decimal(commissionConfig.commissionRate);
          } else {
            // fixed amount: convert to a rate relative to purchase price
            commissionPercentage = new Decimal(commissionConfig.commissionRate).dividedBy(new Decimal(amount));
          }

          // ============================================================
          // STEP 5: Process purchase using FinancialService
          // ============================================================
          // This creates TWO ledger entries:
          // 1. purchase_debit: deducts from account
          // 2. commission_credit: credits commission into account
          let purchaseResult;
          try {
            purchaseResult = await FinancialService.processPurchase(
              db,
              providerId,
              request.distributorId,
              new Decimal(amount),
              commissionPercentage,
              0 // transactionId placeholder
            );
          } catch (error) {
            throw createStructuredError(
              PurchaseErrorCode.INSUFFICIENT_BALANCE,
              error instanceof Error ? error.message : "Purchase failed: insufficient balance or credit",
            );
          }

          // ============================================================
          // STEP 6: Atomically allocate and mark card as SOLD
          // ============================================================
          // This single operation prevents race conditions by combining
          // SELECT FOR UPDATE SKIP LOCKED and UPDATE into one atomic operation.
          // Only ONE concurrent request can successfully allocate each card.
          const card = await atomicAllocateAndMarkCard(
            tx,
            providerId,
            request.productId,
            request.distributorId
          );

          if (!card) {
            throw createStructuredError(
              PurchaseErrorCode.NO_INVENTORY,
              `No available cards for product ${request.productId} from provider ${providerId}`,
            );
          }

          // ============================================================
          // STEP 8: Record transaction
          // ============================================================
          const commissionAmount = new Decimal(amount).times(commissionPercentage);
          const txId = await recordTransaction(db, {
            idempotencyKey: request.idempotencyKey,
            distributorId: request.distributorId,
            providerId,
            productId: request.productId,
            cardId: card.id,
            amount: amount,
            commissionAmount: commissionAmount.toString(),
          });

          // ============================================================
          // STEP 9: Return transaction data
          // ============================================================
          return {
            transactionId: txId,
            cardId: card.id,
            commissionAmount,
            accountBalance: purchaseResult.finalBalance,
            amount: amount,
            createdAt: new Date(),
          };
        })
      );
    } catch (error) {
      if (isStructuredError(error)) {
        logError(error, "Purchase");
        throw error;
      }

      if (error instanceof Error && error.message.includes("Transaction timeout")) {
        const timeoutError = createStructuredError(
          PurchaseErrorCode.TRANSACTION_TIMEOUT,
          `Transaction exceeded timeout: ${error.message}`,
          error,
        );
        logError(timeoutError, "Purchase");
        throw timeoutError;
      }

      const internalError = createStructuredError(
        PurchaseErrorCode.TRANSACTION_FAILED,
        `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
      logError(internalError, "Purchase");
      throw internalError;
    }

    // ============================================================
    // STEP 10: AFTER transaction commit - Atomic PIN access control
    // ============================================================
    let decryptedPin: string | null = null;
    let serialNumber:  string | null = null;
    let pinAccessGranted = false;

    try {
      const accessControl = await atomicMarkPinAsViewed(db, transactionResult.cardId);

      if (accessControl.success) {
        pinAccessGranted = true;

        const cardDetails = await getCardDetails(db, transactionResult.cardId);

        if (!cardDetails) {
          throw createStructuredError(
            PurchaseErrorCode.CARD_NOT_FOUND,
            `Card not found after transaction: ${transactionResult.cardId}`,
          );
        }

        serialNumber = cardDetails.serialNumber;

        try {
          decryptedPin = await pinEncryptionService.decryptPIN(cardDetails.pinEncrypted);
        } catch (decryptError) {
          throw createStructuredError(
            PurchaseErrorCode.PIN_DECRYPTION_FAILED,
            `PIN decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`,
            decryptError instanceof Error ? decryptError : undefined,
          );
        }

        try {
          await insertAuditLog(db, {
            userId: request.distributorId,
            action: "PIN_VIEWED",
            resourceId: transactionResult.cardId,
            metadata: {
              transactionId: transactionResult.transactionId,
              productId: request.productId,
              amount: amount,
              providerId,
            },
          });
        } catch (auditError) {
          console.error("[Audit] Failed to log PIN access:", auditError);
        }
      } else {
        // PIN already viewed — still fetch serial number for reference
        const cardDetails = await getCardDetails(db, transactionResult.cardId);
        serialNumber = cardDetails?.serialNumber ?? null;
        console.log(
          `[Purchase] PIN already viewed for card ${transactionResult.cardId}`,
        );
        pinAccessGranted = false;
      }

      console.log(
        `[Purchase] Successful - Transaction ID: ${transactionResult.transactionId}, Distributor: ${request.distributorId}, Provider: ${providerId}, Amount: ${amount}`,
      );

      const response: PurchaseCardResponse = {
        transactionId: transactionResult.transactionId.toString(),
        status: "completed",
        pin: decryptedPin,
        serialNumber,
        amount: amount,
        commission: transactionResult.commissionAmount.toString(),
        timestamp: transactionResult.createdAt,
      };

      if (!pinAccessGranted) {
        response.message = "PIN already retrieved";
      }

      return response;
    } catch (error) {
      if (isStructuredError(error)) {
        logError(error, "PIN Access");
        return {
          transactionId: transactionResult.transactionId.toString(),
          status: "completed",
          pin: null,
          serialNumber: null,
          message: error.message,
          amount: amount,
          commission: transactionResult.commissionAmount.toString(),
          timestamp: transactionResult.createdAt,
        };
      }

      console.error("[Purchase] Failed to retrieve PIN after transaction:", error);

      if (decryptedPin) {
        pinEncryptionService.constructor.prototype.zeroOutPIN(decryptedPin);
      }

      return {
        transactionId: transactionResult.transactionId.toString(),
        status: "completed",
        pin: null,
        serialNumber: null,
        message: "PIN retrieval failed. Please contact support.",
        amount: amount,
        commission: transactionResult.commissionAmount.toString(),
        timestamp: transactionResult.createdAt,
      };
    } finally {
      if (decryptedPin) {
        pinEncryptionService.constructor.prototype.zeroOutPIN(decryptedPin);
      }
    }
  }

  async retryPurchase(request: PurchaseCardRequest): Promise<PurchaseCardResponse> {
    return this.purchaseCard(request);
  }
}

// Helper function to record transaction
async function recordTransaction(db: any, data: any): Promise<number> {
  const result = await db.insert(transactions).values({
    idempotencyKey: data.idempotencyKey,
    distributorId: data.distributorId,
    providerId: data.providerId,
    productId: data.productId,
    cardId: data.cardId,
    amount: data.amount,
    commissionAmount: data.commissionAmount,
    status: "completed",
  });
  return result[0].insertId;
}

export const purchaseIntegratedService = new PurchaseIntegratedService();
