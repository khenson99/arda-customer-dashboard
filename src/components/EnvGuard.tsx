import { useEffect, useState } from 'react';

// Only guard for client‑side configuration that cannot fall back at runtime.
// API keys should be provided at runtime (e.g., localStorage) to avoid bundling secrets.
const REQUIRED_ENV: string[] = [];

export function EnvGuard() {
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    const absent = REQUIRED_ENV.filter((key) => !import.meta.env[key]);
    setMissing(absent);
  }, []);

  if (missing.length === 0) return null;

  return (
    <div className="env-guard">
      <div className="env-guard__content">
        <strong>Configuration required:</strong> Missing {missing.join(', ')}.  
        Set them in your environment or .env.* files before deploying.
      </div>
    </div>
  );
}
