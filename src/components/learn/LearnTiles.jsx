'use client';

/**
 * 배움 · 현황이 함께 쓰는 작은 칸들 (LEARN-HOME-AK-001) — 예전 홈 메트로 위젯(ProfileStats)에서 떼어 냈다.
 * 홈은 ProfileStats를 통째로 불러오지 않는다(performanceRepairs P4) — 필요한 칸만 이 모듈에서 가져간다.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isVocabularyReviewAvailable, isVocabularyReviewDue } from '@/lib/vocabularyLearningRead';
import { streakView, todayGoalPct } from '@/lib/learnDashboard';
import { wordScopeLanguage } from '@/lib/reviewScope';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import { reducedMotion } from '@/lib/reducedMotion';

export function StatTile({ value, label, href, title, ariaLabel, className = '' }) {
  const body = <><span className="learn-stat__value">{value}</span><span className="learn-stat__label">{label}</span></>;
  const cls = `learn-tile learn-stat ${className}`.trim();
  return href
    ? <Link href={href} prefetch={false} className={cls} title={title} aria-label={ariaLabel}>{body}</Link>
    : <div className={cls} title={title} aria-label={ariaLabel} role={ariaLabel ? 'group' : undefined}>{body}</div>;
}

/** 오늘 목표 — 달성률 표시 전용. 누르면 계정 화면에서 목표 편집(정본 슬라이더). */
export function TodayGoalTile({ vocab, projections, profile, className, empty = false }) {
  const pct = empty ? null : todayGoalPct({ vocab, projections, profile });
  // 0은 크게 쓰지 않는다(0 무표기 — 연속 · 이번 주 칸의 「–」 선례, 목업 신규 사용자 「– / 오늘 목표」).
  return <StatTile className={className} value={pct ? `${pct}%` : '–'} label="오늘 목표" href="/profile" />;
}

/** 연속 — 「12일 / 연속 · 쉼 2」. 칸 설명은 title과 aria-label에 같은 문구(쉼 규칙). */
export function StreakTile({ profile, className }) {
  const view = streakView(profile);
  return <StatTile className={className} value={view.value} label={view.label} title={view.title} ariaLabel={view.aria} />;
}

/**
 * 단어 복습 — 단어가 시간차로 넘어가는 메트로식 칸. 숫자는 부르는 쪽이 countReviewScope로 낸 total을 넘긴다
 * (이 칸은 개수를 세지 않는다). 칩 언어의 단어만 돌린다. 0개면 「N개 대기」 없이 최근 담은 표현만 보인다.
 */
export function ReviewTile({ projections = [], lang, count = null, href, className = '' }) {
  const now = Math.max(Date.now(), ...projections.map(p => Date.parse(p.review.evaluatedAt) || 0));
  const pool = useMemo(() => {
    const mine = projections.filter(p => !lang || wordScopeLanguage(p.vocabulary) === lang);
    const due = mine.filter(p => isVocabularyReviewDue(p, now))
      .sort((a, b) => Date.parse(a.review.nextQuestionAt) - Date.parse(b.review.nextQuestionAt));
    const candidates = due.length ? due : mine.filter(isVocabularyReviewAvailable)
      .sort((a, b) => Date.parse(b.vocabulary.created_at) - Date.parse(a.vocabulary.created_at));
    return candidates.slice(0, 20).map(p => p.vocabulary);
    // now는 렌더 시점 고정으로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projections, lang]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    // 동작 줄이기: 3.5초 자동 순환을 멈추고 첫 단어(가장 급한 복습)를 고정한다(MOTION-R2).
    if (pool.length < 2 || reducedMotion()) return undefined;
    const t = setInterval(() => setIdx(i => (i + 1) % pool.length), 3500);
    return () => clearInterval(t);
  }, [pool]);

  const word = pool[idx % Math.max(pool.length, 1)];
  const waiting = Number.isFinite(count) && count > 0 ? `${count}개 대기` : null;
  const cta = word ? '복습하기' : '읽으러 가기';
  return (
    <Link href={word ? href : '/materials'} prefetch={false} className={`learn-tile learn-review ${className}`.trim()}
      aria-label={['단어 복습', waiting, cta].filter(Boolean).join(' · ')}>
      <span className="learn-tile__head">
        <span className="learn-kick">단어 복습</span>
        {waiting && <span className="learn-review__due">{waiting}</span>}
      </span>
      {word ? (
        <span className="learn-review__cycle" key={word.id ?? idx}>
          <span className="learn-review__word" lang={encounterLookupLang(wordScopeLanguage(word)) || undefined}>{word.word_text}</span>
          <span className="learn-review__meaning">{word.meaning}</span>
        </span>
      ) : (
        <span className="learn-review__cycle">
          <span className="learn-review__empty">아직 수집한 단어가 없어요.<br />자료를 읽으며 단어를 모아 보세요.</span>
        </span>
      )}
      <span className="learn-tile__cta">{cta} →</span>
    </Link>
  );
}
