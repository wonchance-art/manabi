'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/AuthContext';
import { ToastProvider } from '@/lib/ToastContext';
import { useRouter } from 'next/navigation';
import SpeechUnavailableNotice from '@/components/SpeechUnavailableNotice';
import { useEffect, useState } from 'react';
import { installGlobalErrorHooks } from '@/lib/reportError';
import ClsReporter from '@/components/observe/ClsReporter';
import { QUERY_CLIENT_DEFAULTS } from '@/lib/queryClientDefaults';

export default function Providers({ children }) {
  const router = useRouter();
  // 전역 오류(window error · unhandledrejection) 기록 — 한 번만 건다(ERROR-OBSERVE-001). 서버 렌더에서는 돌지 않는다.
  useEffect(() => { installGlobalErrorHooks(); }, []);
  const [queryClient] = useState(
    () =>
      // 쓰기는 끊겨도 바로 시도한다 — 기기 보관함 · 실패 알림이 그 자리에서 돈다(queryClientDefaults.js).
      new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SpeechUnavailableNotice />
        {/* 실사용자 화면 밀림 기록(RUM-CLS-001) — 0.1 초과 방문만 · 그리는 것 없음 */}
        <ClsReporter />
        {/* 계정이 바뀌면 캐시(queryClient)와 서버 렌더(router.refresh)를 같은 관문에서 버린다(AUTH-ROUTER-REFRESH-001). */}
        <AuthProvider queryClient={queryClient} onAccountLeft={() => router.refresh()}>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
