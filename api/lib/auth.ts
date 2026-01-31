import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple API key guard for serverless routes.
// Accepts header `x-arda-api-key`; compares to ARDA_API_KEY env.

export function requireApiKey(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.ARDA_API_KEY;
  const provided = (req.headers['x-arda-api-key'] as string) || '';

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
