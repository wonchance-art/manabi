'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  LEARNING_ACTIVITY_EVENT,
  getLearningMotivation,
} from '../lib/learn/learningActivity';
import {
  preferredLearnLanguage,
  readLearnHomeProgress,
} from '../lib/learn/homeProgress';

const EMPTY_PROGRESS = Object.freeze({
  language: '',
  name: '',
  track: '',
  levels: [],
  hasProgress: false,
});

export function LearnProgressPanel({
  progress = EMPTY_PROGRESS,
  ready = true,
  streakCount = 0,
  source = 'guest',
}) {
  const hasRecords = progress.hasProgress || streakCount > 0;
  const courseHref = progress.track
    ? `/learn/course?track=${encodeURIComponent(progress.track)}`
    : '/learn/course';

  return (
    <section
      className="card mypage-section learn-progress"
      data-learn-progress={ready ? (hasRecords ? 'ready' : 'empty') : 'loading'}
    >
      <div className="lvprog__head">
        <div>
          <h2 className="mypage-section__title" style={{ margin: 0 }}>학습 진도</h2>
          {progress.name && <span className="learn-progress__language">{progress.name}</span>}
        </div>
        <span className="streak-badge" data-learn-streak={streakCount}>
          <span className="streak-badge__fire" aria-hidden="true">🔥</span>
          <span className="streak-badge__count">{streakCount}일</span>
          <span className="streak-badge__label">연속 학습</span>
        </span>
      </div>

      {!ready ? (
        <p className="learn-progress__empty">이 기기의 학습 기록을 불러오는 중…</p>
      ) : !hasRecords ? (
        <div className="learn-progress__empty" data-learn-progress-empty>
          <p>아직 학습 기록이 없어요. 첫 챕터를 방문하면 여기에서 진도를 이어볼 수 있어요.</p>
          <Link href={courseHref} className="fr-check__next">첫 챕터 시작하기 →</Link>
        </div>
      ) : (
        <>
          <div className="lvprog__rows">
            {progress.levels.map((level) => {
              const visitedWidth = level.totalCount
                ? (level.visitedCount / level.totalCount) * 100
                : 0;
              const completedWidth = level.totalCount
                ? (level.completedCount / level.totalCount) * 100
                : 0;
              const done = level.totalCount > 0 && level.completedCount === level.totalCount;

              return (
                <div
                  key={level.key}
                  className="lvprog__row"
                  data-learn-level={level.key}
                >
                  <span className={`lvprog__key ${done ? 'is-done' : ''}`}>{level.short}</span>
                  <span className="lvprog__bar" aria-hidden="true">
                    <span className="lvprog__bar-read" style={{ width: `${visitedWidth}%` }} />
                    <span className="lvprog__bar-pass" style={{ width: `${completedWidth}%` }} />
                  </span>
                  <span className="learn-progress__counts">
                    방문 {level.visitedCount} · 완료 {level.completedCount}/{level.totalCount}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="learn-progress__footer">
            <span>{source === 'guest' ? '이 기기 기준' : '프로필 + 이 기기 기준'}</span>
            <Link href={courseHref} className="fr-check__next">코스 지도 →</Link>
          </div>
        </>
      )}
    </section>
  );
}

export default function LearnProgressWidget({
  catalog = {},
  language,
  userId,
  remoteStreak = 0,
  remoteLastStreakDate = '',
}) {
  const selectedLanguage = useMemo(
    () => preferredLearnLanguage(language, catalog),
    [catalog, language],
  );
  const [snapshot, setSnapshot] = useState({
    progress: { ...EMPTY_PROGRESS, language: selectedLanguage },
    motivation: { streakCount: 0, source: userId ? 'remote' : 'guest' },
    ready: false,
  });

  useEffect(() => {
    const sync = () => {
      setSnapshot({
        progress: readLearnHomeProgress(catalog, language),
        motivation: getLearningMotivation(userId, {
          remoteStreak,
          remoteLastStreakDate,
        }),
        ready: true,
      });
    };

    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    window.addEventListener(LEARNING_ACTIVITY_EVENT, sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener(LEARNING_ACTIVITY_EVENT, sync);
    };
  }, [
    catalog,
    language,
    remoteLastStreakDate,
    remoteStreak,
    userId,
  ]);

  return (
    <LearnProgressPanel
      progress={snapshot.progress}
      ready={snapshot.ready}
      streakCount={snapshot.motivation.streakCount}
      source={snapshot.motivation.source}
    />
  );
}
