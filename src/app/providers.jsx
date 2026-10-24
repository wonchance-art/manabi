'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/AuthContext';
import { ToastProvider } from '@/lib/ToastContext';
import { useRouter } from 'next/navigation';
import SpeechUnavailableNotice from '@/components/SpeechUnavailableNotice';
import { useState } from 'react';
import { QUERY_CLIENT_DEFAULTS } from '@/lib/queryClientDefaults';

export default function Providers({ children }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      // 쓰기는 끊겨도 바로 시도한다 — 기기 보관함 · 실패 알림이 그 자리에서 돈다(queryClientDefaults.js).
      new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SpeechUnavailableNotice />
        {/* 계정이 바뀌면 캐시(queryClient)와 서버 렌더(router.refresh)를 같은 관문에서 버린다(AUTH-ROUTER-REFRESH-001). */}
        <AuthProvider queryClient={queryClient} onAccountLeft={() => router.refresh()}>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
