/**
 * Audit Log Service
 * Provides immutable append-only audit logging for compliance and security
 * All logs are write-once, never updated or deleted
 */

import { getDb, insertAuditLog } from '../db';

export interface AuditLogEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  distributorId?: string;
  providerId?: string;
  userId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  distributorId?: string;
  providerId?: string;
  userId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export class AuditLogService {
  /**
   * Log an event (append-only)
   * Returns the log ID
   */
  async logEvent(event: AuditLogEvent): Promise<string> {
    const db = await getDb();
    if (!db) {
      console.warn('[AuditLog] Database not available');
      return '';
    }

    try {
      // Use existing insertAuditLog function from db.ts
      const logId = await insertAuditLog(db, {
        userId: event.userId ? parseInt(event.userId) : 0,
        action: `${event.resourceType}:${event.action}`,
        resourceId: event.resourceId ? parseInt(event.resourceId) : 0,
        metadata: {
          resourceType: event.resourceType,
          distributorId: event.distributorId,
          providerId: event.providerId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          ...event.details,
        },
      });

      return String(logId);
    } catch (error) {
      console.error('[AuditLog] Failed to log event:', error);
      throw error;
    }
  }

  /**
   * Log PIN access event (sensitive)
   */
  async logPINAccess(
    cardId: string,
    userId: string,
    success: boolean,
    ipAddress?: string
  ): Promise<string> {
    return this.logEvent({
      action: success ? 'pin_access_success' : 'pin_access_failed',
      resourceType: 'card',
      resourceId: cardId,
      userId,
      details: {
        success,
        timestamp: new Date().toISOString(),
      },
      ipAddress,
    });
  }

  /**
   * Log transaction event
   */
  async logTransaction(
    transactionId: string,
    distributorId: string,
    providerId: string,
    userId: string,
    amount: number,
    status: 'success' | 'failure'
  ): Promise<string> {
    return this.logEvent({
      action: status === 'success' ? 'transaction_completed' : 'transaction_failed',
      resourceType: 'transaction',
      resourceId: transactionId,
      distributorId,
      providerId,
      userId,
      details: {
        amount,
        status,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log configuration change
   */
  async logConfigChange(
    configId: string,
    distributorId: string,
    providerId: string,
    userId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      action: 'config_updated',
      resourceType: 'config',
      resourceId: configId,
      distributorId,
      providerId,
      userId,
      details: {
        before: oldValues,
        after: newValues,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log credit limit adjustment
   */
  async logCreditLimitAdjustment(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    userId: string,
    oldLimit: number,
    newLimit: number,
    reason: string
  ): Promise<string> {
    return this.logEvent({
      action: 'credit_limit_adjusted',
      resourceType: 'credit_limit',
      resourceId: creditLimitId,
      distributorId,
      providerId,
      userId,
      details: {
        oldLimit,
        newLimit,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log access grant
   */
  async logAccessGrant(
    accessId: string,
    distributorId: string,
    providerId: string,
    userId: string,
    accessType: string
  ): Promise<string> {
    return this.logEvent({
      action: 'access_granted',
      resourceType: 'access',
      resourceId: accessId,
      distributorId,
      providerId,
      userId,
      details: {
        accessType,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log access revocation
   */
  async logAccessRevocation(
    accessId: string,
    distributorId: string,
    providerId: string,
    userId: string,
    reason: string
  ): Promise<string> {
    return this.logEvent({
      action: 'access_revoked',
      resourceType: 'access',
      resourceId: accessId,
      distributorId,
      providerId,
      userId,
      details: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log settlement event
   */
  async logSettlement(
    settlementId: string,
    distributorId: string,
    providerId: string,
    userId: string,
    amount: number,
    status: 'initiated' | 'completed' | 'failed'
  ): Promise<string> {
    return this.logEvent({
      action: `settlement_${status}`,
      resourceType: 'settlement',
      resourceId: settlementId,
      distributorId,
      providerId,
      userId,
      details: {
        amount,
        status,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log API key event
   */
  async logAPIKeyEvent(
    apiKeyId: string,
    userId: string,
    action: 'created' | 'rotated' | 'revoked',
    reason?: string
  ): Promise<string> {
    return this.logEvent({
      action: `api_key_${action}`,
      resourceType: 'api_key',
      resourceId: apiKeyId,
      userId,
      details: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log rate limit event
   */
  async logRateLimitEvent(
    userId: string,
    endpoint: string,
    limitExceeded: boolean,
    ipAddress?: string
  ): Promise<string> {
    return this.logEvent({
      action: limitExceeded ? 'rate_limit_exceeded' : 'rate_limit_check',
      resourceType: 'rate_limit',
      userId,
      details: {
        endpoint,
        limitExceeded,
        timestamp: new Date().toISOString(),
      },
      ipAddress,
    });
  }
}

// Singleton instance
let auditLogService: AuditLogService | null = null;

export function getAuditLogService(): AuditLogService {
  if (!auditLogService) {
    auditLogService = new AuditLogService();
  }
  return auditLogService;
}
