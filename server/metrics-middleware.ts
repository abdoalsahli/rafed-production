/**
 * Prometheus Metrics Endpoint Middleware
 * Exposes /metrics endpoint for Prometheus scraping
 */

import { Request, Response } from 'express';
import { collectAccountMetrics, formatPrometheusMetrics } from './metrics';

/**
 * Metrics endpoint handler
 * Supports querying specific account or returning global metrics
 * 
 * Query parameters:
 * - provider_id: (optional) Filter by provider ID
 * - distributor_id: (optional) Filter by distributor ID
 */
export async function metricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const providerId = req.query.provider_id ? parseInt(req.query.provider_id as string) : null;
    const distributorId = req.query.distributor_id ? parseInt(req.query.distributor_id as string) : null;

    // If both provider_id and distributor_id are provided, return metrics for that account
    if (providerId !== null && distributorId !== null) {
      const metrics = await collectAccountMetrics(providerId, distributorId);
      const prometheusText = formatPrometheusMetrics(metrics, providerId, distributorId);

      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusText);
      return;
    }

    // Otherwise, return empty metrics (in production, would iterate over all active accounts)
    // This prevents cardinality explosion
    const emptyMetrics = `# HELP queue_metrics Per-account queue system metrics
# TYPE queue_metrics gauge
# No account specified. Use ?provider_id=X&distributor_id=Y to get metrics for a specific account
`;

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(emptyMetrics);
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Register metrics endpoint with Express app
 */
export function registerMetricsEndpoint(app: any): void {
  app.get('/metrics', metricsHandler);
  console.log('[METRICS] Metrics endpoint registered at /metrics');
}
