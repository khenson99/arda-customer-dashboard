const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  // Require an absolute API base in production to avoid accidental relative fetches
  if (import.meta.env.PROD && !API_BASE.startsWith('http')) {
    throw new Error('VITE_API_BASE must be an absolute URL in production');
  }

  const base = API_BASE.startsWith('http') ? API_BASE : `${ORIGIN}${API_BASE}`;
  const cleanedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(cleanedPath, cleanedBase).toString();
}

interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  timeoutMs?: number;
  retries?: number;
}

export class HttpError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function attempt<T>(url: string, options: HttpOptions, attemptNo: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new HttpError(
        `HTTP ${response.status} ${response.statusText}`,
        response.status,
        text
      );
      throw error;
    }

    // Assume JSON responses for API calls
    return (await response.json()) as T;
  } catch (err) {
    // Retry on network/timeout/5xx
    const retriable =
      err instanceof HttpError ? err.status && err.status >= 500 : true;
    const maxRetries = options.retries ?? DEFAULT_RETRIES;
    if (retriable && attemptNo < maxRetries) {
      return attempt<T>(url, options, attemptNo + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpRequest<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const url = resolveUrl(path);
  return attempt<T>(url, options, 0);
}
