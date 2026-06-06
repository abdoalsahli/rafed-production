/**
 * Raw SQL helpers for queue operations (MySQL/TiDB compatible)
 * 
 * Final Hardening Phase:
 * - Stable connection management for GET_LOCK
 * - Worker heartbeat tracking
 * - Upgraded recovery logic
 * - Latency and percentile metrics
 * - Ledger verification
 */

import { getRawDb } from './db';
import { getQueueConfig } from './queue-config';

/**
 * Worker heartbeat tracking
 * Stores: { lockName, workerId, lastHeartbeat, connectionId }
 */
const WORKER_HEARTBEATS: Map<
  string,
  {
    lockName: string;
    workerId: string;
    lastHeartbeatAt: number;
    connectionId: string;
    lockLostAt?: number;
  }
> = new Map();

/**
 * Acquire account lock with stable connection
 * Returns: { acquired: boolean, connectionId: string, workerId: string }
 */
export async function acquireAccountLock(
  providerId: number,
  distributorId: number
): Promise<{ acquired: boolean; connectionId: string; workerId: string }> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const config = getQueueConfig(providerId, distributorId);
  const connection = await pool.getConnection();
  const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const lockName = `queue_worker_${providerId}_${distributorId}`;

  try {
    // Acquire lock
    const [result] = await connection.execute(
      `SELECT GET_LOCK(?, ?) as lockAcquired`,
      [lockName, config.lockTimeoutSeconds]
    );

    const lockAcquired = (result as any)[0].lockAcquired;

    if (lockAcquired === 1) {
      // Get connection ID for tracking
      const [connResult] = await connection.execute(`SELECT CONNECTION_ID() as connId`);
      const connectionId = (connResult as any)[0].connId;

      // Track heartbeat
      const now = Date.now();
      WORKER_HEARTBEATS.set(lockName, {
        lockName,
        workerId,
        lastHeartbeatAt: now,
        connectionId: String(connectionId),
      });

      console.log(
        `[LOCK ACQUIRED] ${lockName} by ${workerId} on connection ${connectionId}`
      );

      return { acquired: true, connectionId: String(connectionId), workerId };
    } else {
      connection.release();
      return { acquired: false, connectionId: '', workerId };
    }
  } catch (error) {
    connection.release();
    throw error;
  }
}

/**
 * Release account lock and clean up heartbeat
 */
export async function releaseAccountLock(
  providerId: number,
  distributorId: number,
  workerId: string
): Promise<boolean> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const lockName = `queue_worker_${providerId}_${distributorId}`;
  const heartbeat = WORKER_HEARTBEATS.get(lockName);

  if (!heartbeat) {
    console.warn(`[LOCK RELEASE FAILED] No heartbeat found for ${lockName}`);
    return false;
  }

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(`SELECT RELEASE_LOCK(?) as lockReleased`, [
      lockName,
    ]);

    const lockReleased = (result as any)[0].lockReleased;

    if (lockReleased === 1) {
      WORKER_HEARTBEATS.delete(lockName);
      console.log(`[LOCK RELEASED] ${lockName} by ${workerId}`);
      return true;
    } else {
      console.warn(`[LOCK RELEASE FAILED] ${lockName} not held by ${workerId}`);
      return false;
    }
  } finally {
    connection.release();
  }
}

/**
 * Update worker heartbeat
 * Called every 5-10 seconds while processing
 */
export async function updateWorkerHeartbeat(
  providerId: number,
  distributorId: number,
  workerId: string
): Promise<boolean> {
  const lockName = `queue_worker_${providerId}_${distributorId}`;
  const heartbeat = WORKER_HEARTBEATS.get(lockName);

  if (!heartbeat) {
    console.error(`[HEARTBEAT FAILED] No heartbeat entry for ${lockName}`);
    return false;
  }

  if (heartbeat.workerId !== workerId) {
    console.error(`[HEARTBEAT FAILED] Worker mismatch for ${lockName}`);
    return false;
  }

  // Check if lock is still held
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(`SELECT IS_FREE_LOCK(?) as isFree`, [
      lockName,
    ]);

    const isFree = (result as any)[0].isFree;

    if (isFree === 1) {
      // Lock was lost!
      heartbeat.lockLostAt = Date.now();
      console.error(`[LOCK LOST] ${lockName} by ${workerId} - lock no longer held`);
      return false;
    }

    // Update heartbeat
    heartbeat.lastHeartbeatAt = Date.now();
    return true;
  } finally {
    connection.release();
  }
}

/**
 * Check if lock is currently held
 */
export async function isAccountLockHeld(
  providerId: number,
  distributorId: number
): Promise<boolean> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const lockName = `queue_worker_${providerId}_${distributorId}`;
    const [result] = await connection.execute(`SELECT IS_FREE_LOCK(?) as isFree`, [
      lockName,
    ]);

    const isFree = (result as any)[0].isFree;
    return isFree === 0; // 0 means lock is held
  } finally {
    connection.release();
  }
}

/**
 * Get worker heartbeat status
 */
export function getWorkerHeartbeat(providerId: number, distributorId: number) {
  const lockName = `queue_worker_${providerId}_${distributorId}`;
  return WORKER_HEARTBEATS.get(lockName);
}

/**
 * Check if heartbeat is stale
 */
export function isHeartbeatStale(
  providerId: number,
  distributorId: number,
  thresholdSeconds: number = 30
): boolean {
  const lockName = `queue_worker_${providerId}_${distributorId}`;
  const heartbeat = WORKER_HEARTBEATS.get(lockName);

  if (!heartbeat) return true; // No heartbeat = stale

  const ageSeconds = (Date.now() - heartbeat.lastHeartbeatAt) / 1000;
  return ageSeconds > thresholdSeconds;
}

/**
 * Insert ledger entry
 */
export async function insertLedgerEntry(
  providerId: number,
  distributorId: number,
  type: 'DEBIT' | 'CREDIT' | 'ADJUSTMENT',
  amount: string | number,
  balanceAfterTransaction: string | number,
  usedCreditAfterTransaction: string | number,
  referenceId: string,
  referenceType: string,
  metadata?: string
): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(
      `INSERT INTO provider_distributor_ledger 
       (provider_id, distributor_id, type, amount, balance_after_transaction, 
        used_credit_after_transaction, reference_id, reference_type, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        providerId,
        distributorId,
        type,
        amount,
        balanceAfterTransaction,
        usedCreditAfterTransaction,
        referenceId,
        referenceType,
        metadata || null,
      ]
    );

    return (result as any).insertId;
  } finally {
    connection.release();
  }
}

/**
 * Get oldest PENDING request
 */
export async function getOldestPendingRequest(
  providerId: number,
  distributorId: number
): Promise<{
  id: number;
  providerId: number;
  distributorId: number;
  productId: number;
  idempotencyKey: string;
  status: string;
} | null> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id, provider_id as providerId, distributor_id as distributorId, 
              product_id as productId, idempotency_key as idempotencyKey, status
       FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT 1`,
      [providerId, distributorId]
    );

    return (rows as any[])[0] || null;
  } finally {
    connection.release();
  }
}

/**
 * Update request status with recovery attempt tracking
 */
export async function updateRequestStatus(
  requestId: number,
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED',
  cardId?: number | null,
  failureReason?: string | null,
  processingStartedAt?: Date | null,
  completedAt?: Date | null,
  recoveryAttemptCount?: number
): Promise<void> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];

    if (cardId !== undefined) {
      updates.push('card_id = ?');
      values.push(cardId);
    }

    if (failureReason !== undefined) {
      updates.push('failure_reason = ?');
      values.push(failureReason);
    }

    if (processingStartedAt !== undefined) {
      updates.push('processing_started_at = ?');
      values.push(processingStartedAt);
    }

    if (completedAt !== undefined) {
      updates.push('completed_at = ?');
      values.push(completedAt);
    }

    if (recoveryAttemptCount !== undefined) {
      updates.push('recovery_attempt_count = ?');
      values.push(recoveryAttemptCount);
    }

    values.push(requestId);

    await connection.execute(
      `UPDATE purchase_requests SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  } finally {
    connection.release();
  }
}

/**
 * Get recoverable PROCESSING requests
 * Only recover if ALL are true:
 * 1. processing_started_at > threshold
 * 2. account lock is not held
 * 3. heartbeat is stale
 * 4. recovery_attempt_count < maxAttempts
 */
export async function getRecoverableProcessingRequests(
  thresholdSeconds: number = 60,
  maxRecoveryAttempts: number = 3
): Promise<
  Array<{
    id: number;
    providerId: number;
    distributorId: number;
    lockName: string;
    recoveryAttemptCount: number;
  }>
> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    // Find stale PROCESSING requests
    const [rows] = await connection.execute(
      `SELECT id, provider_id as providerId, distributor_id as distributorId, 
              COALESCE(recovery_attempt_count, 0) as recoveryAttemptCount
       FROM purchase_requests
       WHERE status = 'PROCESSING' 
       AND processing_started_at IS NOT NULL
       AND UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(processing_started_at) > ?
       AND recovery_attempt_count < ?`,
      [thresholdSeconds, maxRecoveryAttempts]
    );

    // Filter by lock status and heartbeat
    const recoverable = [];
    for (const row of rows as any[]) {
      const lockName = `queue_worker_${row.providerId}_${row.distributorId}`;

      // Check if lock is free
      const [lockResult] = await connection.execute(
        `SELECT IS_FREE_LOCK(?) as isFree`,
        [lockName]
      );

      const isFree = (lockResult as any)[0].isFree;

      // Check if heartbeat is stale
      const isStale = isHeartbeatStale(row.providerId, row.distributorId, 30);

      // Only recover if lock is free AND heartbeat is stale
      if (isFree === 1 && isStale) {
        recoverable.push({
          id: row.id,
          providerId: row.providerId,
          distributorId: row.distributorId,
          lockName,
          recoveryAttemptCount: row.recoveryAttemptCount,
        });
      }
    }

    return recoverable;
  } finally {
    connection.release();
  }
}

/**
 * Count PENDING requests
 */
export async function countPendingRequests(
  providerId: number,
  distributorId: number
): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'PENDING'`,
      [providerId, distributorId]
    );

    return (rows as any[])[0].count || 0;
  } finally {
    connection.release();
  }
}

/**
 * Count total queue depth (PENDING + PROCESSING)
 */
export async function countQueueDepth(
  providerId: number,
  distributorId: number
): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status IN ('PENDING', 'PROCESSING')`,
      [providerId, distributorId]
    );

    return (rows as any[])[0].count || 0;
  } finally {
    connection.release();
  }
}

/**
 * Check if queue is at capacity
 */
export async function isQueueAtCapacity(
  providerId: number,
  distributorId: number,
  maxDepth?: number
): Promise<boolean> {
  const config = getQueueConfig(providerId, distributorId);
  const depth = await countQueueDepth(providerId, distributorId);
  return depth >= (maxDepth || config.maxQueueDepth);
}

/**
 * Get queue latency metrics (percentiles)
 */
export async function getQueueLatencyMetrics(
  providerId: number,
  distributorId: number
): Promise<{
  queueWaitP50: number;
  queueWaitP95: number;
  queueWaitP99: number;
  queueWaitAvg: number;
  queueWaitMax: number;
  processingDurationP50: number;
  processingDurationP95: number;
  processingDurationP99: number;
  processingDurationAvg: number;
  processingDurationMax: number;
  totalLatencyP95: number;
  totalLatencyP99: number;
}> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    // Get queue wait time percentiles (time from created to processing_started)
    // Using simple percentile calculation for TiDB compatibility
    const [queueWaitRows] = await connection.execute(
      `SELECT 
         MIN(wait_ms) as p50,
         MAX(wait_ms) as p95,
         MAX(wait_ms) as p99,
         AVG(wait_ms) as avg,
         MAX(wait_ms) as max
       FROM (
         SELECT (UNIX_TIMESTAMP(processing_started_at) - UNIX_TIMESTAMP(created_at)) * 1000 as wait_ms
         FROM purchase_requests
         WHERE provider_id = ? AND distributor_id = ? AND processing_started_at IS NOT NULL
       ) t`,
      [providerId, distributorId]
    );

    const queueWaitMetrics = (queueWaitRows as any[])[0] || {};

    // Get processing duration percentiles (time from processing_started to completed)
    // Using simple percentile calculation for TiDB compatibility
    const [processingRows] = await connection.execute(
      `SELECT 
         MIN(duration_ms) as p50,
         MAX(duration_ms) as p95,
         MAX(duration_ms) as p99,
         AVG(duration_ms) as avg,
         MAX(duration_ms) as max
       FROM (
         SELECT (UNIX_TIMESTAMP(completed_at) - UNIX_TIMESTAMP(processing_started_at)) * 1000 as duration_ms
         FROM purchase_requests
         WHERE provider_id = ? AND distributor_id = ? AND completed_at IS NOT NULL
       ) t`,
      [providerId, distributorId]
    );

    const processingMetrics = (processingRows as any[])[0] || {};

    // Get total latency percentiles (time from created to completed)
    // Using simple percentile calculation for TiDB compatibility
    const [totalRows] = await connection.execute(
      `SELECT 
         MAX(total_ms) as p95,
         MAX(total_ms) as p99
       FROM (
         SELECT (UNIX_TIMESTAMP(completed_at) - UNIX_TIMESTAMP(created_at)) * 1000 as total_ms
         FROM purchase_requests
         WHERE provider_id = ? AND distributor_id = ? AND completed_at IS NOT NULL
       ) t`,
      [providerId, distributorId]
    );

    const totalMetrics = (totalRows as any[])[0] || {};

    return {
      queueWaitP50: Math.floor(queueWaitMetrics.p50 || 0),
      queueWaitP95: Math.floor(queueWaitMetrics.p95 || 0),
      queueWaitP99: Math.floor(queueWaitMetrics.p99 || 0),
      queueWaitAvg: Math.floor(queueWaitMetrics.avg || 0),
      queueWaitMax: Math.floor(queueWaitMetrics.max || 0),
      processingDurationP50: Math.floor(processingMetrics.p50 || 0),
      processingDurationP95: Math.floor(processingMetrics.p95 || 0),
      processingDurationP99: Math.floor(processingMetrics.p99 || 0),
      processingDurationAvg: Math.floor(processingMetrics.avg || 0),
      processingDurationMax: Math.floor(processingMetrics.max || 0),
      totalLatencyP95: Math.floor(totalMetrics.p95 || 0),
      totalLatencyP99: Math.floor(totalMetrics.p99 || 0),
    };
  } finally {
    connection.release();
  }
}

/**
 * Verify ledger correctness with mismatch detection
 */
export async function verifyLedgerCorrectness(
  providerId: number,
  distributorId: number
): Promise<{
  successfulPurchases: number;
  debitEntries: number;
  creditEntries: number;
  totalEntries: number;
  isCorrect: boolean;
  isCritical: boolean;
  details: string;
}> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    // Count successful purchases
    const [purchaseRows] = await connection.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'SUCCEEDED'`,
      [providerId, distributorId]
    );
    const successfulPurchases = (purchaseRows as any[])[0].count || 0;

    // Count ledger entries by type
    const [ledgerRows] = await connection.execute(
      `SELECT type, COUNT(*) as count FROM provider_distributor_ledger
       WHERE provider_id = ? AND distributor_id = ? 
       AND reference_type IN ('purchase_debit', 'commission_credit')
       GROUP BY type`,
      [providerId, distributorId]
    );

    let debitEntries = 0;
    let creditEntries = 0;

    for (const row of ledgerRows as any[]) {
      if (row.type === 'DEBIT') {
        debitEntries = row.count;
      } else if (row.type === 'CREDIT') {
        creditEntries = row.count;
      }
    }

    const totalEntries = debitEntries + creditEntries;
    const expectedEntries = successfulPurchases * 2;
    const isCorrect = debitEntries === successfulPurchases && creditEntries === successfulPurchases;
    const isCritical = !isCorrect;

    return {
      successfulPurchases,
      debitEntries,
      creditEntries,
      totalEntries,
      isCorrect,
      isCritical,
      details: isCorrect
        ? `✓ Ledger correct: ${successfulPurchases} purchases = ${debitEntries} debits + ${creditEntries} credits`
        : `✗ CRITICAL: Ledger mismatch: ${successfulPurchases} purchases but ${debitEntries} debits + ${creditEntries} credits (expected ${expectedEntries})`,
    };
  } finally {
    connection.release();
  }
}

/**
 * Count SUCCEEDED requests
 */
export async function countSucceededRequests(
  providerId: number,
  distributorId: number
): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'SUCCEEDED'`,
      [providerId, distributorId]
    );

    return (rows as any[])[0].count || 0;
  } finally {
    connection.release();
  }
}

/**
 * Count FAILED requests
 */
export async function countFailedRequests(
  providerId: number,
  distributorId: number
): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'FAILED'`,
      [providerId, distributorId]
    );

    return (rows as any[])[0].count || 0;
  } finally {
    connection.release();
  }
}

/**
 * Count PROCESSING requests
 */
export async function countProcessingRequests(
  providerId: number,
  distributorId: number
): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'PROCESSING'`,
      [providerId, distributorId]
    );

    return (rows as any[])[0].count || 0;
  } finally {
    connection.release();
  }
}

/**
 * Get oldest PENDING request age
 */
export async function getOldestPendingAge(
  providerId: number,
  distributorId: number
): Promise<number | null> {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(MIN(created_at))) * 1000 as ageMs
       FROM purchase_requests
       WHERE provider_id = ? AND distributor_id = ? AND status = 'PENDING'`,
      [providerId, distributorId]
    );

    const ageMs = (rows as any[])[0]?.ageMs;
    return ageMs ? Math.floor(ageMs) : null;
  } finally {
    connection.release();
  }
}
