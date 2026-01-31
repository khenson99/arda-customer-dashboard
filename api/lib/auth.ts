import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple API key guard for serverless routes.
// Accepts header `x-arda-api-key`; compares to ARDA_API_KEY env.

export function requireApiKey(req: VercelRequest, res: VercelResponse): boolean {
  // Trim both values to handle trailing whitespace/newlines in env vars
  const expected = (process.env.ARDA_API_KEY || '').trim();
  const provided = ((req.headers['x-arda-api-key'] as string) || '').trim();

  if (!expected) {
    res.status(500).json({ error: 'Server missing ARDA_API_KEY' });
    return false;
  }

  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

