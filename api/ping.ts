import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  try {
    return res.status(200).json({
      ok: true,
      message: 'pong',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ ok: false, message });
  }
}
