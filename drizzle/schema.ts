import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/mysql-core";
import { createHash } from "crypto";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  passwordHash: text("password_hash"),
  status: mysqlEnum("status", ["active", "pending", "suspended"]).default("active").notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

// Note: openId and loginMethod are mapped to camelCase columns (openId, loginMethod)

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Service Providers - Companies that provide prepaid cards
 */
export const serviceProviders = mysqlTable("service_providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  providerCode: varchar("provider_code", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  organizationId: int("organization_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerCodeIdx: uniqueIndex("idx_provider_code").on(table.providerCode),
}));

export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertServiceProvider = typeof serviceProviders.$inferInsert;

/**
 * Distributors - Companies that purchase and distribute prepaid cards
 */
export const distributors = mysqlTable("distributors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  organizationId: int("organization_id").notNull(),
}, (table) => ({
  fkOrganization: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organizations.id],
    name: "dist_organization_fk",
  }),
}));

export type Distributor = typeof distributors.$inferSelect;
export type InsertDistributor = typeof distributors.$inferInsert;

// Distributor type with optional timestamps for compatibility
export type DistributorWithTimestamps = Distributor & {
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Products - Prepaid card products offered by service providers
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  description: text("description"),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  productCode: varchar("product_code", { length: 64 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  isActive: int("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerIdIdx: index("idx_products_provider_id").on(table.providerId),
  statusIdx: index("idx_products_status").on(table.status),
  productCodeIdx: uniqueIndex("idx_products_provider_code").on(table.providerId, table.productCode),
  fk: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Product Code - Stable external identifier for products
 * Format: PROVIDER_CODE_PRODUCT_CODE (e.g., ZAIN_STEAM_10)
 * Immutable once published
 * Unique within provider
 */
export type ProductCodeLookup = {
  providerId: number;
  productId: number;
  providerCode: string;
  productCode: string;
};

/**
 * Card Batches - Bulk imports of prepaid cards by service providers
 */
export const cardBatches = mysqlTable("card_batches", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  uploadStatus: mysqlEnum("upload_status", ["pending", "processing", "completed", "failed"])
    .default("pending")
    .notNull(),
  totalCards: int("total_cards").notNull(),
  processedCards: int("processed_cards").default(0).notNull(),
  failedCards: int("failed_cards").default(0).notNull(),
  uploadedBy: int("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerIdIdx: index("idx_card_batches_provider_id").on(table.providerId),
  fk: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
  }),
}));

export type CardBatch = typeof cardBatches.$inferSelect;
export type InsertCardBatch = typeof cardBatches.$inferInsert;

/**
 * Cards - Individual prepaid card records
 * PIN is stored encrypted. The pin_encrypted field contains the encrypted Data Encryption Key (DEK).
 */
export const cards = mysqlTable("cards", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  productId: int("product_id").notNull(), // Product this card is for
  batchId: int("batch_id"),
  pinEncrypted: text("pin_encrypted").notNull(), // Encrypted DEK for envelope encryption
  pinHash: varchar("pin_hash", { length: 64 }), // SHA256 hash of raw PIN for duplicate detection
  status: mysqlEnum("status", ["AVAILABLE", "SOLD"]).default("AVAILABLE").notNull(),
  pinViewed: int("pin_viewed").default(0).notNull(), // FIX #3: Track if PIN has been viewed (0=no, 1=yes)
  serialNumber: varchar("serial_number", { length: 128 }), // Card serial number for tracking (nullable, not used in purchase logic)
  allocatedToDistributorId: int("allocated_to_distributor_id"),
  allocatedAt: timestamp("allocated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerProductStatusIdx: index("idx_cards_provider_product_status").on(table.providerId, table.productId, table.status),
  batchIdIdx: index("idx_cards_batch_id").on(table.batchId),
  serialNumberIdx: index("idx_cards_serial_number").on(table.serialNumber),
  providerPinHashIdx: uniqueIndex("idx_provider_pin_hash").on(table.providerId, table.pinHash),
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
  }),
  fkProduct: foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  }),
  fkBatch: foreignKey({
    columns: [table.batchId],
    foreignColumns: [cardBatches.id],
  }),
  fkDistributor: foreignKey({
    columns: [table.allocatedToDistributorId],
    foreignColumns: [distributors.id],
  }),
}));

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

// Helper function to compute SHA256 hash of a PIN
export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

/**
 * Transactions - Purchase transaction records
 * Includes idempotency_key to prevent duplicate processing from POS retries.
 * All financial amounts use NUMERIC type for precision.
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(), // FIX #2: Will be locked with FOR UPDATE inside transaction
  distributorId: int("distributor_id").notNull(),
  providerId: int("provider_id").notNull(),
  productId: int("product_id").notNull(),
  cardId: int("card_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  transactionType: mysqlEnum("transaction_type", ["purchase", "refund"]).default("purchase").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex("idx_transactions_idempotency_key").on(table.idempotencyKey),
  distributorIdIdx: index("idx_transactions_distributor_id").on(table.distributorId),
  providerIdIdx: index("idx_transactions_provider_id").on(table.providerId),
  cardIdIdx: index("idx_transactions_card_id").on(table.cardId),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
  }),
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
  }),
  fkProduct: foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  }),
  fkCard: foreignKey({
    columns: [table.cardId],
    foreignColumns: [cards.id],
  }),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Provider-Distributor Commission - Configurable commission rates per relationship
 */
export const providerDistributorCommission = mysqlTable("provider_distributor_commission", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  distributorId: int("distributor_id").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(), // For percentage (e.g., 0.1500 = 15%)
  commissionType: mysqlEnum("commission_type", ["percentage", "fixed"]).default("percentage").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueRelationship: uniqueIndex("idx_provider_distributor_unique").on(table.providerId, table.distributorId),
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
    name: "pdc_provider_fk",
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "pdc_distributor_fk",
  }),
}));

export type ProviderDistributorCommission = typeof providerDistributorCommission.$inferSelect;
export type InsertProviderDistributorCommission = typeof providerDistributorCommission.$inferInsert;

/**
 * Audit Logs - Append-only audit trail for sensitive actions
 * 
 * CRITICAL: This table is append-only. Rows are NEVER updated or deleted.
 * Each action creates a new immutable record for compliance and security.
 * 
 * Actions tracked:
 * - PIN_VIEWED: When a distributor retrieves a PIN
 * - PIN_DECRYPTION_FAILED: When PIN decryption fails
 * - CARD_ALLOCATED: When a card is allocated to a distributor
 * - TRANSACTION_CREATED: When a transaction is recorded
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // User/distributor who performed the action
  userId: int("user_id").notNull(),
  
  // Action type (e.g., "PIN_VIEWED")
  action: varchar("action", { length: 50 }).notNull(),
  
  // Resource ID (e.g., card_id, wallet_id, transaction_id)
  resourceId: int("resource_id").notNull(),
  
  // Additional context as JSON
  // Example: { transactionId: 123, productId: 1, amount: "100.00" }
  metadata: text("metadata"), // JSON string
  
  // Timestamp (append-only, set at creation)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Indexes for querying
  // Query by user: SELECT * FROM audit_logs WHERE user_id = ?
  // Query by action: SELECT * FROM audit_logs WHERE action = ?
  // Query by resource: SELECT * FROM audit_logs WHERE resource_id = ?
  // Query by date range: SELECT * FROM audit_logs WHERE createdAt >= ? AND createdAt <= ?
}, (table) => ({
  idxUserId: index("audit_user_id_idx").on(table.userId),
  idxAction: index("audit_action_idx").on(table.action),
  idxResourceId: index("audit_resource_id_idx").on(table.resourceId),
  idxCreatedAt: index("audit_created_at_idx").on(table.createdAt),
  // Composite index for common queries: user + action + date
  idxUserActionDate: index("audit_user_action_date_idx").on(
    table.userId,
    table.action,
    table.createdAt,
  ),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;


/**
 * Access Requests - Distributor requests to access provider products
 * Status flow: pending -> approved/rejected
 */
export const accessRequests = mysqlTable("access_requests", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  distributorId: int("distributor_id").notNull(),
  requestedCreditLine: decimal("requested_credit_line", { precision: 12, scale: 2 }).notNull(),
  requestedCommission: decimal("requested_commission_percentage", { precision: 5, scale: 2 }).notNull(), // Percentage
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  reviewedBy: int("approved_by"), // User ID who reviewed
  reviewedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerDistributorIdx: uniqueIndex("idx_access_requests_unique").on(table.providerId, table.distributorId),
  providerIdIdx: index("idx_access_requests_provider_id").on(table.providerId),
  distributorIdIdx: index("idx_access_requests_distributor_id").on(table.distributorId),
  statusIdx: index("idx_access_requests_status").on(table.status),
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
  }),
}));

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

/**
 * Provider-Distributor Relationships - Active relationships with configuration
 * Created when access request is approved
 */
export const providerDistributorRelationships = mysqlTable("provider_distributor_relationships", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  distributorId: int("distributor_id").notNull(),
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 2 }).notNull(), // Percentage
  commissionType: mysqlEnum("commission_type", ["percentage", "fixed"]).default("percentage").notNull(),
  creditLine: decimal("credit_line", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "suspended", "terminated"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueRelationship: uniqueIndex("idx_pdr_unique").on(table.providerId, table.distributorId),
  providerIdIdx: index("idx_pdr_provider_id").on(table.providerId),
  distributorIdIdx: index("idx_pdr_distributor_id").on(table.distributorId),
  statusIdx: index("idx_pdr_status").on(table.status),
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
    name: "pdr_provider_id_service_providers_fk",
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "pdr_distributor_id_distributors_fk",
  }),

}));

export type ProviderDistributorRelationship = typeof providerDistributorRelationships.$inferSelect;
export type InsertProviderDistributorRelationship = typeof providerDistributorRelationships.$inferInsert;

/**
 * Provider-Distributor Accounts - Financial accounts per provider-distributor relationship
 * One account per provider-distributor pair; tracks balance, credit line, and used credit.
 *
 * CRITICAL: This is the source of truth for account balances and credit usage.
 * All balance-affecting operations must update this table atomically.
 */
export const providerDistributorAccounts = mysqlTable("provider_distributor_accounts", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  distributorId: int("distributor_id").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  creditLine: decimal("credit_line", { precision: 12, scale: 2 }).notNull().default("0.00"),
  usedCredit: decimal("used_credit", { precision: 12, scale: 2 }).notNull().default("0.00"),
  version: int("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueRelationship: uniqueIndex("idx_pda_unique").on(table.providerId, table.distributorId),
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
    name: "pda_provider_fk",
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "pda_distributor_fk",
  }),
  providerIdIdx: index("idx_pda_provider_id").on(table.providerId),
  distributorIdIdx: index("idx_pda_distributor_id").on(table.distributorId),
  updatedAtIdx: index("idx_pda_updated_at").on(table.updatedAt),
}));

export type ProviderDistributorAccount = typeof providerDistributorAccounts.$inferSelect;
export type InsertProviderDistributorAccount = typeof providerDistributorAccounts.$inferInsert;

/**
 * Provider-Distributor Ledger - Immutable append-only ledger per provider-distributor relationship.
 * Records every balance-affecting event for audit trail and compliance.
 *
 * CRITICAL: This table is append-only. Rows are NEVER updated or deleted.
 * Each transaction creates new immutable records for audit trail and compliance.
 */
export const providerDistributorLedger = mysqlTable("provider_distributor_ledger", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  distributorId: int("distributor_id").notNull(),
  type: mysqlEnum("type", ["DEBIT", "CREDIT", "ADJUSTMENT"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfterTransaction: decimal("balance_after_transaction", { precision: 12, scale: 2 }).notNull(),
  usedCreditAfterTransaction: decimal("used_credit_after_transaction", { precision: 12, scale: 2 }).notNull(),
  referenceId: varchar("reference_id", { length: 255 }),
  referenceType: mysqlEnum("reference_type", [
    "purchase_debit",
    "commission_credit",
    "topup",
    "refund",
    "adjustment",
  ]).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
    name: "pdl_provider_fk",
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "pdl_distributor_fk",
  }),
  providerDistributorIdx: index("idx_pdl_provider_distributor").on(table.providerId, table.distributorId),
  referenceIdIdx: index("idx_pdl_reference_id").on(table.referenceId),
  referenceTypeIdx: index("idx_pdl_reference_type").on(table.referenceType),
  createdAtIdx: index("idx_pdl_created_at").on(table.createdAt),
  typeIdx: index("idx_pdl_type").on(table.type),
}));

export type ProviderDistributorLedgerEntry = typeof providerDistributorLedger.$inferSelect;
export type InsertProviderDistributorLedgerEntry = typeof providerDistributorLedger.$inferInsert;

/**
 * Monitoring Alerts - Structured financial event logging and alerts
 * 
 * Used for:
 * - Tracking financial events (purchase, refund, adjustment, topup)
 * - Alert generation for anomalies and invariant violations
 * - Audit trail for compliance
 * - Operational monitoring and debugging
 * 
 * CRITICAL: This table is append-only. Alerts are NEVER updated or deleted.
 * Resolved alerts are marked with resolved_at timestamp, not deleted.
 */
export const monitoringAlerts = mysqlTable("monitoring_alerts", {
  id: int("id").autoincrement().primaryKey(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull(),
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  providerId: int("provider_id"),
  distributorId: int("distributor_id"),
  referenceId: varchar("reference_id", { length: 255 }),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON: event details, invariant values, etc.
  status: mysqlEnum("status", ["active", "resolved", "acknowledged"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
    name: "ma_provider_fk",
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "ma_distributor_fk",
  }),
  severityIdx: index("idx_ma_severity").on(table.severity),
  ruleNameIdx: index("idx_ma_rule_name").on(table.ruleName),
  statusIdx: index("idx_ma_status").on(table.status),
  providerDistributorIdx: index("idx_ma_provider_distributor").on(table.providerId, table.distributorId),
  createdAtIdx: index("idx_ma_created_at").on(table.createdAt),
  referenceIdIdx: index("idx_ma_reference_id").on(table.referenceId),
}));

export type MonitoringAlert = typeof monitoringAlerts.$inferSelect;
export type InsertMonitoringAlert = typeof monitoringAlerts.$inferInsert;

/**
 * Purchase Requests - Per-account queue for guaranteed processing
 * 
 * CRITICAL: This table enables the per-account queue architecture.
 * - Queue key = provider_id + distributor_id
 * - One active worker per account
 * - All requests eventually processed in order
 * - Idempotency enforced via idempotency_key
 * 
 * Status flow: PENDING -> PROCESSING -> SUCCEEDED/FAILED
 * 
 * Recovery:
 * - PROCESSING requests older than 30 seconds are recovered and retried
 * - Ensures no stale jobs block the queue
 */
export const purchaseRequests = mysqlTable("purchase_requests", {
  // Queue management for per-account burst handling
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  distributorId: int("distributor_id").notNull(),
  productId: int("product_id").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(), // For idempotency
  status: mysqlEnum("status", ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"]).default("PENDING").notNull(),
  cardId: int("card_id"), // Allocated card ID (set on success)
  failureReason: text("failure_reason"), // Error message if FAILED
  processingStartedAt: timestamp("processing_started_at"), // When worker started processing
  completedAt: timestamp("completed_at"), // When processing finished
  recoveryAttemptCount: int("recovery_attempt_count").default(0).notNull(), // Track recovery attempts
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Composite index for queue ordering: (provider_id, distributor_id, status, created_at)
  queueIdx: index("idx_purchase_requests_queue").on(table.providerId, table.distributorId, table.status, table.createdAt),
  // Index for idempotency checks
  idempotencyIdx: uniqueIndex("idx_purchase_requests_idempotency").on(table.idempotencyKey),
  // Index for recovery of stale PROCESSING jobs
  processingIdx: index("idx_purchase_requests_processing").on(table.status, table.processingStartedAt),
  // Foreign keys
  fkProvider: foreignKey({
    columns: [table.providerId],
    foreignColumns: [serviceProviders.id],
    name: "pr_provider_fk",
  }),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "pr_distributor_fk",
  }),
  fkProduct: foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
    name: "pr_product_fk",
  }),
  fkCard: foreignKey({
    columns: [table.cardId],
    foreignColumns: [cards.id],
    name: "pr_card_fk",
  }),
}));

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = typeof purchaseRequests.$inferInsert;


/**
 * Notifications - User notifications for system events
 * Types: REQUEST_RECEIVED (provider), REQUEST_APPROVED (distributor), REQUEST_REJECTED (distributor)
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["REQUEST_RECEIVED", "REQUEST_APPROVED", "REQUEST_REJECTED"]).notNull(),
  message: text("message").notNull(),
  isRead: int("is_read").default(0).notNull(), // 0 = unread, 1 = read
  relatedEntityId: int("related_entity_id"), // ID of access request or other related entity
  relatedEntityType: varchar("related_entity_type", { length: 64 }), // e.g., "access_request"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_notifications_user_id").on(table.userId),
  isReadIdx: index("idx_notifications_is_read").on(table.isRead),
  createdAtIdx: index("idx_notifications_created_at").on(table.createdAt),
  userIsReadIdx: index("idx_notifications_user_is_read").on(table.userId, table.isRead),
  fkUser: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;


/**
 * Organizations - Companies/entities that use the platform
 * Can be Provider, Distributor, or Internal/Admin
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["provider", "distributor", "internal"]).notNull(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  notes: text("notes"),
  logoUrl: text("logo_url"),
}, (table) => ({
  nameIdx: index("idx_organizations_name").on(table.name),
  typeIdx: index("idx_organizations_type").on(table.type),
  statusIdx: index("idx_organizations_status").on(table.status),
}));

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Organization Users - Maps users to organizations with roles
 */
export const organizationUsers = mysqlTable("organization_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id").notNull(),
  role: mysqlEnum("role", ["admin", "operator", "viewer"]).default("operator").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_organization_users_user_id").on(table.userId),
  organizationIdIdx: index("idx_organization_users_organization_id").on(table.organizationId),
  uniqueUserOrg: uniqueIndex("idx_unique_user_org").on(table.userId, table.organizationId),
  fkUser: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
  fkOrganization: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organizations.id],
  }),
}));

export type OrganizationUser = typeof organizationUsers.$inferSelect;
export type InsertOrganizationUser = typeof organizationUsers.$inferInsert;

/**
 * Update users table to add activation status
 * Note: This extends the existing users table definition
 */
export const usersExtended = mysqlTable("users_extended", {
  userId: int("user_id").notNull().primaryKey(),
  status: mysqlEnum("status", ["pending", "active", "suspended"]).default("pending").notNull(),
  activatedAt: timestamp("activated_at"),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
}, (table) => ({
  statusIdx: index("idx_users_extended_status").on(table.status),
  fkUser: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
}));

export type UserExtended = typeof usersExtended.$inferSelect;
export type InsertUserExtended = typeof usersExtended.$inferInsert;


/**
 * Distributor API Credentials - API keys and webhooks for distributor integrations
 */
export const distributorApiCredentials = mysqlTable("distributor_api_credentials", {
  id: int("id").autoincrement().primaryKey(),
  distributorId: int("distributor_id").notNull(),
  keyId: varchar("key_id", { length: 64 }).notNull().unique(), // Public identifier
  maskedKey: varchar("masked_key", { length: 64 }).notNull(), // e.g., "sk_live_...abc123" (last 12 chars visible)
  secretHash: varchar("secret_hash", { length: 255 }).notNull(), // Hashed secret for verification
  webhookSecret: varchar("webhook_secret", { length: 128 }), // Independent HMAC signing secret for webhooks
  status: mysqlEnum("status", ["active", "rotated", "revoked"]).default("active").notNull(),
  webhookUrl: varchar("webhook_url", { length: 2048 }),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  distributorIdIdx: index("idx_api_creds_distributor_id").on(table.distributorId),
  keyIdIdx: uniqueIndex("idx_api_creds_key_id").on(table.keyId),
  statusIdx: index("idx_api_creds_status").on(table.status),
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
  }),
}));

export type DistributorApiCredential = typeof distributorApiCredentials.$inferSelect;
export type InsertDistributorApiCredential = typeof distributorApiCredentials.$inferInsert;

/**
 * API Logs - Audit trail for distributor API requests
 * 
 * Used for:
 * - Tracking all API requests for audit and compliance
 * - Troubleshooting API issues
 * - Rate limiting enforcement
 * - Usage analytics and monitoring
 * 
 * CRITICAL: This table is append-only. Logs are NEVER updated or deleted.
 * Sensitive data (API keys, PINs, secrets) are masked/excluded for security.
 */
export const apiLogs = mysqlTable("api_logs", {
  id: int("id").autoincrement().primaryKey(),
  distributorId: int("distributor_id").notNull(),
  apiKeyId: int("api_key_id"),
  endpoint: varchar("endpoint", { length: 255 }).notNull(), // e.g., "/api/distributor/purchase"
  method: varchar("method", { length: 10 }).notNull(), // GET, POST, PUT, DELETE
  statusCode: int("status_code").notNull(), // HTTP status code
  responseTimeMs: int("response_time_ms"), // Response time in milliseconds
  requestId: varchar("request_id", { length: 255 }), // Unique request ID for tracing
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"), // Client user agent
  errorMessage: text("error_message"), // Error message if failed (sanitized)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "al_distributor_fk",
  }),
  fkApiKey: foreignKey({
    columns: [table.apiKeyId],
    foreignColumns: [distributorApiCredentials.id],
    name: "al_api_key_fk",
  }),
  distributorIdIdx: index("idx_al_distributor_id").on(table.distributorId),
  endpointIdx: index("idx_al_endpoint").on(table.endpoint),
  statusCodeIdx: index("idx_al_status_code").on(table.statusCode),
  createdAtIdx: index("idx_al_created_at").on(table.createdAt),
  distributorCreatedAtIdx: index("idx_al_distributor_created_at").on(table.distributorId, table.createdAt),
}));

export type ApiLog = typeof apiLogs.$inferSelect;
export type InsertApiLog = typeof apiLogs.$inferInsert;


/**
 * Webhook Deliveries - Audit trail for webhook delivery attempts
 * 
 * Used for:
 * - Tracking all webhook delivery attempts for audit and compliance
 * - Implementing retry logic with exponential backoff
 * - Debugging webhook delivery issues
 * - Monitoring webhook success rates
 * 
 * CRITICAL: This table is append-only. Each delivery attempt creates a new row.
 * Never update or delete existing delivery records.
 */
export const webhookDeliveries = mysqlTable("webhook_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  distributorId: int("distributor_id").notNull(),
  purchaseRequestId: int("purchase_request_id").notNull(),
  eventType: mysqlEnum("event_type", ["purchase.succeeded", "purchase.failed"]).notNull(),
  targetUrl: varchar("target_url", { length: 2048 }).notNull(),
  payloadJson: text("payload_json").notNull(), // Full webhook payload
  responseStatus: int("response_status"), // HTTP status code from webhook endpoint
  responseBody: text("response_body"), // Response body (first 4KB)
  retryCount: int("retry_count").default(0).notNull(),
  deliveryStatus: mysqlEnum("delivery_status", ["PENDING", "DELIVERED", "FAILED_DELIVERY"]).default("PENDING").notNull(),
  deliveredAt: timestamp("delivered_at"), // When webhook was successfully delivered
  failedAt: timestamp("failed_at"), // When webhook delivery was permanently failed
  nextRetryAt: timestamp("next_retry_at"), // When next retry should be attempted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "wd_distributor_fk",
  }),
  fkPurchaseRequest: foreignKey({
    columns: [table.purchaseRequestId],
    foreignColumns: [purchaseRequests.id],
    name: "wd_purchase_request_fk",
  }),
  distributorIdIdx: index("idx_wd_distributor_id").on(table.distributorId),
  purchaseRequestIdIdx: index("idx_wd_purchase_request_id").on(table.purchaseRequestId),
  deliveryStatusIdx: index("idx_wd_delivery_status").on(table.deliveryStatus),
  nextRetryAtIdx: index("idx_wd_next_retry_at").on(table.nextRetryAt),
  createdAtIdx: index("idx_wd_created_at").on(table.createdAt),
  distributorDeliveryIdx: index("idx_wd_distributor_delivery").on(table.distributorId, table.deliveryStatus),
}));

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;

/**
 * Webhook Events - Optional audit table for webhook events (not required, but useful for debugging)
 * 
 * This table stores the original webhook event before delivery attempts.
 * Helps with debugging and replay scenarios.
 */
export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  distributorId: int("distributor_id").notNull(),
  purchaseRequestId: int("purchase_request_id").notNull(),
  eventType: mysqlEnum("event_type", ["purchase.succeeded", "purchase.failed"]).notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fkDistributor: foreignKey({
    columns: [table.distributorId],
    foreignColumns: [distributors.id],
    name: "we_distributor_fk",
  }),
  fkPurchaseRequest: foreignKey({
    columns: [table.purchaseRequestId],
    foreignColumns: [purchaseRequests.id],
    name: "we_purchase_request_fk",
  }),
  distributorIdIdx: index("idx_we_distributor_id").on(table.distributorId),
  purchaseRequestIdIdx: index("idx_we_purchase_request_id").on(table.purchaseRequestId),
  eventTypeIdx: index("idx_we_event_type").on(table.eventType),
  createdAtIdx: index("idx_we_created_at").on(table.createdAt),
}));

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

/* ── Allocation Orders ───────────────────────────────────────────────────────
   Provider-side offline orders: bundle cards from multiple products and
   hand them off to an external client (no platform account required).
   ─────────────────────────────────────────────────────────────────────────── */
export const allocationOrders = mysqlTable("allocation_orders", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientPhone: varchar("client_phone", { length: 64 }),
  clientNotes: text("client_notes"),
  status: mysqlEnum("status", ["draft", "confirmed", "delivered", "cancelled"]).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
  deliveredAt: timestamp("delivered_at"),
}, (table) => ({
  providerIdIdx: index("idx_ao_provider_id").on(table.providerId),
  statusIdx: index("idx_ao_status").on(table.status),
  fkProvider: foreignKey({ columns: [table.providerId], foreignColumns: [serviceProviders.id] }),
}));

export type AllocationOrder = typeof allocationOrders.$inferSelect;

export const allocationOrderItems = mysqlTable("allocation_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id").notNull(),
  quantityRequested: int("quantity_requested").notNull(),
  quantityFulfilled: int("quantity_fulfilled").default(0).notNull(),
}, (table) => ({
  orderIdIdx: index("idx_aoi_order_id").on(table.orderId),
  fkOrder: foreignKey({ columns: [table.orderId], foreignColumns: [allocationOrders.id] }),
  fkProduct: foreignKey({ columns: [table.productId], foreignColumns: [products.id] }),
}));

export type AllocationOrderItem = typeof allocationOrderItems.$inferSelect;

export const allocationOrderCards = mysqlTable("allocation_order_cards", {
  id: int("id").autoincrement().primaryKey(),
  orderItemId: int("order_item_id").notNull(),
  cardId: int("card_id").notNull(),
}, (table) => ({
  orderItemIdIdx: index("idx_aoc_order_item_id").on(table.orderItemId),
  cardIdUq: uniqueIndex("idx_aoc_card_id").on(table.cardId),
  fkOrderItem: foreignKey({ columns: [table.orderItemId], foreignColumns: [allocationOrderItems.id] }),
  fkCard: foreignKey({ columns: [table.cardId], foreignColumns: [cards.id] }),
}));
