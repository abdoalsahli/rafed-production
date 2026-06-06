import { getDb } from "../db";

/**
 * SchemaInspectorService - Captures exact table schemas from the database
 * Uses SHOW CREATE TABLE to get the real schema definition
 */
export class SchemaInspectorService {
  async inspectSchemas() {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }

    const tables = [
      "provider_distributor_commission",
      "distributor_api_credentials",
      "card_batches",
      "cards",
      "service_providers",
      "distributors",
      "products",
      "provider_distributor_relationships",
      "provider_distributor_accounts",
    ];

    const schemas: any = {};

    for (const table of tables) {
      try {
        const result = await db.execute(`SHOW CREATE TABLE ${table}`);
        schemas[table] = result[0];
      } catch (err) {
        schemas[table] = { error: String(err) };
      }
    }

    return schemas;
  }
}

export const schemaInspectorService = new SchemaInspectorService();
