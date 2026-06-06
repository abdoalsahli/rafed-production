import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { AdjustmentService } from "../services/adjustment.service";
import { CleanupService } from "../services/cleanup.service";
import { stepwiseRebuildService } from "../services/rebuild-stepwise.service";
import { RebuildService } from "../services/rebuild.service";
import { diagnosticService } from "../services/diagnostic.service";
import { schemaInspectorService } from "../services/schema-inspector.service";
import { getDb, getRawDb } from "../db";
import { organizations, organizationUsers, usersExtended, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const adjustmentService = new AdjustmentService();
const cleanupService = new CleanupService();
const rebuildService = new RebuildService();

/**
 * Admin Router - Secure admin-only operations
 * 
 * All procedures require:
 * - User authentication
 * - Admin role verification
 * 
 * Endpoints:
 * - admin.adjustment.process - Process balance or credit adjustment
 * - admin.adjustment.history - Get adjustment history
 * - admin.adjustment.audit - Get audit trail for specific adjustment
 * - admin.cleanDatabase - Clean database for rebuild (TEMPORARY)
 * - admin.getCleanupStatus - Get database cleanup status
 */

/**
 * Admin procedure - Verifies user has admin role
 */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User must be authenticated",
    });
  }

  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User does not have admin privileges",
    });
  }

  return next({ ctx });
});

export const adminRouter = router({
  adjustment: router({
    /**
     * Process a balance or credit adjustment
     * 
     * Requires:
     * - Admin authentication
     * - Valid provider and distributor IDs
     * - Valid adjustment amount
     * 
     * Returns:
     * - Adjustment ID
     * - Updated account balance
     * - Updated used credit
     */
    process: adminProcedure
      .input(
        z.object({
          providerId: z.number().positive("Provider ID must be positive"),
          distributorId: z.number().positive("Distributor ID must be positive"),
          adjustmentType: z.enum(["balance", "credit"]),
          adjustmentAmount: z.string().min(1, "Amount is required"),
          reason: z.string().min(1, "Reason is required"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const adjustment = await adjustmentService.processAdjustment({
            adminId: ctx.user.id,
            providerId: input.providerId,
            distributorId: input.distributorId,
            adjustmentType: input.adjustmentType,
            adjustmentAmount: input.adjustmentAmount,
            reason: input.reason,
          });

          return {
            success: true,
            adjustmentId: adjustment.adjustmentId,
            message: "Adjustment processed successfully",
          };
        } catch (error) {
          console.error("[Admin Router] Error processing adjustment:", error);

          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Map common error messages to TRPC error codes
          if (errorMessage.includes("not found")) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: errorMessage,
            });
          }

          if (
            errorMessage.includes("negative") ||
            errorMessage.includes("violate")
          ) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: errorMessage,
            });
          }

          if (errorMessage.includes("privileges")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: errorMessage,
            });
          }

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorMessage,
          });
        }
      }),

    /**
     * Get adjustment history for a provider-distributor relationship
     */
    history: adminProcedure
      .input(
        z.object({
          providerId: z.number().positive("Provider ID must be positive"),
          distributorId: z.number().positive("Distributor ID must be positive"),
        })
      )
      .query(async ({ input }) => {
        try {
          const history = await adjustmentService.getAdjustmentHistory({
            providerId: input.providerId,
            distributorId: input.distributorId,
          });

          return {
            success: true,
            adjustments: history,
            count: history.length,
          };
        } catch (error) {
          console.error("[Admin Router] Error getting adjustment history:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get adjustment history",
          });
        }
      }),

    /**
     * Get audit trail for a specific adjustment
     */
    audit: adminProcedure
      .input(
        z.object({
          adjustmentId: z.string().min(1, "Adjustment ID is required"),
        })
      )
      .query(async ({ input }) => {
        try {
          const audit = await adjustmentService.getAdjustmentAudit(
            input.adjustmentId
          );

          return {
            success: true,
            audit,
          };
        } catch (error) {
          console.error("[Admin Router] Error getting adjustment audit:", error);

          if (error instanceof Error && error.message.includes("not found")) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: error.message,
            });
          }

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get adjustment audit",
          });
        }
      }),
  }),

  /**
   * TEMPORARY: Clean database for rebuild
   * Deletes all demo data using ORM (not raw SQL)
   * Preserves only admin user
   */
  cleanDatabase: adminProcedure
    .input(
      z.object({
        confirmPhrase: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Safety confirmation
      if (input.confirmPhrase !== "DELETE_ALL_DEMO_DATA") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid confirmation phrase",
        });
      }

      try {
        console.log(`[Admin] Cleanup requested by ${ctx.user.email}`);
        const result = await cleanupService.cleanDatabase();
        console.log(`[Admin] Cleanup completed: ${result.message}`);

        return {
          success: true,
          message: result.message,
          duration: result.duration,
        };
      } catch (error) {
        console.error("[Admin] Cleanup error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Cleanup failed",
        });
      }
    }),

  /**
   * Get database cleanup status
   * Returns record counts for all tables
   */
  getCleanupStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      console.log(`[Admin] Status check by ${ctx.user.email}`);
      const status = await cleanupService.getCleanupStatus();

      return {
        success: true,
        counts: status.counts,
      };
    } catch (error) {
      console.error("[Admin] Status check error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Status check failed",
      });
    }
  }),

  /**
   * TEMPORARY: Rebuild infrastructure
   * Creates organizations, products, relationships, and accounts
   */
  diagnoseServiceProviders: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        console.log(`[Admin] Diagnostic requested by ${ctx.user.email}`);
        const result = await diagnosticService.diagnoseServiceProvidersInsert();
        return result;
      } catch (error) {
        console.error(`[Admin] Diagnostic failed:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Diagnostic failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  rebuildInfrastructureStepwise: adminProcedure
    .input(
      z.object({
        confirmPhrase: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.confirmPhrase !== "REBUILD_INFRASTRUCTURE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid confirmation phrase",
        });
      }

      try {
        console.log(`[Admin] Stepwise rebuild requested by ${ctx.user.email}`);
        const result = await stepwiseRebuildService.rebuildStepwise();
        console.log(`[Admin] Rebuild completed: ${result.message}`);

        return result;
      } catch (error) {
        console.error(`[Admin] Rebuild failed:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  rebuildInfrastructure: adminProcedure
    .input(
      z.object({
        confirmPhrase: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Safety confirmation
      if (input.confirmPhrase !== "REBUILD_INFRASTRUCTURE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid confirmation phrase",
        });
      }

      try {
        console.log(`[Admin] Rebuild requested by ${ctx.user.email}`);
        const result = await rebuildService.rebuildInfrastructure();
        console.log(`[Admin] Rebuild completed: ${result.message}`);

        return {
          success: true,
          message: result.message,
          duration: result.duration,
          summary: result.summary,
        };
      } catch (error) {
        console.error("[Admin] Rebuild error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Rebuild failed",
        });
      }
    }),

  /**
   * Inspect actual database schemas using SHOW CREATE TABLE
   * Returns exact table definitions for verification
   */
  inspectSchemas: adminProcedure
    .query(async ({ ctx }) => {
      try {
        console.log(`[Admin] Schema inspection requested by ${ctx.user.email}`);
        const schemas = await schemaInspectorService.inspectSchemas();
        return {
          success: true,
          schemas,
        };
      } catch (error) {
        console.error("[Admin] Schema inspection error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Schema inspection failed",
        });
      }
    }),

  /**
   * admin.getProfile
   * Returns the logged-in admin's own profile from the users table.
   */
  getProfile: adminProcedure.query(async ({ ctx }) => {
    const pool = await getRawDb();
    if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
        [ctx.user.id]
      ) as any[];

      if (!rows || rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Admin profile not found" });
      }

      const row = rows[0];
      return {
        id: row.id,
        name: row.name || "",
        email: row.email || "",
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      conn.release();
    }
  }),

  /**
   * admin.updateProfile
   * Updates the logged-in admin's name and email.
   */
  updateProfile: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conn = await pool.getConnection();
      try {
        await conn.execute(
          "UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ? AND role = 'admin'",
          [input.name, input.email, ctx.user.id]
        );
        return { success: true, message: "Profile updated successfully" };
      } finally {
        conn.release();
      }
    }),
});
