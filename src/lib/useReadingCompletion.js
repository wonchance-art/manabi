'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { recordActivity } from './streak';
import { friendlyToastMessage } from './errorMessage';
import { logReviewEvents } from './reviewEvents';
import { buildReadingMetric } from './readingTimer';
import { fetchMaterialRoundRows } from './readingSpeedRows';
import { compareRound } from './readingSpeedHistory';
import { fetchVocabularyLearningRows } from './vocabularyLearningRows';
import { isVocabularyReviewDue } from './vocabularyLearningRead';

// 공부 모드 지원 언어 키 — REF_LANGS를 직접 import하면 교재 콘텐츠 전체가 클라 번들에 딸려 온다(1.8MB).
// 이 훅은 'use client'라 ViewerPage에 물리면 뷰어 번들이 폭발한다. 실사용은 멤버십 체크 1곳뿐.
// 키는 REF_LANGS와 반드시 일치.
const STUDY_LANGS = new Set(['Japanese', 'English', 'French', 'Chinese']);

/**
 * 자료 완독 처리: reading_progress upsert + 퀴즈 생성.
 * deps가 많지만 모두 외부 context/hook에서 받아오므로 hook 자체는 순수.
 *
 * @returns useMutation 결과 (markCompleteMutation)
 */
export function useReadingCompletion({
  materialId, user, profile, fetchProfile,
  material, generateQuiz,
  toast,
  readingMetricInput,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reading_progress').upsert({
        user_id: user.id,
        material_id: materialId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,material_id' });
      if (error) throw error;

      // 완독 저장은 이미 성공했다. 보조 조회 장애를 0개로 바꾸거나 완독 재시도로 보내지 않는다.
      try {
        const learning = await fetchVocabularyLearningRows(user.id, { fields: 'summary' });
        const now = Math.max(Date.now(), Date.parse(learning.now));
        return {
          wordsSaved: learning.rows.filter(row => row.source_material_id === materialId).length,
          dueCount: learning.projections.filter(p => isVocabularyReviewDue(p, now)).length,
        };
      } catch {
        return { wordsSaved: null, dueCount: null };
      }
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['reading-progress', user?.id, materialId] });
      queryClient.invalidateQueries({ queryKey: ['reading-progress-list', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
      // 완독을 학습 기록에 합류 — fire-and-forget, 실패 무해
      const eventLang = material?.processed_json?.metadata?.language;
      // 유창성 측정(v2-I R1a)은 **기존 완독 이벤트의 detail만 넓힌다** — 새 이벤트도
      // 새 테이블도 만들지 않으므로 이벤트 개수가 늘지 않고 기존 집계가 오염되지 않는다.
      // 200자 미만·시간 0은 metric이 null → detail은 예전 모양 그대로(조용한 무기록).
      let metric = null;
      try { metric = buildReadingMetric({ ...(readingMetricInput?.() || {}) }); } catch { /* 무해성 */ }
      // 회차 비교(I-a R2) — **이번 회차를 기록하기 전에** 이전 회차를 읽는다. 순서가
      // 뒤집히면 방금 넣은 행이 '직전 회차'로 잡혀 언제나 0%가 된다. 조회 실패는
      // 빈 배열로 흘러 비교 줄만 없을 뿐, 완독 자체는 그대로 진행된다.
      let round = null;
      if (metric) {
        const rows = await fetchMaterialRoundRows(user.id, materialId);
        round = compareRound(metric, rows);
      }
      if (eventLang && STUDY_LANGS.has(eventLang)) {
        logReviewEvents(user.id, [{
          lang: eventLang,
          source: 'reading',
          item_key: 'material:' + materialId,
          correct: true,
          detail: { qtype: 'read', mode: 'viewer', ...(metric || {}) },
        }]);
      }
      const pendingCompletion = {
        wordsSaved: data.wordsSaved,
        dueCount: data.dueCount,
        streak: (profile?.streak_count || 0) + 1,
        reading: metric,   // 없으면 완독 화면이 그 줄을 생략한다
        round,             // 첫 회차·페이서 회차면 null — 비교 줄이 없다
      };
      const rawText = material?.raw_text || '';
      const lang = material?.processed_json?.metadata?.language || 'Japanese';
      generateQuiz(rawText, lang, pendingCompletion);
    },
    onError: (err) => toast?.(friendlyToastMessage(err), 'error'),
  });
}
