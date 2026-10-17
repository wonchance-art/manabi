'use client';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { libraryReaderHref, libraryBrowseReturn } from '@/lib/libraryReturn';
import { useAuth } from '@/lib/AuthContext';
import { startEarlyMaterial, viewerMaterialId } from '@/lib/viewerMaterial';
import { intentPrefetchProps } from '@/lib/intentPrefetch';

// 서재 카드 → 뷰어 첫 글자(VIEWER-ENTRY, 2026-10-17 KST 실측 390 · 1440 중앙값 0.68 · 0.73초): 누른 뒤 뷰어 서버 응답 → JS 청크 15개 →
// 그제야 자료 조회가 떠났다. 두 가지를 앞당긴다 — 둘 다 서버 렌더 · 함수 호출을 늘리지 않는다.
//   R1 누르는 순간 자료 조회를 띄운다(lib/viewerMaterial 등록부 — 뷰어가 같은 id · 같은 계정이면 받아 쓰고, 아니면 새로 받는다).
//   R2 마우스가 머물거나(80ms) · 키보드 포커스가 오면(판정은 intentPrefetchProps 그대로) · 마우스로 누르면 뷰어 모듈만 미리 받는다 —
//      동적 import 한 곳, JS 청크만. 터치는 누름(pointerdown — 스크롤 시작일 수 있다)이 아니라 실제 누름(click → openReader)에.
// (c) 행 Link의 화면 진입 자동 prefetch는 끈다(prefetch={false}): 화면에 들어온 행마다 서버 렌더가 생기고, 그 응답(no-store)이 서재를
//   bfcache에서 뺐다(BFCACHE-A-001과 같은 원인). 첫 글자 이득은 없었다 — 전체 응답은 어차피 누를 때 받고, 페이지 JS는 prefetch에 없다.
//   대신 의도 시점에만 router.prefetch(auto — 대기 화면까지)를 건다(배움 · 산책과 같은 intentPrefetchProps — 터치 제외 · 누름에 취소).
let viewerWarm = null;
/** 뷰어 모듈을 한 번만 미리 받는다(실패하면 다음 기회에 다시). 데이터 절약 모드는 받지 않는다. */
export function warmViewer({ load = () => import('@/views/ViewerPage'), nav = globalThis.navigator } = {}) {
  if (nav?.connection?.saveData) return null;
  if (viewerWarm) return viewerWarm;
  viewerWarm = Promise.resolve().then(load).catch(() => { viewerWarm = null; });
  return viewerWarm;
}
const warmTimers = new Map(); // href → 머묾 타이머(라우트 prefetch 타이머와 따로)
/** R2 — 뷰어로 가는 링크에만(그 밖은 빈 객체): 의도(intentPrefetchProps의 머묾 · 키보드 포커스 판정 그대로)와 마우스 누름에 뷰어 모듈을 받는다. */
export function viewerWarmProps(href, { warm = warmViewer, ...intentOptions } = {}) {
  if (!viewerMaterialId(href)) return {};
  const intent = intentPrefetchProps(null, { href, intentPrefetch: true }, false, { timers: warmTimers, ...intentOptions, prefetch: () => warm() });
  // 터치는 누름(pointerdown)에 받지 않는다 — 스크롤 시작도 pointerdown이다. 터치는 실제 누름(click → openReader)에 받는다.
  return { ...intent, onPointerDown: (e) => { intent.onPointerDown(e); if (e?.pointerType !== 'touch') warm(); } };
}
const INTENT_EVENTS = ['onPointerEnter', 'onPointerLeave', 'onPointerDown', 'onFocus'];
/** 받은 처리기 · R2 · 라우트 의도 prefetch를 차례로 부르는 하나의 처리기 묶음(판정은 각자 — 여기서는 잇기만). */
export function chainHandlers(...sets) {
  const out = {};
  for (const name of INTENT_EVENTS) {
    const fns = sets.map(set => set?.[name]).filter(Boolean);
    if (fns.length) out[name] = (e) => { for (const fn of fns) fn(e); };
  }
  return out;
}

export function useLibraryReader() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname=usePathname();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const readerHref = href => libraryReaderHref(href, libraryBrowseReturn(pathname,`?${params}`));
  const openReader = (href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0)) return;
    event?.preventDefault();
    const materialId = viewerMaterialId(href);
    if (materialId) {
      warmViewer(); // R2 — 터치는 여기서(실제 누름) 받는다. 이미 받았으면 그대로
      // R1 — 이 자료가 캐시에 있으면(다시 누름) 띄우지 않는다: 뷰어는 캐시가 빈 첫 조회에서만 등록부를 쓰니 띄워도 고아가 된다.
      if (queryClient.getQueryData(['material', materialId]) === undefined) startEarlyMaterial(href, Date.now(), { owner: user?.id ?? null });
    }
    router.push(libraryReaderHref(href, libraryBrowseReturn(window.location.pathname,window.location.search), window.scrollY));
  };
  return { readerHref, openReader, router };
}

export default function LibraryReaderLink({ href, children, prefetch = false, ...props }) {
  const { readerHref, openReader, router } = useLibraryReader();
  const target = readerHref(href);
  const routeIntent = prefetch === false ? intentPrefetchProps(router, { href: target, intentPrefetch: true }, false) : null;
  return <Link {...props} {...chainHandlers(props, viewerWarmProps(href), routeIntent)} prefetch={prefetch} href={target} onClick={event => openReader(href, event)}>{children}</Link>;
}

// 「← 돌아가기」 링크는 따로 둔다(LibraryReturnLink.jsx) — 일본어 교재(SC 글꼴 범위 밖)가 이 파일을 불러오면 R2의 뷰어 동적 import까지
// 그래프로 닿는다(fontScope.test ②). 예전 import 경로는 그대로 쓰게 다시 내보낸다.
export { LibraryReturnLink } from './LibraryReturnLink';
