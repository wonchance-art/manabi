'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// 같은 경로에서 검색어만 바꾸는 router.replace가 가끔 끝내 반영되지 않는다(Next 15.5 — navigate · server-patch 두 액션이
// 모두 끝나고 RSC도 200인데 React가 그 전환을 commit하지 않는다. 다시 보내면 바로 반영된다. 서재 즐겨찾기 e2e flake 실측
// 2026-10-17 KST, 약 8–10%). 보낸 주소가 정해진 시간 안에 주소창에 닿지 않으면 같은 replace를 다시 보낸다(최대 retries번).
// 더 새 목표가 오면 · 화면이 사라지면 · 사용자가 다른 곳으로 옮기면(주소가 보낼 때와도 목표와도 다르면) 멈춘다.
export const COMMIT_CHECK_MS = 1500;
export const COMMIT_RETRIES = 2;

const normalize = (href, origin = 'http://x') => { const url = new URL(href, origin); return url.pathname + url.search; };

/** 순수 핵심 — 타이머 · 현재 주소 · replace를 주입받는다(계약 테스트 committedReplace.test.js). */
export function createCommittedReplace({ replace, current, setTimer = setTimeout, clearTimer = clearTimeout, wait = COMMIT_CHECK_MS, retries = COMMIT_RETRIES }) {
  let pending = null;
  const cancel = () => { if (pending) clearTimer(pending.timer); pending = null; };
  const check = () => {
    if (!pending) return;
    const now = normalize(current());
    if (now === pending.href) { pending = null; return; } // 반영됐다
    if (now !== pending.from || pending.left <= 0) { pending = null; return; } // 다른 곳으로 옮겼거나 다 썼다 — 덮어쓰지 않는다
    pending.left -= 1;
    replace(pending.target, pending.options);
    pending.timer = setTimer(check, wait);
  };
  return {
    replace(target, options) {
      cancel();
      pending = { target, options, href: normalize(target), from: normalize(current()), left: retries, timer: null };
      replace(target, options);
      pending.timer = setTimer(check, wait);
    },
    cancel,
  };
}

/** 같은 경로 · 검색어만 바꾸는 이동 — router.replace와 같은 모양으로 쓰고, 반영되지 않으면 다시 보낸다. 화면이 사라지면 멈춘다. */
export function useCommittedReplace() {
  const router = useRouter();
  const routerRef = useRef(router); routerRef.current = router;
  const box = useRef(null);
  if (!box.current) {
    box.current = createCommittedReplace({
      replace: (target, options) => routerRef.current.replace(target, options),
      current: () => window.location.pathname + window.location.search,
    });
  }
  useEffect(() => () => box.current.cancel(), []);
  return box.current.replace;
}
