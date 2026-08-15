'use client';
// 지정 범위 양끝 그립 — OS 텍스트 선택 핸들의 인앱 버전(P3, 오너 승인). 확정된 범위의
// 시작·끝 토큰 아래에 앉아, 잡아 끌면 범위를 미세 조정하고 놓으면 재분석한다
// (무변경 릴리스는 훅이 재분석을 생략). 좌표는 reader 컨테이너 기준 절대 배치라
// 페이지 스크롤과 무관하고, 리사이즈·폰트 변경 때 재측정한다.
import { useLayoutEffect, useState } from 'react';

export default function TokenRangeGrips({ range, sequence, tokenRefs, readerRef, onGripDown }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!range || !sequence) { setPos(null); return; }
    const measure = () => {
      const startEl = tokenRefs.current?.[sequence[range.start]];
      const endEl = tokenRefs.current?.[sequence[range.end]];
      const reader = readerRef.current;
      if (!startEl || !endEl || !reader) { setPos(null); return; }
      const r = reader.getBoundingClientRect();
      const s = startEl.getBoundingClientRect();
      const e = endEl.getBoundingClientRect();
      setPos({
        start: { x: s.left - r.left, y: s.bottom - r.top },
        end: { x: e.right - r.left, y: e.bottom - r.top },
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [range, sequence, tokenRefs, readerRef]);

  if (!pos) return null;
  return (
    <>
      <button
        type="button"
        className="range-grip"
        aria-label="지정 시작점 조정"
        style={{ left: pos.start.x, top: pos.start.y }}
        onPointerDown={(e) => onGripDown('start', e)}
      />
      <button
        type="button"
        className="range-grip"
        aria-label="지정 끝점 조정"
        style={{ left: pos.end.x, top: pos.end.y }}
        onPointerDown={(e) => onGripDown('end', e)}
      />
    </>
  );
}
