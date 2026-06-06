import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { FinancialService } from "./financial.service";

/**
 * Refund Service - Handles refund processing with idempotency and audit trail
 * 
 * Key guarantees:
 * - Idempotency enforced (same idempotencyKey returns same result)
 * - Ledger is append-only (refund recorded as new entry, not update)
 * - Original transaction reference required
 * - Prevents duplicate refunds (checks ledger for existing refund)
 * - Restores balance and used_credit correctly
 */

export interface RefundRequest {
  distributorId: number;
  transactionId: number;
  purchaseAmount: string;
  commissionAmount: string;
  refundReason: string;
  idempotencyKey: string;
}

export interface RefundResponse {
  transactionId: number;
  refundId: number;
  finalBalance: string;
  finalUsedCredit: string;
  totalRefunded: string;
  timestamp: Date;
}

export interface RefundStatus {
  transactionId: number;
  hasRefund: boolean;
  refundAmount?: string;
  refundReason?: string;
  refundedAt?: Date;
}

export interface RefundHistoryEntry {
  refundId: number;
  transactionId: number;
  amount: string;
  reason: string;
  timestamp: Date;
}

export class RefundService {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL not set");
    }

    const urlObj = new URL(url);
    const sslParam = urlObj.searchParams.get("ssl");
    const sslConfig = sslParam ? JSON.parse(sslParam) : undefined;

    const connection = await mysql.createConnection({
      host: urlObj.hostname,
      user: urlObj.username,
      password: urlObj.password,
      database: urlObj.pathname.slice(1),
      ssl: sslConfig,
    });

    this.db = drizzle(connection, { schema, mode: "default" });
  }

  /**
   * Process a refund for a completed purchase
   * 
   * Algorithm:
   * 1. Verify transaction exists
   * 2. Check for duplicate refund (idempotency)
   * 3. Verify amounts match original transaction
   * 4. Call FinancialService.processRefund()
   * 5. Update transaction status to refunded
   * 6. Return refund details
   */
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    // Ensure DB is initialized
    if (!this.db) {
      await this.initializeDb();
    }

    const {
      distributorId,
      transactionId,
      purchaseAmount,
      commissionAmount,
      refundReason,
      idempotencyKey,
    } = request;

    // 1. Verify transaction exists
    const transaction = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.distributorId, distributorId)
        )
      )
      .limit(1);

    if (!transaction || transaction.length === 0) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const txn = transaction[0];

    // 2. Check for duplicate refund (idempotency)
    const existingRefund = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(
        and(
          eq(schema.providerDistributorLedger.referenceId, transactionId.toString()),
          eq(schema.providerDistributorLedger.referenceType, "refund")
        )
      )
      .limit(1);

    if (existingRefund && existingRefund.length > 0) {
      // Refund already exists - return existing refund details
      const refund = existingRefund[0];
      const account = await this.db
        .select()
        .from(schema.providerDistributorAccounts)
        .where(
          and(
            eq(schema.providerDistributorAccounts.providerId, txn.providerId),
            eq(schema.providerDistributorAccounts.distributorId, distributorId)
          )
        )
        .limit(1);

      return {
        transactionId,
        refundId: refund.id,
        finalBalance: account[0].balance,
        finalUsedCredit: account[0].usedCredit,
        totalRefunded: refund.amount,
        timestamp: refund.createdAt,
      };
    }

    // 3. Verify amounts match original transaction
    if (
      txn.amount !== purchaseAmount ||
      txn.commissionAmount !== commissionAmount
    ) {
      throw new Error(
        `Amount mismatch: transaction has ${txn.amount}/${txn.commissionAmount}, ` +
        `but refund request has ${purchaseAmount}/${commissionAmount}`
      );
    }

    // 4. Call FinancialService.processRefund()
    const result = await FinancialService.processRefund(
      this.db,
      txn.providerId,
      distributorId,
      transactionId,
      new Decimal(purchaseAmount),
      new Decimal(commissionAmount),
      refundReason
    );

    // 5. Update transaction status to refunded
    await this.db
      .update(schema.transactions)
      .set({
        status: "refunded",
        updatedAt: new Date(),
      })
      .where(eq(schema.transactions.id, transactionId));

    // 6. Get the refund ledger entry ID
    const refundEntry = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(
        and(
          eq(schema.providerDistributorLedger.referenceId, transactionId.toString()),
          eq(schema.providerDistributorLedger.referenceType, "refund")
        )
      )
      .orderBy(schema.providerDistributorLedger.createdAt)
      .limit(1);

    const refundId = refundEntry[0]?.id || 0;

    return {
      transactionId,
      refundId,
      finalBalance: result.finalBalance.toFixed(2),
      finalUsedCredit: result.finalUsedCredit.toFixed(2),
      totalRefunded: new Decimal(purchaseAmount)
        .plus(commissionAmount)
        .toFixed(2),
      timestamp: new Date(),
    };
  }

  /**
   * Get refund status for a transaction
   */
  async getRefundStatus(options: {
    distributorId: number;
    transactionId: number;
  }): Promise<RefundStatus> {
    if (!this.db) {
      await this.initializeDb();
    }

    const { distributorId, transactionId } = options;

    // Check if refund exists
    const refund = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(
        and(
          eq(schema.providerDistributorLedger.referenceId, transactionId.toString()),
          eq(schema.providerDistributorLedger.referenceType, "refund")
        )
      )
      .limit(1);

    if (!refund || refund.length === 0) {
      return {
        transactionId,
        hasRefund: false,
      };
    }

    const refundEntry = refund[0];
    const metadata = refundEntry.metadata ? JSON.parse(refundEntry.metadata) : {};

    return {
      transactionId,
      hasRefund: true,
      refundAmount: refundEntry.amount,
      refundReason: metadata.refundReason || "Unknown",
      refundedAt: refundEntry.createdAt,
    };
  }

  /**
   * Get refund history for a transaction
   */
  async getRefundHistory(options: {
    distributorId: number;
    transactionId: number;
  }): Promise<RefundHistoryEntry[]> {
    if (!this.db) {
      await this.initializeDb();
    }

    const { transactionId } = options;

    // Get all refund entries for this transaction
    const refunds = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(
        and(
          eq(schema.providerDistributorLedger.referenceId, transactionId.toString()),
          eq(schema.providerDistributorLedger.referenceType, "refund")
        )
      )
      .orderBy(schema.providerDistributorLedger.createdAt);

    return refunds.map((entry: any) => {
      const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};
      return {
        refundId: entry.id,
        transactionId,
        amount: entry.amount,
        reason: metadata.refundReason || "Unknown",
        timestamp: entry.createdAt,
      };
    });
  }
}
