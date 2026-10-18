'use client';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearWordFacets, fetchWordFacets, restoreWordFacets, setWordFacet, updateFacetRows } from './wordFacets';

/** 탭별 O · X 읽기 · 쓰기(LEVEL-FACET-AO-001). 쓰기는 낙관적으로 바로 그리고, 실패하면 되돌린 뒤 onError로 알린다.
 *  available = 표를 읽어 왔을 때만 true — 표가 아직 없거나(운영 미적용) 읽기에 실패하면 화면은 탭별 기록 없이 단어 단위 O · X로 돌아간다. */
export function useWordFacets(userId, lang, enabled = true, { onError } = {}) {
  const client = useQueryClient();
  const key = ['word-facets', userId, lang];
  const query = useQuery({ queryKey: key, queryFn: () => fetchWordFacets(userId, lang), enabled: !!userId && enabled, staleTime: 60_000, retry: false });
  // 보내는 중인 단어(wordText → 보낸 수) — 키보드 O · X가 응답 전에 같은 카드를 다시 고치지 않게(isPending). 그리기와 무관해 ref.
  const inFlight = useRef(new Map());
  const settle = (wordText) => {
    const n = (inFlight.current.get(wordText) || 0) - 1;
    if (n > 0) inFlight.current.set(wordText, n); else inFlight.current.delete(wordText);
  };
  const mutation = useMutation({
    mutationFn: ({ wordText, facet, mark }) => setWordFacet(userId, lang, wordText, facet, mark),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData(key);
      client.setQueryData(key, (rows) => updateFacetRows(rows, body));
      return { before };
    },
    onError: (error, _body, context) => { client.setQueryData(key, context?.before); onError?.(error); },
    onSettled: (_data, _error, body) => settle(body?.wordText),
  });
  const mark = (body) => {
    if (!userId) return false;
    inFlight.current.set(body.wordText, (inFlight.current.get(body.wordText) || 0) + 1);
    mutation.mutate(body);
    return true;
  };
  // 여러 단어 한꺼번에(레벨 초기화 · 되돌리기 — LEVEL-ROUND-001 ②). 실패면 reject(부르는 쪽이 알린다), 끝나면 표를 다시 읽는다.
  const clear = async (words) => {
    const set = new Set(words);
    client.setQueryData(key, (rows) => (rows || []).filter((row) => !set.has(row.word_text)));
    try { await clearWordFacets(userId, lang, words); } finally { await client.invalidateQueries({ queryKey: key }); }
  };
  const restore = async (rows) => {
    try { await restoreWordFacets(userId, lang, rows); } finally { await client.invalidateQueries({ queryKey: key }); }
  };
  return { available: query.isSuccess, rows: query.data || [], mark, clear, restore, isPending: (wordText) => inFlight.current.has(wordText) };
}
