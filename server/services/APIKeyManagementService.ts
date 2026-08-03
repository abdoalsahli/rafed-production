/**
 * API Key Management Service
 * Manages API keys, authentication, and rate limiting
 */

import { AuditLogService } from './AuditLogService';
import crypto from 'crypto';

export interface APIKey {
  id: string;
  key: string;
  keyHash: string;
  name: string;
  distributorId: string;
  status: 'active' | 'revoked' | 'expired';
  rateLimit: number;
  rateLimitWindow: number; // in seconds
  createdBy: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

export interface RateLimitInfo {
  limit: number;
  window: number;
  current: number;
  remaining: number;
  resetAt: Date;
}

export class APIKeyManagementService {
  private auditService: AuditLogService;
  private rateLimitCache: Map<string, { count: number; resetAt: Date }> = new Map();

  constructor(auditService: AuditLogService) {
    this.auditService = auditService;
  }

  /**
   * Generate a new API key
   */
  async generateAPIKey(
    distributorId: string,
    name: string,
    createdBy: string,
    rateLimit: number = 1000,
    rateLimitWindow: number = 60,
    expiresAt?: Date
  ): Promise<APIKey> {

    try {
      // Generate random key
      const keyBuffer = crypto.randomBytes(32);
      const key = keyBuffer.toString('hex');
      const keyHash = this.hashKey(key);

      const now = new Date();
      const apiKey: APIKey = {
        id: `key_${Date.now()}`,
        key,
        keyHash,
        name,
        distributorId,
        status: 'active',
        rateLimit,
        rateLimitWindow,
        createdBy,
        createdAt: now,
        expiresAt,
      };

      // Audit log
      await this.auditService.logAPIKeyEvent(
        apiKey.id,
        createdBy,
        'created',
        `API key "${name}" created for distributor ${distributorId}`
      );

      return apiKey;
    } catch (error) {
      console.error('[APIKeyManagement] Failed to generate API key:', error);
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(key: string): Promise<{ valid: boolean; distributorId?: string; reason?: string }> {

    try {
      const keyHash = this.hashKey(key);

      // TODO: implement real DB lookup by keyHash
      // Until then, reject all keys so no forged key can gain access.
      return { valid: false, reason: 'API key authentication not yet implemented' };
    } catch (error) {
      console.error('[APIKeyManagement] Failed to validate API key:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(keyId: string, rateLimit: number, window: number): Promise<RateLimitInfo> {
    const now = new Date();
    const cacheKey = keyId;

    // Get or create cache entry
    let entry = this.rateLimitCache.get(cacheKey);

    if (!entry || now > entry.resetAt) {
      // Create new entry
      entry = {
        count: 0,
        resetAt: new Date(now.getTime() + window * 1000),
      };
      this.rateLimitCache.set(cacheKey, entry);
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    const exceeded = entry.count > rateLimit;

    if (exceeded) {
      // Audit log
      await this.auditService.logRateLimitEvent(
        keyId,
        'api_call',
        true
      );
    }

    return {
      limit: rateLimit,
      window,
      current: entry.count,
      remaining: Math.max(0, rateLimit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Rotate API key
   */
  async rotateAPIKey(
    oldKeyId: string,
    distributorId: string,
    rotatedBy: string
  ): Promise<APIKey> {

    try {
      // Get old key
      // Revoke old key
      // Generate new key

      const newKey = await this.generateAPIKey(
        distributorId,
        `rotated_${Date.now()}`,
        rotatedBy,
        1000,
        60
      );

      // Audit log
      await this.auditService.logAPIKeyEvent(
        oldKeyId,
        rotatedBy,
        'rotated',
        `API key rotated, new key: ${newKey.id}`
      );

      return newKey;
    } catch (error) {
      console.error('[APIKeyManagement] Failed to rotate API key:', error);
      throw error;
    }
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(
    keyId: string,
    distributorId: string,
    revokedBy: string,
    reason: string
  ): Promise<APIKey> {

    try {
      const now = new Date();

      // Mock implementation - would update database

      const revokedKey: APIKey = {
        id: keyId,
        key: '',
        keyHash: '',
        name: '',
        distributorId,
        status: 'revoked',
        rateLimit: 0,
        rateLimitWindow: 0,
        createdBy: '',
        createdAt: now,
        revokedAt: now,
        revokedBy,
      };

      // Audit log
      await this.auditService.logAPIKeyEvent(
        keyId,
        revokedBy,
        'revoked',
        reason
      );

      // Clear from cache
      this.rateLimitCache.delete(keyId);

      return revokedKey;
    } catch (error) {
      console.error('[APIKeyManagement] Failed to revoke API key:', error);
      throw error;
    }
  }

  /**
   * List API keys for distributor
   */
  async listAPIKeys(distributorId: string): Promise<APIKey[]> {

    try {
      // Mock implementation - would query database
      return [];
    } catch (error) {
      console.error('[APIKeyManagement] Failed to list API keys:', error);
      throw error;
    }
  }

  /**
   * Update API key rate limit
   */
  async updateRateLimit(
    keyId: string,
    distributorId: string,
    newRateLimit: number,
    updatedBy: string
  ): Promise<APIKey> {

    try {
      // Mock implementation - would update database

      const updatedKey: APIKey = {
        id: keyId,
        key: '',
        keyHash: '',
        name: '',
        distributorId,
        status: 'active',
        rateLimit: newRateLimit,
        rateLimitWindow: 60,
        createdBy: '',
        createdAt: new Date(),
      };

      // Audit log
      await this.auditService.logEvent({
        action: 'rate_limit_updated',
        resourceType: 'api_key',
        resourceId: keyId,
        distributorId,
        userId: updatedBy,
        details: {
          newRateLimit,
        },
      });

      return updatedKey;
    } catch (error) {
      console.error('[APIKeyManagement] Failed to update rate limit:', error);
      throw error;
    }
  }

  /**
   * Get rate limit info for API key
   */
  async getRateLimitInfo(keyId: string): Promise<RateLimitInfo | null> {
    const entry = this.rateLimitCache.get(keyId);

    if (!entry) {
      return null;
    }

    return {
      limit: 1000,
      window: 60,
      current: entry.count,
      remaining: Math.max(0, 1000 - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries from cache
   */
  cleanupExpiredEntries(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    this.rateLimitCache.forEach((entry, key) => {
      if (now > entry.resetAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.rateLimitCache.delete(key);
    });
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

// Singleton instance
let apiKeyManagementService: APIKeyManagementService | null = null;

export function getAPIKeyManagementService(auditService: AuditLogService): APIKeyManagementService {
  if (!apiKeyManagementService) {
    apiKeyManagementService = new APIKeyManagementService(auditService);
  }
  return apiKeyManagementService;
}
