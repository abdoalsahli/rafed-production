/**
 * Dashboard Performance Instrumentation
 * Logs timing data for dashboard procedures when DASHBOARD_PERF_LOGS=true
 * 
 * Logs only non-sensitive data:
 * - procedure name, user_id, distributor/provider id, duration, row count
 * 
 * Never logs:
 * - PINs, API secrets, passwords, tokens, card data
 */

const PERF_LOGS_ENABLED = process.env.DASHBOARD_PERF_LOGS === "true";

interface PerfLogData {
  procedure: string;
  userId: number;
  distributorId?: number;
  providerId?: number;
  durationMs: number;
  rowCount: number;
  success: boolean;
  errorCode?: string;
}

export function logPerfData(data: PerfLogData) {
  if (!PERF_LOGS_ENABLED) return;

  const {
    procedure,
    userId,
    distributorId,
    providerId,
    durationMs,
    rowCount,
    success,
    errorCode,
  } = data;

  const status = success ? "OK" : `ERROR[${errorCode}]`;
  const ids = [
    distributorId ? `dist=${distributorId}` : null,
    providerId ? `prov=${providerId}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(
    `[PERF] ${procedure} user=${userId} ${ids} ${durationMs}ms rows=${rowCount} ${status}`
  );
}

export function isPerfLogsEnabled() {
  return PERF_LOGS_ENABLED;
}
