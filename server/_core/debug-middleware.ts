/**
 * Debug Middleware - Log raw incoming requests
 */

import { Request, Response, NextFunction } from 'express';

export function debugMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only log tRPC requests
  if (!req.path.startsWith('/api/trpc')) {
    return next();
  }

  console.log('\n[DEBUG-MIDDLEWARE] Incoming tRPC Request');
  console.log('  Method:', req.method);
  console.log('  Path:', req.path);
  console.log('  URL:', req.url);
  console.log('  Content-Type:', req.get('content-type'));
  console.log('  Content-Length:', req.get('content-length'));
  
  // Log body if available
  if (req.body) {
    console.log('  Body (parsed):', JSON.stringify(req.body, null, 2));
  } else {
    console.log('  Body: (not parsed yet)');
  }

  // Log query string
  if (Object.keys(req.query).length > 0) {
    console.log('  Query:', req.query);
  }

  next();
}
