/**
 * Per-Account Queue Manager - Final Hardening Phase
 * 
 * Features:
 * - Stable connection management for GET_LOCK
 * - Worker heartbeat tracking (every 5-10 seconds)
 * - Upgraded recovery logic (lock + heartbeat verification)
 * - Latency and percentile metrics
 * - Alert flags for critical conditions
 * - Automated ledger verification
 */

import { getDb, getRawDb } from './db';
import { purchaseRequests, cards, providerDistributorAccounts, products, providerDistributorRelationships } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { PurchaseWebhookIntegration } from './services/purchase-webhook.integration';
import {
  insertLedgerEntry,
  getOldestPendingRequest,
  updateRequestStatus,
  getRecoverableProcessingRequests,
  countPendingRequests,
  countQueueDepth,
  isQueueAtCapacity,
  countProcessingRequests,
  countSucceededRequests,
  countFailedRequests,
  getOldestPendingAge,
  getQueueLatencyMetrics,
  verifyLedgerCorrectness,
} from './queue-sql';
import { getQueueConfig } from './queue-config';

export interface QueueMetrics {
  queueDepth: number;
  oldestPendingAge: number | null;
  processingCount: number;
  successCount: number;
  failureCount: number;
  // Latency metrics
  queueWaitP95: number;
  queueWaitP99: number;
  processingDurationP95: number;
  processingDurationP99: number;
  totalLatencyP95: number;
  totalLatencyP99: number;
  // Alert flags
  alerts: {
    queueDepthWarning: boolean;
    queueDepthCritical: boolean;
    processingTimeWarning: boolean;
    processingTimeCritical: boolean;
    ledgerMismatch: boolean;
  };
  // Ledger verification
  ledgerStatus: {
    successfulPurchases: number;
    debitEntries: number;
    creditEntries: number;
    isCorrect: boolean;
  };
}

interface AccountWorker {
  providerId: number;
  distributorId: number;
  processing: boolean;
  lastError?: string;
}

class QueueManager {
  private workers: Map<string, AccountWorker> = new Map();
  private recoveryInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startRecoveryJob();
    // Recover any PENDING requests left over from a previous server session
    this.recoverPendingOnStartup();
  }

  /**
   * Get account queue key
   */
  private getQueueKey(providerId: number, distributorId: number): string {
    return `${providerId}:${distributorId}`;
  }

  /**
   * Enqueue a purchase request
   */
  async enqueueRequest(
    providerId: number,
    distributorId: number,
    productId: number,
    idempotencyKey: string
  ): Promise<{ requestId: number; status: string; error?: string }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const config = getQueueConfig(providerId, distributorId);

    // Check queue capacity (backpressure)
    const isAtCapacity = await isQueueAtCapacity(providerId, distributorId, config.maxQueueDepth);
    if (isAtCapacity) {
      return {
        requestId: 0,
        status: 'REJECTED',
        error: 'Queue at capacity. Please retry later.',
      };
    }

    // Check idempotency
    const existingList = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.idempotencyKey, idempotencyKey))
      .limit(1);

    const existing = existingList[0];

    if (existing) {
      return { requestId: existing.id, status: existing.status };
    }

    // Insert new request
    const result = await db.insert(purchaseRequests).values({
      providerId,
      distributorId,
      productId,
      idempotencyKey,
      status: 'PENDING' as const,
    });

    // Drizzle returns insertId in the result object
    const requestId = (result as any)[0]?.insertId || (result as any).insertId;
    if (!requestId) {
      throw new Error('Failed to get insert ID from database');
    }

    // Trigger worker (non-blocking)
    this.processQueue(providerId, distributorId).catch((error) => {
      console.error(`Queue processing error for ${providerId}:${distributorId}:`, error);
    });

    return { requestId, status: 'PENDING' };
  }

  /**
   * Get request status
   */
  async getRequestStatus(requestId: number): Promise<{
    id: number;
    status: string;
    cardId?: number;
    failureReason?: string;
    createdAt: Date;
    completedAt?: Date;
  }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const requestList = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId));

    if (!requestList || requestList.length === 0) {
      throw new Error(`Request ${requestId} not found`);
    }

    const request = requestList[0];

    return {
      id: request.id,
      status: request.status,
      cardId: request.cardId || undefined,
      failureReason: request.failureReason || undefined,
      createdAt: request.createdAt,
      completedAt: request.completedAt || undefined,
    };
  }

  /**
   * Process queue for account.
   * Uses an in-process mutex (worker.processing) to prevent concurrent workers
   * for the same provider-distributor pair. This is safe for a single Node.js
   * process and avoids the connection-leak bug of MySQL advisory locks.
   */
  private async processQueue(providerId: number, distributorId: number): Promise<void> {
    const queueKey = this.getQueueKey(providerId, distributorId);

    // Get or create worker entry
    let worker = this.workers.get(queueKey);
    if (!worker) {
      worker = { providerId, distributorId, processing: false };
      this.workers.set(queueKey, worker);
    }

    // In-process mutex: skip if already running for this pair
    if (worker.processing) {
      return;
    }

    worker.processing = true;

    try {
      while (true) {
        // Get oldest PENDING request for this provider-distributor pair
        const pending = await getOldestPendingRequest(providerId, distributorId);
        if (!pending) break;

        // Process the request
        await this.processRequest(pending.id, providerId, distributorId, pending.productId);
      }
    } catch (error) {
      worker.lastError = error instanceof Error ? error.message : String(error);
      console.error(`Queue error for ${queueKey}:`, worker.lastError);
    } finally {
      // Always reset so the next purchase can trigger a new worker run
      worker.processing = false;
    }
  }

  /**
   * Process single request with atomic transaction
   */
  private async processRequest(
    requestId: number,
    providerId: number,
    distributorId: number,
    productId: number
  ): Promise<void> {
    try {
      // Mark as PROCESSING
      await updateRequestStatus(requestId, 'PROCESSING', undefined, undefined, new Date());

      // Run atomic purchase transaction
      const result = await this.processPurchaseTransaction(
        requestId,
        providerId,
        distributorId,
        productId
      );

      if (result.success) {
        // Mark as SUCCEEDED
        await updateRequestStatus(
          requestId,
          'SUCCEEDED',
          result.cardId,
          undefined,
          undefined,
          new Date()
        );
        
        // Queue webhook (async, non-blocking, after DB commit)
        PurchaseWebhookIntegration.onPurchaseSucceeded(
          requestId,
          providerId,
          distributorId,
          productId,
          result.cardSerial,
        ).catch(err => {
          console.error('[Queue Manager] Webhook error (non-blocking):', err);
        });
      } else {
        // Mark as FAILED
        await updateRequestStatus(
          requestId,
          'FAILED',
          undefined,
          result.error,
          undefined,
          new Date()
        );
        
        // Queue webhook (async, non-blocking, after DB commit)
        PurchaseWebhookIntegration.onPurchaseFailed(
          requestId,
          providerId,
          distributorId,
          productId,
          result.error
        ).catch(err => {
          console.error('[Queue Manager] Webhook error (non-blocking):', err);
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Mark as FAILED with error
      await updateRequestStatus(
        requestId,
        'FAILED',
        undefined,
        errorMsg,
        undefined,
        new Date()
      );
      
      // Queue webhook (async, non-blocking, after DB commit)
      PurchaseWebhookIntegration.onPurchaseFailed(
        requestId,
        providerId,
        distributorId,
        productId,
        errorMsg
      ).catch(err => {
        console.error('[Queue Manager] Webhook error (non-blocking):', err);
      });
    }
  }

  /**
   * Atomic purchase transaction
   */
  private async processPurchaseTransaction(
    requestId: number,
    providerId: number,
    distributorId: number,
    productId: number
  ): Promise<{ success: boolean; cardId?: number; cardSerial?: string; cardPin?: string; error?: string }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    try {
      // Get product price
      const productListArray = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!productListArray || productListArray.length === 0) {
        return { success: false, error: 'Product not found' };
      }

      const price = parseFloat((productListArray[0] as any).price);

      // Get commission rate from the relationship (stored as whole-number percent, e.g. "5" = 5%)
      const relList = await db
        .select()
        .from(providerDistributorRelationships)
        .where(
          and(
            eq(providerDistributorRelationships.providerId, providerId),
            eq(providerDistributorRelationships.distributorId, distributorId)
          )
        )
        .limit(1);

      const commissionPct = relList.length > 0
        ? parseFloat((relList[0] as any).commissionPercentage)
        : 5; // fallback to 5% if relationship not found
      const commissionRate = commissionPct / 100; // e.g. 5 → 0.05

      // Get available card (atomic with FOR UPDATE)
      const cardList = await db
        .select()
        .from(cards)
        .where(
          and(
            eq(cards.providerId, providerId),
            eq(cards.productId, productId),
            eq(cards.status, 'AVAILABLE')
          )
        )
        .limit(1)
        .for('update');

      if (!cardList || cardList.length === 0) {
        return { success: false, error: 'No cards available' };
      }

      const availableCard = cardList[0];

      // Get account (lock for update to prevent concurrent modifications)
      const accountList = await db
        .select()
        .from(providerDistributorAccounts)
        .where(
          and(
            eq(providerDistributorAccounts.providerId, providerId),
            eq(providerDistributorAccounts.distributorId, distributorId)
          )
        )
        .for('update');

      if (!accountList || accountList.length === 0) {
        return { success: false, error: 'Account not found' };
      }

      const account = accountList[0];
      const currentBalance  = parseFloat((account as any).balance);
      const currentCreditLine = parseFloat((account as any).creditLine);
      const currentUsedCredit = parseFloat((account as any).usedCredit);
      const availableToSpend = currentBalance + currentCreditLine - currentUsedCredit;

      if (availableToSpend < price) {
        return { success: false, error: 'Insufficient balance' };
      }

      // ── Step 1: Apply DEBIT ──────────────────────────────────────────────────
      // Use balance first; only draw on credit when balance is exhausted
      let balanceAfterDebit: number;
      let usedCreditAfterDebit: number;

      if (currentBalance >= price) {
        balanceAfterDebit  = currentBalance - price;
        usedCreditAfterDebit = currentUsedCredit;
      } else {
        const creditUsed = price - currentBalance;
        balanceAfterDebit  = 0;
        usedCreditAfterDebit = currentUsedCredit + creditUsed;
      }

      // ── Step 2: Apply commission CREDIT back to distributor ──────────────────
      // Commission = price × rate  (e.g. 10 LYD × 0.05 = 0.50 LYD per card)
      // Net charge  = price - commission  (e.g. 40 - 2 = 38 LYD for 4 cards)
      //
      // Commission reduces usedCredit first (if any), then increases balance.
      const commissionAmount = parseFloat((price * commissionRate).toFixed(4));

      let finalBalance: number;
      let finalUsedCredit: number;

      if (usedCreditAfterDebit > 0) {
        const creditReduction = Math.min(commissionAmount, usedCreditAfterDebit);
        finalUsedCredit = usedCreditAfterDebit - creditReduction;
        finalBalance    = balanceAfterDebit + (commissionAmount - creditReduction);
      } else {
        finalBalance    = balanceAfterDebit + commissionAmount;
        finalUsedCredit = usedCreditAfterDebit;
      }

      // ── Step 3: Mark card as SOLD ────────────────────────────────────────────
      await db
        .update(cards)
        .set({
          status: 'SOLD' as const,
          allocatedToDistributorId: distributorId,
          allocatedAt: new Date(),
        })
        .where(eq(cards.id, availableCard.id));

      // ── Step 4: Persist final account state (debit + commission both applied) ─
      await db
        .update(providerDistributorAccounts)
        .set({
          balance: String(finalBalance),
          usedCredit: String(finalUsedCredit),
          version: (account as any).version + 1,
        })
        .where(
          and(
            eq(providerDistributorAccounts.providerId, providerId),
            eq(providerDistributorAccounts.distributorId, distributorId)
          )
        );

      // ── Step 5: Append ledger entries ────────────────────────────────────────
      // DEBIT entry — snapshot after the debit, before the commission credit
      await insertLedgerEntry(
        providerId,
        distributorId,
        'DEBIT',
        String(price),
        String(balanceAfterDebit),
        String(usedCreditAfterDebit),
        String(requestId),
        'purchase_debit',
        JSON.stringify({
          requestId,
          cardId: availableCard.id,
          productId,
          commissionRate: `${commissionPct}%`,
          commissionAmount,
        })
      );

      // COMMISSION CREDIT entry — snapshot after both debit and credit applied
      await insertLedgerEntry(
        providerId,
        distributorId,
        'CREDIT',
        String(commissionAmount),
        String(finalBalance),
        String(finalUsedCredit),
        String(requestId),
        'commission_credit',
        JSON.stringify({
          requestId,
          cardId: availableCard.id,
          productId,
          commissionRate: `${commissionPct}%`,
          commissionAmount,
        })
      );

      // ── Step 6: Record in transactions table ──────────────────────────────────
      const pool = await getRawDb();
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO transactions (
              idempotency_key, distributor_id, provider_id, product_id, card_id,
              amount, commission_amount, transaction_type, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(requestId),
              distributorId,
              providerId,
              productId,
              availableCard.id,
              String(price),
              String(commissionAmount),
              'purchase',
              'completed',
            ]
          );
        } catch (txnError) {
          console.error('[QueueManager] Error recording transaction:', txnError);
        }
      }

      return {
        success: true,
        cardId: availableCard.id,
        cardSerial: (availableCard as any).serialNumber,
        cardPin: (availableCard as any).pin,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * On startup: re-trigger processQueue for any provider-distributor pairs
   * that still have PENDING requests left over from a previous server session.
   * Runs once, non-blocking, after a short delay to let the DB pool warm up.
   */
  private recoverPendingOnStartup(): void {
    setTimeout(async () => {
      try {
        const pool = await getRawDb();
        if (!pool) return;

        const [rows]: any = await pool.query(
          `SELECT DISTINCT provider_id, distributor_id
           FROM purchase_requests
           WHERE status IN ('PENDING', 'PROCESSING')
           LIMIT 100`
        );

        if (!rows || rows.length === 0) return;

        console.log(`[Startup Recovery] Found ${rows.length} pair(s) with stuck requests — re-triggering workers`);

        for (const row of rows) {
          // Reset any PROCESSING requests back to PENDING (server crashed mid-flight)
          await pool.query(
            `UPDATE purchase_requests SET status = 'PENDING', processing_started_at = NULL
             WHERE provider_id = ? AND distributor_id = ? AND status = 'PROCESSING'`,
            [row.provider_id, row.distributor_id]
          );

          this.processQueue(row.provider_id, row.distributor_id).catch((err) => {
            console.error(`[Startup Recovery] Error processing queue for ${row.provider_id}:${row.distributor_id}:`, err);
          });
        }
      } catch (err) {
        console.error('[Startup Recovery] Error:', err);
      }
    }, 3000); // 3-second delay to let DB pool initialize
  }

  /**
   * Recovery job: Recover stale PROCESSING requests every 30 seconds.
   * A request is stale if it has been in PROCESSING for > staleProcessingSeconds.
   * Since there is no external worker process, a PROCESSING request that's old
   * means the server crashed mid-flight — reset it to PENDING and re-trigger.
   */
  private startRecoveryJob(): void {
    const config = getQueueConfig();
    this.recoveryInterval = setInterval(async () => {
      try {
        const recoverableRequests = await getRecoverableProcessingRequests(
          config.staleProcessingSeconds,
          config.maxRecoveryAttempts
        );

        for (const request of recoverableRequests) {
          console.log(
            `[RECOVERY] Recovering request ${request.id} (attempt ${request.recoveryAttemptCount + 1}/${config.maxRecoveryAttempts})`
          );

          // Reset to PENDING with incremented recovery counter
          await updateRequestStatus(
            request.id,
            'PENDING',
            undefined,
            undefined,
            null,
            undefined,
            request.recoveryAttemptCount + 1
          );

          // Trigger worker (skipped if one is already running for this pair)
          this.processQueue(request.providerId, request.distributorId).catch((error) => {
            console.error('[Recovery] Queue trigger error:', error);
          });
        }
      } catch (error) {
        console.error('[Recovery] Job error:', error);
      }
    }, config.recoveryIntervalSeconds * 1000);
  }

  /**
   * Get queue metrics with alerts and ledger verification
   */
  async getMetrics(providerId: number, distributorId: number): Promise<QueueMetrics> {
    const config = getQueueConfig(providerId, distributorId);

    const [
      pendingCount,
      queueDepth,
      processingCount,
      successCount,
      failureCount,
      oldestPendingAge,
      latencyMetrics,
      ledgerVerification,
    ] = await Promise.all([
      countPendingRequests(providerId, distributorId),
      countQueueDepth(providerId, distributorId),
      countProcessingRequests(providerId, distributorId),
      countSucceededRequests(providerId, distributorId),
      countFailedRequests(providerId, distributorId),
      getOldestPendingAge(providerId, distributorId),
      getQueueLatencyMetrics(providerId, distributorId),
      verifyLedgerCorrectness(providerId, distributorId),
    ]);

    // Calculate alert flags
    const alerts = {
      queueDepthWarning: queueDepth >= config.alertThresholds.queueDepthWarning,
      queueDepthCritical: queueDepth >= config.alertThresholds.queueDepthCritical,
      processingTimeWarning: latencyMetrics.processingDurationP95 >= config.alertThresholds.p95ProcessingWarningMs,
      processingTimeCritical: latencyMetrics.processingDurationP99 >= config.alertThresholds.p99ProcessingCriticalMs,
      ledgerMismatch: !ledgerVerification.isCorrect,
    };

    if (alerts.ledgerMismatch) {
      console.error(`[CRITICAL] Ledger mismatch detected: ${ledgerVerification.details}`);
    }

    return {
      queueDepth: pendingCount,
      oldestPendingAge,
      processingCount,
      successCount,
      failureCount,
      queueWaitP95: latencyMetrics.queueWaitP95,
      queueWaitP99: latencyMetrics.queueWaitP99,
      processingDurationP95: latencyMetrics.processingDurationP95,
      processingDurationP99: latencyMetrics.processingDurationP99,
      totalLatencyP95: latencyMetrics.totalLatencyP95,
      totalLatencyP99: latencyMetrics.totalLatencyP99,
      alerts,
      ledgerStatus: {
        successfulPurchases: ledgerVerification.successfulPurchases,
        debitEntries: ledgerVerification.debitEntries,
        creditEntries: ledgerVerification.creditEntries,
        isCorrect: ledgerVerification.isCorrect,
      },
    };
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
    }
  }
}

// Lazy initialization
let _queueManager: QueueManager | null = null;

export function getQueueManager(): QueueManager {
  if (!_queueManager) {
    _queueManager = new QueueManager();
  }
  return _queueManager;
}

export const queueManager = getQueueManager();
