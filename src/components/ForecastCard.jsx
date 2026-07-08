'use client';

import Link from 'next/link';

/**
 * 망각 예보 위젯 — FSRS retrievability(src/lib/forecast.js)를 날씨 은유로 노출한다.
 * (docs/plan-v3-living-serial.md §3-A)
 *
 * 원칙:
 * - count === 0(또는 forecast 없음)이면 완전히 침묵한다 — 렌더 자체를 하지 않는다.
 *   로딩 스켈레톤도 없다(데이터가 없으면 그냥 안 보이는 게 자연스럽다).
 * - 죄책감 프레임 금지: 퍼센트·숫자 확률 노출 없음, "밀림/실패/해야" 어휘 없음,
 *   날씨 은유만 쓴다. count(개수)는 노출하되 "N개나 밀렸어요" 식이 아니라
 *   "N개가 흐려져요"처럼 담백한 정보로만 전달한다.
 * - 인용부호로 감싼 외국어 단어(일본어/영어/프랑스어/중국어 혼용) 뒤에 조사가 바로
 *   붙지 않도록("約束가"처럼 받침 불일치 위험) "하나가"/"외 N개가"처럼 고유어
 *   수량사에 조사를 붙이는 구조로 우회한다.
 */
export default function ForecastCard({ forecast }) {
  if (!forecast || forecast.count === 0 || !forecast.top3?.length) return null;

  const { count, top3 } = forecast;
  const headline = count === 1
    ? `'${top3[0].word_text}' 하나가 흐려져요`
    : `'${top3[0].word_text}' 외 ${count - 1}개가 흐려져요`;

  return (
    <Link href="/study" className="forecast-card">
      <span className="forecast-card__icon" aria-hidden="true">🌫</span>
      <span className="forecast-card__body">
        <span className="forecast-card__kicker">오늘 안개 예보</span>
        <span className="forecast-card__title">{headline}. 3분이면 붙잡아요.</span>
        <span className="forecast-card__words">
          {top3.map(w => (
            <span key={w.word_text} className="forecast-card__word">{w.word_text}</span>
          ))}
        </span>
      </span>
    </Link>
  );
}
