import { useEffect, useState } from 'react';

const REQUIRED_ENV = ['VITE_ARDA_API_KEY', 'VITE_API_BASE'];

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
