'use client';
import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { updateVocabularyExclusions } from './vocabularyExclusion';

async function request(body, signal) {
  const response = await fetch('/api/learning/exclusions', body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  } : { signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '제외 상태를 확인하지 못했어요.');
  return result;
}

export function useVocabularyExclusions() {
  const { user } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const owner = user?.id;
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const key = ['vocabulary-exclusions', owner];
  const query = useQuery({ queryKey: key, enabled: !!owner,
    queryFn: ({ signal }) => request(null, signal).then(result => result.items), staleTime: 0 });
  const mutation = useMutation({
    mutationFn: body => request(body),
    onSuccess: (result, body) => {
      client.setQueryData(['vocabulary-exclusions', body.accountId], rows => updateVocabularyExclusions(rows || [], result));
      for (const prefix of ['vocab', 'vocab-words', 'home-v2', 'output-words', 'book-review', 'due-vocab-index']) {
        client.invalidateQueries({ queryKey: [prefix, body.accountId] });
      }
    },
    onError: (error, body) => { if (activeOwner.current === body.accountId) toast(error.message, 'error'); },
  });
  return { ...query, rows: query.data || [], mutation: { ...mutation,
    mutate: body => mutation.mutate({ ...body, accountId: owner }),
    mutateAsync: body => mutation.mutateAsync({ ...body, accountId: owner }),
  } };
}
