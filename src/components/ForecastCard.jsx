'use client';

import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import { logReviewEvents } from '../lib/reviewEvents';

/**
 * 예보 탭 계측 이벤트 — review_events의 source:'ui' 규약(docs/architecture-and-handoff.md §4.9).
 * review_events.correct는 NOT NULL이므로 ui 이벤트는 true로 채운다(qtype은 detail에 담는다 —
 * 코드베이스 전역 관례: 집계는 detail->>'qtype'로 필터). 순수 함수 — 테스트 대상.
 * @param {string} lang
 * @param {{count?: number}} [forecast]
 */
export function buildForecastTapEvent(lang, forecast) {
  return {
    lang,
    source: 'ui',
    item_key: '-',
    correct: true,
    detail: { qtype: 'forecast_tap', count: forecast?.count ?? 0 },
  };
}

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
  const { user, profile } = useAuth();

  if (!forecast || forecast.count === 0 || !forecast.top3?.length) return null;

  const { count, top3 } = forecast;
  const headline = count === 1
    ? `'${top3[0].word_text}' 하나가 흐려져요`
    : `'${top3[0].word_text}' 외 ${count - 1}개가 흐려져요`;

  // 예보 탭 계측 — 실패는 조용히 무시(학습 흐름·이동을 막지 않는다). lang은 프로필의
  // 주 학습언어로 근사(부모가 lang을 넘기지 않으므로 AuthContext에서 취득 — 부모 수정 회피).
  const handleTap = () => {
    if (!user?.id) return;
    const ll = profile?.learning_language;
    const lang = (Array.isArray(ll) ? ll[0] : ll) || 'Japanese';
    try { logReviewEvents(user.id, [buildForecastTapEvent(lang, forecast)]); } catch { /* noop */ }
  };

  return (
    <Link href="/study" className="forecast-card" onClick={handleTap}>
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
