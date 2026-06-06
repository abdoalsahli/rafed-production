/**
 * Query Timing Utility
 * Captures execution times for dashboard queries
 * Used for performance measurement and optimization
 */

interface QueryTiming {
  queryName: string;
  executionTimeMs: number;
  rowCount: number;
  timestamp: string;
}

const timings: QueryTiming[] = [];

export function startTiming(queryName: string) {
  return {
    queryName,
    startTime: Date.now(),
  };
}

export function endTiming(
  timer: { queryName: string; startTime: number },
  rowCount: number = 0
) {
  const executionTimeMs = Date.now() - timer.startTime;
  const timing: QueryTiming = {
    queryName: timer.queryName,
    executionTimeMs,
    rowCount,
    timestamp: new Date().toISOString(),
  };

  timings.push(timing);

  // Log to console for measurement
  console.log(
    `[QUERY_TIMING] ${timer.queryName}: ${executionTimeMs}ms (${rowCount} rows)`
  );

  return timing;
}

export function getTimings() {
  return timings;
}

export function clearTimings() {
  timings.length = 0;
}

export function printTimingsSummary() {
  if (timings.length === 0) {
    console.log("[QUERY_TIMING] No timings recorded");
    return;
  }

  console.log("\n=== DASHBOARD QUERY TIMINGS ===");
  let totalMs = 0;
  timings.forEach((t) => {
    console.log(
      `${t.queryName}: ${t.executionTimeMs}ms (${t.rowCount} rows)`
    );
    totalMs += t.executionTimeMs;
  });
  console.log(`Total: ${totalMs}ms`);
  console.log("================================\n");
}
