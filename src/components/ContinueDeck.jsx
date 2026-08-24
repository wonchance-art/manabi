'use client';

/**
 * '이어서' 덱 (오너 지시 2026-08-24) — 하던 걸 이어서 하는 진입들을 **한 자리에서 옆으로
 * 넘기게** 모은다. 지금 구성원은 교재 이어서 학습·다시 읽기 둘.
 *
 * 넘기기는 CSS scroll-snap이다(라이브러리 0). 관성 스크롤·키보드 이동·터치 감을 브라우저가
 * 이미 제대로 하는데, 2~3장에 자동재생도 무한루프도 없는 요구에 캐러셀 라이브러리를 들이면
 * 안 쓸 기능값만 문다(embla ~5kB·swiper ~40kB 배제 — 조사 근거는 보드).
 *
 * 카드가 하나면 캐러셀 옷을 벗는다 — 넘길 게 없는데 점과 걸침을 보이면 거짓 신호다.
 * 다만 **구조는 한 갈래로 유지하고 폭·점만 바꾼다**. 단독일 때 다른 트리를 그리면 항목이
 * 1→2로 늘 때(교재 카드가 늦게 붙는 실제 경로) React가 카드를 갈아끼워 화면이 한 번 튀고,
 * 방금 그린 노드를 잡고 있던 쪽은 detach된 노드를 보게 된다(e2e에서 실측).
 */
import { useRef, useState } from 'react';
import Link from 'next/link';

function ContinueRow({ item }) {
  return (
    <Link href={item.href} className="lessons-continue">
      <span className="lessons-continue__body">
        <span className="lessons-continue__kicker">{item.kicker}</span>
        <span className="lessons-continue__title">{item.title}</span>
      </span>
      <span className="lessons-continue__meta">{item.meta}</span>
    </Link>
  );
}

export default function ContinueDeck({ items }) {
  const list = (items || []).filter(Boolean);
  const scrollerRef = useRef(null);
  const [active, setActive] = useState(0);

  if (list.length === 0) return null;
  const solo = list.length === 1;

  const goTo = (i) => {
    const el = scrollerRef.current?.children?.[i];
    if (!el) return;
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
  };

  // 활성 장은 스크롤 위치에서 역산한다(별도 상태 동기화 없이 스크롤이 진실).
  const onScroll = (e) => {
    const el = e.currentTarget;
    const first = el.children?.[0];
    const step = first ? first.getBoundingClientRect().width + 8 : el.clientWidth;
    const i = Math.round(el.scrollLeft / Math.max(step, 1));
    setActive(Math.min(Math.max(i, 0), list.length - 1));
  };

  return (
    <div className={`continue-deck${solo ? ' continue-deck--solo' : ''}`}>
      <div className="continue-deck__scroller" ref={scrollerRef} onScroll={solo ? undefined : onScroll}>
        {list.map((item) => (
          <div className="continue-deck__slide" key={item.key}>
            <ContinueRow item={item} />
          </div>
        ))}
      </div>
      {!solo && <div className="continue-deck__dots">
        {list.map((item, i) => (
          <button
            key={item.key}
            type="button"
            className={`continue-deck__dot ${i === active ? 'continue-deck__dot--on' : ''}`}
            aria-label={`${i + 1}번째 카드 보기`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </div>}
    </div>
  );
}
