import { z } from "zod";
import { products } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { eq } from "drizzle-orm";
import { getDb } from "../db";

// CSV row validation schema
const csvRowSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  displayName: z.string().min(1, "Display name is required"),
  faceValue: z.coerce.number().positive("Face value must be positive"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be 3-letter code (e.g., USD)"),
  description: z.string().optional().default(""),
  isActive: z.coerce.boolean().optional().default(true),
});

type CSVRow = z.infer<typeof csvRowSchema>;

interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: Array<{
    rowNumber: number;
    name?: string;
    reason: string;
  }>;
}

export const importProductsRouter = {
  importProducts: protectedProcedure
    .input(
      z.object({
        csvContent: z.string().min(1, "CSV content is required"),
      })
    )
    .output(
      z.object({
        totalRows: z.number(),
        successCount: z.number(),
        failedCount: z.number(),
        errors: z.array(
          z.object({
            rowNumber: z.number(),
            name: z.string().optional(),
            reason: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "provider") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to import products",
        });
      }

      const providerId = ctx.user.id;
      const result: ImportResult = {
        totalRows: 0,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }

      // Parse CSV
      const lines = input.csvContent.trim().split("\n");
      if (lines.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must contain header and at least one data row",
        });
      }

      // Parse header
      const headerLine = lines[0];
      const headers = headerLine.split(",").map((h: string) => h.trim().toLowerCase());

      // Validate headers
      const requiredHeaders = ["name", "displayname", "facevalue", "currency"];
      const hasRequiredHeaders = requiredHeaders.every((h: string) =>
        headers.includes(h)
      );

      if (!hasRequiredHeaders) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `CSV must contain headers: ${requiredHeaders.join(", ")}`,
        });
      }

      // Get existing product names for duplicate check
      const existingProducts = await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.providerId, providerId));

      const existingNames = new Set(
        existingProducts.map((p: any) => p.name.toLowerCase())
      );

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        result.totalRows++;
        const rowNumber = i + 1; // 1-indexed for user display

        try {
          // Parse CSV row (handle quoted fields)
          const values = parseCSVLine(line);
          const rowData: Record<string, any> = {};

          headers.forEach((header: string, index: number) => {
            rowData[header] = values[index]?.trim() || "";
          });

          // Map CSV headers to schema fields
          const csvRow: Record<string, any> = {
            name: rowData["name"],
            displayName: rowData["displayname"],
            faceValue: rowData["facevalue"],
            currency: rowData["currency"],
            description: rowData["description"] || "",
            isActive: rowData["isactive"] !== undefined ? rowData["isactive"] : true,
          };

          // Validate row
          const validatedRow = csvRowSchema.parse(csvRow);

          // Check for duplicate names
          if (existingNames.has(validatedRow.name.toLowerCase())) {
            result.failedCount++;
            result.errors.push({
              rowNumber,
              name: validatedRow.name,
              reason: `Product name "${validatedRow.name}" already exists`,
            });
            continue;
          }

          // Create product
          await db.insert(products).values({
            name: validatedRow.name,
            displayName: validatedRow.displayName,
            faceValue: validatedRow.faceValue,
            currency: validatedRow.currency,
            description: validatedRow.description,
            status: validatedRow.isActive ? "active" : "inactive",
            price: validatedRow.faceValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          // Add to existing names to prevent duplicates within this import
          existingNames.add(validatedRow.name.toLowerCase());
          result.successCount++;
        } catch (error) {
          result.failedCount++;

          let errorMessage = "Unknown error";
          if (error instanceof z.ZodError) {
            const zodError = error as z.ZodError<unknown>;
            errorMessage = zodError.issues[0]?.message || "Validation failed";
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          result.errors.push({
            rowNumber,
            reason: errorMessage,
          });
        }
      }

      return result;
    }),
};

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}
