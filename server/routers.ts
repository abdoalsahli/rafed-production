import { getSessionCookieOptions } from "./_core/cookies";
import { logPerfData } from "./utils/dashboard-perf";
import { COOKIE_NAME } from "@shared/const";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { purchaseRouter } from "./routers/purchase.router";
import { refundRouter } from "./routers/refund.router";

console.log('[ROUTER-INIT] Initializing app router...');
import { adminRouter } from "./routers/admin.router";
import { financialRouter } from "./routers/financial.router";
import { providerRouter } from "./routers/provider.router";
import { providerTransactionsRouter } from "./routers/provider-transactions";
import { purchasesRouter } from "./routers/purchases";
import { healthRouter } from "./routers/health";
import { testMinimalRouter } from "./routers/test-minimal";
import { dashboardRouter } from "./routers/dashboard";
import { runtimeHealthRouter } from "./routers/runtime-health";
import { distributorCatalogRouter } from "./routers/distributor-catalog";
import { distributorRouter } from "./routers/distributor.router";
import { migrationHelperRouter } from "./routers/migration-helper";
import { notificationsRouter } from "./routers/notifications.router";
import { organizationsRouter } from "./routers/organizations.router";
import { distributorApiRouter } from "./routers/distributor-api.router";
import { exportRouter } from "./routers/export.router";
import { apiLogsRouter } from "./routers/api-logs.router";
import { authEmailRouter } from "./routers/auth-email.router";
import { debugRouter } from "./routers/debug.router";
import { webhookResilienceRouter } from "./routers/webhook.resilience.router";
import { userRouter } from "./routers/user.router";




console.log('[ROUTER-INIT] Registering routers...');

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  notifications: notificationsRouter,
  auth: router({
    signup: authEmailRouter._def.procedures.signup,
    login: authEmailRouter._def.procedures.login,
    me: publicProcedure.query(async (opts) => {
      const queryStartTime = Date.now(); // TIMING: Start measurement
      const user = opts.ctx.user;
      if (!user) return null;
      
      // Get user's organization type for role-based routing
      let organizationType: string | null = null;
      try {
        const { getRawDb } = await import('./db');
        const pool = await getRawDb();
        if (pool && user.id) {
          const connection = await pool.getConnection();
          try {
            const [rows] = await connection.execute(
              'SELECT DISTINCT o.type FROM organizations o INNER JOIN organization_users ou ON o.id = ou.organization_id WHERE ou.user_id = ? LIMIT 1',
              [user.id]
            );
            if (rows && rows.length > 0) {
              organizationType = (rows as any[])[0].type;
            }
            console.log(`[auth.me] User ${user.email} organizationType=${organizationType}`);
          } finally {
            connection.release();
          }
        }
      } catch (error) {
        console.error('Error fetching organization type:', error);
      }
      
      // TIMING: Log execution time
      const queryEndTime = Date.now();
      const executionTimeMs = queryEndTime - queryStartTime;
      logPerfData({
        procedure: 'auth.me',
        userId: user.id,
        distributorId: user.id,
        durationMs: executionTimeMs,
        rowCount: 1,
        success: true,
      });
      
      const result = {
        ...user,
        organizationType,
      };
      console.log('[auth.me] User:', { email: user.email, organizationType, hasOrg: !!organizationType });
      return result;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      console.log('[logout] Clearing session cookie:', COOKIE_NAME);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      console.log('[logout] Cookie options:', cookieOptions);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      console.log('[logout] Cookie cleared, response headers:', ctx.res.getHeaders());
      return {
        success: true,
      } as const;
    }),

  }),

  purchase: purchaseRouter,
  purchases: purchasesRouter,
  health: healthRouter,
  testMinimal: testMinimalRouter,
  refund: refundRouter,
  admin: adminRouter,
  organizations: organizationsRouter,
  distributor: distributorRouter,
  distributorApi: distributorApiRouter,
  export: exportRouter,
  apiLogs: apiLogsRouter,
  financial: financialRouter,
  migration: migrationHelperRouter,
  provider: providerRouter,
  providerTransactions: providerTransactionsRouter,
  dashboard: dashboardRouter,
  runtimeHealth: runtimeHealthRouter,
  debug: debugRouter,
  webhookResilience: webhookResilienceRouter,
  user: userRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

console.log('[ROUTER-INIT] App router created successfully');

export type AppRouter = typeof appRouter;
