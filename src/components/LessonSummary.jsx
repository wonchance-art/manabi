'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Button from './Button';

/**
 * 강의 마무리 카드
 *  - 이번 강의에서 배운 것 요약 (패턴 수, 단어 저장 상태, 미션 결과)
 *  - 다음 강의 미리보기
 *  - 강의 완료 버튼 → 완료 후 다음 강의 CTA
 */
export default function LessonSummary({
  lesson, lessonId, language, nextLesson, isCompleted, completePending, onComplete,
}) {
  const { user } = useAuth();
  const [savedCount, setSavedCount] = useState(0);
  const [practiceResult, setPracticeResult] = useState(null);
  const [cfuStats, setCfuStats] = useState({ answered: 0, correct: 0 });

  useEffect(() => {
    if (!user || !lesson?.vocab?.length) { setSavedCount(0); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('user_vocabulary')
        .select('word_text')
        .eq('user_id', user.id)
        .in('word_text', lesson.vocab.map(v => v.ja));
      if (!cancel) setSavedCount(data?.length || 0);
    })();
    return () => { cancel = true; };
  }, [user?.id, lesson]);

  useEffect(() => {
    if (typeof window === 'undefined' || !lessonId) return;
    try {
      const p = JSON.parse(localStorage.getItem('lesson_practice:' + lessonId) || '{}');
      if (p.done && Array.isArray(p.failed)) {
        const total = lesson?.practice?.length || 0;
        const failedCount = p.failed.length;
        setPracticeResult({ total, correct: total - failedCount });
      }
    } catch {}

    // CFU 통계
    if (!lesson?.sections) return;
    let answered = 0, correct = 0;
    lesson.sections.forEach((s, i) => {
      if (!s.cfu) return;
      try {
        const saved = JSON.parse(localStorage.getItem(`lesson_cfu:${lessonId}:${i}`) || 'null');
        if (saved) {
          answered += 1;
          if (saved.correct) correct += 1;
        }
      } catch {}
    });
    setCfuStats({ answered, correct });
  }, [lessonId, lesson]);

  const patternCount = (lesson?.sections || []).filter(s => !s.kind || s.kind === 'pattern').length;
  const vocabCount = lesson?.vocab?.length || 0;
  const allSaved = vocabCount > 0 && savedCount === vocabCount;

  return (
    <div className="lesson-summary">
      <h2 className="lesson-summary__title">🎯 이번 강의에서 익힌 것</h2>

      <ul className="lesson-summary__list">
        {patternCount > 0 && (
          <li className="lesson-summary__item">
            <span className="lesson-summary__icon">💡</span>
            <div>
              <strong>{patternCount}개 패턴</strong>
              <span className="lesson-summary__sub"> · 각 패턴을 회화 속에서 사용 가능</span>
            </div>
          </li>
        )}

        {vocabCount > 0 && (
          <li className="lesson-summary__item">
            <span className="lesson-summary__icon">📚</span>
            <div>
              <strong>{vocabCount}단어</strong>
              {user ? (
                <span className="lesson-summary__sub">
                  {' · '}
                  {allSaved ? '모두 단어장에 저장됨' : `${savedCount}/${vocabCount} 저장됨 (위에서 ⭐로 마저 저장)`}
                </span>
              ) : (
                <span className="lesson-summary__sub"> · 로그인하면 단어장에 저장됩니다</span>
              )}
            </div>
          </li>
        )}

        {cfuStats.answered > 0 && (
          <li className="lesson-summary__item">
            <span className="lesson-summary__icon">✅</span>
            <div>
              <strong>이해 확인 {cfuStats.correct}/{cfuStats.answered}</strong>
            </div>
          </li>
        )}

        {practiceResult && (
          <li className="lesson-summary__item">
            <span className="lesson-summary__icon">✍️</span>
            <div>
              <strong>미션 {practiceResult.correct}/{practiceResult.total} 정답</strong>
            </div>
          </li>
        )}

        {user && (
          <li className="lesson-summary__item">
            <span className="lesson-summary__icon">📅</span>
            <div>
              <strong>내일부터 복습</strong>
              <span className="lesson-summary__sub"> · 저장한 단어가 자동으로 복습 큐에 들어가요</span>
            </div>
          </li>
        )}
      </ul>

      {nextLesson && (
        <div className="lesson-summary__next">
          <div className="lesson-summary__next-label">다음 강의 미리보기</div>
          <div className="lesson-summary__next-title">{nextLesson.title}</div>
          {lesson?.nextPreview && (
            <div className="lesson-summary__next-body">{lesson.nextPreview}</div>
          )}
        </div>
      )}

      <div className="lesson-summary__cta">
        {!isCompleted ? (
          <Button onClick={onComplete} disabled={completePending}>
            {completePending ? '⏳' : '🎉 강의 마치기'}
          </Button>
        ) : nextLesson ? (
          <Link href={`/lessons/${nextLesson.id}`} className="btn btn--primary">
            다음 강의로 →
          </Link>
        ) : (
          <span className="lesson-completed">✓ 완료됨</span>
        )}
      </div>
    </div>
  );
}
