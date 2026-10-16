'use client';
/**
 * 오늘 문단 칸(「오늘 학습」에서 이름을 바꿈) — 상태 셋: 준비된 문단의 첫 문장 → 넣을 복습 표현(예보 상위 3) → 신규 안내.
 * 예보 상태에서 누르면 기존 forecast_tap 기록을 그대로 남긴다(onForecastTap — 부르는 쪽이 buildForecastTapEvent → logReviewEvents).
 */
import Link from 'next/link';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';

// busy = 새 언어의 문단을 받는 동안 이전 내용을 흐리게 남긴 상태(LIST-KEEP). 머리줄 · 시작하기는 새 언어 그대로.
// pending = 처음 받는 중(LOADING-SKELETON-001) — 「시작하면 오늘 문단을 만들어요」(거짓 빈 상태) 대신 문장 두 줄 골격.
export default function ParagraphTile({ state, lang, href, kicker = '오늘 문단', onForecastTap, busy = false, pending = false }) {
  const code = encounterLookupLang(lang) || undefined;
  if (pending) {
    return (
      <Link href={href} prefetch={false} className="learn-tile learn-paragraph learn-order-paragraph" aria-label={`${kicker} · 시작하기`}>
        <span className="learn-tile__head"><span className="learn-kick">{kicker}</span></span>
        <SkeletonRegion as="span" className="learn-paragraph__cycle" label={kicker}>
          <span className="learn-paragraph__sentence" aria-hidden="true"><SkeletonLine width="12em" /><br /><SkeletonLine width="8em" /></span>
        </SkeletonRegion>
        <span className="learn-tile__cta">시작하기 →</span>
      </Link>
    );
  }
  return (
    <Link href={href} prefetch={false} className="learn-tile learn-paragraph learn-order-paragraph" aria-label={`${kicker} · 시작하기`}
      onClick={state.kind === 'forecast' ? onForecastTap : undefined}>
      <span className="learn-tile__head"><span className="learn-kick">{kicker}</span></span>
      <span className="learn-paragraph__cycle" aria-busy={busy || undefined}>
        {state.kind === 'ready' && <span className="learn-paragraph__sentence" lang={code}>{state.sentence}</span>}
        {state.kind === 'forecast' && <>
          <span className="learn-paragraph__words" lang={code}>{state.words.join(' · ')}</span>
          <span className="learn-paragraph__cap">오늘 문단에 넣을 표현</span>
        </>}
        {state.kind === 'empty' && <span className="learn-paragraph__cap">시작하면 오늘 문단을 만들어요</span>}
      </span>
      <span className="learn-tile__cta">시작하기 →</span>
    </Link>
  );
}
