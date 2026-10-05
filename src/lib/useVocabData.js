// 단어장 데이터 레이어 — vocab 쿼리 + 데이터 뮤테이션(채점/삭제/일괄삭제/편집/CSV가져오기).
// 수동 추가는 모달 UI 상태와 묶여 있어 VocabPage에 남겨둔다.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { friendlyToastMessage } from './errorMessage';
import { csvToVocabRows } from './vocabIO';
import { fetchVocabularyLearningRows } from './vocabularyLearningRows';
import { useMemo, useRef } from 'react';
import { persistVocabGrade } from './fsrs';
import { cacheVocabSnapshot, getCachedVocabSnapshot } from './offlineCache';

const EMPTY_ROWS = Object.freeze([]);
const EMPTY_TITLES = new Map();

// 오프라인 캐시는 원문 읽기만 복원한다. 정본 확인 실패를 빈 registry로 추측하지 않는다.
export async function fetchVocabLearningData(actorId, options = {}) {
  const current = () => !options.signal?.aborted && (!options.getActorId || options.getActorId() === actorId);
  try {
    const snapshot = await fetchVocabularyLearningRows(actorId, options);
    Promise.resolve().then(() => cacheVocabSnapshot(`learning:${actorId}`, snapshot.rows)).catch(() => {});
    return snapshot;
  } catch (error) {
    if (!current()) throw error;
    const rows = await getCachedVocabSnapshot(`learning:${actorId}`) || await getCachedVocabSnapshot(actorId);
    if (!current() || !rows || rows.some(row => row.user_id !== actorId)) throw error;
    return { actorId, rows, projections: EMPTY_ROWS, complete: false, registryAvailable: false, offline: true, readError: error };
  }
}

/** 정착한 변경만 호출한다. 다른 계정의 화면/캐시를 무효화하지 않는다. */
export function invalidateVocabularyLearning(queryClient, actorId) {
  if (typeof actorId !== 'string' || !actorId) return Promise.resolve([]);
  return Promise.all(['vocab', 'vocab-words', 'vocab-titles', 'home-v2', 'profile-stats', 'output-words',
    'book-review', 'due-vocab-index', 'weekly-report', 'goal-progress', 'goal-known', 'weak-spot', 'confused-events']
    .map(prefix => queryClient.invalidateQueries({ queryKey: [prefix, actorId] })));
}

export function useVocabData() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const actorRef = useRef(user?.id);
  actorRef.current = user?.id;
  // 기존 vocab prefix invalidation은 유지하되 원본 배열 캐시와 snapshot을 섞지 않는다.
  const { data: learning, isLoading, error, refetch } = useQuery({
    queryKey: ['vocab', user?.id, 'learning'],
    queryFn: ({ signal }) => fetchVocabLearningData(user.id, { signal, getActorId: () => actorRef.current }),
    enabled: !!user,
  });
  const vocab = learning?.actorId === user?.id ? learning.rows : EMPTY_ROWS;
  const projections = learning?.actorId === user?.id ? learning.projections : EMPTY_ROWS;
  const materialIds = useMemo(() => [...new Set(vocab.map(row => row.source_material_id).filter(Boolean))].sort(), [vocab]);
  // 제목은 로그인 사용자의 RLS로만 읽는 표시 보조다. 실패해도 학습 정본을 대체하지 않는다.
  const { data: materialTitles = EMPTY_TITLES } = useQuery({
    queryKey: ['vocab-titles', user?.id, materialIds],
    enabled: !!user && materialIds.length > 0,
    queryFn: async ({ signal }) => {
      const titles = new Map();
      for (let i = 0; i < materialIds.length; i += 100) {
        const { data, error: titleError } = await supabase.from('reading_materials').select('id, title')
          .in('id', materialIds.slice(i, i + 100)).abortSignal(signal);
        if (titleError) throw titleError;
        for (const row of data || []) titles.set(row.id, row.title);
      }
      if (actorRef.current !== user.id) throw new Error('fsrs_stale_account');
      return titles;
    },
  });

  const scoreMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async ({ id, nextStats }) => {
      await persistVocabGrade(supabase, id, nextStats);
    },
    onSuccess: (_result, _variables, context) => {
      invalidateVocabularyLearning(queryClient, context?.actorId);
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast('업데이트 실패 — ' + friendlyToastMessage(err), 'error'); },
  });

  const deleteMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('user_vocabulary')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_result, _variables, context) => {
      invalidateVocabularyLearning(queryClient, context?.actorId);
      queryClient.invalidateQueries({ queryKey: ['vocabulary-exclusions', context?.actorId] });
      if (context?.actorId !== actorRef.current) return;
      toast('단어를 삭제했습니다.', 'info');
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast('삭제 실패 — ' + friendlyToastMessage(err), 'error'); },
  });

  // CSV 불러오기
  const csvImportMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async (file) => {
      const text = await file.text();
      const rows = csvToVocabRows(text, user.id);
      if (rows.length === 0) throw new Error('유효한 행이 없습니다.');
      if (rows.length > 5000) throw new Error('한 번에 5000개까지만 가져올 수 있어요.');

      // 500개씩 배치 upsert
      let imported = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from('user_vocabulary')
          .upsert(chunk, { onConflict: 'user_id,word_text', ignoreDuplicates: true });
        if (error) throw error;
        imported += chunk.length;
      }
      return imported;
    },
    onSuccess: (count, _variables, context) => {
      invalidateVocabularyLearning(queryClient, context?.actorId);
      queryClient.invalidateQueries({ queryKey: ['vocabulary-exclusions', context?.actorId] });
      if (context?.actorId !== actorRef.current) return;
      toast(`${count}개 단어를 가져왔어요. (중복은 자동 스킵)`, 'success', 5000);
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast('가져오기 실패 — ' + friendlyToastMessage(err), 'error'); },
  });

  // 개별 단어 편집 (word_text/furigana/meaning/pos)
  const updateVocabMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async ({ id, updates }) => {
      const allowed = {};
      if (typeof updates.word_text === 'string') allowed.word_text = updates.word_text.trim().slice(0, 200);
      if (typeof updates.furigana === 'string') allowed.furigana = updates.furigana.trim().slice(0, 200);
      if (typeof updates.meaning === 'string') allowed.meaning = updates.meaning.trim().slice(0, 500);
      if (typeof updates.pos === 'string') allowed.pos = updates.pos.trim().slice(0, 50);
      if (Object.keys(allowed).length === 0) throw new Error('변경할 내용이 없어요');
      const { error } = await supabase
        .from('user_vocabulary')
        .update(allowed)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_result, _variables, context) => {
      invalidateVocabularyLearning(queryClient, context?.actorId);
      queryClient.invalidateQueries({ queryKey: ['vocabulary-exclusions', context?.actorId] });
      if (context?.actorId !== actorRef.current) return;
      toast('단어를 수정했어요', 'success');
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast('수정 실패 — ' + friendlyToastMessage(err), 'error'); },
  });

  const bulkDeleteMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async (ids) => {
      if (!ids?.length) return 0;
      const { error } = await supabase
        .from('user_vocabulary')
        .delete()
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count, _variables, context) => {
      invalidateVocabularyLearning(queryClient, context?.actorId);
      queryClient.invalidateQueries({ queryKey: ['vocabulary-exclusions', context?.actorId] });
      if (context?.actorId !== actorRef.current) return;
      toast(`${count}개 단어를 삭제했습니다.`, 'info');
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast('일괄 삭제 실패: ' + err.message, 'error'); },
  });

  return {
    vocab,
    projections,
    learningAvailable: !error && learning?.actorId === user?.id && learning?.complete === true,
    learningNow: learning?.now,
    materialTitles,
    isOffline: learning?.actorId === user?.id && learning?.offline === true,
    isLoading,
    error: error || learning?.readError,
    refetch,
    scoreMutation,
    deleteMutation,
    csvImportMutation,
    updateVocabMutation,
    bulkDeleteMutation,
  };
}
