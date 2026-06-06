/**
 * Runtime Health Dashboard
 * Displays process, memory, connection pool, cache, worker, and error health
 * Admin-only component
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
}

export function RuntimeHealthDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Fetch health data
  const { data: health, isLoading, refetch } = trpc.runtimeHealth.getRuntimeHealth.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? refreshInterval : false,
      staleTime: 0,
    }
  );

  if (isLoading) {
    return <div className="p-4">Loading runtime health...</div>;
  }

  if (!health?.success || !health.data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load runtime health metrics</AlertDescription>
      </Alert>
    );
  }

  const h = health.data;
  const now = Date.now();

  // Determine health statuses
  const memoryStatus: HealthStatus =
    h.memory.heapUsedPercent > 85
      ? { status: 'critical', message: 'Heap usage critical' }
      : h.memory.heapUsedPercent > 70
        ? { status: 'warning', message: 'Heap usage high' }
        : { status: 'healthy', message: 'Heap usage normal' };

  const poolStatus: HealthStatus =
    h.connectionPool.saturationPercent > 85
      ? { status: 'critical', message: 'Pool saturation critical' }
      : h.connectionPool.saturationPercent > 70
        ? { status: 'warning', message: 'Pool saturation high' }
        : { status: 'healthy', message: 'Pool saturation normal' };

  const errorStatus: HealthStatus =
    h.error.errorCount24h > 50
      ? { status: 'critical', message: 'High error rate' }
      : h.error.errorCount24h > 20
        ? { status: 'warning', message: 'Elevated error rate' }
        : { status: 'healthy', message: 'Error rate normal' };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Runtime Health Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Last updated: {new Date(h.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border ${getStatusColor(memoryStatus.status)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Memory Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusBadgeColor(memoryStatus.status)}>
              {memoryStatus.message}
            </Badge>
            <p className="text-2xl font-bold mt-2">{h.memory.heapUsedPercent.toFixed(1)}%</p>
            <p className="text-xs text-gray-600 mt-1">Heap Used</p>
          </CardContent>
        </Card>

        <Card className={`border ${getStatusColor(poolStatus.status)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connection Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusBadgeColor(poolStatus.status)}>
              {poolStatus.message}
            </Badge>
            <p className="text-2xl font-bold mt-2">{h.connectionPool.saturationPercent.toFixed(1)}%</p>
            <p className="text-xs text-gray-600 mt-1">Saturation</p>
          </CardContent>
        </Card>

        <Card className={`border ${getStatusColor(errorStatus.status)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error Health</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusBadgeColor(errorStatus.status)}>
              {errorStatus.message}
            </Badge>
            <p className="text-2xl font-bold mt-2">{h.error.errorCount24h}</p>
            <p className="text-xs text-gray-600 mt-1">Errors (24h)</p>
          </CardContent>
        </Card>
      </div>

      {/* Memory Health */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Health</CardTitle>
          <CardDescription>Process memory usage and heap statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Heap Used</p>
              <p className="text-lg font-bold">{formatBytes(h.memory.heapUsed)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Heap Total</p>
              <p className="text-lg font-bold">{formatBytes(h.memory.heapTotal)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">RSS Memory</p>
              <p className="text-lg font-bold">{formatBytes(h.memory.rssMemory)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">External</p>
              <p className="text-lg font-bold">{formatBytes(h.memory.external)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Array Buffers</p>
              <p className="text-lg font-bold">{formatBytes(h.memory.arrayBuffers)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Heap Usage</p>
              <p className="text-lg font-bold">{h.memory.heapUsedPercent.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Pool Health */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Pool Health</CardTitle>
          <CardDescription>Database connection pool statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Connections</p>
              <p className="text-lg font-bold">{h.connectionPool.activeConnections}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Idle Connections</p>
              <p className="text-lg font-bold">{h.connectionPool.idleConnections}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Max Connections</p>
              <p className="text-lg font-bold">{h.connectionPool.maxConnections}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Waiting Requests</p>
              <p className="text-lg font-bold">{h.connectionPool.waitingRequests}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Saturation</p>
              <p className="text-lg font-bold">{h.connectionPool.saturationPercent.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Acquisition Failures</p>
              <p className="text-lg font-bold">{h.connectionPool.acquisitionFailures}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Health */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Health</CardTitle>
          <CardDescription>Metrics cache statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Entries</p>
              <p className="text-lg font-bold">{h.cache.entries}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Locks</p>
              <p className="text-lg font-bold">{h.cache.locks}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Memory Used</p>
              <p className="text-lg font-bold">{formatBytes(h.cache.memory)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Hit Ratio</p>
              <p className="text-lg font-bold">{(h.cache.hitRatio * 100).toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worker Health */}
      <Card>
        <CardHeader>
          <CardTitle>Worker Health</CardTitle>
          <CardDescription>Queue worker and lock statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Workers</p>
              <p className="text-lg font-bold">{h.worker.activeWorkers}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Stale Heartbeats</p>
              <p className="text-lg font-bold text-yellow-600">{h.worker.staleHeartbeatCount}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Recovery Count</p>
              <p className="text-lg font-bold">{h.worker.recoveryCount}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Lock Failures</p>
              <p className="text-lg font-bold text-red-600">{h.worker.lockAcquisitionFailures}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Unexpected Stops</p>
              <p className="text-lg font-bold text-red-600">{h.worker.unexpectedStops}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Health */}
      <Card>
        <CardHeader>
          <CardTitle>Process Health</CardTitle>
          <CardDescription>Process uptime and CPU usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Uptime</p>
              <p className="text-lg font-bold">{formatUptime(h.process.uptime)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">User CPU</p>
              <p className="text-lg font-bold">{(h.process.cpuUsage.user / 1000).toFixed(2)}ms</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">System CPU</p>
              <p className="text-lg font-bold">{(h.process.cpuUsage.system / 1000).toFixed(2)}ms</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Event Loop Lag</p>
              <p className="text-lg font-bold">{h.process.eventLoopLag.toFixed(2)}ms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Health */}
      <Card>
        <CardHeader>
          <CardTitle>Error Health</CardTitle>
          <CardDescription>Error tracking and statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Errors (24h)</p>
              <p className="text-lg font-bold">{h.error.errorCount24h}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-lg font-bold">{h.error.errorRate.toFixed(2)}/min</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Restart Count</p>
              <p className="text-lg font-bold">{h.error.restartCount}</p>
            </div>
          </div>

          {h.error.lastCriticalError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">Last Critical Error</p>
                <p className="text-xs mt-1">
                  {new Date(h.error.lastCriticalError.timestamp).toLocaleString()}
                </p>
                <p className="text-sm mt-1">{h.error.lastCriticalError.message}</p>
              </AlertDescription>
            </Alert>
          )}

          {h.error.recentErrors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Recent Errors</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {h.error.recentErrors.map((err, idx) => (
                  <div key={idx} className="text-xs p-2 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center justify-between">
                      <Badge
                        className={
                          err.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : err.severity === 'warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {err.severity}
                      </Badge>
                      <span className="text-gray-600">
                        {new Date(err.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-700">{err.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
