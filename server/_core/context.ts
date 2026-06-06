import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getRawDb } from "../db";

export type UserWithProvider = User & {
  providerId?: number;
  organizationId?: number;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: UserWithProvider | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: UserWithProvider | null = null;

  try {
    const baseUser = await sdk.authenticateRequest(opts.req);
    if (baseUser) {
      // Find the provider associated with this user's organization
      try {
        const rawDb = await getRawDb();
        if (rawDb) {
          const connection = await rawDb.getConnection();
          try {
            // Query: Find provider for this user via organization_users -> organizations -> service_providers
            const [rows] = await connection.execute(
              `SELECT sp.id as provider_id, sp.organization_id
               FROM service_providers sp
               INNER JOIN organizations o ON sp.organization_id = o.id
               INNER JOIN organization_users ou ON o.id = ou.organization_id
               WHERE ou.user_id = ? AND o.type = 'provider'
               LIMIT 1`,
              [baseUser.id]
            );

            if (rows && (rows as any[]).length > 0) {
              const row = (rows as any[])[0];
              user = {
                ...baseUser,
                providerId: row.provider_id,
                organizationId: row.organization_id || undefined,
              };
              console.log(`[Context] User ${baseUser.id} resolved to provider ${row.provider_id}`);
            } else {
              console.warn(`[Context] No provider found for user ${baseUser.id}`);
              user = baseUser as UserWithProvider;
            }
          } finally {
            connection.release();
          }
        } else {
          user = baseUser as UserWithProvider;
        }
      } catch (error) {
        console.error("[Context] Failed to load provider info:", error);
        user = baseUser as UserWithProvider;
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
