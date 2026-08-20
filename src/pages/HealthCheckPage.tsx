import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Status = 'checking' | 'ok' | 'error';

export function HealthCheckPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiClient
      .get('/')
      .then((res) => {
        setStatus('ok');
        setMessage(typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Unknown error');
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 dark:bg-neutral-900">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        CCWP — stack check
      </h1>
      <div
        className={
          status === 'ok'
            ? 'rounded-md bg-green-100 px-4 py-2 text-green-800'
            : status === 'error'
              ? 'rounded-md bg-red-100 px-4 py-2 text-red-800'
              : 'rounded-md bg-neutral-200 px-4 py-2 text-neutral-700'
        }
      >
        {status === 'checking' && 'Checking backend...'}
        {status === 'ok' && `Backend reachable: ${message}`}
        {status === 'error' && `Backend unreachable: ${message}`}
      </div>
    </div>
  );
}
