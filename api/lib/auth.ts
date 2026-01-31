import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple API key guard for serverless routes.
// Accepts header `x-arda-api-key`; compares to ARDA_API_KEY env.

export function requireApiKey(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.ARDA_API_KEY;
  const provided = (req.headers['x-arda-api-key'] as string) || '';

  // Temporary debug logging
  console.log('[Auth Debug] Expected key length:', expected?.length, 'chars');
  console.log('[Auth Debug] Provided key length:', provided.length, 'chars');
  console.log('[Auth Debug] Expected prefix:', expected?.slice(0, 12));
  console.log('[Auth Debug] Provided prefix:', provided.slice(0, 12));
  console.log('[Auth Debug] Keys match:', provided === expected);

  if (!expected) {
    res.status(500).json({ error: 'Server missing ARDA_API_KEY' });
    return false;
  }

  if (provided !== expected) {
    console.log('[Auth Debug] Key mismatch - expected vs provided:');
    console.log('[Auth Debug]   Expected:', expected);
    console.log('[Auth Debug]   Provided:', provided);
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

