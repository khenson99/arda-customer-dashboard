/**
 * Ping API Endpoint - Health Check
 * 
 * GET /api/ping
 * 
 * Simple health check endpoint for API connectivity verification.
 * Returns 200 OK if the API is reachable.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple ping response - no auth required for health checks
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'arda-customer-dashboard',
  });
}
