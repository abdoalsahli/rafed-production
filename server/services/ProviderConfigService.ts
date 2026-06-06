/**
 * Provider Configuration Service
 * Manages provider-distributor configurations including commission structures and credit rules
 */

import { getDb, getCommissionRate } from '../db';
import { AuditLogService } from './AuditLogService';

export interface CommissionConfig {
  id: string;
  providerId: string;
  distributorId: string;
  commissionType: 'percentage' | 'fixed' | 'tiered';
  commissionValue: number;
  commissionTierConfig?: Record<string, any>;
  transactionLimit?: number;
  dailyVolumeLimit?: number;
  monthlyVolumeLimit?: number;
  dailyTransactionCountLimit?: number;
  cardAllocationLimit?: number;
  autoReplenishThreshold?: number;
  autoReplenishQuantity?: number;
  settlementFrequency: 'daily' | 'weekly' | 'monthly';
  settlementDay?: number;
  settlementCurrency: string;
  featuresEnabled: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditRule {
  id: string;
  providerId: string;
  distributorId: string;
  totalCreditLimit: number;
  transactionLimit: number;
  dailyTransactionLimit: number;
  dailyTransactionCountLimit: number;
  status: 'active' | 'suspended' | 'exceeded';
  createdAt: Date;
  updatedAt: Date;
}

export class ProviderConfigService {
  private auditService: AuditLogService;

  constructor(auditService: AuditLogService) {
    this.auditService = auditService;
  }

  /**
   * Get commission configuration
   */
  async getCommissionConfig(
    providerId: string,
    distributorId: string
  ): Promise<CommissionConfig | null> {
    const db = await getDb();
    if (!db) {
      console.warn('[ProviderConfig] Database not available');
      return null;
    }

    try {
      // Use existing getCommissionRate function
      const config = await getCommissionRate(
        db,
        parseInt(providerId),
        parseInt(distributorId)
      );

      if (!config) {
        return null;
      }

      return this.mapCommissionConfig(config);
    } catch (error) {
      console.error('[ProviderConfig] Failed to get commission config:', error);
      throw error;
    }
  }

  /**
   * Create commission configuration
   */
  async createCommissionConfig(
    providerId: string,
    distributorId: string,
    config: Omit<CommissionConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommissionConfig> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      // Create configuration in database
      // This would use drizzle ORM insert
      const now = new Date();

      // Mock implementation - in real scenario, use db.insert()
      const newConfig: CommissionConfig = {
        id: `config_${Date.now()}`,
        providerId,
        distributorId,
        commissionType: config.commissionType,
        commissionValue: config.commissionValue,
        commissionTierConfig: config.commissionTierConfig,
        transactionLimit: config.transactionLimit,
        dailyVolumeLimit: config.dailyVolumeLimit,
        monthlyVolumeLimit: config.monthlyVolumeLimit,
        dailyTransactionCountLimit: config.dailyTransactionCountLimit,
        cardAllocationLimit: config.cardAllocationLimit,
        autoReplenishThreshold: config.autoReplenishThreshold,
        autoReplenishQuantity: config.autoReplenishQuantity,
        settlementFrequency: config.settlementFrequency,
        settlementDay: config.settlementDay,
        settlementCurrency: config.settlementCurrency,
        featuresEnabled: config.featuresEnabled,
        createdAt: now,
        updatedAt: now,
      };

      // Audit log
      await this.auditService.logConfigChange(
        newConfig.id,
        distributorId,
        providerId,
        'system',
        {},
        config as Record<string, any>
      );

      return newConfig;
    } catch (error) {
      console.error('[ProviderConfig] Failed to create commission config:', error);
      throw error;
    }
  }

  /**
   * Update commission configuration
   */
  async updateCommissionConfig(
    configId: string,
    providerId: string,
    distributorId: string,
    updates: Partial<CommissionConfig>,
    userId: string
  ): Promise<CommissionConfig> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      // Get current config
      const current = await this.getCommissionConfig(providerId, distributorId);
      if (!current) {
        throw new Error('Configuration not found');
      }

      // Merge updates
      const updated: CommissionConfig = {
        ...current,
        ...updates,
        updatedAt: new Date(),
      };

      // Audit log
      await this.auditService.logConfigChange(
        configId,
        distributorId,
        providerId,
        userId,
        current as Record<string, any>,
        updated as Record<string, any>
      );

      return updated;
    } catch (error) {
      console.error('[ProviderConfig] Failed to update commission config:', error);
      throw error;
    }
  }

  /**
   * Calculate commission for a transaction
   */
  async calculateCommission(
    providerId: string,
    distributorId: string,
    amount: number
  ): Promise<number> {
    const config = await this.getCommissionConfig(providerId, distributorId);

    if (!config) {
      throw new Error('Commission configuration not found');
    }

    switch (config.commissionType) {
      case 'percentage':
        return amount * (config.commissionValue / 100);

      case 'fixed':
        return config.commissionValue;

      case 'tiered':
        return this.calculateTieredCommission(amount, config.commissionTierConfig || {});

      default:
        throw new Error(`Unknown commission type: ${config.commissionType}`);
    }
  }

  /**
   * Validate transaction against configuration limits
   */
  async validateTransactionLimits(
    providerId: string,
    distributorId: string,
    amount: number,
    dailyVolume: number,
    dailyTransactionCount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    const config = await this.getCommissionConfig(providerId, distributorId);

    if (!config) {
      return { valid: false, reason: 'Configuration not found' };
    }

    // Check transaction limit
    if (config.transactionLimit && amount > config.transactionLimit) {
      return { valid: false, reason: 'Transaction exceeds limit' };
    }

    // Check daily volume limit
    if (config.dailyVolumeLimit && dailyVolume + amount > config.dailyVolumeLimit) {
      return { valid: false, reason: 'Daily volume limit exceeded' };
    }

    // Check daily transaction count limit
    if (config.dailyTransactionCountLimit && dailyTransactionCount >= config.dailyTransactionCountLimit) {
      return { valid: false, reason: 'Daily transaction count limit exceeded' };
    }

    return { valid: true };
  }

  /**
   * Get credit rule for distributor-provider pair
   */
  async getCreditRule(
    providerId: string,
    distributorId: string
  ): Promise<CreditRule | null> {
    // Mock implementation - would query database
    return null;
  }

  /**
   * Create credit rule
   */
  async createCreditRule(
    providerId: string,
    distributorId: string,
    rule: Omit<CreditRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CreditRule> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const now = new Date();
      const newRule: CreditRule = {
        id: `credit_${Date.now()}`,
        providerId,
        distributorId,
        totalCreditLimit: rule.totalCreditLimit,
        transactionLimit: rule.transactionLimit,
        dailyTransactionLimit: rule.dailyTransactionLimit,
        dailyTransactionCountLimit: rule.dailyTransactionCountLimit,
        status: rule.status,
        createdAt: now,
        updatedAt: now,
      };

      // Audit log
      await this.auditService.logCreditLimitAdjustment(
        newRule.id,
        distributorId,
        providerId,
        'system',
        0,
        rule.totalCreditLimit,
        'Initial credit limit'
      );

      return newRule;
    } catch (error) {
      console.error('[ProviderConfig] Failed to create credit rule:', error);
      throw error;
    }
  }

  /**
   * Update credit rule
   */
  async updateCreditRule(
    ruleId: string,
    providerId: string,
    distributorId: string,
    updates: Partial<CreditRule>,
    userId: string
  ): Promise<CreditRule> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const current = await this.getCreditRule(providerId, distributorId);
      if (!current) {
        throw new Error('Credit rule not found');
      }

      const updated: CreditRule = {
        ...current,
        ...updates,
        updatedAt: new Date(),
      };

      // Audit log if limit changed
      if (updates.totalCreditLimit && updates.totalCreditLimit !== current.totalCreditLimit) {
        await this.auditService.logCreditLimitAdjustment(
          ruleId,
          distributorId,
          providerId,
          userId,
          current.totalCreditLimit,
          updates.totalCreditLimit,
          'Manual adjustment'
        );
      }

      return updated;
    } catch (error) {
      console.error('[ProviderConfig] Failed to update credit rule:', error);
      throw error;
    }
  }

  /**
   * Check if daily volume limit exceeded
   */
  async isDailyVolumeLimitExceeded(
    providerId: string,
    distributorId: string,
    currentDailyVolume: number
  ): Promise<boolean> {
    const config = await this.getCommissionConfig(providerId, distributorId);

    if (!config || !config.dailyVolumeLimit) {
      return false;
    }

    return currentDailyVolume > config.dailyVolumeLimit;
  }

  /**
   * Check if card allocation limit reached
   */
  async isCardAllocationLimitReached(
    providerId: string,
    distributorId: string,
    currentAllocation: number
  ): Promise<boolean> {
    const config = await this.getCommissionConfig(providerId, distributorId);

    if (!config || !config.cardAllocationLimit) {
      return false;
    }

    return currentAllocation >= config.cardAllocationLimit;
  }

  /**
   * Get settlement schedule for provider-distributor pair
   */
  async getSettlementSchedule(
    providerId: string,
    distributorId: string
  ): Promise<{ frequency: string; day?: number; currency: string } | null> {
    const config = await this.getCommissionConfig(providerId, distributorId);

    if (!config) {
      return null;
    }

    return {
      frequency: config.settlementFrequency,
      day: config.settlementDay,
      currency: config.settlementCurrency,
    };
  }

  private calculateTieredCommission(
    amount: number,
    tierConfig: Record<string, any>
  ): number {
    // Mock implementation
    return amount * 0.02; // Default 2%
  }

  private mapCommissionConfig(row: any): CommissionConfig {
    return {
      id: row.id || `config_${row.providerId}_${row.distributorId}`,
      providerId: String(row.providerId),
      distributorId: String(row.distributorId),
      commissionType: row.commissionType || 'percentage',
      commissionValue: row.commissionValue || 0,
      commissionTierConfig: row.commissionTierConfig,
      dailyVolumeLimit: row.dailyVolumeLimit,
      monthlyVolumeLimit: row.monthlyVolumeLimit,
      dailyTransactionCountLimit: row.dailyTransactionCountLimit,
      cardAllocationLimit: row.cardAllocationLimit,
      autoReplenishThreshold: row.autoReplenishThreshold,
      autoReplenishQuantity: row.autoReplenishQuantity,
      settlementFrequency: row.settlementFrequency || 'monthly',
      settlementDay: row.settlementDay,
      settlementCurrency: row.settlementCurrency || 'USD',
      featuresEnabled: row.featuresEnabled || [],
      createdAt: row.createdAt || new Date(),
      updatedAt: row.updatedAt || new Date(),
    };
  }
}

// Singleton instance
let providerConfigService: ProviderConfigService | null = null;

export function getProviderConfigService(auditService: AuditLogService): ProviderConfigService {
  if (!providerConfigService) {
    providerConfigService = new ProviderConfigService(auditService);
  }
  return providerConfigService;
}
