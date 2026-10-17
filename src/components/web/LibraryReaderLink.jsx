'use client';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { libraryReaderHref, libraryBrowseReturn } from '@/lib/libraryReturn';
import { useAuth } from '@/lib/AuthContext';
import { startEarlyMaterial, viewerMaterialId } from '@/lib/viewerMaterial';

// 서재 카드 → 뷰어 첫 글자(VIEWER-ENTRY, 2026-10-17 KST 실측 390 · 1440 중앙값 0.68 · 0.73초): 누른 뒤 뷰어 서버 응답 → JS 청크 15개 →
// 그제야 자료 조회가 떠났다. 두 가지를 앞당긴다 — 둘 다 서버 렌더 · 함수 호출을 늘리지 않는다(Next 라우트 prefetch는 보류, (c)).
//   R1 누르는 순간 자료 조회를 띄운다(lib/viewerMaterial 등록부 — 뷰어가 같은 id · 같은 계정이면 받아 쓰고, 아니면 새로 받는다).
//   R2 마우스가 머물거나(80ms — intent-prefetch 선례) · 누르거나 · 키보드 포커스가 오면 뷰어 모듈만 미리 받는다 — 동적 import 한 곳, JS 청크만.
export const VIEWER_WARM_DWELL_MS = 80;
let viewerWarm = null;
/** 뷰어 모듈을 한 번만 미리 받는다(실패하면 다음 기회에 다시). 데이터 절약 모드는 받지 않는다. */
export function warmViewer({ load = () => import('@/views/ViewerPage'), nav = globalThis.navigator } = {}) {
  if (nav?.connection?.saveData) return null;
  if (viewerWarm) return viewerWarm;
  viewerWarm = Promise.resolve().then(load).catch(() => { viewerWarm = null; });
  return viewerWarm;
}
const warmTimers = new Map(); // href → 머묾 타이머
const keyboardFocus = (e) => { try { return !!e?.currentTarget?.matches?.(':focus-visible'); } catch { return false; } };
/** 뷰어로 가는 링크에만 붙는 미리 받기 이벤트(그 밖의 링크는 빈 객체). 받은 이벤트 처리기(props)는 그대로 부른다. */
export function viewerWarmProps(href, props = {}, { warm = warmViewer, dwellMs = VIEWER_WARM_DWELL_MS, schedule = setTimeout, cancel = clearTimeout, timers = warmTimers } = {}) {
  if (!viewerMaterialId(href)) return {};
  const stop = () => { const t = timers.get(href); if (t != null) { cancel(t); timers.delete(href); } };
  return {
    onPointerEnter: (e) => { props.onPointerEnter?.(e); if (e?.pointerType === 'touch') return; stop(); timers.set(href, schedule(() => { timers.delete(href); warm(); }, dwellMs)); },
    onPointerLeave: (e) => { props.onPointerLeave?.(e); stop(); },
    // 터치는 누름(pointerdown)에 받지 않는다 — 스크롤 시작도 pointerdown이다. 터치는 실제 누름(click → openReader)에 받는다.
    onPointerDown: (e) => { props.onPointerDown?.(e); stop(); if (e?.pointerType !== 'touch') warm(); },
    onFocus: (e) => { props.onFocus?.(e); if (keyboardFocus(e)) warm(); },
  };
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
  return { readerHref, openReader };
}

export default function LibraryReaderLink({ href, children, ...props }) {
  const { readerHref, openReader } = useLibraryReader();
  return <Link {...props} {...viewerWarmProps(href, props)} href={readerHref(href)} onClick={event => openReader(href, event)}>{children}</Link>;
}

// 「← 돌아가기」 링크는 따로 둔다(LibraryReturnLink.jsx) — 일본어 교재(SC 글꼴 범위 밖)가 이 파일을 불러오면 R2의 뷰어 동적 import까지
// 그래프로 닿는다(fontScope.test ②). 예전 import 경로는 그대로 쓰게 다시 내보낸다.
export { LibraryReturnLink } from './LibraryReturnLink';
