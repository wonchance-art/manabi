'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
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

function lessonHref(lesson) {
  const slug = chapterSlug(lesson);
  return slug ? `/english/grammar/${encodeURIComponent(slug)}` : '/lessons';
}

export function CourseMap({
  course,
  units = [],
  lessons = [],
  levels = [],
  selectedLevel,
  completedSlugs = [],
  progressSource = 'guest',
  progressLoading = false,
}) {
  const completed = new Set(completedSlugs);
  const nextLesson = lessons.find((lesson) => !completed.has(chapterSlug(lesson)));
  const completedCount = lessons.filter((lesson) => completed.has(chapterSlug(lesson))).length;

  if (!course || lessons.length === 0) {
    return (
      <div className={`page-container ${styles.page}`} data-course-map="empty">
        <header className={styles.header}>
          <p className={styles.eyebrow}>영어 트랙</p>
          <h1 className={styles.title}>{course?.title || '영어 코스'}</h1>
        </header>
        <div className={`card ${styles.empty}`} role="status">
          레슨이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className={`page-container ${styles.page}`} data-course-map="ready">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>영어 트랙</p>
          <h1 className={styles.title}>{course.title}</h1>
        </div>
        <div className={styles.progress} aria-label={`완료 ${completedCount}개, 전체 ${lessons.length}개`}>
          <span>{progressLoading ? '진도 확인 중' : PROGRESS_LABELS[progressSource]}</span>
          <strong>{completedCount} / {lessons.length}</strong>
        </div>
      </header>

      <nav className={styles.levels} aria-label="영어 레벨">
        {levels.map((level) => (
          <Link
            key={level}
            href={`/learn/course?level=${encodeURIComponent(level)}`}
            className={`${styles.level} ${level === selectedLevel ? styles.levelActive : ''}`}
            aria-current={level === selectedLevel ? 'page' : undefined}
          >
            {level}
          </Link>
        ))}
      </nav>

      {nextLesson ? (
        <Link
          href={lessonHref(nextLesson)}
          className={`lessons-continue learn-cta ${styles.next}`}
          data-course-next={chapterSlug(nextLesson)}
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
                    const slug = chapterSlug(lesson);
                    const isComplete = completed.has(slug);
                    const isNext = nextLesson?.id === lesson.id;

                    return (
                      <li key={lesson.id}>
                        <Link
                          href={lessonHref(lesson)}
                          className={`${styles.lesson} ${isComplete ? styles.lessonComplete : ''} ${isNext ? styles.lessonNext : ''}`}
                          aria-current={isNext ? 'step' : undefined}
                          data-lesson-status={isComplete ? 'complete' : isNext ? 'next' : 'pending'}
                        >
                          <span className={styles.lessonStatus} aria-hidden="true">
                            {isComplete ? '✓' : lesson.order}
                          </span>
                          <span className={styles.lessonBody}>
                            <strong>{lesson.title}</strong>
                            <span>{lesson.estimatedMinutes}분</span>
                          </span>
                          <span className={styles.lessonMeta}>
                            {isComplete ? '완료' : isNext ? '다음' : ''}
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
  const { user, loading: authLoading } = useAuth();
  const lessonSlugs = useMemo(
    () => props.lessons.map(chapterSlug).filter(Boolean),
    [props.lessons],
  );
  const [progress, setProgress] = useState({
    completedSlugs: [],
    source: user?.id ? 'remote' : 'guest',
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return undefined;

    let active = true;
    setProgress((current) => ({ ...current, loading: true }));

    getLessonProgress(user?.id, {
      lang: 'English',
      slugs: lessonSlugs,
    }).then((result) => {
      if (active) setProgress({ ...result, loading: false });
    });

    return () => {
      active = false;
    };
  }, [authLoading, lessonSlugs, user?.id]);

  return (
    <CourseMap
      {...props}
      completedSlugs={progress.completedSlugs}
      progressSource={progress.source}
      progressLoading={progress.loading || authLoading}
    />
  );
}
