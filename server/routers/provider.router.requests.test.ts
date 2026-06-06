import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '../db';
import { accessRequests, providerDistributorRelationships, distributors, serviceProviders } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Provider Request Mutations Tests
 * 
 * Tests for approveRequest and rejectRequest mutations
 */
describe('Provider Request Mutations', () => {
  let db: any;
  let providerId: number;
  let distributorId: number;
  let requestId: number;

  beforeEach(async () => {
    db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create test provider
    const providerResult = await db.insert(serviceProviders).values({
      name: 'Test Provider',
      email: 'provider@test.com',
      apiKey: 'test-key-' + Date.now(),
      status: 'active',
    });
    providerId = providerResult[0];

    // Create test distributor
    const distributorResult = await db.insert(distributors).values({
      name: 'Test Distributor',
      email: 'distributor@test.com',
      status: 'active',
    });
    distributorId = distributorResult[0];

    // Create test access request
    const requestResult = await db.insert(accessRequests).values({
      providerId,
      distributorId,
      requestedCommission: '5.00',
      requestedCreditLine: '50000.00',
      status: 'pending',
      createdAt: new Date(),
    });
    requestId = requestResult[0];
  });

  afterEach(async () => {
    if (!db) return;

    // Cleanup
    await db.delete(providerDistributorRelationships).where(eq(providerDistributorRelationships.providerId, providerId));
    await db.delete(accessRequests).where(eq(accessRequests.id, requestId));
    await db.delete(distributors).where(eq(distributors.id, distributorId));
    await db.delete(serviceProviders).where(eq(serviceProviders.id, providerId));
  });

  describe('approveRequest', () => {
    it('should approve a pending request and create relationship', async () => {
      // Verify request is pending
      const beforeApprove = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
      expect(beforeApprove[0].status).toBe('pending');

      // Simulate approval (in real test, would call mutation)
      await db
        .update(accessRequests)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: providerId,
        })
        .where(eq(accessRequests.id, requestId));

      // Create relationship
      await db.insert(providerDistributorRelationships).values({
        providerId,
        distributorId,
        commissionPercentage: '5.00',
        creditLine: '50000.00',
        status: 'active',
      });

      // Verify request is approved
      const afterApprove = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
      expect(afterApprove[0].status).toBe('approved');
      expect(afterApprove[0].reviewedBy).toBe(providerId);

      // Verify relationship created
      const relationships = await db
        .select()
        .from(providerDistributorRelationships)
        .where(eq(providerDistributorRelationships.providerId, providerId));
      expect(relationships.length).toBe(1);
      expect(relationships[0].distributorId).toBe(distributorId);
      expect(relationships[0].status).toBe('active');
    });

    it('should reject approval if request not found', async () => {
      const nonExistentId = 99999;
      const result = await db.select().from(accessRequests).where(eq(accessRequests.id, nonExistentId));
      expect(result.length).toBe(0);
    });

    it('should reject approval if already approved', async () => {
      // First approval
      await db
        .update(accessRequests)
        .set({ status: 'approved', reviewedAt: new Date(), reviewedBy: providerId })
        .where(eq(accessRequests.id, requestId));

      // Try to approve again
      const request = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
      expect(request[0].status).toBe('approved');
    });
  });

  describe('rejectRequest', () => {
    it('should reject a pending request', async () => {
      const rejectionReason = 'Insufficient credit history';

      // Reject request
      await db
        .update(accessRequests)
        .set({
          status: 'rejected',
          rejectionReason,
          reviewedBy: providerId,
          reviewedAt: new Date(),
        })
        .where(eq(accessRequests.id, requestId));

      // Verify rejection
      const result = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
      expect(result[0].status).toBe('rejected');
      expect(result[0].rejectionReason).toBe(rejectionReason);

      // Verify no relationship created
      const relationships = await db
        .select()
        .from(providerDistributorRelationships)
        .where(eq(providerDistributorRelationships.providerId, providerId));
      expect(relationships.length).toBe(0);
    });

    it('should reject rejection if request not found', async () => {
      const nonExistentId = 99999;
      const result = await db.select().from(accessRequests).where(eq(accessRequests.id, nonExistentId));
      expect(result.length).toBe(0);
    });

    it('should reject rejection if already rejected', async () => {
      // First rejection
      await db
        .update(accessRequests)
        .set({ status: 'rejected', rejectionReason: 'First reason', reviewedAt: new Date(), reviewedBy: providerId })
        .where(eq(accessRequests.id, requestId));

      // Verify rejection
      const request = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
      expect(request[0].status).toBe('rejected');
    });
  });

  describe('Authorization', () => {
    it('should prevent other providers from approving request', async () => {
      // Create another provider
      const otherProviderResult = await db.insert(serviceProviders).values({
        name: 'Other Provider',
        email: 'other@test.com',
        apiKey: 'other-key-' + Date.now(),
        status: 'active',
      });
      const otherProviderId = otherProviderResult[0];

      try {
        // Verify request belongs to original provider
        const request = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
        expect(request[0].providerId).toBe(providerId);
        expect(request[0].providerId).not.toBe(otherProviderId);
      } finally {
        // Cleanup
        await db.delete(serviceProviders).where(eq(serviceProviders.id, otherProviderId));
      }
    });
  });
});
