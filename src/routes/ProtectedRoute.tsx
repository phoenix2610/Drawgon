import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { DrawgonLoader } from '@/components/DrawgonLoader';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();

  if (isPending) {
    return <DrawgonLoader />;
  }

  if (!data) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
