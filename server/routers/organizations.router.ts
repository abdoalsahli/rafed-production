import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { organizations, organizationUsers, users, serviceProviders, distributors } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Generate a unique provider code from the organization name.
 * Format: UP-TO-8-CHARS + random 4-char hex suffix  e.g. "VODAFONE-A3K2"
 */
function generateProviderCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')   // keep only letters/digits
    .slice(0, 8)
    || 'PROVIDER';
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${base}-${suffix}`;
}

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const isAdmin =
    ctx.user?.role === "admin" ||
    (ctx.user as any)?.organizationType === "internal";
  if (!ctx.user || !isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx });
});

export const organizationsRouter = router({
  createOrganization: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["provider", "distributor", "internal"]),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 1. Create the organization
      const result = await db.insert(organizations).values({
        name: input.name,
        type: input.type,
        status: "active",
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone,
        address: input.address,
        notes: input.notes,
      });
      const orgId = result[0].insertId;

      // 2. Create the backing service_providers or distributors record.
      //    Without this record, getProviderIdFromUser / getDistributorIdFromUser
      //    always throws NOT_FOUND and every API call fails, causing slow/broken pages.
      if (input.type === "provider") {
        // Retry up to 3 times in case of provider_code collision
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const providerCode = generateProviderCode(input.name);
            await db.insert(serviceProviders).values({
              name: input.name,
              providerCode,
              status: "active",
              organizationId: orgId,
            });
            break;
          } catch (err: any) {
            if (attempt === 2) throw err; // give up after 3 tries
          }
        }
      } else if (input.type === "distributor") {
        await db.insert(distributors).values({
          name: input.name,
          status: "active",
          organizationId: orgId,
        });
      }

      const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      return org[0];
    }),

  listOrganizations: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    return await db.select().from(organizations);
  }),

  updateOrganization: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      status: z.enum(["active", "suspended"]).optional(),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const updates: any = {};
      if (input.name) updates.name = input.name;
      if (input.status) updates.status = input.status;
      if (input.contactPerson) updates.contactPerson = input.contactPerson;
      if (input.email) updates.email = input.email;
      if (input.phone) updates.phone = input.phone;
      if (input.address) updates.address = input.address;
      if (input.notes) updates.notes = input.notes;
      if (Object.keys(updates).length > 0) {
        await db.update(organizations).set(updates).where(eq(organizations.id, input.id));
      }
      const org = await db.select().from(organizations).where(eq(organizations.id, input.id)).limit(1);
      return org[0];
    }),

  getOrganization: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const org = await db.select().from(organizations).where(eq(organizations.id, input.id)).limit(1);
      if (!org || org.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      const orgUsers = await db.select().from(organizationUsers).where(eq(organizationUsers.organizationId, input.id));
      return { ...org[0], users: orgUsers };
    }),

  listUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const allUsers = await db.select().from(users);
    const userOrgs = await db.select().from(organizationUsers);
    return allUsers.map((user) => {
      const orgs = userOrgs.filter((o) => o.userId === user.id);
      // Use status directly from users table (already included in user object)
      return { ...user, organizations: orgs };
    });
  }),

  activateUser: adminProcedure
    .input(z.object({ userId: z.number(), organizationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      // Update users table status to active
      await db.update(users).set({ status: "active" }).where(eq(users.id, input.userId));
      try {
        await db.insert(organizationUsers).values({
          userId: input.userId,
          organizationId: input.organizationId,
          role: "operator",
          updatedAt: new Date(),
        }).onDuplicateKeyUpdate({ set: { role: "operator", updatedAt: new Date() } });
      } catch (error: any) {
        // Silently ignore duplicate entries - user already linked to organization
        if (error.code !== "ER_DUP_ENTRY") throw error;
      }
      return { success: true };
    }),

  suspendUser: adminProcedure
    .input(z.object({ userId: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      // Update users table status to suspended
      await db.update(users).set({ status: "suspended" }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  linkUserToOrganization: adminProcedure
    .input(z.object({
      userId: z.number(),
      organizationId: z.number(),
      role: z.enum(["admin", "operator", "viewer"]).default("operator"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const result = await db.insert(organizationUsers).values({
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role,
        updatedAt: new Date(),
      }).onDuplicateKeyUpdate({ set: { role: input.role, updatedAt: new Date() } });
      const linkId = result[0].insertId;
      const link = await db.select().from(organizationUsers).where(eq(organizationUsers.id, linkId)).limit(1);
      return link[0];
    }),

  assignUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      organizationId: z.number(),
      role: z.enum(["admin", "operator", "viewer"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      await db.update(organizationUsers).set({ role: input.role, updatedAt: new Date() }).where(and(eq(organizationUsers.userId, input.userId), eq(organizationUsers.organizationId, input.organizationId)));
      const link = await db.select().from(organizationUsers).where(and(eq(organizationUsers.userId, input.userId), eq(organizationUsers.organizationId, input.organizationId))).limit(1);
      return link[0];
    }),
});
