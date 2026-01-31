import { httpRequest } from './http';

type HealthResult = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
};

export async function checkApiHealth(): Promise<HealthResult> {
  const start = performance.now();
  try {
    // Prefer lightweight edge ping if available
    await httpRequest(`/ping`, { timeoutMs: 5_000, retries: 0 });
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export function envSummary() {
  return {
    apiBasePresent: Boolean(import.meta.env.VITE_API_BASE),
    apiKeyPresent: Boolean(import.meta.env.VITE_ARDA_API_KEY || localStorage.getItem('arda_api_key')),
    // Author always has a default value in arda-client.ts
    authorSet: true,
  };
}
