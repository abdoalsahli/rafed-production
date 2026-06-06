import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getApiLogs, getApiLogsCount } from '../_core/api-logger';
import { TRPCError } from '@trpc/server';
import { getDistributorIdFromUser } from '../utils/org-lookup';

export const apiLogsRouter = router({
  /**
   * Get API logs for the current distributor
   * Supports filtering by date range, status code, and endpoint
   */
  getApiLogs: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        statusCode: z.number().optional(),
        endpoint: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Only distributors can view their own API logs
      // In a real app, you'd check if the user is associated with a distributor
      // For now, we'll use the user ID as a proxy for distributor ID
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        const [logs, total] = await Promise.all([
          getApiLogs(distributorId, {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            statusCode: input.statusCode,
            endpoint: input.endpoint,
            limit: input.limit,
            offset: input.offset,
          }),
          getApiLogsCount(distributorId, {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            statusCode: input.statusCode,
            endpoint: input.endpoint,
          }),
        ]);

        return {
          logs: logs.map(log => ({
            id: log.id,
            endpoint: log.endpoint,
            method: log.method,
            statusCode: log.status_code,
            responseTimeMs: log.response_time_ms,
            requestId: log.request_id,
            errorMessage: log.error_message,
            createdAt: new Date(log.created_at),
          })),
          total,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error('[API-Logs] Error fetching logs:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch API logs',
        });
      }
    }),

  /**
   * Get summary statistics for API usage
   */
  getApiStats: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Get all logs for the period
        const logs = await getApiLogs(distributorId, {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          limit: 10000, // Get all logs for stats
        });

        // Calculate statistics
        const totalRequests = logs.length;
        const successfulRequests = logs.filter((log: any) => log.status_code < 400).length;
        const failedRequests = logs.filter((log: any) => log.status_code >= 400).length;
        const averageResponseTime = logs.length > 0
          ? logs.reduce((sum: number, log: any) => sum + (log.response_time_ms || 0), 0) / logs.length
          : 0;

        // Group by status code
        const statusCodeDistribution: Record<number, number> = {};
        logs.forEach((log: any) => {
          statusCodeDistribution[log.status_code] = (statusCodeDistribution[log.status_code] || 0) + 1;
        });

        // Group by endpoint
        const endpointDistribution: Record<string, number> = {};
        logs.forEach((log: any) => {
          endpointDistribution[log.endpoint] = (endpointDistribution[log.endpoint] || 0) + 1;
        });

        return {
          totalRequests,
          successfulRequests,
          failedRequests,
          successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
          averageResponseTime: Math.round(averageResponseTime),
          statusCodeDistribution,
          endpointDistribution,
        };
      } catch (error) {
        console.error('[API-Logs] Error fetching stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch API statistics',
        });
      }
    }),
});
