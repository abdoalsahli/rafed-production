import { Request, Response } from 'express';
import { getRawDb } from '../db';

export interface ApiLogEntry {
  distributorId: number;
  apiKeyId?: number;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
}

/**
 * Log an API request to the database
 * Sanitizes sensitive data to ensure audit safety
 */
export async function logApiRequest(entry: ApiLogEntry): Promise<void> {
  try {
    const rawDb = await getRawDb();
    if (!rawDb) {
      console.warn('[API-Logger] Database connection not available');
      return;
    }

    const conn = await rawDb.getConnection();
    try {
      const sanitizedErrorMessage = sanitizeErrorMessage(entry.errorMessage);

      const query = `
        INSERT INTO api_logs (
          distributor_id,
          api_key_id,
          endpoint,
          method,
          status_code,
          response_time_ms,
          request_id,
          ip_address,
          user_agent,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await conn.execute(query, [
        entry.distributorId,
        entry.apiKeyId || null,
        entry.endpoint,
        entry.method,
        entry.statusCode,
        entry.responseTimeMs || null,
        entry.requestId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        sanitizedErrorMessage || null,
      ]);
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('[API-Logger] Failed to log API request:', error);
    // Don't throw - logging failures shouldn't break the API
  }
}

/**
 * Get API logs with optional filtering
 */
export async function getApiLogs(
  distributorId: number,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    statusCode?: number;
    endpoint?: string;
    limit?: number;
    offset?: number;
  }
) {
  const rawDb = await getRawDb();
  if (!rawDb) {
    throw new Error('Database connection not available');
  }

  const conn = await rawDb.getConnection();
  try {
    let query = `
      SELECT 
        id,
        distributor_id,
        api_key_id,
        endpoint,
        method,
        status_code,
        response_time_ms,
        request_id,
        ip_address,
        user_agent,
        error_message,
        created_at
      FROM api_logs
      WHERE distributor_id = ?
    `;

    const params: any[] = [distributorId];

    if (filters?.dateFrom) {
      query += ` AND created_at >= ?`;
      params.push(filters.dateFrom);
    }

    if (filters?.dateTo) {
      query += ` AND created_at <= ?`;
      params.push(filters.dateTo);
    }

    if (filters?.statusCode) {
      query += ` AND status_code = ?`;
      params.push(filters.statusCode);
    }

    if (filters?.endpoint) {
      query += ` AND endpoint LIKE ?`;
      params.push(`%${filters.endpoint}%`);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters?.limit) {
      // LIMIT and OFFSET must be literals in MySQL, not parameters
      const limit = Math.min(Math.max(filters.limit, 1), 100); // Clamp between 1 and 100
      query += ` LIMIT ${limit}`;

      if (filters?.offset) {
        const offset = Math.max(filters.offset, 0); // Ensure non-negative
        query += ` OFFSET ${offset}`;
      }
    }

    const [rows] = await conn.execute(query, params);
    return rows as any[];
  } finally {
    conn.release();
  }
}

/**
 * Get API logs count for pagination
 */
export async function getApiLogsCount(
  distributorId: number,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    statusCode?: number;
    endpoint?: string;
  }
) {
  const rawDb = await getRawDb();
  if (!rawDb) {
    throw new Error('Database connection not available');
  }

  const conn = await rawDb.getConnection();
  try {
    let query = `
      SELECT COUNT(*) as count
      FROM api_logs
      WHERE distributor_id = ?
    `;

    const params: any[] = [distributorId];

    if (filters?.dateFrom) {
      query += ` AND created_at >= ?`;
      params.push(filters.dateFrom);
    }

    if (filters?.dateTo) {
      query += ` AND created_at <= ?`;
      params.push(filters.dateTo);
    }

    if (filters?.statusCode) {
      query += ` AND status_code = ?`;
      params.push(filters.statusCode);
    }

    if (filters?.endpoint) {
      query += ` AND endpoint LIKE ?`;
      params.push(`%${filters.endpoint}%`);
    }

    const [rows]: any = await conn.execute(query, params);
    return rows[0]?.count || 0;
  } finally {
    conn.release();
  }
}

/**
 * Sanitize error messages to remove sensitive data
 * Removes: API keys, PINs, secrets, passwords, card numbers
 */
export function sanitizeErrorMessage(message?: string): string | undefined {
  if (!message) return undefined;

  let sanitized = message;

  // Remove API keys/secrets (common patterns)
  sanitized = sanitized.replace(/[Aa]pi[_-]?[Kk]ey[:\s=]*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi, 'API_KEY_REDACTED');
  sanitized = sanitized.replace(/[Ss]ecret[:\s=]*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi, 'SECRET_REDACTED');
  sanitized = sanitized.replace(/[Pp]assword[:\s=]*['"]?[^\s'"]+['"]?/gi, 'PASSWORD_REDACTED');

  // Remove card numbers (16 digits)
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'CARD_REDACTED');

  // Remove PINs (4-6 digits in PIN context)
  sanitized = sanitized.replace(/PIN[\s:=]*\d{4,6}/gi, 'PIN_REDACTED');
  // Also catch standalone 4-digit sequences that look like PINs after colon
  sanitized = sanitized.replace(/:\s*\d{4}\b/g, ': PIN_REDACTED');

  // Remove bearer tokens
  sanitized = sanitized.replace(/[Bb]earer\s+[a-zA-Z0-9_-]+/g, 'BEARER_TOKEN_REDACTED');

  // Limit message length to prevent bloat
  if (sanitized.length > 480) {
    sanitized = sanitized.substring(0, 480) + '...(truncated)';
  }

  return sanitized;
}

/**
 * Extract IP address from request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Express middleware to log API requests
 */
export function apiLoggingMiddleware(distributorId: number, apiKeyId?: number) {
  return async (req: Request, res: Response, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || generateRequestId();

    // Store request ID in response headers
    res.setHeader('X-Request-ID', requestId);

    // Intercept response to log after it's sent
    const originalSend = res.send;
    res.send = function (data: any) {
      const responseTimeMs = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log the request
      logApiRequest({
        distributorId,
        apiKeyId,
        endpoint: req.path,
        method: req.method,
        statusCode,
        responseTimeMs,
        requestId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        errorMessage: statusCode >= 400 ? extractErrorFromResponse(data) : undefined,
      }).catch(err => console.error('[API-Logger] Logging error:', err));

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Extract error message from response data
 */
function extractErrorFromResponse(data: any): string | undefined {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed.error || parsed.message || data;
    } catch {
      return data.substring(0, 200);
    }
  }

  if (data && typeof data === 'object') {
    return data.error || data.message || JSON.stringify(data).substring(0, 200);
  }

  return undefined;
}
