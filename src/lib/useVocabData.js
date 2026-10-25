// 단어장 데이터 레이어 — vocab 쿼리 + 데이터 뮤테이션(채점/삭제/일괄삭제/편집/CSV가져오기).
// 수동 추가는 모달 UI 상태와 묶여 있어 VocabPage에 남겨둔다.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { failureMessage } from './errorMessage';
import { csvToVocabRows } from './vocabIO';
import { fetchVocabularyLearningRows, reprojectVocabularyLearningRow } from './vocabularyLearningRows';
import { useEffect, useMemo, useRef } from 'react';
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

/**
 * 정착한 변경만 호출한다. 다른 계정의 화면/캐시를 무효화하지 않는다.
 * refetchLearning:false는 단어장 학습 목록(['vocab', …])을 낡음으로만 표시하고 지금 다시 읽지 않는다 —
 * 복습 중 채점마다 전체 목록(fsrs_vocabulary_snapshot)을 다시 읽으면 작은 DB가 시간 초과로 넘어간다
 * (운영 실측 2026-10-23 KST: 채점 101번에 목록 읽기 107번 · 평균 2초). 채점은 patchVocabularyLearningRow가 화면에 반영한다.
 */
export function invalidateVocabularyLearning(queryClient, actorId, { refetchLearning = true, deferReviewRoom = false } = {}) {
  if (typeof actorId !== 'string' || !actorId) return Promise.resolve([]);
  return Promise.all(['vocab', 'vocab-words', 'vocab-titles', 'home-v2', 'profile-stats', 'output-words',
    'book-review', 'due-vocab-index', 'weekly-report', 'goal-progress', 'goal-known', 'weak-spot', 'confused-events']
    .map(prefix => queryClient.invalidateQueries({ queryKey: [prefix, actorId],
      ...((prefix === 'vocab' && !refetchLearning) || (deferReviewRoom && REVIEW_ROOM_DEFERRED.includes(prefix))
        ? { refetchType: 'none' } : {}) })));
}

/**
 * 복습방(목록 화면)에만 그려지는 조회 — 복습 세션 중에는 화면에 없다. deferReviewRoom이면 채점마다 다시 읽지 않고 낡음만 표시하고,
 * 세션이 끝나 목록으로 돌아올 때 VocabPage가 한 번 다시 읽는다(LOGGED-IN-PERF 감사 2026-10-25 KST: 3,000단어 계정에서 채점 1번에
 * 출처 제목 2번 · 헷갈린 표현 400행 · 되돌리기 표식 = 요청 4번, 50번 채점이면 200번이었다). 출처 제목은 채점이 바꾸지도 않는다.
 */
export const REVIEW_ROOM_DEFERRED = Object.freeze(['vocab-titles', 'confused-events']);

/**
 * 출처 제목 — 100개 id씩 나눠 **함께** 받는다(로그인 감사 F10 2026-10-25 KST: 3,000단어 계정은 묶음 2개를 차례로 받아 왕복이 겹쳤다).
 * 결과는 차례 받기와 같다: 묶음 순서대로 Map에 넣고, 한 묶음이라도 실패하면 오류(부분 제목 없음), 계정이 바뀌었으면 버린다.
 */
export const MATERIAL_TITLE_BATCH = 100;
export async function fetchMaterialTitles(client, materialIds, { signal, current = () => true } = {}) {
  const batches = [];
  for (let i = 0; i < materialIds.length; i += MATERIAL_TITLE_BATCH) batches.push(materialIds.slice(i, i + MATERIAL_TITLE_BATCH));
  const results = await Promise.all(batches.map(async (ids) => {
    const { data, error: titleError } = await client.from('reading_materials').select('id, title').in('id', ids).abortSignal(signal);
    if (titleError) throw titleError;
    return data || [];
  }));
  const titles = new Map();
  for (const rows of results) for (const row of rows) titles.set(row.id, row.title);
  if (!current()) throw new Error('fsrs_stale_account');
  return titles;
}

/**
 * 저장한 예전 방식 채점을 단어장 학습 목록 캐시에 바로 반영한다(서버가 돌려줄 값과 같은 SRS 필드).
 * 투영(projections: 오늘 복습 수 · 달력)은 바뀐 행 하나만 정본 투영기로 다시 계산하고 다른 행의 투영은 그대로 둔다
 * (LOGGED-IN-PERF F7 — 3,000단어 계정에서 채점마다 전체 재투영이 CPU ×4 약 65 ms였다. 화면 값이 전체 재투영과 같다는 계약은
 * vocabLearningPatch). 반영하지 못하면 false — 호출부가 다시 읽는다.
 */
export function patchVocabularyLearningRow(queryClient, actorId, wordId, patch) {
  if (typeof actorId !== 'string' || !actorId || !wordId) return false;
  let patched = false;
  queryClient.setQueryData(['vocab', actorId, 'learning'], cur => {
    if (cur?.actorId !== actorId || !Array.isArray(cur.rows)) return cur;
    const current = cur.rows.find(row => row?.id === wordId);
    if (!current) return cur;
    const next = { ...current, ...patch };
    if (cur.offline) { patched = true; return { ...cur, rows: cur.rows.map(row => (row?.id === wordId ? { ...row, ...patch } : row)) }; }
    try {
      const at = new Date(Math.max(Date.now(), Date.parse(cur.now) || 0)).toISOString();
      const result = reprojectVocabularyLearningRow(cur, wordId, next, { actorId, at });
      patched = true;
      return result;
    } catch { return cur; }
  });
  return patched;
}

/**
 * 로그인 복원 전에 전체 학습 목록을 받기 시작한다(VOCAB-FIRST-NUMBERS-001). 서버가 이 요청의 쿠키 세션으로 확인한 계정(serverUserId)만,
 * useVocabData와 같은 키 · 같은 가져오기 함수다 — 로그인이 복원되면 useVocabData가 진행 중인 요청이나 받은 결과(2분 신선)를 그대로 쓴다.
 * 응답 계정이 다르면 fetchVocabularyLearningRows가 거절한다(남의 목록을 이 키에 담지 않는다). 복원된 계정이 다르면 쓰이지 않는다.
 */
export function usePrefetchVocabLearning(serverUserId, enabled) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof serverUserId !== 'string' || !serverUserId) return;
    queryClient.prefetchQuery({ queryKey: ['vocab', serverUserId, 'learning'], queryFn: ({ signal }) => fetchVocabLearningData(serverUserId, { signal }) });
  }, [queryClient, serverUserId, enabled]);
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
  // 로그인 전에는 query가 꺼져 learning이 없다 — `undefined === undefined`로 남의(없는) 결과를 읽지 않게
  // 사용자 id가 있을 때만 그 사용자의 결과로 인정한다(2026-10-14 M09: 게스트 /vocab 크래시).
  const ownLearning = user?.id && learning?.actorId === user.id ? learning : null;
  const vocab = ownLearning ? ownLearning.rows : EMPTY_ROWS;
  const projections = ownLearning ? ownLearning.projections : EMPTY_ROWS;
  const materialIds = useMemo(() => [...new Set(vocab.map(row => row.source_material_id).filter(Boolean))].sort(), [vocab]);
  // 제목은 로그인 사용자의 RLS로만 읽는 표시 보조다. 실패해도 학습 정본을 대체하지 않는다.
  const { data: materialTitles = EMPTY_TITLES } = useQuery({
    queryKey: ['vocab-titles', user?.id, materialIds],
    enabled: !!user && materialIds.length > 0,
    queryFn: ({ signal }) => fetchMaterialTitles(supabase, materialIds, { signal, current: () => actorRef.current === user.id }),
  });

  const scoreMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async ({ id, nextStats }) => {
      await persistVocabGrade(supabase, id, nextStats);
    },
    onSuccess: (_result, _variables, context) => {
      invalidateVocabularyLearning(queryClient, context?.actorId);
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast(failureMessage('단어를 수정하지 못했어요.', err), 'error'); },
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
      toast('단어를 삭제했어요.', 'info');
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast(failureMessage('단어를 삭제하지 못했어요.', err), 'error'); },
  });

  // CSV 불러오기
  const csvImportMutation = useMutation({
    onMutate: () => ({ actorId: actorRef.current }),
    mutationFn: async (file) => {
      const text = await file.text();
      const rows = csvToVocabRows(text, user.id);
      if (rows.length === 0) throw new Error('가져올 수 있는 행이 없어요.');
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
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast(failureMessage('단어를 가져오지 못했어요.', err), 'error'); },
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
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast(failureMessage('단어를 수정하지 못했어요.', err), 'error'); },
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
      toast(`단어 ${count}개를 삭제했어요.`, 'info');
    },
    onError: (err, _variables, context) => { if (context?.actorId === actorRef.current) toast(failureMessage('선택한 단어를 삭제하지 못했어요.', err), 'error'); },
  });

  return {
    vocab,
    projections,
    learningAvailable: !error && ownLearning?.complete === true,
    learningNow: ownLearning?.now,
    materialTitles,
    isOffline: ownLearning?.offline === true,
    isLoading,
    error: error || ownLearning?.readError,
    refetch,
    scoreMutation,
    deleteMutation,
    csvImportMutation,
    updateVocabMutation,
    bulkDeleteMutation,
  };
}
