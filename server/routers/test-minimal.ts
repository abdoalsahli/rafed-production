/**
 * Minimal Test Router - Isolate tRPC input issue
 */

import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';

console.log('[TEST-MINIMAL-ROUTER] Loading...');

export const testMinimalRouter = router({
  /**
   * Simple echo mutation with input
   */
  echo: publicProcedure
    .input(
      z.object({
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('[TEST-ECHO] Received:', input);
      return {
        echo: input.message,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Simple query with input
   */
  greet: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(async ({ input }) => {
      console.log('[TEST-GREET] Received:', input);
      return {
        greeting: `Hello, ${input.name}!`,
        timestamp: new Date().toISOString(),
      };
    }),
});

console.log('[TEST-MINIMAL-ROUTER] Loaded');
