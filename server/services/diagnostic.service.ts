import { getDb } from "../db";
import { serviceProviders, distributors } from "../../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * DiagnosticService - Captures full database errors and schema details
 */
export class DiagnosticService {
  async diagnoseDistributorsInsert() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    console.log("[Diagnostic] Diagnosing distributors table...");
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      table: "distributors",
      steps: {},
    };

    try {
      // Get schema
      const schemaQuery = await db.execute(
        sql`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'distributors'
            ORDER BY ORDINAL_POSITION`
      );
      console.log("[Diagnostic] Distributors schema:", schemaQuery);
      diagnostics.steps.schema = {
        success: true,
        columns: schemaQuery,
      };

      // Test insert
      const testPayload = {
        name: "TEST_DISTRIBUTOR_" + Date.now(),
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        console.log("[Diagnostic] Testing distributor insert:", testPayload);
        const insertResult = await db.insert(distributors).values(testPayload);
        console.log("[Diagnostic] Insert succeeded", insertResult);
        diagnostics.steps.testInsert = {
          success: true,
          payload: testPayload,
        };

        // Cleanup
        await db.execute(
          sql`DELETE FROM distributors WHERE name = ${testPayload.name}`
        );
      } catch (err: any) {
        console.error("[Diagnostic] Insert failed:", err);
        diagnostics.steps.testInsert = {
          success: false,
          payload: testPayload,
          error: {
            message: err.message,
            code: err.code,
            sqlMessage: err.sqlMessage,
          },
        };
      }

      return {
        success: true,
        diagnostics,
      };
    } catch (error) {
      console.error("[Diagnostic] Diagnosis failed:", error);
      return {
        success: false,
        error: String(error),
        diagnostics,
      };
    }
  }

  async diagnoseServiceProvidersInsert() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    console.log("[Diagnostic] Starting service_providers insert diagnosis...");
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      steps: {},
    };

    try {
      // Step 1: Inspect table schema
      console.log("[Diagnostic] Step 1: Inspecting service_providers table schema...");
      try {
        const schemaQuery = await db.execute(
          sql`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_providers'
              ORDER BY ORDINAL_POSITION`
        );
        console.log("[Diagnostic] Schema query result:", schemaQuery);
        diagnostics.steps.schema = {
          success: true,
          columns: schemaQuery,
        };
      } catch (err) {
        console.error("[Diagnostic] Schema inspection failed:", err);
        diagnostics.steps.schema = {
          success: false,
          error: String(err),
        };
      }

      // Step 2: Check indexes and constraints
      console.log("[Diagnostic] Step 2: Checking indexes and constraints...");
      try {
        const indexQuery = await db.execute(
          sql`SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, COLUMN_NAME 
              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_providers'`
        );
        console.log("[Diagnostic] Indexes/constraints:", indexQuery);
        diagnostics.steps.constraints = {
          success: true,
          data: indexQuery,
        };
      } catch (err) {
        console.error("[Diagnostic] Constraint inspection failed:", err);
        diagnostics.steps.constraints = {
          success: false,
          error: String(err),
        };
      }

      // Step 3: Check current row count
      console.log("[Diagnostic] Step 3: Checking current row count...");
      try {
        const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM service_providers`);
        console.log("[Diagnostic] Row count:", countResult);
        diagnostics.steps.rowCount = {
          success: true,
          count: countResult,
        };
      } catch (err) {
        console.error("[Diagnostic] Row count check failed:", err);
        diagnostics.steps.rowCount = {
          success: false,
          error: String(err),
        };
      }

      // Step 4: Test minimal insert with full error capture
      console.log("[Diagnostic] Step 4: Testing minimal insert...");
      const testPayload = {
        name: "TEST_PROVIDER_" + Date.now(),
        providerCode: "TEST_" + Date.now(),
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        console.log("[Diagnostic] Attempting insert with payload:", testPayload);
        const insertResult = await db.insert(serviceProviders).values(testPayload);
        console.log("[Diagnostic] Insert succeeded:", insertResult);
        diagnostics.steps.testInsert = {
          success: true,
          payload: testPayload,
          result: insertResult,
        };

        // Clean up test row
        console.log("[Diagnostic] Cleaning up test row...");
        await db.execute(
          sql`DELETE FROM service_providers WHERE provider_code = ${testPayload.providerCode}`
        );
        console.log("[Diagnostic] Test row deleted");
      } catch (err: any) {
        console.error("[Diagnostic] Insert failed with full error:", err);
        diagnostics.steps.testInsert = {
          success: false,
          payload: testPayload,
          error: {
            message: err.message,
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage,
            sql: err.sql,
            stack: err.stack,
            fullError: JSON.stringify(err, null, 2),
          },
        };
      }

      // Step 5: List all columns to verify schema matches Drizzle
      console.log("[Diagnostic] Step 5: Listing all columns...");
      try {
        const allColumns = await db.execute(
          sql`DESCRIBE service_providers`
        );
        console.log("[Diagnostic] All columns:", allColumns);
        diagnostics.steps.allColumns = {
          success: true,
          columns: allColumns,
        };
      } catch (err) {
        console.error("[Diagnostic] Column listing failed:", err);
        diagnostics.steps.allColumns = {
          success: false,
          error: String(err),
        };
      }

      console.log("[Diagnostic] Diagnosis complete");
      return {
        success: true,
        diagnostics,
      };
    } catch (error) {
      console.error("[Diagnostic] Diagnosis failed:", error);
      return {
        success: false,
        error: String(error),
        diagnostics,
      };
    }
  }
}

export const diagnosticService = new DiagnosticService();
