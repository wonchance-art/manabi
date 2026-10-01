'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { fetchKnownWords, markKnown, unmarkKnown } from './knownWords';
import { updateKnownWords } from './knownWordControl';
export function useKnownWords(lang = null, enabled = true) {
  const { user } = useAuth();
  const toast = useToast(), client = useQueryClient(), owner = user?.id;
  const activeOwner = useRef(owner); activeOwner.current = owner;
  const pending = useRef(new Set()), [pendingKeys, setPendingKeys] = useState(new Set());
  const requestKey = body => `${body.accountId}:${body.lang}:${body.wordText}`;
  const query = useQuery({ queryKey: lang ? ['known-words', owner, lang] : ['known-words-all', owner],
    queryFn: () => fetchKnownWords(owner, lang), enabled: !!owner && enabled, staleTime: 0 });
  const mutation = useMutation({
    mutationFn: async body => {
      if (body.known) await markKnown(body.accountId, body.lang, body.wordText);
      else await unmarkKnown(body.accountId, body.lang, body.removeKeys);
    },
    onSuccess: (_, body) => {
      client.setQueryData(['known-words', body.accountId, body.lang], rows => updateKnownWords(rows, body));
      client.setQueryData(['known-words-all', body.accountId], rows => updateKnownWords(rows, body));
      // known과 복습 보호는 한 DB 트랜잭션이다. 성공 후 모든 실제 출제 소비자도 다시 읽는다.
      return Promise.all(['known-words', 'known-words-all', 'vocabulary-exclusions', 'vocab', 'vocab-words',
        'home-v2', 'output-words', 'book-review', 'due-vocab-index'].map(prefix =>
        client.invalidateQueries({ queryKey: [prefix, body.accountId] })));
    },
    onError: (error, body) => { if (activeOwner.current === body.accountId) toast(error.message || '잠시 후 다시 시도해 주세요.', 'error'); },
    onSettled: (_, __, body) => { pending.current.delete(requestKey(body)); setPendingKeys(new Set(pending.current)); },
  });
  return { ...query, rows: query.data || [], isPendingWord: (lang, wordText) => pendingKeys.has(requestKey({accountId:owner,lang,wordText})),
    mutation: { ...mutation,
    mutate: body => {
      const snapshot = { ...body, accountId: owner }, key = requestKey(snapshot);
      if (!owner || pending.current.has(key)) return;
      pending.current.add(key); setPendingKeys(new Set(pending.current)); mutation.mutate(snapshot);
    },
  } };
}
