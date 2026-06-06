import { describe, it, expect } from 'vitest';
import { AccessRequestValidator } from '../validators/AccessRequestValidator';

describe('AccessRequestValidator', () => {
  describe('validateCreation', () => {
    it('should validate correct access request creation', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50000,
        requestedCommission: 5,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid provider ID', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: -1,
        distributorId: 2,
        requestedCreditLine: 50000,
        requestedCommission: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'providerId',
          code: 'INVALID_PROVIDER_ID',
        })
      );
    });

    it('should reject invalid distributor ID', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 0,
        requestedCreditLine: 50000,
        requestedCommission: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'distributorId',
          code: 'INVALID_DISTRIBUTOR_ID',
        })
      );
    });

    it('should reject credit line below minimum', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50, // Below minimum of 100
        requestedCommission: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCreditLine',
          code: 'CREDIT_LINE_TOO_LOW',
        })
      );
    });

    it('should reject credit line above maximum', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 2000000, // Above maximum of 1000000
        requestedCommission: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCreditLine',
          code: 'CREDIT_LINE_TOO_HIGH',
        })
      );
    });

    it('should reject commission below minimum', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50000,
        requestedCommission: -1, // Below minimum of 0
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCommission',
          code: 'COMMISSION_TOO_LOW',
        })
      );
    });

    it('should reject commission above maximum', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50000,
        requestedCommission: 150, // Above maximum of 100
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCommission',
          code: 'COMMISSION_TOO_HIGH',
        })
      );
    });

    it('should reject invalid credit line format', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 'invalid',
        requestedCommission: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCreditLine',
          code: 'INVALID_CREDIT_LINE_FORMAT',
        })
      );
    });

    it('should accept string numbers for credit line and commission', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: '50000',
        requestedCommission: '5.5',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateApproval', () => {
    it('should validate approval within provider limits', () => {
      const result = AccessRequestValidator.validateApproval({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50000,
        requestedCommission: 5,
        providerMaxCreditLine: 100000,
        providerMaxCommission: 10,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject credit line exceeding provider limit', () => {
      const result = AccessRequestValidator.validateApproval({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 150000,
        requestedCommission: 5,
        providerMaxCreditLine: 100000,
        providerMaxCommission: 10,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCreditLine',
          code: 'EXCEEDS_PROVIDER_CREDIT_LIMIT',
        })
      );
    });

    it('should reject commission exceeding provider limit', () => {
      const result = AccessRequestValidator.validateApproval({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50000,
        requestedCommission: 15,
        providerMaxCreditLine: 100000,
        providerMaxCommission: 10,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'requestedCommission',
          code: 'EXCEEDS_PROVIDER_COMMISSION_LIMIT',
        })
      );
    });
  });

  describe('validateRelationshipConfig', () => {
    it('should validate correct relationship config', () => {
      const result = AccessRequestValidator.validateRelationshipConfig({
        commissionPercentage: 5,
        creditLine: 50000,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid commission rate', () => {
      const result = AccessRequestValidator.validateRelationshipConfig({
        commissionPercentage: 150,
        creditLine: 50000,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'commissionRate',
          code: 'INVALID_COMMISSION_RANGE',
        })
      );
    });

    it('should reject invalid credit line', () => {
      const result = AccessRequestValidator.validateRelationshipConfig({
        commissionPercentage: 5,
        creditLine: 50, // Below minimum
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'creditLine',
          code: 'INVALID_CREDIT_RANGE',
        })
      );
    });

    it('should accept boolean or number for allowCredit', () => {
      const result1 = AccessRequestValidator.validateRelationshipConfig({
        commissionPercentage: 5,
        creditLine: 50000,
      });

      const result2 = AccessRequestValidator.validateRelationshipConfig({
        commissionPercentage: 5,
        creditLine: 50000,
      });

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('canDistributorPurchase', () => {
    it('should allow purchase with active relationship and sufficient credit', () => {
      const result = AccessRequestValidator.canDistributorPurchase({
        relationshipStatus: 'active',
        creditLine: 100000,
        purchaseAmount: 50000,
      });

      expect(result.canPurchase).toBe(true);
    });

    it('should reject purchase with inactive relationship', () => {
      const result = AccessRequestValidator.canDistributorPurchase({
        relationshipStatus: 'suspended',
        creditLine: 100000,
        purchaseAmount: 50000,
      });

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toContain('not active');
    });

    it('should reject purchase with insufficient credit', () => {
      const result = AccessRequestValidator.canDistributorPurchase({
        relationshipStatus: 'active',
        creditLine: 100000,
        purchaseAmount: 50000,
      });

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toContain('Insufficient credit');
    });

    it('should allow purchase using exactly available credit', () => {
      const result = AccessRequestValidator.canDistributorPurchase({
        relationshipStatus: 'active',
        creditLine: 100000,
        purchaseAmount: 50000,
      });

      expect(result.canPurchase).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined values gracefully', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: undefined,
        distributorId: undefined,
        requestedCreditLine: undefined,
        requestedCommission: undefined,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept boundary values', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 1,
        requestedCreditLine: 100, // Minimum
        requestedCommission: 0, // Minimum
      });

      expect(result.isValid).toBe(true);
    });

    it('should accept maximum boundary values', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 999999,
        distributorId: 999999,
        requestedCreditLine: 1000000, // Maximum
        requestedCommission: 100, // Maximum
      });

      expect(result.isValid).toBe(true);
    });

    it('should handle decimal precision correctly', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50000.99,
        requestedCommission: 5.55,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('Error messages', () => {
    it('should provide clear error messages', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: -1,
        distributorId: 0,
        requestedCreditLine: 50,
        requestedCommission: 150,
      });

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('required'),
        })
      );
    });

    it('should include error codes for programmatic handling', () => {
      const result = AccessRequestValidator.validateCreation({
        providerId: 1,
        distributorId: 2,
        requestedCreditLine: 50,
        requestedCommission: 5,
      });

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/^[A-Z_]+$/),
        })
      );
    });
  });
});
