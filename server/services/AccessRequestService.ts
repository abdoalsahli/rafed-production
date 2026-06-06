/**
 * AccessRequestService - Business logic for managing access requests
 * 
 * Responsibilities:
 * - Create access requests from distributors
 * - Retrieve pending requests for providers
 * - Approve/reject requests with validation
 * - Create provider-distributor relationships on approval
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { accessRequests, providerDistributorRelationships } from '../../drizzle/schema';
import { AccessRequestValidator } from '../validators/AccessRequestValidator';

export interface CreateAccessRequestInput {
  providerId: number;
  distributorId: number;
  requestedCreditLine: number;
  requestedCommission: number;
}

export interface ApproveAccessRequestInput {
  requestId: number;
  reviewedBy: number;
  commissionPercentage?: number;
  creditLine?: number;
  allowCredit?: boolean;
}

export interface RejectAccessRequestInput {
  requestId: number;
  rejectionReason: string;
}

export interface AccessRequestResponse {
  id: number;
  providerId: number;
  distributorId: number;
  distributorName?: string;
  requestedCreditLine: number;
  requestedCommission: number;
  status: string;
  rejectionReason?: string;
  reviewedBy?: number;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AccessRequestService {
  /**
   * Create a new access request
   */
  static async createAccessRequest(input: CreateAccessRequestInput): Promise<AccessRequestResponse> {
    // Validate input
    const validation = AccessRequestValidator.validateCreation({
      providerId: input.providerId,
      distributorId: input.distributorId,
      requestedCreditLine: input.requestedCreditLine,
      requestedCommission: input.requestedCommission,
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Check if request already exists
    const existing = await db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.providerId, input.providerId),
          eq(accessRequests.distributorId, input.distributorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Access request already exists for this provider-distributor pair');
    }

    // Create request
    const result = await db.insert(accessRequests).values({
      providerId: input.providerId,
      distributorId: input.distributorId,
      requestedCreditLine: input.requestedCreditLine.toString(),
      requestedCommission: input.requestedCommission.toString(),
      status: 'pending',
    });

    const requestId = (result as any).insertId || 1;

    return {
      id: requestId as number,
      providerId: input.providerId,
      distributorId: input.distributorId,
      requestedCreditLine: input.requestedCreditLine,
      requestedCommission: input.requestedCommission,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get pending access requests for a provider
   */
  static async getProviderAccessRequests(providerId: number): Promise<AccessRequestResponse[]> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const requests = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.providerId, providerId));

    return requests.map((r) => ({
      id: r.id,
      providerId: r.providerId,
      distributorId: r.distributorId,
      requestedCreditLine: parseFloat(r.requestedCreditLine.toString()),
      requestedCommission: parseFloat(r.requestedCommission.toString()),
      status: r.status,
      rejectionReason: r.rejectionReason || undefined,
      reviewedBy: r.reviewedBy || undefined,
      reviewedAt: r.reviewedAt || undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Approve an access request
   */
  static async approveAccessRequest(input: ApproveAccessRequestInput): Promise<AccessRequestResponse> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get the request
    const request = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, input.requestId))
      .limit(1);

    if (request.length === 0) {
      throw new Error('Access request not found');
    }

    const req = request[0];

    // Use requested values or provided overrides
    const commissionPercentage = input.commissionPercentage ?? parseFloat(req.requestedCommission.toString());
    const creditLine = input.creditLine ?? parseFloat(req.requestedCreditLine.toString());
    const allowCredit = input.allowCredit !== undefined ? input.allowCredit : true;

    // Validate relationship config
    const validation = AccessRequestValidator.validateRelationshipConfig({
      commissionPercentage,
      creditLine,
      allowCredit,
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    // Update access request
    await db
      .update(accessRequests)
      .set({
        status: 'approved',
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(accessRequests.id, input.requestId));

    // Create provider-distributor relationship
    await db.insert(providerDistributorRelationships).values({
      providerId: req.providerId,
      distributorId: req.distributorId,
      commissionPercentage: commissionPercentage.toString(),
      commissionType: 'percentage',
      creditLine: creditLine.toString(),
      status: 'active',
    });

    return {
      id: req.id,
      providerId: req.providerId,
      distributorId: req.distributorId,
      requestedCreditLine: parseFloat(req.requestedCreditLine.toString()),
      requestedCommission: parseFloat(req.requestedCommission.toString()),
      status: 'approved',
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      createdAt: req.createdAt,
      updatedAt: new Date(),
    };
  }

  /**
   * Reject an access request
   */
  static async rejectAccessRequest(input: RejectAccessRequestInput): Promise<AccessRequestResponse> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get the request
    const request = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, input.requestId))
      .limit(1);

    if (request.length === 0) {
      throw new Error('Access request not found');
    }

    const req = request[0];

    // Update request
    await db
      .update(accessRequests)
      .set({
        status: 'rejected',
        rejectionReason: input.rejectionReason,
      })
      .where(eq(accessRequests.id, input.requestId));

    return {
      id: req.id,
      providerId: req.providerId,
      distributorId: req.distributorId,
      requestedCreditLine: parseFloat(req.requestedCreditLine.toString()),
      requestedCommission: parseFloat(req.requestedCommission.toString()),
      status: 'rejected',
      rejectionReason: input.rejectionReason,
      createdAt: req.createdAt,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if distributor can purchase from provider
   */
  static async canDistributorPurchase(
    providerId: number,
    distributorId: number,
    purchaseAmount: number
  ): Promise<{ canPurchase: boolean; reason?: string }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get relationship
    const relationship = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, providerId),
          eq(providerDistributorRelationships.distributorId, distributorId)
        )
      )
      .limit(1);

    if (relationship.length === 0) {
      return {
        canPurchase: false,
        reason: 'No active relationship with this provider',
      };
    }

    const rel = relationship[0];

    return AccessRequestValidator.canDistributorPurchase({
      relationshipStatus: rel.status,
      creditLine: rel.creditLine,
      purchaseAmount,
    });
  }

  /**
   * Get relationship for provider-distributor pair
   */
  static async getRelationship(providerId: number, distributorId: number) {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const relationship = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, providerId),
          eq(providerDistributorRelationships.distributorId, distributorId)
        )
      )
      .limit(1);

    return relationship.length > 0 ? relationship[0] : null;
  }
}
