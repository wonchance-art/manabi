'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/AuthContext';
import { ToastProvider } from '@/lib/ToastContext';
import { CelebrationProvider } from '@/lib/CelebrationContext';
import { useState } from 'react';

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 1000 * 60 * 2, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CelebrationProvider>
          <AuthProvider>{children}</AuthProvider>
        </CelebrationProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
