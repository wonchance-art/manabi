'use client';

/**
 * 홈 알림 덱 (오너 지시 2026-08-24) — 홈의 알림성 진입을 **전부 한 자리에 겹쳐** 두고
 * 옆으로 넘기게 한다. 구성원: 안개 예보 · 교재 이어서 학습 · 다시 읽기 · 함께 읽기.
 *
 * 성격은 색으로 가른다(tone) — 진행(테라코타) · 시간 민감(황금) · 함께(초록).
 * 함께 읽기는 성격이 달라 진행 계열의 빨강을 쓰지 않는다(오너 지시).
 *
 * **높이는 장마다 같다.** 줄 수·칩 유무로 카드가 커졌다 작아지면 넘길 때마다 아래
 * 콘텐츠가 밀린다 — 가장 큰 구성(예보: 제목 2줄 + 단어 칩)에 맞춰 전부 키우고,
 * 제목은 2줄에서 자른다(오너 지시: "전부 다 크기를 키우던지").
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
    <Link
      href={item.href}
      onClick={item.onClick}
      className={`deck-card deck-card--${item.tone || 'progress'}`}
    >
      <span className="deck-card__body">
        <span className="deck-card__kicker">{item.kicker}</span>
        <span className="deck-card__title">{item.title}</span>
        {item.chips?.length > 0 && (
          <span className="deck-card__chips">
            {item.chips.map((c) => <span key={c} className="deck-card__chip">{c}</span>)}
          </span>
        )}
      </span>
      {item.meta && <span className="deck-card__meta">{item.meta}</span>}
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
