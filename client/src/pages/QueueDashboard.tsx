import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export function QueueDashboard() {
  const [providerId, setProviderId] = useState(1);
  const [distributorId, setDistributorId] = useState(1);

  // Query dashboard data
  const healthQuery = trpc.dashboard.queueHealth.useQuery(
    { providerId, distributorId },
    { refetchInterval: 5000 }
  );

  const metricsQuery = trpc.dashboard.performanceMetrics.useQuery(
    { providerId, distributorId },
    { refetchInterval: 10000 }
  );

  const integrityQuery = trpc.dashboard.financialIntegrity.useQuery(
    { providerId, distributorId },
    { refetchInterval: 30000 }
  );

  const alertsQuery = trpc.dashboard.alertStatus.useQuery(
    { providerId, distributorId },
    { refetchInterval: 5000 }
  );

  const configQuery = trpc.dashboard.accountConfig.useQuery({
    providerId,
    distributorId,
  });

  const health = healthQuery.data;
  const metrics = metricsQuery.data;
  const integrity = integrityQuery.data;
  const alerts = alertsQuery.data;
  const config = configQuery.data;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Queue Operations Dashboard</h1>
        <p className="text-gray-600 mt-2">Real-time monitoring for prepaid card purchase queue</p>
      </div>

      {/* Account Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Account Selection</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Provider ID</label>
            <input
              type="number"
              value={providerId}
              onChange={(e) => setProviderId(Number(e.target.value))}
              className="border rounded px-3 py-2 w-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Distributor ID</label>
            <input
              type="number"
              value={distributorId}
              onChange={(e) => setDistributorId(Number(e.target.value))}
              className="border rounded px-3 py-2 w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerts Panel */}
      {alerts && (alerts.hasCritical || alerts.hasWarnings) && (
        <div className="space-y-2">
          {alerts.alerts.map((alert: any, idx: number) => (
            <Alert
              key={idx}
              className={alert.level === 'critical' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}
            >
              <div className="flex items-start gap-3">
                {alert.level === 'critical' ? (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                )}
                <AlertDescription
                  className={alert.level === 'critical' ? 'text-red-800' : 'text-yellow-800'}
                >
                  {alert.message}
                </AlertDescription>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Queue Health */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{health.queueDepth}</div>
              <p className="text-xs text-gray-600 mt-1">
                {health.queueDepth > (config?.alertThresholds?.queueDepthCritical || 8000)
                  ? '🔴 Critical'
                  : health.queueDepth > (config?.alertThresholds?.queueDepthWarning || 5000)
                  ? '🟡 Warning'
                  : '🟢 Normal'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{health.processingCount}</div>
              <p className="text-xs text-gray-600 mt-1">Currently processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Oldest Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{health.oldestPendingAgeSeconds}s</div>
              <p className="text-xs text-gray-600 mt-1">Age of oldest request</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Lock Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {health.lockHeld ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-semibold">Held</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="font-semibold">Free</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-2">{health.lastWorkerInstanceId || 'None'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Queue Wait Time (ms)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>P50</span>
                    <span className="font-mono">{metrics.queueWait.p50Ms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P95</span>
                    <span className="font-mono">{metrics.queueWait.p95Ms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P99</span>
                    <span className="font-mono">{metrics.queueWait.p99Ms}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Processing Duration (ms)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>P50</span>
                    <span className="font-mono">{metrics.processingDuration.p50Ms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P95</span>
                    <span className="font-mono">{metrics.processingDuration.p95Ms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P99</span>
                    <span className="font-mono">{metrics.processingDuration.p99Ms}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Success / Failure</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">✓ Succeeded</span>
                    <span className="font-mono font-semibold">{metrics.successCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-700">✗ Failed</span>
                    <span className="font-mono font-semibold">{metrics.failureCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate</span>
                    <span className="font-mono">
                      {((metrics.successCount / (metrics.successCount + metrics.failureCount)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Integrity */}
      {integrity && (
        <Card
          className={
            integrity.mismatchFlag ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Financial Integrity</CardTitle>
              {integrity.isCorrect ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Successful Purchases</p>
                <p className="text-2xl font-bold">{integrity.successfulPurchases}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Purchase Debits</p>
                <p className="text-2xl font-bold text-red-600">{integrity.purchaseDebitCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Commission Credits</p>
                <p className="text-2xl font-bold text-green-600">{integrity.commissionCreditCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`text-lg font-bold ${integrity.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {integrity.isCorrect ? '✓ Correct' : '✗ Mismatch'}
                </p>
              </div>
            </div>
            {integrity.mismatchFlag && (
              <Alert className="mt-4 border-red-500">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Ledger mismatch detected. Immediate investigation required.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Queue Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Max Queue Depth</p>
                <p className="font-mono font-semibold">{config.maxQueueDepth}</p>
              </div>
              <div>
                <p className="text-gray-600">Stale Processing (s)</p>
                <p className="font-mono font-semibold">{config.staleProcessingSeconds}</p>
              </div>
              <div>
                <p className="text-gray-600">Lock Timeout (s)</p>
                <p className="font-mono font-semibold">{config.lockTimeoutSeconds}</p>
              </div>
              <div>
                <p className="text-gray-600">Heartbeat Interval (s)</p>
                <p className="font-mono font-semibold">{config.heartbeatIntervalSeconds}</p>
              </div>
              <div>
                <p className="text-gray-600">Recovery Interval (s)</p>
                <p className="font-mono font-semibold">{config.recoveryIntervalSeconds}</p>
              </div>
              <div>
                <p className="text-gray-600">Max Recovery Attempts</p>
                <p className="font-mono font-semibold">{config.maxRecoveryAttempts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
