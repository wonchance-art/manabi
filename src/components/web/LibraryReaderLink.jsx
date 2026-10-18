'use client';
import { useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { libraryReaderHref, libraryBrowseReturn } from '@/lib/libraryReturn';
import { startEarlyMaterial, viewerMaterialId } from '@/lib/viewerMaterial';
import { intentPrefetchProps } from '@/lib/intentPrefetch';

// 서재 카드 → 뷰어 첫 글자(VIEWER-ENTRY, 2026-10-17 KST 실측 390 · 1440 중앙값 0.68 · 0.73초): 누른 뒤 뷰어 서버 응답 → JS 청크 15개 →
// 그제야 자료 조회가 떠났다. 누르는 순간 자료 조회를 띄운다(R1 — lib/viewerMaterial 등록부: 뷰어가 같은 id · 같은 계정이면 받아 쓰고,
// 아니면 새로 받는다). 서버 렌더 · 함수 호출은 늘리지 않는다.
// R2(머묾 · 누름에 뷰어 모듈 동적 import)는 뺐다(2026-10-18 KST 실측): 받은 20개 중 3개 청크(9.4KB gz)는 뷰어 경로 청크가 아니었고,
//   그 안 모듈 14개(8.7KB gz)가 이동 때 받는 뷰어 page 청크에 다시 실렸다(같은 모듈 두 청크). 첫 글자 이득도 잡음 안이었다.
//   뷰어 모듈을 미리 받으려면 경로 청크 그대로(라우터) 받아야 한다 — 이 파일에서 동적 import를 다시 쓰지 않는다(viewerEntryWarm 계약).
// (c) 행 Link의 화면 진입 자동 prefetch는 끈다(prefetch={false}): 화면에 들어온 행마다 서버 렌더가 생겼다(2026-10-18 KST 실측 — 40행
//   서재 방문 1회에 40건 → 의도 시점 6~7건). 첫 글자 · 느린 서버(1.2초)의 대기 화면은 전후 차이가 잡음 안이었다 — 전체 응답은 어차피
//   누를 때 받고, 페이지 JS는 prefetch에 없다. 서재 bfcache는 이것과 무관하다: 서재 문서 자체가 no-store라 prefetch를 꺼도 복원되지 않는다.
//   대신 의도 시점에만 router.prefetch(auto — 대기 화면까지)를 건다(배움 · 산책과 같은 intentPrefetchProps — 터치 제외 · 누름에 취소).
// 대기 표시(LIBRARY-PENDING-001, 2026-10-18 KST): 느린 서버(1.2초)에서 누른 뒤 응답까지 화면이 그대로라 눌렸는지 알 수 없었다.
//   누른 링크에 탭과 같은 대기 밑줄(APP-FEEL-003 .nav-pending — 100ms 지연 · 동작 줄이기 정지)을 둔다. 탭의 useLinkStatus는 쓸 수 없다 —
//   여기는 누를 때 restoreY를 붙여 router.push로 옮기는데, router.push는 Link 대기 상태를 잇지 않는다(setLinkForCurrentNavigation(null)).
//   그래서 router.push를 useTransition으로 감싸 이동이 끝날(새 화면이 붙을) 때까지 pending을 받는다. 대기 중 같은 곳을 또 누르면 무시한다
//   (같은 뷰어 기록이 두 줄 쌓이지 않게) · 다른 곳은 바로 간다(마음을 바꿈) · 수정키 · 새 탭은 브라우저 몫이라 표시도 없다.
const INTENT_EVENTS = ['onPointerEnter', 'onPointerLeave', 'onPointerDown', 'onFocus'];
/** 받은 처리기 · 라우트 의도 prefetch를 차례로 부르는 하나의 처리기 묶음(판정은 intentPrefetchProps — 여기서는 잇기만). */
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
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const pendingHref = useRef(null);
  const readerHref = href => libraryReaderHref(href, libraryBrowseReturn(pathname,`?${params}`));
  const openReader = (href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0)) return;
    event?.preventDefault();
    if (pending && pendingHref.current === href) return; // 대기 중 같은 곳 다시 누름 — 무시
    pendingHref.current = href;
    const materialId = viewerMaterialId(href);
    if (materialId) {
      // R1 — 이 자료가 캐시에 있으면(다시 누름) 띄우지 않는다: 뷰어는 캐시가 빈 첫 조회에서만 등록부를 쓰니 띄워도 고아가 된다.
      if (queryClient.getQueryData(['material', materialId]) === undefined) startEarlyMaterial(href, Date.now()); // 계정 = 화면 계정(knownAccount — 등록부 기본값)
    }
    const next = libraryReaderHref(href, libraryBrowseReturn(window.location.pathname,window.location.search), window.scrollY);
    startTransition(() => router.push(next));
  };
  return { readerHref, openReader, router, pending: pending ? pendingHref.current : null };
}

export default function LibraryReaderLink({ href, children, prefetch = false, ...props }) {
  const { readerHref, openReader, router, pending } = useLibraryReader();
  const target = readerHref(href);
  const routeIntent = prefetch === false ? intentPrefetchProps(router, { href: target, intentPrefetch: true }, false) : null;
  return <Link {...props} {...chainHandlers(props, routeIntent)} prefetch={prefetch} href={target} onClick={event => openReader(href, event)}>
    {children}<span className="nav-pending nav-pending--reader" data-pending={pending === href || undefined} aria-hidden="true" />
  </Link>;
}

// 「← 돌아가기」 링크는 따로 둔다(LibraryReturnLink.jsx) — 교재 · 뷰어 「←」가 서재 카드의 조기 조회 · 의도 prefetch까지 끌지 않게.
// 예전 import 경로는 그대로 쓰게 다시 내보낸다.
export { LibraryReturnLink } from './LibraryReturnLink';
