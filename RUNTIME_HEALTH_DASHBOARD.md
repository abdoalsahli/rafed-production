# Runtime Health Dashboard

## Overview

The Runtime Health Dashboard provides internal operational visibility into the prepaid card platform's runtime behavior. It displays real-time metrics for memory, connection pools, caches, workers, and error health.

**Access:** `/admin/runtime-health` (Admin-only)

---

## Features

### 1. Memory Health

Displays process memory usage and heap statistics:

- **Heap Used**: Current heap memory in use
- **Heap Total**: Total heap memory allocated
- **RSS Memory**: Resident set size (total process memory)
- **External**: Memory used by C++ objects bound to JS objects
- **Array Buffers**: Memory used by typed arrays
- **Heap Usage %**: Percentage of heap in use (0-100%)

**Status Indicators:**
- 🟢 Healthy: < 70%
- 🟡 Warning: 70-85%
- 🔴 Critical: > 85%

### 2. Connection Pool Health

Displays database connection pool statistics:

- **Active Connections**: Currently open connections
- **Idle Connections**: Available connections in pool
- **Max Connections**: Pool size limit
- **Waiting Requests**: Requests waiting for a connection
- **Saturation %**: Active connections as % of max (0-100%)
- **Acquisition Failures**: Failed connection attempts
- **Acquisition Timeouts**: Timeout errors

**Status Indicators:**
- 🟢 Healthy: < 70%
- 🟡 Warning: 70-85%
- 🔴 Critical: > 85%

### 3. Cache Health

Displays metrics cache statistics:

- **Cache Entries**: Number of cached items
- **Active Locks**: Ongoing cache computations (thundering herd prevention)
- **Memory Used**: Estimated memory consumed by cache
- **Hit Ratio**: Cache hit rate (0-100%)

**Purpose:** Monitors the metrics cache that prevents expensive calculations from running repeatedly.

### 4. Worker Health

Displays queue worker and lock statistics:

- **Active Workers**: Currently running workers
- **Stale Heartbeats**: Workers with missed heartbeats
- **Recovery Count**: Number of recovery operations
- **Lock Acquisition Failures**: Failed lock attempts
- **Unexpected Stops**: Workers that stopped unexpectedly

**Interpretation:**
- Stale heartbeats indicate worker hangs
- Lock failures may indicate contention
- Unexpected stops require investigation

### 5. Process Health

Displays process uptime and CPU usage:

- **Uptime**: Time since process started (days, hours, minutes)
- **User CPU**: CPU time spent in user code (milliseconds)
- **System CPU**: CPU time spent in kernel (milliseconds)
- **Event Loop Lag**: Average delay in event loop (milliseconds)

**Event Loop Lag:**
- < 10ms: Healthy
- 10-50ms: Elevated (may indicate GC or heavy computation)
- > 50ms: Concerning (investigate for bottlenecks)

### 6. Error Health

Displays error tracking and statistics:

- **Errors (24h)**: Total errors in last 24 hours
- **Error Rate**: Errors per minute
- **Restart Count**: Number of process restarts
- **Last Critical Error**: Most recent critical error with timestamp
- **Recent Errors**: List of last 10 errors with severity and time

**Severity Levels:**
- 🟢 Info: Informational messages
- 🟡 Warning: Non-critical issues
- 🔴 Critical: Requires immediate attention

---

## Data Sources

### Metrics Collected From:

1. **Node.js Process API**
   - `process.memoryUsage()` - Memory statistics
   - `process.uptime()` - Process uptime
   - `process.cpuUsage()` - CPU usage

2. **Metrics Cache**
   - `metricsCache.getStats()` - Cache statistics

3. **Connection Pool Manager**
   - Active/idle connections
   - Pool saturation
   - Acquisition failures

4. **Queue Manager**
   - Active workers
   - Stale heartbeats
   - Recovery counts

5. **Error Tracking**
   - Error log maintained by `runtime-health.ts`
   - Tracked via `trackError()` calls

6. **Event Loop Lag**
   - Sampled via `trackEventLoopLag()` calls

---

## API Endpoints

All endpoints require admin authentication.

### Get Complete Health Snapshot

```typescript
GET /api/trpc/runtimeHealth.getRuntimeHealth
```

Returns all health metrics in a single snapshot.

**Response:**
```typescript
{
  success: true,
  data: {
    timestamp: number,
    memory: MemoryHealth,
    connectionPool: ConnectionPoolHealth,
    cache: CacheHealth,
    worker: WorkerHealth,
    error: ErrorHealth,
    process: ProcessHealth
  }
}
```

### Get Specific Health Category

```typescript
GET /api/trpc/runtimeHealth.getMemoryHealth
GET /api/trpc/runtimeHealth.getConnectionPoolHealth
GET /api/trpc/runtimeHealth.getCacheHealth
GET /api/trpc/runtimeHealth.getWorkerHealth
GET /api/trpc/runtimeHealth.getErrorHealth
GET /api/trpc/runtimeHealth.getProcessHealth
```

Each returns the specific health category.

### Get Health Summary

```typescript
GET /api/trpc/runtimeHealth.getHealthSummary
```

Returns a quick overview with key metrics and status indicators.

**Response:**
```typescript
{
  success: true,
  data: {
    timestamp: number,
    memoryStatus: 'healthy' | 'warning' | 'critical',
    heapUsedPercent: number,
    poolStatus: 'healthy' | 'warning' | 'critical',
    poolSaturation: number,
    errorCount24h: number,
    errorRate: number,
    uptime: number,
    eventLoopLag: number
  }
}
```

---

## Server Integration

### Initialize Error Tracking

Add to server startup (`server/_core/index.ts`):

```typescript
import { trackError, trackEventLoopLag } from '../runtime-health';

// Track uncaught errors
process.on('uncaughtException', (error) => {
  trackError(error.message, 'critical');
});

process.on('unhandledRejection', (reason) => {
  trackError(String(reason), 'critical');
});

// Track event loop lag (optional, for performance monitoring)
// This requires a separate monitoring mechanism
```

### Track Errors in Code

```typescript
import { trackError } from './runtime-health';

try {
  // Some operation
} catch (error) {
  trackError(
    error instanceof Error ? error.message : String(error),
    'error'
  );
}
```

### Track Event Loop Lag

```typescript
import { trackEventLoopLag } from './runtime-health';

// Measure event loop lag
const start = Date.now();
setImmediate(() => {
  const lag = Date.now() - start;
  trackEventLoopLag(lag);
});
```

---

## UI Components

### RuntimeHealthDashboard

Main dashboard component displaying all health metrics.

**Location:** `client/src/components/RuntimeHealthDashboard.tsx`

**Features:**
- Auto-refresh with configurable interval
- Color-coded status indicators
- Formatted byte/time values
- Recent error list
- Responsive grid layout

**Usage:**
```typescript
import { RuntimeHealthDashboard } from '@/components/RuntimeHealthDashboard';

export default function AdminPage() {
  return <RuntimeHealthDashboard />;
}
```

### RuntimeHealthPage

Admin-only page wrapping the dashboard.

**Location:** `client/src/pages/RuntimeHealth.tsx`

**Route:** `/admin/runtime-health`

**Access Control:** Admin users only

---

## Monitoring Recommendations

### Daily Checks

- [ ] Memory heap usage stays < 70%
- [ ] Connection pool saturation < 70%
- [ ] Error count 24h within baseline
- [ ] Event loop lag < 20ms average

### Weekly Reviews

- [ ] Trend analysis of memory growth
- [ ] Connection pool usage patterns
- [ ] Error spike investigation
- [ ] Worker health status

### Monthly Analysis

- [ ] Memory leak detection
- [ ] Connection pool sizing adequacy
- [ ] Error patterns and root causes
- [ ] Capacity planning

---

## Troubleshooting

### High Memory Usage

**Symptoms:** Heap usage > 80%, RSS memory growing

**Investigation:**
1. Check for memory leaks in recent code changes
2. Review cache size (may need TTL reduction)
3. Check for large error logs
4. Consider heap snapshot analysis

**Actions:**
- Restart process if necessary
- Reduce cache TTL
- Implement memory limits
- Profile with Node.js inspector

### Connection Pool Saturation

**Symptoms:** Pool saturation > 80%, waiting requests > 0

**Investigation:**
1. Check database query performance
2. Look for long-running queries
3. Review connection timeout settings
4. Check for connection leaks

**Actions:**
- Increase pool size if appropriate
- Optimize slow queries
- Reduce query timeout
- Investigate connection leaks

### High Error Rate

**Symptoms:** Error count > 50/day, error rate > 0.1/min

**Investigation:**
1. Review recent error messages
2. Check error timestamps for patterns
3. Correlate with external events
4. Review recent deployments

**Actions:**
- Investigate error root causes
- Review error logs
- Check external service status
- Rollback if recent change caused spike

### Event Loop Lag Spike

**Symptoms:** Event loop lag > 50ms

**Investigation:**
1. Check for long-running synchronous code
2. Look for garbage collection pauses
3. Review CPU usage
4. Check for blocking operations

**Actions:**
- Profile with Node.js inspector
- Check for synchronous operations
- Review GC logs
- Consider splitting work into smaller chunks

---

## Metrics Reference

### Memory Health Interface

```typescript
interface MemoryHealth {
  heapUsed: number;        // Bytes
  heapTotal: number;       // Bytes
  rssMemory: number;       // Bytes
  external: number;        // Bytes
  arrayBuffers: number;    // Bytes
  heapUsedPercent: number; // 0-100
}
```

### Connection Pool Health Interface

```typescript
interface ConnectionPoolHealth {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
  saturationPercent: number;  // 0-100
  acquisitionFailures: number;
  acquisitionTimeouts: number;
}
```

### Cache Health Interface

```typescript
interface CacheHealth {
  entries: number;
  locks: number;
  memory: number;
  hitRatio: number;  // 0-1
}
```

### Worker Health Interface

```typescript
interface WorkerHealth {
  activeWorkers: number;
  staleHeartbeatCount: number;
  recoveryCount: number;
  lockAcquisitionFailures: number;
  unexpectedStops: number;
}
```

### Error Health Interface

```typescript
interface ErrorHealth {
  recentErrors: Array<{
    timestamp: number;
    message: string;
    severity: 'error' | 'warning' | 'critical';
  }>;
  errorCount24h: number;
  errorRate: number;
  lastCriticalError: {
    timestamp: number;
    message: string;
  } | null;
  restartCount: number;
}
```

### Process Health Interface

```typescript
interface ProcessHealth {
  uptime: number;
  cpuUsage: NodeJS.CpuUsage;
  eventLoopLag: number;
}
```

---

## Implementation Details

### Files

1. **`server/runtime-health.ts`** (220 lines)
   - Core metrics collection
   - Error tracking
   - Event loop lag tracking

2. **`server/routers/runtime-health.ts`** (130 lines)
   - tRPC procedures for health queries
   - Admin-only access control

3. **`client/src/components/RuntimeHealthDashboard.tsx`** (350 lines)
   - Dashboard UI component
   - Auto-refresh functionality
   - Status indicators and formatting

4. **`client/src/pages/RuntimeHealth.tsx`** (25 lines)
   - Admin-only page wrapper
   - Access control

5. **`server/runtime-health.test.ts`** (250+ lines)
   - 20+ test cases
   - Metrics collection tests
   - Error tracking tests

### Integration Points

1. **App Router** (`server/routers.ts`)
   - Registered as `runtimeHealth` router

2. **App Routes** (`client/src/App.tsx`)
   - Route: `/admin/runtime-health`
   - Component: `RuntimeHealthPage`

---

## Future Enhancements

### Potential Additions

1. **Historical Metrics**
   - Store metrics snapshots in database
   - Display trends over time
   - Alert on anomalies

2. **Custom Thresholds**
   - Per-environment thresholds
   - Alert configuration
   - Notification integration

3. **Export Functionality**
   - Export metrics as CSV/JSON
   - Prometheus metrics endpoint
   - Integration with monitoring systems

4. **Advanced Analysis**
   - Memory leak detection
   - Performance bottleneck identification
   - Capacity planning recommendations

5. **Real-time Monitoring**
   - WebSocket updates
   - Live charts
   - Alert notifications

---

## Support

For issues or questions about the runtime health dashboard:

1. Check the troubleshooting section above
2. Review server logs for errors
3. Verify admin access permissions
4. Check database connectivity

---

**Last Updated:** April 20, 2026
