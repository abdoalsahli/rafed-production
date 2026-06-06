import { Decimal } from "decimal.js";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { FinancialService } from "./financial.service";

/**
 * Adjustment Service - Admin-only financial adjustments with audit trail
 * 
 * Key guarantees:
 * - Admin authorization required
 * - Append-only ledger (adjustments recorded as ADJUSTMENT entries)
 * - Financial invariants enforced (no negative balances, credit constraints)
 * - Audit metadata captured (reviewedBy, reason)
 * - All adjustments traceable and reversible
 */

export interface AdjustmentRequest {
  adminId: number;                    // Admin user ID (must have admin role)
  providerId: number;                 // Provider to adjust
  distributorId: number;              // Distributor to adjust
  adjustmentType: "balance" | "credit";
  adjustmentAmount: string;           // Amount to adjust (XX.XX or -XX.XX)
  reason: string;                     // Reason for adjustment
}

export interface AdjustmentResponse {
  adjustmentId: string;
  providerId: number;
  distributorId: number;
  adjustmentType: "balance" | "credit";
  adjustmentAmount: string;
  finalBalance: string;
  finalUsedCredit: string;
  reviewedBy: number;
  reason: string;
  timestamp: Date;
}

export class AdjustmentService {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL not set");
    }

    const urlObj = new URL(url);
    const sslParam = urlObj.searchParams.get("ssl");
    const sslConfig = sslParam ? JSON.parse(sslParam) : undefined;

    const connection = await mysql.createConnection({
      host: urlObj.hostname,
      user: urlObj.username,
      password: urlObj.password,
      database: urlObj.pathname.slice(1),
      ssl: sslConfig,
    });

    this.db = drizzle(connection, { schema, mode: "default" });
  }

  /**
   * Verify admin authorization
   */
  private async verifyAdminAuthorization(adminId: number): Promise<void> {
    if (!this.db) {
      await this.initializeDb();
    }

    const admin = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, adminId))
      .limit(1);

    if (!admin || admin.length === 0) {
      throw new Error("Admin user not found");
    }

    if (admin[0].role !== "admin") {
      throw new Error("User does not have admin privileges");
    }
  }

  /**
   * Process a balance or credit adjustment
   * 
   * Algorithm:
   * 1. Verify admin authorization
   * 2. Validate adjustment amount and type
   * 3. Verify provider and distributor exist
   * 4. Call FinancialService.processAdjustment()
   * 5. Return adjustment details
   */
  async processAdjustment(request: AdjustmentRequest): Promise<AdjustmentResponse> {
    // Ensure DB is initialized
    if (!this.db) {
      await this.initializeDb();
    }

    const {
      adminId,
      providerId,
      distributorId,
      adjustmentType,
      adjustmentAmount,
      reason,
    } = request;

    // 1. Verify admin authorization
    await this.verifyAdminAuthorization(adminId);

    // 2. Validate adjustment amount
    const amount = new Decimal(adjustmentAmount);
    if (amount.isNaN()) {
      throw new Error("Invalid adjustment amount");
    }

    if (reason.length < 1 || reason.length > 255) {
      throw new Error("Reason must be between 1 and 255 characters");
    }

    // 3. Verify provider and distributor exist
    const provider = await this.db
      .select()
      .from(schema.serviceProviders)
      .where(eq(schema.serviceProviders.id, providerId))
      .limit(1);

    if (!provider || provider.length === 0) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const distributor = await this.db
      .select()
      .from(schema.distributors)
      .where(eq(schema.distributors.id, distributorId))
      .limit(1);

    if (!distributor || distributor.length === 0) {
      throw new Error(`Distributor ${distributorId} not found`);
    }

    // 4. Call FinancialService.processAdjustment()
    const result = await FinancialService.processAdjustment(
      this.db,
      providerId,
      distributorId,
      adjustmentType,
      amount,
      adminId,
      reason
    );

    // 5. Get the adjustment ledger entry ID
    const adjustmentEntry = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(
        and(
          eq(schema.providerDistributorLedger.providerId, providerId),
          eq(schema.providerDistributorLedger.distributorId, distributorId),
          eq(schema.providerDistributorLedger.referenceType, "adjustment")
        )
      )
      .orderBy(schema.providerDistributorLedger.createdAt)
      .limit(1);

    const adjustmentId = adjustmentEntry[0]?.referenceId || `ADJ-${Date.now()}`;

    return {
      adjustmentId,
      providerId,
      distributorId,
      adjustmentType,
      adjustmentAmount: amount.toFixed(2),
      finalBalance: result.finalBalance.toFixed(2),
      finalUsedCredit: result.finalUsedCredit.toFixed(2),
      reviewedBy: adminId,
      reason,
      timestamp: new Date(),
    };
  }

  /**
   * Get adjustment history for a provider-distributor relationship
   */
  async getAdjustmentHistory(options: {
    providerId: number;
    distributorId: number;
  }): Promise<any[]> {
    if (!this.db) {
      await this.initializeDb();
    }

    const { providerId, distributorId } = options;

    const adjustments = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(
        and(
          eq(schema.providerDistributorLedger.providerId, providerId),
          eq(schema.providerDistributorLedger.distributorId, distributorId),
          eq(schema.providerDistributorLedger.referenceType, "adjustment")
        )
      )
      .orderBy(schema.providerDistributorLedger.createdAt);

    return adjustments.map((entry: any) => {
      const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};
      return {
        adjustmentId: entry.referenceId,
        adjustmentType: metadata.adjustmentType,
        adjustmentAmount: metadata.adjustmentAmount,
        balanceAfter: entry.balanceAfterTransaction,
        usedCreditAfter: entry.usedCreditAfterTransaction,
        reviewedBy: metadata.reviewedBy,
        reason: metadata.reason,
        timestamp: entry.createdAt,
      };
    });
  }

  /**
   * Get audit trail for a specific adjustment
   */
  async getAdjustmentAudit(adjustmentId: string): Promise<any> {
    if (!this.db) {
      await this.initializeDb();
    }

    const adjustment = await this.db
      .select()
      .from(schema.providerDistributorLedger)
      .where(eq(schema.providerDistributorLedger.referenceId, adjustmentId))
      .limit(1);

    if (!adjustment || adjustment.length === 0) {
      throw new Error(`Adjustment ${adjustmentId} not found`);
    }

    const entry = adjustment[0];
    const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};

    return {
      adjustmentId: entry.referenceId,
      providerId: entry.providerId,
      distributorId: entry.distributorId,
      adjustmentType: metadata.adjustmentType,
      adjustmentAmount: metadata.adjustmentAmount,
      balanceAfter: entry.balanceAfterTransaction,
      usedCreditAfter: entry.usedCreditAfterTransaction,
      reviewedBy: metadata.reviewedBy,
      reason: metadata.reason,
      timestamp: entry.createdAt,
    };
  }
}
