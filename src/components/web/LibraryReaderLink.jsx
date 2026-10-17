'use client';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { libraryReaderHref, safeReaderReturn, libraryBrowseReturn, readerReturnLabel, readerReturnTarget } from '@/lib/libraryReturn';
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
  if (viewerWarm) return viewerWarm;
  if (nav?.connection?.saveData) return null;
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
    onPointerDown: (e) => { props.onPointerDown?.(e); stop(); warm(); },
    onFocus: (e) => { props.onFocus?.(e); if (keyboardFocus(e)) warm(); },
  };
}

export function useLibraryReader() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname=usePathname();
  const { user } = useAuth();
  const readerHref = href => libraryReaderHref(href, libraryBrowseReturn(pathname,`?${params}`));
  const openReader = (href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0)) return;
    event?.preventDefault();
    startEarlyMaterial(href, Date.now(), { owner: user?.id ?? null }); // R1 — 뷰어 경로가 아니면 아무것도 하지 않는다
    router.push(libraryReaderHref(href, libraryBrowseReturn(window.location.pathname,window.location.search), window.scrollY));
  };
  return { readerHref, openReader };
}

export default function LibraryReaderLink({ href, children, ...props }) {
  const { readerHref, openReader } = useLibraryReader();
  return <Link {...props} {...viewerWarmProps(href, props)} href={readerHref(href)} onClick={event => openReader(href, event)}>{children}</Link>;
}

// guest = 확인된 손님(로그인 확인이 끝난 뒤) — 맥락 없는 「←」를 산책으로(readerReturnTarget). 회원 · 확인 중은 지금 그대로.
export function LibraryReturnLink({ children, onlyWithContext = false, guest = false, ...props }) {
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const back = safeReaderReturn(returnTo);
  if (onlyWithContext && (!returnTo || (back === '/materials' && returnTo !== '/materials'))) return null;
  const label = readerReturnLabel(back);
  // 라벨 · 맥락 판정은 back(저장 주소) 기준, 이동은 readerReturnTarget(→ readerReturnHref) — 공개 목록은 /materials를 거치지 않고
  // /discover?view=reading으로. 손님 기본 「← 산책」도 children(아이콘)을 그대로 그린다 — 보이는 그림은 바뀌지 않는다.
  const target = readerReturnTarget(returnTo, { guest });
  return <Link {...props} href={target.href}>{target.guestDefault || label === '← 내 서재' ? children || target.label : label}</Link>;
}
