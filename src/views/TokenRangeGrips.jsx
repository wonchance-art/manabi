'use client';
// 지정 범위 양끝 그립 — OS 텍스트 선택 핸들의 인앱 버전(P3, 오너 승인). 확정된 범위의
// 시작·끝 토큰 가장자리에 앉아, 잡아 끌면 범위를 미세 조정하고 놓으면 재분석한다
// (무변경 릴리스는 훅이 재분석을 생략). 좌표는 reader 컨테이너 기준 절대 배치라
// 페이지 스크롤과 무관하고, 리사이즈·폰트 변경 때 재측정한다.
// 모양(RANGE-GRIP-BAR-001 — 오너 사진 · 승인 2026-11-02 KST): OS 선택 핸들처럼 세로 막대 + 점. 시작 = 첫 토큰 왼쪽 끝 막대 + 위 점,
// 끝 = 마지막 토큰 오른쪽 끝 막대 + 아래 점. 막대 높이 = 고른 띠(.surface::before) 높이. 예전 모양(두 점이 다 토큰 아래)은
// 어디가 시작인지 덜 분명했다.
import { useLayoutEffect, useState } from 'react';
import { overlayOrigin } from '../lib/usePagedReader';

// 그립은 28px 터치 타깃의 가운데(margin-left -14px, index.css .range-grip)를 토큰 끝에 맞춘다. 막대는 타깃을 화면 안으로 민 만큼
// 반대로 옮겨(--grip-bar-x) 토큰 끝에 그대로 선다. 좁은 화면은 본문 안쪽 여백이
// 12px이라 첫 토큰이 줄 머리에 오면 시작 그립이 화면 밖으로 2px 나간다 — 타깃 전체가 화면 안에 남도록 x를 화면 폭 안으로 민다.
export const GRIP_HALF = 14;
export function clampGripX(x, originLeft, viewportWidth) {
  if (!Number.isFinite(viewportWidth) || viewportWidth < GRIP_HALF * 2) return x;
  return Math.min(Math.max(x, GRIP_HALF - originLeft), viewportWidth - GRIP_HALF - originLeft);
}

/** 막대 · 점 여유 — 막대 위아래로 이만큼 타깃을 늘린다(점 12px이 막대 끝에 2px 겹쳐 앉는다 · index.css). */
export const GRIP_PAD = 14;

/** 토큰의 띠(.surface::before) 세로 자리 — 계산값이 없으면 토큰 상자 전체. */
export function bandBox(el) {
  const surface = el.querySelector?.('.surface') || el;
  const rect = surface.getBoundingClientRect();
  const band = typeof getComputedStyle === 'function' ? getComputedStyle(surface, '::before') : null;
  const top = parseFloat(band?.top), height = parseFloat(band?.height);
  return Number.isFinite(top) && Number.isFinite(height) && height > 0
    ? { top: rect.top + top, height }
    : { top: rect.top, height: rect.height };
}

/** 그립 하나의 자리 — 막대 x(기준 상자 기준)를 화면 안 타깃 가운데로 바꾸고, 막대는 그 차이만큼 타깃 안에서 옮긴다. */
export function gripPlacement(barX, band, originLeft, originTop, viewportWidth) {
  const x = clampGripX(barX, originLeft, viewportWidth);
  return { x, barOffset: GRIP_HALF + (barX - x), top: band.top - originTop - GRIP_PAD, height: band.height + GRIP_PAD * 2, bar: band.height };
}

export default function TokenRangeGrips({ range, sequence, tokenRefs, readerRef, onGripDown }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!range || !sequence) { setPos(null); return; }
    const measure = () => {
      const startEl = tokenRefs.current?.[sequence[range.start]];
      const endEl = tokenRefs.current?.[sequence[range.end]];
      const reader = readerRef.current;
      if (!startEl || !endEl || !reader) { setPos(null); return; }
      const r = overlayOrigin(reader); // 쪽 넘김 보기는 다단 상자가 기준(본문 영역은 단마다 쪼개진다)
      const s = startEl.getBoundingClientRect();
      const e = endEl.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      setPos({
        start: gripPlacement(s.left - r.left, bandBox(startEl), r.left, r.top, width),
        end: gripPlacement(e.right - r.left, bandBox(endEl), r.left, r.top, width),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [range, sequence, tokenRefs, readerRef]);

  if (!pos) return null;
  const style = (g) => ({ left: g.x, top: g.top, height: g.height, '--grip-bar-x': `${g.barOffset}px`, '--grip-bar-h': `${g.bar}px` });
  return (
    <>
      <button
        type="button"
        className="range-grip range-grip--start"
        aria-label="지정 시작점 조정"
        style={style(pos.start)}
        onPointerDown={(e) => onGripDown('start', e)}
      />
      <button
        type="button"
        className="range-grip range-grip--end"
        aria-label="지정 끝점 조정"
        style={style(pos.end)}
        onPointerDown={(e) => onGripDown('end', e)}
      />
    </>
  );
}
