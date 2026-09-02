'use client';

/**
 * 오늘 복습 단어 주입 훅 (#1077-16+17 UI 라운드) — pickOutputWords 엔진의 조회 배선.
 * 오늘(KST) 복습된 단어만 서버에서 좁혀 온다(전 단어장 무견인 — 쿼리 다이어트).
 * 게스트·실패는 빈 배열(무해성 — 칩 줄만 생략).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { kstDayStartIso } from './growthStats';
import { pickOutputWords } from './outputWords';
import { dropUndoneEvents } from './undoneReviews';

async function fetchTodayReviewRows(userId) {
  const iso = kstDayStartIso();
  const [vocab, events] = await Promise.all([
    supabase.from('user_vocabulary')
      .select('id, word_text, meaning, language, last_reviewed_at')
      .eq('user_id', userId).gte('last_reviewed_at', iso),
    supabase.from('review_events')
      // item_key는 되돌린 채점 대조 키(W 후속 ②) — 마커(source ui)는 같은 조회에 들어 있다
      .select('source, item_key, correct, created_at, detail')
      .eq('user_id', userId).gte('created_at', iso).limit(500),
  ]);
  return { vocabRows: vocab.data || [], events: dropUndoneEvents(events.data || []) };
}

export function useOutputWords(language) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['output-words', user?.id],
    queryFn: () => fetchTodayReviewRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  if (!user || !data) return [];
  return pickOutputWords({ ...data, language });
}
