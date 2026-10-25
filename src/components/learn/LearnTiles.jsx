'use client';
import { ZhSlot } from '@/components/fonts/ScFontLink';

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
import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';
import { reducedMotion } from '@/lib/reducedMotion';

/**
 * 손님 배움의 로그인 칸 — 화면(HomePage, href 있음)과 대기 화면(home/loading.jsx, href 없는 자리표)이 같은 칸을 쓴다.
 * 자리표는 href 없는 <a>라 초점 · 이동이 없고 실제 칸 스타일을 그대로 받는다(발견 대기 화면 선례).
 */
export function GuestLoginTile({ href }) {
  const body = <>
    <span>
      <span className="learn-goal__title">로그인하면 여기에 쌓여요</span>
      <span className="learn-goal__line">단어 복습 · 오늘 목표 · 레벨 어휘 · 기록</span>
    </span>
    <span className="learn-button-s">로그인</span>
  </>;
  const className = 'learn-tile learn-goal--empty learn-guest';
  return href ? <Link href={href} prefetch={false} className={className}>{body}</Link> : <a className={className}>{body}</a>;
}

export function StatTile({ value, label, href, onClick, title, ariaLabel, className = '' }) {
  const body = <><span className="learn-stat__value">{value}</span><span className="learn-stat__label">{label}</span></>;
  const cls = `learn-tile learn-stat ${className}`.trim();
  if (href) return <Link href={href} prefetch={false} className={cls} title={title} aria-label={ariaLabel}>{body}</Link>;
  if (onClick) return <button type="button" className={`${cls} learn-stat--btn`} onClick={onClick} title={title} aria-label={ariaLabel} aria-haspopup="dialog">{body}</button>;
  return <div className={cls} title={title} aria-label={ariaLabel} role={ariaLabel ? 'group' : undefined}>{body}</div>;
}

/**
 * 오늘 목표 — 달성률 표시 전용. 누르면 현황의 목표 창(하루 목표 · 날짜 목표를 고치는 한 자리 — PROFILE-REDESIGN-001 D2).
 * 현황 안에서는 같은 화면이라 주소 대신 창을 바로 연다(onOpen).
 */
export function TodayGoalTile({ vocab, projections, profile, className, empty = false, onOpen }) {
  const pct = empty ? null : todayGoalPct({ vocab, projections, profile });
  // 0은 크게 쓰지 않는다(0 무표기 — 연속 · 이번 주 칸의 「–」 선례, 목업 신규 사용자 「– / 오늘 목표」).
  const value = pct ? `${pct}%` : '–';
  return onOpen
    ? <StatTile className={className} value={value} label="오늘 목표" onClick={onOpen} />
    : <StatTile className={className} value={value} label="오늘 목표" href="/progress?goal=edit" />;
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
export function ReviewTile({ projections = [], lang, count = null, href, className = '', pending = false }) {
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

  // 처음 받는 중(LOADING-SKELETON-001) — 「아직 수집한 단어가 없어요」(거짓 빈 상태) 대신 단어 · 뜻 자리 골격.
  // 어디로 갈지(복습 · 읽으러 가기)를 아직 모르므로 링크가 아니다.
  if (pending) {
    return (
      <div className={`learn-tile learn-review ${className}`.trim()}>
        <span className="learn-tile__head"><span className="learn-kick">단어 복습</span></span>
        <SkeletonRegion as="span" className="learn-review__cycle learn-review__cycle--skeleton" label="단어 복습">
          <span className="learn-review__word" aria-hidden="true"><SkeletonLine width="3.5em" /></span>
          <span className="learn-review__meaning" aria-hidden="true"><SkeletonLine width="6em" /></span>
        </SkeletonRegion>
        <span className="learn-tile__cta" aria-hidden="true"><SkeletonLine width="5em" /></span>
      </div>
    );
  }
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
          <ZhSlot lang={encounterLookupLang(wordScopeLanguage(word))}><span className="learn-review__word" lang={encounterLookupLang(wordScopeLanguage(word)) || undefined}>{word.word_text}</span></ZhSlot>
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
