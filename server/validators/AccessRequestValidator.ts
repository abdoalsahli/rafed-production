/**
 * AccessRequestValidator - Business rules for access request validation
 * 
 * Enforces:
 * - Commission rate must be within allowed range (0-100%)
 * - Credit line cannot exceed provider limit
 * - Distributor can only have one pending request per provider
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class AccessRequestValidator {
  // Configuration
  private static readonly MIN_COMMISSION = 0; // 0%
  private static readonly MAX_COMMISSION = 100; // 100%
  private static readonly MIN_CREDIT_LINE = 100; // Minimum credit line
  private static readonly MAX_CREDIT_LINE = 1000000; // Maximum credit line

  /**
   * Validate access request creation
   */
  static validateCreation(data: {
    providerId?: number;
    distributorId?: number;
    requestedCreditLine?: number | string;
    requestedCommission?: number | string;
  }): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate provider ID
    if (!data.providerId || data.providerId <= 0) {
      errors.push({
        field: 'providerId',
        message: 'Provider ID is required and must be positive',
        code: 'INVALID_PROVIDER_ID',
      });
    }

    // Validate distributor ID
    if (!data.distributorId || data.distributorId <= 0) {
      errors.push({
        field: 'distributorId',
        message: 'Distributor ID is required and must be positive',
        code: 'INVALID_DISTRIBUTOR_ID',
      });
    }

    // Validate credit line
    const creditLine = this.parseDecimal(data.requestedCreditLine);
    if (creditLine === null) {
      errors.push({
        field: 'requestedCreditLine',
        message: 'Credit line must be a valid number',
        code: 'INVALID_CREDIT_LINE_FORMAT',
      });
    } else if (creditLine < this.MIN_CREDIT_LINE) {
      errors.push({
        field: 'requestedCreditLine',
        message: `Credit line must be at least ${this.MIN_CREDIT_LINE}`,
        code: 'CREDIT_LINE_TOO_LOW',
      });
    } else if (creditLine > this.MAX_CREDIT_LINE) {
      errors.push({
        field: 'requestedCreditLine',
        message: `Credit line cannot exceed ${this.MAX_CREDIT_LINE}`,
        code: 'CREDIT_LINE_TOO_HIGH',
      });
    }

    // Validate commission
    const commission = this.parseDecimal(data.requestedCommission);
    if (commission === null) {
      errors.push({
        field: 'requestedCommission',
        message: 'Commission must be a valid number',
        code: 'INVALID_COMMISSION_FORMAT',
      });
    } else if (commission < this.MIN_COMMISSION) {
      errors.push({
        field: 'requestedCommission',
        message: `Commission must be at least ${this.MIN_COMMISSION}%`,
        code: 'COMMISSION_TOO_LOW',
      });
    } else if (commission > this.MAX_COMMISSION) {
      errors.push({
        field: 'requestedCommission',
        message: `Commission cannot exceed ${this.MAX_COMMISSION}%`,
        code: 'COMMISSION_TOO_HIGH',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate approval with provider constraints
   */
  static validateApproval(data: {
    requestedCreditLine?: number | string;
    requestedCommission?: number | string;
    providerMaxCreditLine?: number | string;
    providerMaxCommission?: number | string;
  }): ValidationResult {
    const errors: ValidationError[] = [];

    // First validate basic format
    const basicValidation = this.validateCreation(data);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    const creditLine = this.parseDecimal(data.requestedCreditLine)!;
    const commission = this.parseDecimal(data.requestedCommission)!;
    const providerMaxCredit = this.parseDecimal(data.providerMaxCreditLine);
    const providerMaxCommission = this.parseDecimal(data.providerMaxCommission);

    // Check against provider limits
    if (providerMaxCredit !== null && creditLine > providerMaxCredit) {
      errors.push({
        field: 'requestedCreditLine',
        message: `Credit line cannot exceed provider limit of ${providerMaxCredit}`,
        code: 'EXCEEDS_PROVIDER_CREDIT_LIMIT',
      });
    }

    if (providerMaxCommission !== null && commission > providerMaxCommission) {
      errors.push({
        field: 'requestedCommission',
        message: `Commission cannot exceed provider limit of ${providerMaxCommission}%`,
        code: 'EXCEEDS_PROVIDER_COMMISSION_LIMIT',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate relationship configuration
   */
  static validateRelationshipConfig(data: {
    commissionPercentage?: number | string;
    creditLine?: number | string;
    allowCredit?: boolean | number;
  }): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate commission rate
    const commission = this.parseDecimal(data.commissionPercentage);
    if (commission === null) {
      errors.push({
        field: 'commissionPercentage',
        message: 'Commission rate must be a valid number',
        code: 'INVALID_COMMISSION_RATE',
      });
    } else if (commission < this.MIN_COMMISSION || commission > this.MAX_COMMISSION) {
      errors.push({
        field: 'commissionPercentage',
        message: `Commission rate must be between ${this.MIN_COMMISSION} and ${this.MAX_COMMISSION}`,
        code: 'INVALID_COMMISSION_RANGE',
      });
    }

    // Validate credit line
    const creditLine = this.parseDecimal(data.creditLine);
    if (creditLine === null) {
      errors.push({
        field: 'creditLine',
        message: 'Credit line must be a valid number',
        code: 'INVALID_CREDIT_LINE',
      });
    } else if (creditLine < this.MIN_CREDIT_LINE || creditLine > this.MAX_CREDIT_LINE) {
      errors.push({
        field: 'creditLine',
        message: `Credit line must be between ${this.MIN_CREDIT_LINE} and ${this.MAX_CREDIT_LINE}`,
        code: 'INVALID_CREDIT_RANGE',
      });
    }

    // Validate allowCredit
    if (data.allowCredit !== undefined && typeof data.allowCredit !== 'boolean' && typeof data.allowCredit !== 'number') {
      errors.push({
        field: 'allowCredit',
        message: 'Allow credit must be a boolean or number',
        code: 'INVALID_ALLOW_CREDIT',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if distributor can purchase
   * Returns true only if relationship is active and credit is available
   */
  static canDistributorPurchase(data: {
    relationshipStatus?: string;
    creditLine?: number | string;
    usedCredit?: number | string;
    purchaseAmount?: number | string;
  }): { canPurchase: boolean; reason?: string } {
    // Check relationship status
    if (data.relationshipStatus !== 'active') {
      return {
        canPurchase: false,
        reason: 'Relationship is not active. Please contact the provider.',
      };
    }

    // Check credit availability
    const creditLine = this.parseDecimal(data.creditLine);
    const usedCredit = this.parseDecimal(data.usedCredit);
    const purchaseAmount = this.parseDecimal(data.purchaseAmount);

    if (creditLine === null || usedCredit === null || purchaseAmount === null) {
      return {
        canPurchase: false,
        reason: 'Invalid credit or purchase amount',
      };
    }

    const availableCredit = creditLine - usedCredit;
    if (purchaseAmount > availableCredit) {
      return {
        canPurchase: false,
        reason: `Insufficient credit. Available: ${availableCredit}, Required: ${purchaseAmount}`,
      };
    }

    return { canPurchase: true };
  }

  /**
   * Helper: Parse decimal value safely
   */
  private static parseDecimal(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? null : num;
  }
}
