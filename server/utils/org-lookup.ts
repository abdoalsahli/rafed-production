/**
 * Organization-based ID resolution helpers.
 *
 * These functions resolve a user's logical role ID (service_providers.id or
 * distributors.id) by walking the organization graph:
 *
 *   users → organization_users → organizations → service_providers / distributors
 *
 * The old "legacy" approach assumed user.id === distributor/provider.id, which
 * was true only for the original seed data. It is WRONG in general and causes
 * queries to return data for the wrong account when IDs happen to collide.
 * The organization JOIN is the only correct path and is what we use here.
 */

import { getRawDb } from "../db";
import { TRPCError } from "@trpc/server";

/**
 * Return the distributors.id for the given user.
 * Throws NOT_FOUND if the user has no distributor organization.
 */
export async function getDistributorIdFromUser(userId: number): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error("Database connection not available");

  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT DISTINCT d.id
       FROM distributors d
       INNER JOIN organizations o ON d.organization_id = o.id
       INNER JOIN organization_users ou ON o.id = ou.organization_id
       WHERE ou.user_id = ? AND o.type = 'distributor'
       LIMIT 1`,
      [userId]
    );

    if (rows && rows.length > 0) {
      return rows[0].id;
    }

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User is not linked to any distributor organization",
    });
  } finally {
    conn.release();
  }
}

/**
 * Return the service_providers.id for the given user.
 * Throws NOT_FOUND if the user has no provider organization.
 */
export async function getProviderIdFromUser(userId: number): Promise<number> {
  const pool = await getRawDb();
  if (!pool) throw new Error("Database connection not available");

  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT DISTINCT sp.id
       FROM service_providers sp
       INNER JOIN organizations o ON sp.organization_id = o.id
       INNER JOIN organization_users ou ON o.id = ou.organization_id
       WHERE ou.user_id = ? AND o.type = 'provider'
       LIMIT 1`,
      [userId]
    );

    if (rows && rows.length > 0) {
      return rows[0].id;
    }

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User is not linked to any provider organization",
    });
  } finally {
    conn.release();
  }
}
