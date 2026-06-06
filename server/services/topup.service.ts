import { getDb } from "../db";
import { FinancialService } from "./financial.service";
import { Decimal } from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { providerDistributorAccounts } from "../../drizzle/schema";

/**
 * Provider Top-up Service
 * 
 * Handles crediting distributor accounts when provider receives payment.
 * Uses FinancialService to ensure consistency and audit trail.
 */

export interface TopUpRequest {
  providerId: number;
  distributorId: number;
  amount: Decimal | string;
  paymentId: string;
  description?: string;
}

export interface TopUpResponse {
  success: boolean;
  newBalance: Decimal;
  message: string;
  ledgerEntryId?: number;
}

export class TopUpService {
  /**
   * Process provider top-up
   * 
   * Credits the provider_distributor_account with the top-up amount.
   * Creates a CREDIT ledger entry with referenceType = "topup".
   * 
   * @param request TopUpRequest with provider, distributor, amount, and paymentId
   * @returns TopUpResponse with new balance and success status
   */
  async processTopUp(request: TopUpRequest): Promise<TopUpResponse> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    // Validate inputs
    if (!request.providerId || request.providerId <= 0) {
      throw new Error(`Invalid provider ID: ${request.providerId}`);
    }

    if (!request.distributorId || request.distributorId <= 0) {
      throw new Error(`Invalid distributor ID: ${request.distributorId}`);
    }

    const amount = new Decimal(request.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error(`Invalid top-up amount: ${amount}`);
    }

    if (!request.paymentId || request.paymentId.trim().length === 0) {
      throw new Error("Payment ID is required");
    }

    // Verify account exists
    const account = await db
      .select()
      .from(providerDistributorAccounts)
      .where(
        sql`provider_id = ${request.providerId} AND distributor_id = ${request.distributorId}`
      )
      .limit(1);

    if (!account || account.length === 0) {
      throw new Error(
        `Account not found for provider ${request.providerId} and distributor ${request.distributorId}`
      );
    }

    try {
      // Process top-up using FinancialService
      const result = await FinancialService.processTopUp(
        db,
        request.providerId,
        request.distributorId,
        amount,
        request.paymentId
      );

      return {
        success: true,
        newBalance: result.newBalance,
        message: `Top-up of ${amount} successfully credited to account`,
      };
    } catch (error) {
      throw new Error(
        `Top-up failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get account balance for provider-distributor pair
   */
  async getAccountBalance(
    providerId: number,
    distributorId: number
  ): Promise<{
    balance: Decimal;
    creditLine: Decimal;
    usedCredit: Decimal;
    availableToSpend: Decimal;
  } | null> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const result = await FinancialService.getAccountBalance(
      db,
      providerId,
      distributorId
    );

    if (!result) {
      return null;
    }

    return {
      balance: result.balance,
      creditLine: result.creditLine,
      usedCredit: result.usedCredit,
      availableToSpend: result.availableToSpend,
    };
  }

  /**
   * Get ledger history for provider-distributor pair
   */
  async getLedgerHistory(
    providerId: number,
    distributorId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    return FinancialService.getLedgerHistory(
      db,
      providerId,
      distributorId,
      limit,
      offset
    );
  }
}

export const topUpService = new TopUpService();
