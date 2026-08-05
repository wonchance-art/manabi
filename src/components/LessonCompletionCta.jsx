'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  getLessonProgress,
  recordLessonCompleted,
} from '../lib/learn/progressStore';

export function claimLessonCompletion(pendingRef, completed) {
  if (completed || pendingRef.current) return false;
  pendingRef.current = true;
  return true;
}

export function LessonCompletionActions({
  completed,
  disabled,
  error,
  lessonId,
  nextLesson,
  onComplete,
}) {
  return (
    <section
      className="card fr-section"
      data-lesson-completion={completed ? 'complete' : 'pending'}
      data-lesson-id={lessonId}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="lessons-continue learn-cta"
          style={{
            flex: '1 1 260px',
            margin: 0,
            cursor: disabled || completed ? 'default' : 'pointer',
            opacity: disabled && !completed ? 0.72 : 1,
          }}
          onClick={onComplete}
          disabled={disabled || completed}
          aria-pressed={completed}
        >
          <span className="lessons-continue__body">
            <span className="lessons-continue__title">이 레슨 마치기</span>
          </span>
          <span className="lessons-continue__meta" aria-hidden="true">
            {completed ? '✓' : '→'}
          </span>
        </button>

        {completed && nextLesson && (
          <Link
            href={nextLesson.href}
            className="fr-check__next"
            data-next-lesson-id={nextLesson.id}
          >
            다음 레슨 →
          </Link>
        )}
      </div>
      {error && <p role="alert" style={{ margin: '10px 0 0', color: 'var(--danger)', fontSize: '0.82rem' }}>{error}</p>}
    </section>
  );
}

export async function readLessonCompleted(progressGetter, userId, lessonRef) {
  const result = await progressGetter(userId, {
    lang: lessonRef.lang,
    slugs: [lessonRef.slug],
  });
  return result.completedSlugs.includes(lessonRef.slug);
}

export default function LessonCompletionCta({ lessonRef, nextLesson }) {
  const { user, loading: authLoading } = useAuth();
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);

  useEffect(() => {
    if (authLoading || !lessonRef?.lang || !lessonRef?.slug) return undefined;

    let active = true;
    setLoading(true);
    setCompleted(false);
    setError('');

    readLessonCompleted(getLessonProgress, user?.id, lessonRef)
      .then((isCompleted) => {
        if (active) setCompleted(isCompleted);
      })
      .catch(() => {
        if (active) setError('레슨 진행 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, lessonRef?.lang, lessonRef?.slug, user?.id]);

  async function completeLesson() {
    if (!claimLessonCompletion(pendingRef, completed)) return;

    setSaving(true);
    setError('');
    try {
      await recordLessonCompleted(user?.id, lessonRef);
      setCompleted(true);
    } catch {
      setError('레슨 완료를 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <LessonCompletionActions
      completed={completed}
      disabled={authLoading || loading || saving}
      error={error}
      lessonId={lessonRef?.id}
      nextLesson={nextLesson}
      onComplete={completeLesson}
    />
  );
}
