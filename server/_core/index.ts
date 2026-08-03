import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { assertPINEncryptionKeyValid } from "./pin-key-validator";
import { debugMiddleware } from "./debug-middleware";
import { registerMetricsEndpoint } from "../metrics-middleware";
import { setupErrorHandlers } from "../error-handler";
import { connectionPoolManager } from "../connection-pool";
import { apiAuthMiddleware } from "./api-auth";
import { handleExternalPurchase } from "../api/purchase";
import { handleProductCatalog } from "../api/catalog";
import { handlePurchaseStatus } from "../api/status";
import { handleWebhookPing } from "../api/webhook-ping";
import { WebhookDeliveryService } from "../services/webhook.delivery";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Setup error handlers first
  console.log('[SERVER-INIT] Setting up error handlers...');
  setupErrorHandlers();
  console.log('[SERVER-INIT] Error handlers configured');

  console.log('[SERVER-INIT] Initializing connection pool...');
  await connectionPoolManager.initialize();
  console.log('[SERVER-INIT] Connection pool initialized');

  // Run lightweight schema migrations (idempotent — safe to run on every boot)
  try {
    const { getRawDb } = await import('../db');
    const pool = await getRawDb();
    if (pool) {
      const conn = await pool.getConnection();
      try {
        const [cols] = await conn.execute(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizations' AND COLUMN_NAME = 'logo_url'`
        ) as any[];
        if (cols[0].cnt === 0) {
          await conn.execute(`ALTER TABLE organizations ADD COLUMN logo_url LONGTEXT NULL`);
          console.log('[SERVER-INIT] Schema migration: added logo_url column');
        } else {
          console.log('[SERVER-INIT] Schema migration: logo_url column already exists');
        }
        // Add webhook_secret column (C-2 fix)
        const [whCols] = await conn.execute(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'distributor_api_credentials' AND COLUMN_NAME = 'webhook_secret'`
        ) as any[];
        if (whCols[0].cnt === 0) {
          await conn.execute(
            `ALTER TABLE distributor_api_credentials ADD COLUMN webhook_secret VARCHAR(128) NULL AFTER secret_hash`
          );
          console.log('[SERVER-INIT] Schema migration: added webhook_secret column');
        }

        // Allocation orders tables (offline provider bulk orders)
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS \`allocation_orders\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`provider_id\` int NOT NULL,
            \`client_name\` varchar(255) NOT NULL,
            \`client_phone\` varchar(64) NULL,
            \`client_notes\` text NULL,
            \`status\` enum('draft','confirmed','delivered','cancelled') NOT NULL DEFAULT 'draft',
            \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`confirmed_at\` timestamp NULL,
            \`delivered_at\` timestamp NULL,
            PRIMARY KEY (\`id\`),
            INDEX \`idx_ao_provider_id\` (\`provider_id\`),
            INDEX \`idx_ao_status\` (\`status\`),
            CONSTRAINT \`fk_ao_provider\` FOREIGN KEY (\`provider_id\`) REFERENCES \`service_providers\` (\`id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS \`allocation_order_items\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`order_id\` int NOT NULL,
            \`product_id\` int NOT NULL,
            \`quantity_requested\` int NOT NULL,
            \`quantity_fulfilled\` int NOT NULL DEFAULT 0,
            PRIMARY KEY (\`id\`),
            INDEX \`idx_aoi_order_id\` (\`order_id\`),
            CONSTRAINT \`fk_aoi_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`allocation_orders\` (\`id\`),
            CONSTRAINT \`fk_aoi_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS \`allocation_order_cards\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`order_item_id\` int NOT NULL,
            \`card_id\` int NOT NULL,
            PRIMARY KEY (\`id\`),
            UNIQUE INDEX \`idx_aoc_card_id\` (\`card_id\`),
            INDEX \`idx_aoc_order_item_id\` (\`order_item_id\`),
            CONSTRAINT \`fk_aoc_order_item\` FOREIGN KEY (\`order_item_id\`) REFERENCES \`allocation_order_items\` (\`id\`),
            CONSTRAINT \`fk_aoc_card\` FOREIGN KEY (\`card_id\`) REFERENCES \`cards\` (\`id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[SERVER-INIT] Schema migration: allocation_orders tables ready');
      } finally {
        conn.release();
      }
    }
  } catch (e) {
    console.warn('[SERVER-INIT] Schema migration warning (non-fatal):', e);
  }

  console.log('[SERVER-INIT] Validating PIN encryption key...');
  // Validate PIN_ENCRYPTION_KEY first - fail fast if invalid
  assertPINEncryptionKeyValid();
  console.log('[SERVER-INIT] PIN encryption key valid');

  console.log('[SERVER-INIT] Creating Express app...');
  const app = express();
  // Trust reverse-proxy headers (x-forwarded-proto) so isSecureRequest() works
  // correctly behind HTTPS load balancers and sameSite cookie logic is accurate.
  app.set('trust proxy', 1);
  const server = createServer(app);
  // CORS — origin:true reflects the request origin, allowing credentialed requests
  // from any domain. Restrict to the Vercel domain before going live.
  app.use(cors({ origin: "https://rafed-backend-production-0dc6.up.railway.app", credentials: true }));
  // Health check
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Debug middleware — development only (logs full request bodies; never run in production)
  if (process.env.NODE_ENV !== 'production') {
    app.use(debugMiddleware);
  }
  // OAuth callback under /api/oauth/callback
  console.log('[SERVER-INIT] Registering OAuth routes...');
  registerOAuthRoutes(app);
  console.log('[SERVER-INIT] OAuth routes registered');
  // tRPC API
  console.log('[SERVER-INIT] Mounting tRPC middleware at /api/trpc');
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        console.error(`[tRPC] Error at path: ${path}`, error);
      },
    })
  );
  console.log('[SERVER-INIT] tRPC middleware mounted');
  // Register external API endpoints
  console.log('[SERVER-INIT] Registering external API endpoints...');
  app.get('/api/v1/products', apiAuthMiddleware, handleProductCatalog);
  app.post('/api/v1/purchases', apiAuthMiddleware, handleExternalPurchase);
  app.get('/api/v1/purchases/:requestId', apiAuthMiddleware, handlePurchaseStatus);
  app.post('/api/v1/webhooks/test', apiAuthMiddleware, handleWebhookPing);
  console.log('[SERVER-INIT] External API endpoints registered');
  // Register Prometheus metrics endpoint
  console.log('[SERVER-INIT] Registering metrics endpoint...');
  registerMetricsEndpoint(app);
  console.log('[SERVER-INIT] Metrics endpoint registered at /metrics');
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[SERVER-INIT] Server running on http://localhost:${port}/`);
    console.log('[SERVER-INIT] tRPC endpoint: http://localhost:${port}/api/trpc');
    console.log('[SERVER-INIT] External API endpoint: http://localhost:${port}/api/v1/purchases');
  });

  // Webhook retry worker — runs every 30 seconds to re-attempt failed deliveries
  setInterval(() => {
    WebhookDeliveryService.processPendingDeliveries().catch((err) => {
      console.error('[Webhook-Worker] processPendingDeliveries error:', err);
    });
  }, 30_000);
}

console.log('[SERVER-INIT] Starting server...');
startServer().catch(err => {
  console.error('[SERVER-INIT] Fatal error:', err);
  process.exit(1);
});
