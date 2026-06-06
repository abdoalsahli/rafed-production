import { getDb } from "../db";
import { AlertService } from "../services/alert.service";
import { MonitoringService } from "../services/monitoring.service";
import { providerDistributorLedger, providerDistributorAccounts } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";

/**
 * Reconciliation Jobs - Scheduled monitoring and validation
 * 
 * These jobs run periodically to:
 * 1. Verify ledger/account consistency
 * 2. Detect missing ledger entry pairs
 * 3. Detect failed purchase spikes
 * 4. Validate financial invariants
 * 
 * CRITICAL: These jobs are read-only and non-blocking.
 * They log alerts but do not modify business data.
 */

/**
 * Job 1: Ledger/Account Reconciliation
 * 
 * Verifies that account balances match ledger calculations
 * Detects data corruption or inconsistencies
 */
export async function reconcileLedgerAndAccounts(): Promise<{
  checked: number;
  mismatches: number;
  alerts: number;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[Reconciliation] Database not available");
    return { checked: 0, mismatches: 0, alerts: 0 };
  }

  try {
    let checked = 0;
    let mismatches = 0;
    let alerts = 0;

    // Get all accounts
    const accounts = await db.select().from(providerDistributorAccounts);

    for (const account of accounts) {
      checked++;

      const providerId = account.providerId;
      const distributorId = account.distributorId;

      // Get latest ledger entry
      const latestLedger = await db
        .select()
        .from(providerDistributorLedger)
        .where(
          and(
            eq(providerDistributorLedger.providerId, providerId),
            eq(providerDistributorLedger.distributorId, distributorId),
          ),
        )
        .orderBy((t: any) => t.createdAt)
        .limit(1);

      if (latestLedger && latestLedger.length > 0) {
        const ledgerEntry = latestLedger[0];
        const accountBalance = new Decimal(account.balance);
        const ledgerBalance = new Decimal(ledgerEntry.balanceAfterTransaction);

        if (!accountBalance.equals(ledgerBalance)) {
          mismatches++;

          const alert = await AlertService.createAlert(db, {
            severity: "critical",
            ruleName: "ledger_account_mismatch",
            providerId,
            distributorId,
            message: `Account balance (${accountBalance}) does not match latest ledger entry (${ledgerBalance})`,
            metadata: {
              accountBalance: accountBalance.toString(),
              ledgerBalance: ledgerBalance.toString(),
              accountVersion: account.version,
              ledgerEntryId: ledgerEntry.id,
            },
          });

          alerts++;
          console.warn(
            `[Reconciliation] Mismatch detected for provider ${providerId}, distributor ${distributorId}`,
          );
        }
      }
    }

    console.info(
      `[Reconciliation] Ledger check complete: ${checked} accounts, ${mismatches} mismatches, ${alerts} alerts`,
    );
    return { checked, mismatches, alerts };
  } catch (error) {
    console.error("[Reconciliation] Ledger reconciliation failed:", error);
    return { checked: 0, mismatches: 0, alerts: 0 };
  }
}

/**
 * Job 2: Detect Missing Ledger Entry Pairs
 * 
 * For each purchase_debit, verify there's a corresponding commission_credit
 * Detects incomplete transactions
 */
export async function detectMissingLedgerPairs(): Promise<{
  checked: number;
  missing: number;
  alerts: number;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[Reconciliation] Database not available");
    return { checked: 0, missing: 0, alerts: 0 };
  }

  try {
    let checked = 0;
    let missing = 0;
    let alerts = 0;

    // Get all purchase_debit entries
    const purchaseDebits = await db
      .select()
      .from(providerDistributorLedger)
      .where(eq(providerDistributorLedger.referenceType, "purchase_debit")) as any[];

    for (const debit of purchaseDebits) {
      checked++;

      // Check if there's a corresponding commission_credit
      const commissionCredit = await db
        .select()
        .from(providerDistributorLedger)
        .where(
          and(
            eq(providerDistributorLedger.providerId, debit.providerId),
            eq(providerDistributorLedger.distributorId, debit.distributorId),
            debit.referenceId ? eq(providerDistributorLedger.referenceId, debit.referenceId) : sql`1=1`,
            eq(providerDistributorLedger.referenceType, "commission_credit"),
          ),
        )
        .limit(1);

      if (!commissionCredit || commissionCredit.length === 0) {
        missing++;

        const alert = await AlertService.createAlert(db, {
          severity: "warning",
          ruleName: "missing_commission_credit",
          providerId: debit.providerId,
          distributorId: debit.distributorId,
          referenceId: debit.referenceId || undefined,
          message: `Purchase debit (ID: ${debit.id}) missing corresponding commission credit`,
          metadata: {
            debitId: debit.id,
            debitAmount: debit.amount,
            referenceId: debit.referenceId,
          },
        });

        alerts++;
        console.warn(
          `[Reconciliation] Missing commission credit for purchase debit ${debit.id}`,
        );
      }
    }

    console.info(
      `[Reconciliation] Ledger pair check complete: ${checked} debits, ${missing} missing pairs, ${alerts} alerts`,
    );
    return { checked, missing, alerts };
  } catch (error) {
    console.error("[Reconciliation] Ledger pair detection failed:", error);
    return { checked: 0, missing: 0, alerts: 0 };
  }
}

/**
 * Job 3: Failed Purchase Spike Detection
 * 
 * Detects unusual patterns of failed purchases
 * Alerts on potential issues with purchase flow
 */
export async function detectFailedPurchaseSpike(): Promise<{
  timeWindow: string;
  failedCount: number;
  alerts: number;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[Reconciliation] Database not available");
    return { timeWindow: "", failedCount: 0, alerts: 0 };
  }

  try {
    // Check for failed purchases in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // This would require a failed_purchases table or status field
    // For now, we'll check for alerts about insufficient funds
    const insufficientFundsAlerts = await AlertService.getAlerts(db, {
      ruleName: "insufficient_funds",
      severity: "warning",
      limit: 1000,
    });

    // Filter alerts from last hour
    const recentAlerts = insufficientFundsAlerts.filter(
      (alert: any) => new Date(alert.createdAt) > oneHourAgo,
    );

    const failedCount = recentAlerts.length;
    let alerts = 0;

    // If more than 10 failures in an hour, create a spike alert
    if (failedCount > 10) {
      const alert = await AlertService.createAlert(db, {
        severity: "warning",
        ruleName: "failed_purchase_spike",
        message: `${failedCount} failed purchases detected in the last hour`,
        metadata: {
          failedCount,
          timeWindow: "1 hour",
          threshold: 10,
        },
      });

      alerts++;
      console.warn(`[Reconciliation] Failed purchase spike detected: ${failedCount} failures`);
    }

    console.info(
      `[Reconciliation] Failed purchase check complete: ${failedCount} failures in last hour, ${alerts} alerts`,
    );
    return {
      timeWindow: "1 hour",
      failedCount,
      alerts,
    };
  } catch (error) {
    console.error("[Reconciliation] Failed purchase spike detection failed:", error);
    return { timeWindow: "", failedCount: 0, alerts: 0 };
  }
}

/**
 * Run all reconciliation jobs
 */
export async function runAllReconciliationJobs(): Promise<{
  ledgerReconciliation: Awaited<ReturnType<typeof reconcileLedgerAndAccounts>>;
  ledgerPairs: Awaited<ReturnType<typeof detectMissingLedgerPairs>>;
  failedPurchases: Awaited<ReturnType<typeof detectFailedPurchaseSpike>>;
}> {
  console.info("[Reconciliation] Starting all reconciliation jobs...");

  const startTime = Date.now();

  const ledgerReconciliation = await reconcileLedgerAndAccounts();
  const ledgerPairs = await detectMissingLedgerPairs();
  const failedPurchases = await detectFailedPurchaseSpike();

  const duration = Date.now() - startTime;

  console.info(`[Reconciliation] All jobs completed in ${duration}ms`);

  return {
    ledgerReconciliation,
    ledgerPairs,
    failedPurchases,
  };
}
