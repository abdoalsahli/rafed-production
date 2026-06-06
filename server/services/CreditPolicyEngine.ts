/**
 * Credit Policy Engine
 * Enforces credit limits and manages credit reservations/utilization
 */

import { getDb } from '../db';
import { AuditLogService } from './AuditLogService';

export interface CreditLimit {
  id: string;
  distributorId: string;
  providerId: string;
  totalCreditLimit: number;
  availableCredit: number;
  reservedCredit: number;
  utilizedCredit: number;
  status: 'active' | 'suspended' | 'exceeded';
  suspensionReason?: string;
  suspendedAt?: Date;
}

export interface CreditTransaction {
  id: string;
  creditLimitId: string;
  transactionId?: string;
  amount: number;
  transactionType: 'reserve' | 'utilize' | 'release' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  idempotencyKey?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class CreditPolicyEngine {
  private auditService: AuditLogService;

  constructor(auditService: AuditLogService) {
    this.auditService = auditService;
  }

  /**
   * Get credit limit for distributor-provider pair
   */
  async getCreditLimit(
    distributorId: string,
    providerId: string
  ): Promise<CreditLimit | null> {
    const db = await getDb();
    if (!db) {
      console.warn('[CreditPolicy] Database not available');
      return null;
    }

    try {
      // Mock implementation - would query database
      return {
        id: `credit_${distributorId}_${providerId}`,
        distributorId,
        providerId,
        totalCreditLimit: 100000,
        availableCredit: 100000,
        reservedCredit: 0,
        utilizedCredit: 0,
        status: 'active',
      };
    } catch (error) {
      console.error('[CreditPolicy] Failed to get credit limit:', error);
      throw error;
    }
  }

  /**
   * Reserve credit for a transaction
   */
  async reserveCredit(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ reserved: boolean; availableCredit: number }> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      // Get current credit limit
      const creditLimit = await this.getCreditLimit(distributorId, providerId);
      if (!creditLimit) {
        throw new Error('Credit limit not found');
      }

      // Check if already reserved (idempotency)
      const existing = await this.getReservation(creditLimitId, idempotencyKey);
      if (existing) {
        return {
          reserved: true,
          availableCredit: creditLimit.availableCredit - amount,
        };
      }

      // Check if sufficient credit
      if (amount > creditLimit.availableCredit) {
        throw new Error('Insufficient credit');
      }

      // Check if suspended
      if (creditLimit.status === 'suspended') {
        throw new Error('Credit limit suspended');
      }

      // Reserve credit
      const newAvailable = creditLimit.availableCredit - amount;
      const newReserved = creditLimit.reservedCredit + amount;

      // Create credit transaction record
      await this.createCreditTransaction({
        creditLimitId,
        amount,
        transactionType: 'reserve',
        status: 'completed',
        idempotencyKey,
      });

      // Audit log
      await this.auditService.logEvent({
        action: 'credit_reserved',
        resourceType: 'credit',
        resourceId: creditLimitId,
        distributorId,
        providerId,
        details: {
          amount,
          availableBefore: creditLimit.availableCredit,
          availableAfter: newAvailable,
          reservedBefore: creditLimit.reservedCredit,
          reservedAfter: newReserved,
        },
      });

      return {
        reserved: true,
        availableCredit: newAvailable,
      };
    } catch (error) {
      console.error('[CreditPolicy] Failed to reserve credit:', error);
      throw error;
    }
  }

  /**
   * Utilize reserved credit (on transaction completion)
   */
  async utilizeCredit(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    amount: number,
    transactionId: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const creditLimit = await this.getCreditLimit(distributorId, providerId);
      if (!creditLimit) {
        throw new Error('Credit limit not found');
      }

      // Move from reserved to utilized
      const newReserved = Math.max(0, creditLimit.reservedCredit - amount);
      const newUtilized = creditLimit.utilizedCredit + amount;

      // Create credit transaction record
      await this.createCreditTransaction({
        creditLimitId,
        transactionId,
        amount,
        transactionType: 'utilize',
        status: 'completed',
      });

      // Audit log
      await this.auditService.logEvent({
        action: 'credit_utilized',
        resourceType: 'credit',
        resourceId: creditLimitId,
        distributorId,
        providerId,
        details: {
          amount,
          transactionId,
          reservedBefore: creditLimit.reservedCredit,
          reservedAfter: newReserved,
          utilizedBefore: creditLimit.utilizedCredit,
          utilizedAfter: newUtilized,
        },
      });
    } catch (error) {
      console.error('[CreditPolicy] Failed to utilize credit:', error);
      throw error;
    }
  }

  /**
   * Release reserved credit (on transaction failure)
   */
  async releaseCredit(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const creditLimit = await this.getCreditLimit(distributorId, providerId);
      if (!creditLimit) {
        throw new Error('Credit limit not found');
      }

      // Move from reserved back to available
      const newReserved = Math.max(0, creditLimit.reservedCredit - amount);
      const newAvailable = creditLimit.availableCredit + amount;

      // Create credit transaction record
      await this.createCreditTransaction({
        creditLimitId,
        amount,
        transactionType: 'release',
        status: 'completed',
      });

      // Audit log
      await this.auditService.logEvent({
        action: 'credit_released',
        resourceType: 'credit',
        resourceId: creditLimitId,
        distributorId,
        providerId,
        details: {
          amount,
          reason,
          reservedBefore: creditLimit.reservedCredit,
          reservedAfter: newReserved,
          availableBefore: creditLimit.availableCredit,
          availableAfter: newAvailable,
        },
      });
    } catch (error) {
      console.error('[CreditPolicy] Failed to release credit:', error);
      throw error;
    }
  }

  /**
   * Refund utilized credit (on transaction reversal)
   */
  async refundCredit(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    amount: number,
    transactionId: string,
    reason: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const creditLimit = await this.getCreditLimit(distributorId, providerId);
      if (!creditLimit) {
        throw new Error('Credit limit not found');
      }

      // Move from utilized back to available
      const newUtilized = Math.max(0, creditLimit.utilizedCredit - amount);
      const newAvailable = creditLimit.availableCredit + amount;

      // Create credit transaction record
      await this.createCreditTransaction({
        creditLimitId,
        transactionId,
        amount,
        transactionType: 'refund',
        status: 'completed',
      });

      // Audit log
      await this.auditService.logEvent({
        action: 'credit_refunded',
        resourceType: 'credit',
        resourceId: creditLimitId,
        distributorId,
        providerId,
        details: {
          amount,
          transactionId,
          reason,
          utilizedBefore: creditLimit.utilizedCredit,
          utilizedAfter: newUtilized,
          availableBefore: creditLimit.availableCredit,
          availableAfter: newAvailable,
        },
      });
    } catch (error) {
      console.error('[CreditPolicy] Failed to refund credit:', error);
      throw error;
    }
  }

  /**
   * Adjust credit limit
   */
  async adjustCreditLimit(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    newLimit: number,
    reason: string,
    changedBy: string
  ): Promise<CreditLimit> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const creditLimit = await this.getCreditLimit(distributorId, providerId);
      if (!creditLimit) {
        throw new Error('Credit limit not found');
      }

      // Validate new limit >= utilized credit
      if (newLimit < creditLimit.utilizedCredit) {
        throw new Error('New limit cannot be less than utilized credit');
      }

      // Calculate new available credit
      const difference = newLimit - creditLimit.totalCreditLimit;
      const newAvailable = creditLimit.availableCredit + difference;

      // Audit log
      await this.auditService.logCreditLimitAdjustment(
        creditLimitId,
        distributorId,
        providerId,
        changedBy,
        creditLimit.totalCreditLimit,
        newLimit,
        reason
      );

      // Return updated credit limit
      return {
        ...creditLimit,
        totalCreditLimit: newLimit,
        availableCredit: newAvailable,
      };
    } catch (error) {
      console.error('[CreditPolicy] Failed to adjust credit limit:', error);
      throw error;
    }
  }

  /**
   * Suspend credit limit
   */
  async suspendCreditLimit(
    creditLimitId: string,
    distributorId: string,
    providerId: string,
    reason: string,
    suspendedBy: string
  ): Promise<CreditLimit> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const creditLimit = await this.getCreditLimit(distributorId, providerId);
      if (!creditLimit) {
        throw new Error('Credit limit not found');
      }

      // Audit log
      await this.auditService.logEvent({
        action: 'credit_limit_suspended',
        resourceType: 'credit',
        resourceId: creditLimitId,
        distributorId,
        providerId,
        userId: suspendedBy,
        details: {
          reason,
        },
      });

      return {
        ...creditLimit,
        status: 'suspended',
        suspensionReason: reason,
        suspendedAt: new Date(),
      };
    } catch (error) {
      console.error('[CreditPolicy] Failed to suspend credit limit:', error);
      throw error;
    }
  }

  /**
   * Validate credit for transaction
   */
  async validateCreditForTransaction(
    distributorId: string,
    providerId: string,
    amount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const creditLimit = await this.getCreditLimit(distributorId, providerId);

      if (!creditLimit) {
        return { valid: false, reason: 'Credit limit not found' };
      }

      if (creditLimit.status === 'suspended') {
        return { valid: false, reason: 'Credit limit suspended' };
      }

      if (amount > creditLimit.availableCredit) {
        return { valid: false, reason: 'Insufficient credit' };
      }

      return { valid: true };
    } catch (error) {
      console.error('[CreditPolicy] Failed to validate credit:', error);
      return { valid: false, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async getReservation(
    creditLimitId: string,
    idempotencyKey: string
  ): Promise<CreditTransaction | null> {
    // Mock implementation - would query database
    return null;
  }

  private async createCreditTransaction(data: Omit<CreditTransaction, 'id' | 'createdAt'>): Promise<CreditTransaction> {
    return {
      id: `credit_txn_${Date.now()}`,
      createdAt: new Date(),
      ...data,
    };
  }
}

// Singleton instance
let creditPolicyEngine: CreditPolicyEngine | null = null;

export function getCreditPolicyEngine(auditService: AuditLogService): CreditPolicyEngine {
  if (!creditPolicyEngine) {
    creditPolicyEngine = new CreditPolicyEngine(auditService);
  }
  return creditPolicyEngine;
}
