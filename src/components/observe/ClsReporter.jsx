'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { installClsReporter } from '@/lib/clsReport';

/**
 * 실사용자 화면 밀림 기록(RUM-CLS-001) — CLS 0.1 초과 방문만 /api/vitals로. 경로마다 따로 세서 앱 안 이동 때 앞 경로 몫을 보낸다.
 * 따로 떼어 둔 부품이다: Providers가 경로를 구독하면 경로가 바뀔 때마다 그 아래 제공자들이 다시 그려진다. 그리는 것은 없다. 운영 빌드에서만 건다.
 */
export default function ClsReporter() {
  const pathname = usePathname();
  const routeChanged = useRef(null);
  useEffect(() => { if (process.env.NODE_ENV === 'production') routeChanged.current = installClsReporter(); }, []);
  useEffect(() => { routeChanged.current?.(pathname); }, [pathname]);
  return null;
}
