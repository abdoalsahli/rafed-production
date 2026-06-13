import { logPerfData } from '../utils/dashboard-perf';
/**
 * Distributor Router
 * Handles distributor-specific operations including provider connection via code
 */

import { z } from "zod";
import { getDb, getRawDb } from "../db";
import { serviceProviders, providerDistributorRelationships, accessRequests, users, products, cards, purchaseRequests } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { NotificationService } from "../_core/notification.service";
import { queueManager } from "../queue-manager";
import { atomicMarkPinAsViewed, getCardEncryptedPin, insertAuditLog } from "../db";
import { pinEncryptionService } from "../services/encryption.service";
import { getDistributorIdFromUser } from "../utils/org-lookup";

export const distributorRouter = router({
  /**
   * distributor.findProviderByCode
   * Lookup a provider by their unique provider code
   * Returns provider info if found and active
   */
  findProviderByCode: protectedProcedure
    .input(
      z.object({
        providerCode: z.string().min(1).max(32).toUpperCase(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        const provider = await db
          .select({
            id: serviceProviders.id,
            name: serviceProviders.name,
            providerCode: serviceProviders.providerCode,
            status: serviceProviders.status,
            createdAt: serviceProviders.createdAt,
          })
          .from(serviceProviders)
          .where(
            and(
              eq(serviceProviders.providerCode, input.providerCode),
              eq(serviceProviders.status, "active")
            )
          )
          .limit(1);

        if (provider.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Provider not found or inactive",
          });
        }

        return provider[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Distributor Router] Error finding provider by code:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to lookup provider",
        });
      }
    }),

  /**
   * distributor.requestConnection
   * Send a connection request to a provider using their code
   * Creates an access request that provider must approve
   */
  requestConnection: protectedProcedure
    .input(
      z.object({
        providerCode: z.string().min(1).max(32).toUpperCase(),
        requestedCommission: z.number().positive().default(5),
        requestedCreditLine: z.number().nonnegative().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Find provider by code
        const providerResult = await db
          .select({ id: serviceProviders.id })
          .from(serviceProviders)
          .where(
            and(
              eq(serviceProviders.providerCode, input.providerCode),
              eq(serviceProviders.status, "active")
            )
          )
          .limit(1);

        if (providerResult.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Provider not found",
          });
        }

        const providerId = providerResult[0].id;

        // Check if already connected
        const existingRelationship = await db
          .select()
          .from(providerDistributorRelationships)
          .where(
            and(
              eq(providerDistributorRelationships.providerId, providerId),
              eq(providerDistributorRelationships.distributorId, distributorId)
            )
          )
          .limit(1);

        if (existingRelationship.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Already connected to this provider",
          });
        }

        // Check for pending request
        const pendingRequest = await db
          .select()
          .from(accessRequests)
          .where(
            and(
              eq(accessRequests.providerId, providerId),
              eq(accessRequests.distributorId, distributorId),
              eq(accessRequests.status, "pending")
            )
          )
          .limit(1);

        if (pendingRequest.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Connection request already pending",
          });
        }

        // Create access request
        await db.insert(accessRequests).values({
          providerId,
          distributorId,
          requestedCommission: input.requestedCommission.toString(),
          requestedCreditLine: input.requestedCreditLine.toString(),
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Notify provider of new connection request
        try {
          await NotificationService.createNotification({
            userId: providerId,
            type: "REQUEST_RECEIVED",
            message: `New connection request from distributor (Commission: ${input.requestedCommission}%, Credit Line: $${input.requestedCreditLine})`,
            relatedEntityId: providerId,
            relatedEntityType: "access_request",
          });
        } catch (notificationError) {
          // Log but don't fail the request if notification fails
          console.error("[Distributor Router] Failed to create notification:", notificationError);
        }

        return {
          success: true,
          message: "Connection request sent successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Distributor Router] Error requesting connection:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send connection request",
        });
      }
    }),

  /**
   * distributor.listProducts
   * List available products from linked providers
   */
  listProducts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        const pool = await getRawDb();
        if (!pool) throw new Error("Database connection not available");
        
        // Execute query using pool.query
        const [rows] = await pool.query(
          `SELECT
            p.id, p.provider_id, p.name, p.display_name, p.description,
            p.face_value, p.currency, p.price, p.status, p.created_at,
            sp.id as sp_id, sp.name as provider_name,
            CASE WHEN EXISTS (
              SELECT 1 FROM cards c WHERE c.product_id = p.id AND c.status = 'AVAILABLE'
            ) THEN 1 ELSE 0 END as in_stock
          FROM products p
          JOIN service_providers sp ON p.provider_id = sp.id
          JOIN provider_distributor_relationships pdr ON sp.id = pdr.provider_id
          WHERE pdr.distributor_id = ? AND pdr.status = 'active' AND p.status = 'active'
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?`,
          [distributorId, input.limit, input.offset]
        );

        return {
          products: rows || [],
          total: rows?.length || 0,
        };
      } catch (error) {
        console.error("[Distributor Router] Error listing products:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list products",
        });
      }
    }),

  /**
   * distributor.purchase
   * Purchase a card from a provider
   */
  purchase: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
        idempotencyKey: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Verify relationship is active
        const relationship = await db
          .select()
          .from(providerDistributorRelationships)
          .where(
            and(
              eq(providerDistributorRelationships.providerId, input.providerId),
              eq(providerDistributorRelationships.distributorId, distributorId),
              eq(providerDistributorRelationships.status, "active")
            )
          )
          .limit(1);

        if (relationship.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not connected to this provider or connection is inactive",
          });
        }

        // Verify product belongs to provider
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, input.providerId),
              eq(products.status, "active")
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or inactive",
          });
        }

        // Use queue manager for purchase (delegates to shared service)
        const result = await queueManager.enqueueRequest(
          input.providerId,
          distributorId,
          input.productId,
          input.idempotencyKey
        );

        return {
          success: true,
          requestId: result.requestId,
          status: result.status,
          message: result.error || "Purchase request queued",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Distributor Router] Error processing purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process purchase",
        });
      }
    }),

  /**
   * distributor.getPurchaseResult
   * Poll the result of an async purchase request.
   * When status is SUCCEEDED, decrypts and returns the card PIN (one-time only).
   */
  getPurchaseResult: protectedProcedure
    .input(z.object({ requestId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      const pool = await getRawDb();
      const [rows]: any = await pool.query(
        `SELECT pr.id, pr.status, pr.card_id, pr.failure_reason,
                c.pin_encrypted, c.pin_viewed, c.serial_number,
                p.display_name, p.name AS product_name,
                p.face_value, p.currency, p.price
         FROM purchase_requests pr
         LEFT JOIN cards c ON pr.card_id = c.id
         LEFT JOIN products p ON pr.product_id = p.id
         WHERE pr.id = ? AND pr.distributor_id = ?`,
        [input.requestId, distributorId]
      );

      if (!rows || rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      const req = rows[0];
      const base = {
        productName: req.display_name || req.product_name || "",
        faceValue: req.face_value ? parseFloat(req.face_value) : null,
        price: req.price ? parseFloat(req.price) : null,
        currency: req.currency || "LYD",
      };

      const serialNumber: string | null = req.serial_number ?? null;

      if (req.status === "PENDING" || req.status === "PROCESSING") {
        return { ...base, status: req.status as "PENDING" | "PROCESSING", pin: null, serialNumber: null, failureReason: null };
      }

      if (req.status === "FAILED") {
        return { ...base, status: "FAILED" as const, pin: null, serialNumber: null, failureReason: req.failure_reason || "Purchase failed" };
      }

      // SUCCEEDED — decrypt PIN (one-time)
      if (!req.card_id || !req.pin_encrypted) {
        return { ...base, status: "SUCCEEDED" as const, pin: null, serialNumber, failureReason: "Card data unavailable" };
      }

      // Guard: already viewed before this call (e.g. via webhook flow)
      if (Number(req.pin_viewed) === 1) {
        return { ...base, status: "SUCCEEDED" as const, pin: null, serialNumber, failureReason: "PIN already retrieved" };
      }

      // Atomic one-time mark
      const [markResult]: any = await pool.query(
        "UPDATE cards SET pin_viewed = 1, updated_at = NOW() WHERE id = ? AND pin_viewed = 0",
        [req.card_id]
      );
      if (!markResult.affectedRows || markResult.affectedRows === 0) {
        return { ...base, status: "SUCCEEDED" as const, pin: null, serialNumber, failureReason: "PIN already retrieved" };
      }

      try {
        const pin = await pinEncryptionService.decryptPIN(req.pin_encrypted);
        await insertAuditLog(db, {
          userId: ctx.user.id,
          action: "PIN_VIEWED",
          resourceId: req.card_id,
          metadata: { requestId: input.requestId, distributorId, source: "manual_purchase" },
        });
        return { ...base, status: "SUCCEEDED" as const, pin, serialNumber, failureReason: null };
      } catch (err: any) {
        console.error("[getPurchaseResult] PIN decryption failed:", err);
        return { ...base, status: "SUCCEEDED" as const, pin: null, serialNumber, failureReason: "PIN decryption failed" };
      }
    }),

  /**
   * distributor.getConnectionStatus
   * Check connection status with a provider
   */
  getConnectionStatus: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Check for active relationship
        const relationship = await db
          .select()
          .from(providerDistributorRelationships)
          .where(
            and(
              eq(providerDistributorRelationships.providerId, input.providerId),
              eq(providerDistributorRelationships.distributorId, distributorId)
            )
          )
          .limit(1);

        if (relationship.length > 0) {
          return {
            status: relationship[0].status,
            connected: relationship[0].status === "active",
          };
        }

        // Check for pending request
        const request = await db
          .select()
          .from(accessRequests)
          .where(
            and(
              eq(accessRequests.providerId, input.providerId),
              eq(accessRequests.distributorId, distributorId)
            )
          )
          .orderBy(accessRequests.createdAt)
          .limit(1);

        if (request.length > 0) {
          return {
            status: request[0].status,
            connected: false,
            requestId: request[0].id,
          };
        }

        return {
          status: "not_connected",
          connected: false,
        };
      } catch (error) {
        console.error("[Distributor Router] Error getting connection status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get connection status",
        });
      }
    }),

  /**
   * distributor.getConnectedProviders
   * Get list of all connected providers for the distributor
   */
  getConnectedProviders: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      const queryStartTime = Date.now(); // TIMING: Start measurement
      try {
        const pool = await getRawDb();
        if (!pool) throw new Error("Database connection not available");
        
        // Get all active provider connections for this distributor
        const [rows] = await pool.query(
          `SELECT 
            pdr.id as relationship_id,
            sp.id as provider_id,
            sp.name as provider_name,
            sp.provider_code as provider_code,
            pdr.status,
            pdr.commission_percentage,
            pdr.credit_line,
            
            pdr.created_at as connected_at,
            pda.balance as available_credit,
            pda.used_credit as account_used_credit
          FROM provider_distributor_relationships pdr
          JOIN service_providers sp ON pdr.provider_id = sp.id
          LEFT JOIN provider_distributor_accounts pda ON pdr.provider_id = pda.provider_id AND pdr.distributor_id = pda.distributor_id
          WHERE pdr.distributor_id = ?
          ORDER BY pdr.created_at DESC`,
          [distributorId]
        );

        // TIMING: Log execution time
        const queryEndTime = Date.now();
        const executionTimeMs = queryEndTime - queryStartTime;
        logPerfData({
          procedure: 'distributor.getConnectedProviders',
          userId: ctx.user.id,
          distributorId,
          durationMs: executionTimeMs,
          rowCount: rows?.length || 0,
          success: true,
        });

        return {
          providers: (rows || []).map((row: any) => ({
            id: row.provider_id,
            relationshipId: row.relationship_id,
            name: row.provider_name,
            code: row.provider_code,
            status: row.status,
            commissionPercentage: parseFloat(row.commission_percentage) || 0,
            creditLine: parseFloat(row.credit_line) || 0,
            usedCredit: parseFloat(row.used_credit) || 0,
            connectedAt: row.connected_at,
            availableCredit: parseFloat(row.available_credit) || 0,
            accountUsedCredit: parseFloat(row.account_used_credit) || 0,
          })),
          total: rows?.length || 0,
        };
      } catch (error) {
        logPerfData({
          procedure: 'distributor.getConnectedProviders',
          userId: ctx.user.id,
          distributorId: ctx.user.id, // fallback to user id if distributor lookup failed
          durationMs: Date.now() - queryStartTime,
          rowCount: 0,
          success: false,
          errorCode: 'INTERNAL_SERVER_ERROR',
        });
        console.error("[Distributor Router] Error getting connected providers:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get connected providers",
        });
      }
    }),

  /**
   * distributor.getPendingAccessRequests
   * Get count of pending access requests for this distributor
   */
  getPendingAccessRequests: protectedProcedure.query(async ({ ctx }) => {
    const queryStartTime = Date.now(); // TIMING: Start measurement
    let distributorId = 0; // fallback
    try {
      distributorId = await getDistributorIdFromUser(ctx.user.id);

      const pool = await getRawDb();
      if (!pool) throw new Error("Database connection not available");

      const conn = await pool.getConnection();
      try {
        // Get pending access requests where distributor is the recipient
        const [rows] = await conn.execute(
          `SELECT COUNT(*) as count
           FROM access_requests ar
           WHERE ar.distributor_id = ?
           AND ar.status = 'pending'`,
          [distributorId]
        );

        // TIMING: Log execution time
        const queryEndTime = Date.now();
        const executionTimeMs = queryEndTime - queryStartTime;
        logPerfData({
          procedure: 'distributor.getPendingAccessRequests',
          userId: ctx.user.id,
          distributorId,
          durationMs: executionTimeMs,
          rowCount: 1,
          success: true,
        });

        return {
          pendingCount: rows?.[0]?.count || 0,
        };
      } finally {
        conn.release();
      }
    } catch (error) {
      logPerfData({
        procedure: 'distributor.getPendingAccessRequests',
        userId: ctx.user.id,
        distributorId,
        durationMs: Date.now() - queryStartTime,
        rowCount: 0,
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
      });
      console.error("[Distributor Router] Error getting pending access requests:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get pending access requests",
      });
    }
  }),

  /**
   * Get distributor profile information
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const pool = await getRawDb();
    if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    try {
      const conn = await pool.getConnection();
      try {
        // Get distributor organization info
        const [rows] = await conn.execute(
          `SELECT o.id, o.name, o.type, d.id as distributor_id, u.name, u.email,
                  IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='logo_url'), o.logo_url, NULL) as logo_url
           FROM organizations o
           INNER JOIN organization_users ou ON o.id = ou.organization_id
           INNER JOIN distributors d ON d.organization_id = o.id
           LEFT JOIN users u ON u.id = ou.user_id
           WHERE ou.user_id = ? AND o.type = 'distributor'
           LIMIT 1`,
          [ctx.user.id]
        );
        
        if (!rows || rows.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Distributor profile not found",
          });
        }
        
        const row = rows[0];
        return {
          organizationId: row.id,
          organizationName: row.name || "",
          distributorId: row.distributor_id,
          fullName: row.name || "",
          email: row.email || "",
          phone: "",
          company: row.name || "",
          logoUrl: row.logo_url || null,
        };
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("[Distributor Router] Error getting profile:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get profile",
      });
    }
  }),

  /**
   * Update distributor profile information
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(1, "Full name is required"),
        email: z.string().email("Invalid email address"),
        phone: z.string().min(1, "Phone number is required"),
        company: z.string().min(1, "Company name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        const conn = await pool.getConnection();
        try {
          // Update user info
          await conn.execute(
            `UPDATE users SET name = ?, email = ? WHERE id = ?`,
            [input.fullName, input.email, ctx.user.id]
          );
          
          // Update organization name
          const [orgRows] = await conn.execute(
            `SELECT o.id FROM organizations o
             INNER JOIN organization_users ou ON o.id = ou.organization_id
             WHERE ou.user_id = ? AND o.type = 'distributor'
             LIMIT 1`,
            [ctx.user.id]
          );
          
          if (orgRows && orgRows.length > 0) {
            await conn.execute(
              `UPDATE organizations SET name = ? WHERE id = ?`,
              [input.company, orgRows[0].id]
            );
          }
          
          // Note: phone field is not stored in the database currently
          
          return { success: true, message: "Profile updated successfully" };
        } finally {
          conn.release();
        }
      } catch (error) {
        console.error("[Distributor Router] Error updating profile:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update profile",
        });
      }
    }),

  uploadLogo: protectedProcedure
    .input(z.object({
      logoDataUrl: z.string().max(2_000_000, "Image too large (max ~1.5 MB)"),
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const conn = await pool.getConnection();
      try {
        await conn.execute(
          `UPDATE organizations o
           INNER JOIN organization_users ou ON o.id = ou.organization_id
           SET o.logo_url = ?
           WHERE ou.user_id = ? AND o.type = 'distributor'`,
          [input.logoDataUrl, ctx.user.id]
        );
        return { success: true };
      } finally {
        conn.release();
      }
    }),

  /**
   * distributor.getSettings
   * Get the distributor organization settings
   */
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      try {
        const conn = await pool.getConnection();
        try {
          const [rows] = await conn.execute(
            `SELECT o.id as organizationId, d.id as distributorId,
                    o.name as organizationName, o.status as organizationStatus, o.contact_person as contactPerson,
                    o.email, o.phone, o.address, o.notes, u.name as userName, u.email as userEmail,
                    o.created_at as createdAt, o.updated_at as updatedAt
             FROM organizations o
             INNER JOIN organization_users ou ON o.id = ou.organization_id
             INNER JOIN distributors d ON d.organization_id = o.id
             LEFT JOIN users u ON u.id = ou.user_id
             WHERE ou.user_id = ? AND o.type = 'distributor'
             LIMIT 1`,
            [ctx.user.id]
          );
          
          if (!rows || rows.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Distributor organization not found",
            });
          }
          
          return (rows as any)[0];
        } finally {
          conn.release();
        }
      } catch (error) {
        console.error("[Distributor Router] Error getting settings:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get distributor settings",
        });
      }
    }),
});
