import { adminProcedure, router } from "../_core/trpc";
import { getRawDb } from "../db";

// Restricted to admin role only
export const debugRouter = router({
  checkUserOrg: adminProcedure.query(async (opts) => {
    const user = opts.ctx.user;
    const pool = await getRawDb();
    const conn = await pool.getConnection();
    try {
      const [orgUsers] = await conn.execute(
        `SELECT ou.user_id, ou.organization_id, o.name, o.type
         FROM organization_users ou
         JOIN organizations o ON ou.organization_id = o.id
         WHERE ou.user_id = ?`,
        [user.id]
      );
      return { userId: user.id, userEmail: user.email, organizations: orgUsers };
    } finally {
      conn.release();
    }
  }),
});
