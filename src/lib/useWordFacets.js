'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWordFacets, setWordFacet, updateFacetRows } from './wordFacets';

/** 탭별 O · X 읽기 · 쓰기(LEVEL-FACET-AO-001). 쓰기는 낙관적으로 바로 그리고, 실패하면 되돌린 뒤 onError로 알린다. */
export function useWordFacets(userId, lang, enabled = true, { onError } = {}) {
  const client = useQueryClient();
  const key = ['word-facets', userId, lang];
  const query = useQuery({ queryKey: key, queryFn: () => fetchWordFacets(userId, lang), enabled: !!userId && enabled, staleTime: 60_000, retry: false });
  const mutation = useMutation({
    mutationFn: ({ wordText, facet, mark }) => setWordFacet(userId, lang, wordText, facet, mark),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData(key);
      client.setQueryData(key, (rows) => updateFacetRows(rows, body));
      return { before };
    },
    onError: (error, _body, context) => { client.setQueryData(key, context?.before); onError?.(error); },
  });
  return { rows: query.data || [], mark: (body) => userId && mutation.mutate(body) };
}
