'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/AuthContext';
import { ToastProvider } from '@/lib/ToastContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Providers({ children }) {
  const router = useRouter();
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
        {/* 계정이 바뀌면 캐시(queryClient)와 서버 렌더(router.refresh)를 같은 관문에서 버린다(AUTH-ROUTER-REFRESH-001). */}
        <AuthProvider queryClient={queryClient} onAccountLeft={() => router.refresh()}>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
