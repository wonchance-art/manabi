'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  LEARNING_ACTIVITY_EVENT,
  getLearningMotivation,
} from '../lib/learn/learningActivity';
import { getLessonProgress } from '../lib/learn/progressStore';
import styles from './CourseMapPage.module.css';

const PROGRESS_LABELS = {
  remote: '계정 진도',
  guest: '게스트 · 이 기기',
  'local-fallback': '이 기기 진도',
};

function chapterSlug(lesson) {
  return lesson?.specialFields?.originalChapterSlug || '';
}

function lessonProgressKey(lesson) {
  return chapterSlug(lesson) || lesson?.specialFields?.progressSlug || '';
}

function lessonPrerequisites(lesson) {
  return Array.isArray(lesson?.prerequisites)
    ? lesson.prerequisites.filter((slug) => typeof slug === 'string' && slug.length > 0)
    : [];
}

export function lessonHref(lesson, course) {
  if (lesson?.specialFields?.contentHref) return lesson.specialFields.contentHref;

  const slug = chapterSlug(lesson);
  const track = course?.language?.toLowerCase();
  return slug && track ? `/${track}/grammar/${encodeURIComponent(slug)}` : '/lessons';
}

function TrackNav({ tracks, selectedTrack, selectedLevel }) {
  return (
    <nav className={styles.tracks} aria-label="학습 트랙">
      {tracks.map((track) => {
        const active = track.id === selectedTrack;
        const level = active ? selectedLevel : track.defaultLevel;

        return (
          <Link
            key={track.id}
            href={`/learn/course?track=${encodeURIComponent(track.id)}&level=${encodeURIComponent(level)}`}
            className={`${styles.track} ${active ? styles.trackActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {track.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CourseMap({
  course,
  units = [],
  lessons = [],
  tracks = [],
  selectedTrack = 'english',
  trackLabel = '영어',
  levels = [],
  levelLabels = {},
  selectedLevel,
  completedSlugs = [],
  progressSource = 'guest',
  progressLoading = false,
  streakCount = 0,
  dailyGoalComplete = false,
  motivationSource = 'guest',
}) {
  const completed = new Set(completedSlugs);
  const nextLesson = lessons.find((lesson) => !completed.has(lessonProgressKey(lesson)));
  const completedCount = lessons.filter((lesson) => completed.has(lessonProgressKey(lesson))).length;

  if (!course || lessons.length === 0) {
    return (
      <div
        className={`page-container ${styles.page}`}
        data-course-map="empty"
        data-course-track={selectedTrack}
      >
        <TrackNav
          tracks={tracks}
          selectedTrack={selectedTrack}
          selectedLevel={selectedLevel}
        />
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{trackLabel} 트랙</p>
            <h1 className={styles.title}>{course?.title || `${trackLabel} 코스`}</h1>
          </div>
        </header>
        <div className={`card ${styles.empty}`} role="status">
          레슨이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`page-container ${styles.page}`}
      data-course-map="ready"
      data-course-track={selectedTrack}
    >
      <TrackNav
        tracks={tracks}
        selectedTrack={selectedTrack}
        selectedLevel={selectedLevel}
      />
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{trackLabel} 트랙</p>
          <h1 className={styles.title}>{course.title}</h1>
        </div>
        <div className={styles.progress} aria-label={`완료 ${completedCount}개, 전체 ${lessons.length}개`}>
          <span>{progressLoading ? '진도 확인 중' : PROGRESS_LABELS[progressSource]}</span>
          <strong>{completedCount} / {lessons.length}</strong>
        </div>
      </header>

      <section className={`card ${styles.motivation}`} aria-label="오늘의 학습 동기">
        <div
          className={styles.streak}
          data-course-streak={streakCount}
          aria-label={`${streakCount}일 스트릭`}
        >
          <span className={styles.streakFire} aria-hidden="true">🔥</span>
          <span className={styles.streakBody}>
            <strong>{streakCount}일</strong>
            <span>스트릭 · {motivationSource === 'guest' ? '이 기기 기준' : '계정 기준'}</span>
          </span>
        </div>
        <div
          className={`${styles.dailyGoal} ${dailyGoalComplete ? styles.dailyGoalComplete : ''}`}
          data-daily-goal={dailyGoalComplete ? 'complete' : 'pending'}
          aria-label={`오늘 레슨 1개 완료: ${dailyGoalComplete ? '완료' : '미완료'}`}
        >
          <span className={styles.goalCheck} aria-hidden="true">
            {dailyGoalComplete ? '✓' : '○'}
          </span>
          <span className={styles.goalBody}>
            <strong>오늘 레슨 1개 완료</strong>
            <span>{dailyGoalComplete ? '오늘 목표를 채웠어요' : '레슨을 마치면 체크돼요'}</span>
          </span>
          <span className={styles.goalStatus}>{dailyGoalComplete ? '완료' : '0 / 1'}</span>
        </div>
      </section>

      <nav className={styles.levels} aria-label={`${trackLabel} 레벨`}>
        {levels.map((level) => (
          <Link
            key={level}
            href={`/learn/course?track=${encodeURIComponent(selectedTrack)}&level=${encodeURIComponent(level)}`}
            className={`${styles.level} ${level === selectedLevel ? styles.levelActive : ''}`}
            aria-current={level === selectedLevel ? 'page' : undefined}
          >
            {levelLabels[level] || level}
          </Link>
        ))}
      </nav>

      {nextLesson ? (
        <Link
          href={lessonHref(nextLesson, course)}
          className={`lessons-continue learn-cta ${styles.next}`}
          data-course-next={lessonProgressKey(nextLesson)}
        >
          <span className="lessons-continue__body">
            <span className="lessons-continue__kicker">다음 레슨</span>
            <span className="lessons-continue__title">{nextLesson.title}</span>
          </span>
          <span className="lessons-continue__meta" aria-hidden="true">→</span>
        </Link>
      ) : (
        <div className={`card ${styles.complete}`} role="status">
          <span>코스 완료</span>
          <strong>{completedCount} / {lessons.length}</strong>
        </div>
      )}

      <ol className={styles.units} aria-label={`${course.title} 유닛`}>
        {units.map((unit) => {
          const unitLessons = lessons.filter((lesson) => lesson.unitId === unit.id);
          if (unitLessons.length === 0) return null;

          return (
            <li key={unit.id} className={styles.unit}>
              <div className={styles.unitMarker} aria-hidden="true">{unit.week}</div>
              <section className={styles.unitBody} aria-labelledby={`${unit.id}-title`}>
                <header className={styles.unitHeader}>
                  <div>
                    <p className={styles.unitLabel}>유닛 {unit.week}</p>
                    <h2 id={`${unit.id}-title`} className={styles.unitTitle}>{unit.title}</h2>
                  </div>
                  <span className={styles.unitCount}>{unitLessons.length} 레슨</span>
                </header>

                <ol className={styles.lessons}>
                  {unitLessons.map((lesson) => {
                    const progressKey = lessonProgressKey(lesson);
                    const isComplete = completed.has(progressKey);
                    const isNext = nextLesson?.id === lesson.id;
                    const vocabThemes = lesson.specialFields?.vocabThemeNames || [];
                    const isVocabulary = lesson.specialFields?.contentType === 'vocabulary';
                    const hasUnmetPrerequisites = lessonPrerequisites(lesson)
                      .some((slug) => !completed.has(slug));
                    const isFormulaic = lesson.formulaic === true;

                    return (
                      <li key={lesson.id}>
                        <Link
                          href={lessonHref(lesson, course)}
                          className={`${styles.lesson} ${isComplete ? styles.lessonComplete : ''} ${isNext ? styles.lessonNext : ''}`}
                          aria-current={isNext ? 'step' : undefined}
                          data-lesson-status={isComplete ? 'complete' : isNext ? 'next' : 'pending'}
                          data-lesson-type={isVocabulary ? 'vocabulary' : 'grammar'}
                          data-unmet-prerequisites={hasUnmetPrerequisites ? 'true' : undefined}
                          data-formulaic={isFormulaic ? 'true' : undefined}
                        >
                          <span className={styles.lessonStatus} aria-hidden="true">
                            {isComplete ? '✓' : lesson.order}
                          </span>
                          <span className={styles.lessonBody}>
                            <strong>{lesson.title}</strong>
                            {(hasUnmetPrerequisites || isFormulaic) && (
                              <span className={styles.lessonBadges}>
                                {hasUnmetPrerequisites && (
                                  <span className={`${styles.lessonBadge} ${styles.lessonBadgeRecommended}`}>
                                    먼저 보면 좋아요
                                  </span>
                                )}
                                {isFormulaic && (
                                  <span className={`${styles.lessonBadge} ${styles.lessonBadgeFormulaic}`}>
                                    장면 고정구
                                  </span>
                                )}
                              </span>
                            )}
                            <span>
                              {lesson.estimatedMinutes}분
                              {vocabThemes.length > 0
                                ? ` · 어휘 ${vocabThemes.join(' · ')}`
                                : ''}
                            </span>
                          </span>
                          <span className={styles.lessonMeta}>
                            {isComplete ? '완료' : isNext ? '다음' : isVocabulary ? '어휘' : ''}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function CourseMapPage(props) {
  const { user, profile, loading: authLoading } = useAuth();
  const lessonSlugs = useMemo(
    () => [...new Set(props.lessons.flatMap((lesson) => [
      lessonProgressKey(lesson),
      ...lessonPrerequisites(lesson),
    ]).filter(Boolean))],
    [props.lessons],
  );
  const vocabLessons = useMemo(
    () => props.lessons.flatMap((lesson) => {
      const storageKey = lesson.specialFields?.vocabProgressStorageKey;
      const words = lesson.specialFields?.vocabProgressWords;
      if (!storageKey || !Array.isArray(words) || words.length === 0) return [];

      return [{
        slug: lessonProgressKey(lesson),
        storageKey,
        words,
      }];
    }),
    [props.lessons],
  );
  const [progress, setProgress] = useState({
    completedSlugs: [],
    source: user?.id ? 'remote' : 'guest',
    loading: true,
  });
  const [motivation, setMotivation] = useState({
    streakCount: 0,
    dailyGoalComplete: false,
    source: 'guest',
  });

  useEffect(() => {
    if (authLoading) return undefined;

    let active = true;
    setProgress((current) => ({ ...current, loading: true }));

    getLessonProgress(user?.id, {
      lang: props.course?.language,
      slugs: lessonSlugs,
      vocabLessons,
    }).then((result) => {
      if (active) setProgress({ ...result, loading: false });
    });

    return () => {
      active = false;
    };
  }, [authLoading, lessonSlugs, props.course?.language, user?.id, vocabLessons]);

  useEffect(() => {
    if (authLoading) return undefined;

    const syncMotivation = () => {
      setMotivation(getLearningMotivation(user?.id, {
        remoteStreak: profile?.streak_count,
        remoteLastStreakDate: profile?.last_streak_date,
      }));
    };

    syncMotivation();
    window.addEventListener(LEARNING_ACTIVITY_EVENT, syncMotivation);
    return () => window.removeEventListener(LEARNING_ACTIVITY_EVENT, syncMotivation);
  }, [
    authLoading,
    profile?.last_streak_date,
    profile?.streak_count,
    user?.id,
  ]);

  return (
    <CourseMap
      {...props}
      completedSlugs={progress.completedSlugs}
      progressSource={progress.source}
      progressLoading={progress.loading || authLoading}
      streakCount={motivation.streakCount}
      dailyGoalComplete={motivation.dailyGoalComplete}
      motivationSource={motivation.source}
    />
  );
}
