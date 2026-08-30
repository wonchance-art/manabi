'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { recordActivity } from './streak';
import { friendlyToastMessage } from './errorMessage';
import { logReviewEvents } from './reviewEvents';
import { buildReadingMetric } from './readingTimer';

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

      const now = new Date().toISOString();
      const [
        { count: wordsSaved },
        { count: dueCount },
      ] = await Promise.all([
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('source_material_id', materialId),
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).lte('next_review_at', now),
      ]);

      return { wordsSaved: wordsSaved || 0, dueCount: dueCount || 0 };
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
      };
      const rawText = material?.raw_text || '';
      const lang = material?.processed_json?.metadata?.language || 'Japanese';
      generateQuiz(rawText, lang, pendingCompletion);
    },
    onError: (err) => toast?.(friendlyToastMessage(err), 'error'),
  });
}
