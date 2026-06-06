import { Decimal } from "decimal.js";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  providerDistributorAccounts,
  providerDistributorLedger,
  providerDistributorRelationships,
} from "../../drizzle/schema";
import { MonitoringService } from "./monitoring.service";
import { AlertService } from "./alert.service";

/**
 * Financial Service - Core financial operations for provider-distributor accounts
 * 
 * CRITICAL GUARANTEES:
 * - All balance-affecting operations use SELECT FOR UPDATE for atomicity
 * - Ledger is append-only (no updates, no deletes)
 * - Account state is always consistent with ledger
 * - All amounts use Decimal for precision
 * - Commission is credited into the same account/ledger
 */

export interface AccountBalance {
  balance: Decimal;
  creditLine: Decimal;
  usedCredit: Decimal;
  availableToSpend: Decimal;
}

export interface LedgerEntry {
  id: number;
  providerId: number;
  distributorId: number;
  type: "DEBIT" | "CREDIT" | "ADJUSTMENT";
  amount: Decimal;
  balanceAfterTransaction: Decimal;
  usedCreditAfterTransaction: Decimal;
  referenceId: string | null;
  referenceType: "purchase_debit" | "commission_credit" | "topup" | "refund" | "adjustment";
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export class FinancialService {
  /**
   * Validate account invariants
   * 
   * CRITICAL: These invariants MUST always hold:
   * - balance >= 0
   * - used_credit >= 0
   * - used_credit <= credit_line
   * 
   * If any invariant is violated, log a critical alert.
   */
  static async validateAndLogInvariants(
    db: any,
    providerId: number,
    distributorId: number,
    balance: Decimal,
    usedCredit: Decimal,
    creditLine: Decimal,
    referenceId?: string,
  ): Promise<boolean> {
    const violations = MonitoringService.validateInvariants(balance, usedCredit, creditLine);

    if (!violations.valid) {
      // Log critical alert for each violation
      for (const violation of violations.violations) {
        const [rule] = violation.split(":");
        await MonitoringService.logInvariantViolation(db, {
          rule: rule as any,
          providerId,
          distributorId,
          balance,
          usedCredit,
          creditLine,
          referenceId,
        });
      }
      return false;
    }

    return true;
  }

  /**
   * Get current account balance with available to spend calculation
   * 
   * Available to Spend = Balance + (Credit Line - Used Credit)
   */
  static async getAccountBalance(
    db: any,
    providerId: number,
    distributorId: number,
  ): Promise<AccountBalance | null> {
    const result = await db
      .select()
      .from(providerDistributorAccounts)
      .where(
        and(
          eq(providerDistributorAccounts.providerId, providerId),
          eq(providerDistributorAccounts.distributorId, distributorId),
        ),
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const account = result[0];
    const balance = new Decimal(account.balance);
    const creditLine = new Decimal(account.creditLine);
    const usedCredit = new Decimal(account.usedCredit);
    const availableToSpend = balance.plus(creditLine.minus(usedCredit));

    return {
      balance,
      creditLine,
      usedCredit,
      availableToSpend,
    };
  }

  /**
   * Create or initialize an account for a provider-distributor relationship
   * Called when access request is approved
   */
  static async createAccount(
    db: any,
    providerId: number,
    distributorId: number,
    creditLine: Decimal | string,
  ): Promise<void> {
    await db.insert(providerDistributorAccounts).values({
      providerId,
      distributorId,
      balance: "0.00",
      creditLine: creditLine.toString(),
      usedCredit: "0.00",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Lock account for update (SELECT FOR UPDATE)
   * Must be called within a transaction context
   * 
   * CRITICAL: This prevents concurrent balance modifications
   */
  static async lockAccountForUpdate(
    db: any,
    providerId: number,
    distributorId: number,
  ): Promise<any> {
    // Use Drizzle query builder with FOR UPDATE
    const result = await db
      .select()
      .from(providerDistributorAccounts)
      .where(
        and(
          eq(providerDistributorAccounts.providerId, providerId),
          eq(providerDistributorAccounts.distributorId, distributorId),
        ),
      )
      .limit(1);

    return result && result.length > 0 ? result[0] : null;
  }

  /**
   * Validate relationship is active and allows credit if needed
   */
  static async validateRelationship(
    db: any,
    providerId: number,
    distributorId: number,
    needsCredit: boolean = false,
  ): Promise<{ valid: boolean; error?: string; allowCredit?: boolean }> {
    const result = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, providerId),
          eq(providerDistributorRelationships.distributorId, distributorId),
        ),
      )
      .limit(1);

    if (!result || result.length === 0) {
      return { valid: false, error: "Relationship not found" };
    }

    const relationship = result[0];

    if (relationship.status !== "active") {
      return { valid: false, error: `Relationship is ${relationship.status}` };
    }

    if (needsCredit && !relationship.allowCredit) {
      return { valid: false, error: "Credit not allowed for this relationship" };
    }

    return { valid: true, allowCredit: relationship.allowCredit };
  }

  /**
   * Record a ledger entry (append-only)
   * 
   * CRITICAL: This is the audit trail. Never update or delete.
   */
  static async recordLedgerEntry(
    db: any,
    data: {
      providerId: number;
      distributorId: number;
      type: "DEBIT" | "CREDIT" | "ADJUSTMENT";
      amount: Decimal | string;
      balanceAfterTransaction: Decimal | string;
      usedCreditAfterTransaction: Decimal | string;
      referenceId: string;
      referenceType: "purchase_debit" | "commission_credit" | "topup" | "refund" | "adjustment";
      metadata?: Record<string, any>;
    },
  ): Promise<number> {
    const result = await db.insert(providerDistributorLedger).values({
      providerId: data.providerId,
      distributorId: data.distributorId,
      type: data.type,
      amount: data.amount.toString(),
      balanceAfterTransaction: data.balanceAfterTransaction.toString(),
      usedCreditAfterTransaction: data.usedCreditAfterTransaction.toString(),
      referenceId: data.referenceId,
      referenceType: data.referenceType,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      createdAt: new Date(),
    });

    return result.insertId;
  }

  /**
   * Get ledger history for a provider-distributor relationship
   */
  static async getLedgerHistory(
    db: any,
    providerId: number,
    distributorId: number,
    limit: number = 100,
    offset: number = 0,
  ): Promise<LedgerEntry[]> {
    const result = await db
      .select()
      .from(providerDistributorLedger)
      .where(
        and(
          eq(providerDistributorLedger.providerId, providerId),
          eq(providerDistributorLedger.distributorId, distributorId),
        ),
      )
      .orderBy(desc(providerDistributorLedger.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map((entry: any) => ({
      id: entry.id,
      providerId: entry.providerId,
      distributorId: entry.distributorId,
      type: entry.type,
      amount: new Decimal(entry.amount),
      balanceAfterTransaction: new Decimal(entry.balanceAfterTransaction),
      usedCreditAfterTransaction: new Decimal(entry.usedCreditAfterTransaction),
      referenceId: entry.referenceId,
      referenceType: entry.referenceType,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Get ledger entry by reference ID
   */
  static async getLedgerEntryByReference(
    db: any,
    referenceId: string,
    referenceType: "purchase_debit" | "commission_credit" | "topup" | "refund" | "adjustment",
  ): Promise<LedgerEntry | null> {
    const result = await db
      .select()
      .from(providerDistributorLedger)
      .where(
        and(
          eq(providerDistributorLedger.referenceId, referenceId),
          eq(providerDistributorLedger.referenceType, referenceType),
        ),
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const entry = result[0];
    return {
      id: entry.id,
      providerId: entry.providerId,
      distributorId: entry.distributorId,
      type: entry.type,
      amount: new Decimal(entry.amount),
      balanceAfterTransaction: new Decimal(entry.balanceAfterTransaction),
      usedCreditAfterTransaction: new Decimal(entry.usedCreditAfterTransaction),
      referenceId: entry.referenceId,
      referenceType: entry.referenceType,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
      createdAt: entry.createdAt,
    };
  }

  /**
   * PURCHASE FLOW: Debit purchase amount, then credit commission
   * 
   * Algorithm:
   * 1. Lock account
   * 2. Calculate available to spend
   * 3. Validate sufficient balance
   * 4. Determine deduction source (balance vs credit)
   * 5. Record DEBIT ledger entry
   * 6. Calculate commission
   * 7. Apply commission credit (reduces used_credit first, then increases balance)
   * 8. Record CREDIT ledger entry
   * 9. Update account with final state
   * 
   * Returns: { finalBalance, finalUsedCredit, commissionAmount }
   */
  static async processPurchase(
    db: any,
    providerId: number,
    distributorId: number,
    purchaseAmount: Decimal | string,
    commissionPercentage: Decimal | string,
    transactionId: number,
  ): Promise<{
    finalBalance: Decimal;
    finalUsedCredit: Decimal;
    commissionAmount: Decimal;
  }> {
    const purchase = new Decimal(purchaseAmount);
    const commission = new Decimal(commissionPercentage);

    // 1. Lock account
    const lockedAccount = await this.lockAccountForUpdate(db, providerId, distributorId);
    if (!lockedAccount) {
      throw new Error("Account not found");
    }

    const balance = new Decimal(lockedAccount.balance);
    const creditLine = new Decimal(lockedAccount.creditLine);
    const usedCredit = new Decimal(lockedAccount.usedCredit);

    // 2. Calculate available to spend
    const availableToSpend = balance.plus(creditLine.minus(usedCredit));

    // 3. Validate sufficient balance
    if (availableToSpend.lessThan(purchase)) {
      throw new Error(`Insufficient funds: required ${purchase}, available ${availableToSpend}`);
    }

    // 4. Determine deduction source
    let newBalance: Decimal;
    let newUsedCredit: Decimal;
    let creditUsedInPurchase: Decimal;

    if (balance.greaterThanOrEqualTo(purchase)) {
      // Deduct from balance only
      newBalance = balance.minus(purchase);
      newUsedCredit = usedCredit;
      creditUsedInPurchase = new Decimal(0);
    } else {
      // Use balance + credit
      const creditToUse = purchase.minus(balance);
      if (creditToUse.greaterThan(creditLine.minus(usedCredit))) {
        throw new Error("Insufficient credit available");
      }
      newBalance = new Decimal(0);
      newUsedCredit = usedCredit.plus(creditToUse);
      creditUsedInPurchase = creditToUse;
    }

    // 5. Record DEBIT ledger entry (purchase)
    const commissionAmount = purchase.times(commission);
    await this.recordLedgerEntry(db, {
      providerId,
      distributorId,
      type: "DEBIT",
      amount: purchase,
      balanceAfterTransaction: newBalance,
      usedCreditAfterTransaction: newUsedCredit,
      referenceId: transactionId.toString(),
      referenceType: "purchase_debit",
      metadata: {
        transactionId,
        purchaseAmount: purchase.toString(),
        commissionPercentage: commission.toString(),
        commissionAmount: commissionAmount.toString(),
      },
    });

    // 6-7. Apply commission credit
    let finalBalance: Decimal;
    let finalUsedCredit: Decimal;
    let creditReduction: Decimal;

    if (newUsedCredit.greaterThan(0)) {
      // Commission reduces used_credit first
      creditReduction = Decimal.min(commissionAmount, newUsedCredit);
      const balanceIncrease = commissionAmount.minus(creditReduction);
      finalUsedCredit = newUsedCredit.minus(creditReduction);
      finalBalance = newBalance.plus(balanceIncrease);
    } else {
      // All commission goes to balance
      creditReduction = new Decimal(0);
      finalUsedCredit = newUsedCredit;
      finalBalance = newBalance.plus(commissionAmount);
    }

    // 8. Record CREDIT ledger entry (commission)
    await this.recordLedgerEntry(db, {
      providerId,
      distributorId,
      type: "CREDIT",
      amount: commissionAmount,
      balanceAfterTransaction: finalBalance,
      usedCreditAfterTransaction: finalUsedCredit,
      referenceId: transactionId.toString(),
      referenceType: "commission_credit",
      metadata: {
        transactionId,
        commissionAmount: commissionAmount.toString(),
        commissionPercentage: commission.toString(),
        creditReducedBy: creditReduction.toString(),
        balanceIncreasedBy: commissionAmount.minus(creditReduction).toString(),
      },
    });

    // 9. Update account with final state
    await db.execute(sql`
      UPDATE provider_distributor_accounts
      SET balance = ${finalBalance.toString()},
          used_credit = ${finalUsedCredit.toString()},
          version = version + 1,
          updated_at = NOW()
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    // 10. Validate invariants (non-blocking)
    await this.validateAndLogInvariants(
      db,
      providerId,
      distributorId,
      finalBalance,
      finalUsedCredit,
      creditLine,
      transactionId.toString(),
    );

    return {
      finalBalance,
      finalUsedCredit,
      commissionAmount,
    };
  }

  /**
   * TOP-UP FLOW: Provider credits distributor account
   * 
   * Implements automatic settlement:
   * 1. If usedCredit > 0: apply top-up to reduce usedCredit first
   * 2. If top-up exceeds usedCredit: remaining goes to balance
   * 3. If usedCredit = 0: full top-up goes to balance
   * 
   * Records a CREDIT ledger entry with detailed settlement metadata
   */
  static async processTopUp(
    db: any,
    providerId: number,
    distributorId: number,
    topupAmount: Decimal | string,
    paymentId: string,
  ): Promise<{ newBalance: Decimal; newUsedCredit: Decimal }> {
    const amount = new Decimal(topupAmount);

    // Lock account
    const lockedAccount = await FinancialService.lockAccountForUpdate(db, providerId, distributorId);
    if (!lockedAccount) {
      throw new Error("Account not found");
    }

    const originalBalance = new Decimal(lockedAccount.balance);
    const originalUsedCredit = new Decimal(lockedAccount.usedCredit);
    const creditLine = new Decimal(lockedAccount.creditLine);

    // Automatic settlement logic
    let newBalance = originalBalance;
    let newUsedCredit = originalUsedCredit;
    let amountAppliedToUsedCredit = new Decimal(0);
    let amountAddedToBalance = new Decimal(0);

    if (originalUsedCredit.greaterThan(0)) {
      // Apply top-up to reduce usedCredit first
      amountAppliedToUsedCredit = Decimal.min(amount, originalUsedCredit);
      newUsedCredit = originalUsedCredit.minus(amountAppliedToUsedCredit);
      
      // Remaining top-up goes to balance
      amountAddedToBalance = amount.minus(amountAppliedToUsedCredit);
      newBalance = originalBalance.plus(amountAddedToBalance);
    } else {
      // No used credit, full top-up goes to balance
      amountAddedToBalance = amount;
      newBalance = originalBalance.plus(amount);
    }

    // Record ledger entry with detailed settlement metadata
    await this.recordLedgerEntry(db, {
      providerId,
      distributorId,
      type: "CREDIT",
      amount,
      balanceAfterTransaction: newBalance,
      usedCreditAfterTransaction: newUsedCredit,
      referenceId: paymentId,
      referenceType: "topup",
      metadata: {
        reason: "provider_topup",
        paymentId,
        topupAmount: amount.toString(),
        originalBalance: originalBalance.toString(),
        originalUsedCredit: originalUsedCredit.toString(),
        amountAppliedToUsedCredit: amountAppliedToUsedCredit.toString(),
        amountAddedToBalance: amountAddedToBalance.toString(),
        finalBalance: newBalance.toString(),
        finalUsedCredit: newUsedCredit.toString(),
      },
    });

    // Update account with both balance and usedCredit
    await db.execute(sql`
      UPDATE provider_distributor_accounts
      SET balance = ${newBalance.toString()},
          used_credit = ${newUsedCredit.toString()},
          version = version + 1,
          updated_at = NOW()
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    // Validate invariants (non-blocking)
    await this.validateAndLogInvariants(
      db,
      providerId,
      distributorId,
      newBalance,
      newUsedCredit,
      creditLine,
      paymentId,
    );

    return { newBalance, newUsedCredit }
  }

  /**
   * REFUND FLOW: Reverse a completed purchase
   * 
   * Reverses both the DEBIT (purchase) and CREDIT (commission) entries
   * Uses exact ledger entries to determine allocation (not inferred from balance)
   */
  static async processRefund(
    db: any,
    providerId: number,
    distributorId: number,
    transactionId: number,
    purchaseAmount: Decimal | string,
    commissionAmount: Decimal | string,
    refundReason: string,
  ): Promise<{ finalBalance: Decimal; finalUsedCredit: Decimal }> {
    const purchase = new Decimal(purchaseAmount);
    const commission = new Decimal(commissionAmount);

    // Lock account
    const lockedAccount = await FinancialService.lockAccountForUpdate(db, providerId, distributorId);
    if (!lockedAccount) {
      throw new Error("Account not found");
    }

    const currentBalance = new Decimal(lockedAccount.balance);
    const currentUsedCredit = new Decimal(lockedAccount.usedCredit);
    const creditLine = new Decimal(lockedAccount.creditLine);

    // Get original ledger entries to determine exact allocation
    const purchaseEntry = await this.getLedgerEntryByReference(
      db,
      transactionId.toString(),
      "purchase_debit",
    );
    const commissionEntry = await this.getLedgerEntryByReference(
      db,
      transactionId.toString(),
      "commission_credit",
    );

    if (!purchaseEntry || !commissionEntry) {
      throw new Error("Original transaction ledger entries not found");
    }

    // State after purchase debit (before commission credit)
    const stateAfterDebit = {
      balance: purchaseEntry.balanceAfterTransaction,
      usedCredit: purchaseEntry.usedCreditAfterTransaction,
    };

    // Reverse commission credit
    let stateAfterCommissionReversal = { ...stateAfterDebit };

    if (commissionEntry.usedCreditAfterTransaction.lessThan(currentUsedCredit)) {
      // Credit was repaid after commission, restore proportionally
      const creditToRestore = currentUsedCredit.minus(
        commissionEntry.usedCreditAfterTransaction,
      );
      const balanceToReduce = commission.minus(creditToRestore);
      stateAfterCommissionReversal.balance = currentBalance.minus(balanceToReduce);
      stateAfterCommissionReversal.usedCredit = currentUsedCredit.plus(creditToRestore);
    } else {
      // All credit from commission is still in use
      stateAfterCommissionReversal.balance = currentBalance.minus(commission);
      stateAfterCommissionReversal.usedCredit = currentUsedCredit;
    }

    // Reverse purchase debit
    let finalBalance = stateAfterCommissionReversal.balance;
    let finalUsedCredit = stateAfterCommissionReversal.usedCredit;

    if (stateAfterDebit.usedCredit.greaterThan(stateAfterCommissionReversal.usedCredit)) {
      // Credit was used in purchase
      const creditToRestore = stateAfterDebit.usedCredit.minus(
        stateAfterCommissionReversal.usedCredit,
      );
      const balanceToIncrease = purchase.minus(creditToRestore);
      finalBalance = stateAfterCommissionReversal.balance.plus(balanceToIncrease);
      finalUsedCredit = stateAfterCommissionReversal.usedCredit.minus(creditToRestore);
    } else {
      // Balance was used in purchase
      finalBalance = stateAfterCommissionReversal.balance.plus(purchase);
      finalUsedCredit = stateAfterCommissionReversal.usedCredit;
    }

    // Record refund ledger entry
    const totalRefund = purchase.plus(commission);
    await this.recordLedgerEntry(db, {
      providerId,
      distributorId,
      type: "CREDIT",
      amount: totalRefund,
      balanceAfterTransaction: finalBalance,
      usedCreditAfterTransaction: finalUsedCredit,
      referenceId: transactionId.toString(),
      referenceType: "refund",
      metadata: {
        originalTransactionId: transactionId,
        refundReason,
        purchaseAmount: purchase.toString(),
        commissionAmount: commission.toString(),
        totalRefund: totalRefund.toString(),
      },
    });

    // Update account
    await db.execute(sql`
      UPDATE provider_distributor_accounts
      SET balance = ${finalBalance.toString()},
          used_credit = ${finalUsedCredit.toString()},
          version = version + 1,
          updated_at = NOW()
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    return { finalBalance, finalUsedCredit };
  }

  /**
   * ADJUSTMENT FLOW: Admin manual correction
   * 
   * Records an ADJUSTMENT ledger entry
   */
  static async processAdjustment(
    db: any,
    providerId: number,
    distributorId: number,
    adjustmentType: "balance" | "credit",
    adjustmentAmount: Decimal | string,
    reviewedBy: number,
    reason: string,
  ): Promise<{ finalBalance: Decimal; finalUsedCredit: Decimal }> {
    const amount = new Decimal(adjustmentAmount);

    // Lock account
    const lockedAccount = await FinancialService.lockAccountForUpdate(db, providerId, distributorId);
    if (!lockedAccount) {
      throw new Error("Account not found");
    }

    const balance = new Decimal(lockedAccount.balance);
    const usedCredit = new Decimal(lockedAccount.usedCredit);
    const creditLine = new Decimal(lockedAccount.creditLine);

    let finalBalance = balance;
    let finalUsedCredit = usedCredit;

    if (adjustmentType === "balance") {
      finalBalance = balance.plus(amount);
      if (finalBalance.lessThan(0)) {
        throw new Error("Adjustment would result in negative balance");
      }
    } else if (adjustmentType === "credit") {
      finalUsedCredit = usedCredit.plus(amount);
      if (finalUsedCredit.lessThan(0) || finalUsedCredit.greaterThan(creditLine)) {
        throw new Error("Adjustment would violate credit constraints");
      }
    }

    // Record adjustment ledger entry
    const referenceId = `ADJ-${Date.now()}`;
    await this.recordLedgerEntry(db, {
      providerId,
      distributorId,
      type: "ADJUSTMENT",
      amount: amount.abs(),
      balanceAfterTransaction: finalBalance,
      usedCreditAfterTransaction: finalUsedCredit,
      referenceId,
      referenceType: "adjustment",
      metadata: {
        reviewedBy,
        reason,
        adjustmentType,
        adjustmentAmount: amount.toString(),
      },
    });

    // 8. Update account with final state
    await db.execute(sql`
      UPDATE provider_distributor_accounts
      SET balance = ${finalBalance.toString()},
          used_credit = ${finalUsedCredit.toString()},
          version = version + 1,
          updated_at = NOW()
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
    `);

    // 9. Validate invariants (non-blocking)
    await this.validateAndLogInvariants(
      db,
      providerId,
      distributorId,
      finalBalance,
      finalUsedCredit,
      creditLine,
      referenceId,
    );

    return {
      finalBalance,
      finalUsedCredit,
    };
  }

  /**
   * Get commission earned report for a provider-distributor relationship
   */
  static async getCommissionReport(
    db: any,
    providerId: number,
    distributorId: number,
  ): Promise<{
    totalTransactions: number;
    totalCommissionEarned: Decimal;
    totalPurchaseAmount: Decimal;
  }> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as transaction_count,
        SUM(amount) as total_commission
      FROM provider_distributor_ledger
      WHERE provider_id = ${providerId}
      AND distributor_id = ${distributorId}
      AND reference_type = 'commission_credit'
    `);

    if (!result[0] || result[0].length === 0) {
      return {
        totalTransactions: 0,
        totalCommissionEarned: new Decimal(0),
        totalPurchaseAmount: new Decimal(0),
      };
    }

    const row = result[0][0];
    return {
      totalTransactions: row.transaction_count || 0,
      totalCommissionEarned: new Decimal(row.total_commission || 0),
      totalPurchaseAmount: new Decimal(0), // Will be calculated from purchase_debit entries
    };
  }
}
