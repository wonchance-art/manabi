'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { createKnownWordBeacon, fetchKnownWords, markKnown, unmarkKnown } from './knownWords';
import { revertKnownWords, updateKnownWords } from './knownWordControl';
import { friendlyToastMessage } from './errorMessage';

const cacheKeys = body => [['known-words', body.accountId, body.lang], ['known-words-all', body.accountId]];
const requestKey = body => `${body.accountId}:${body.lang}:${body.wordText}`;
const busy = code => Object.assign(new Error(code), { code });
// 응답을 기다리는 쓰기의 닫힘 대비(pagehide keepalive) — 화면 하나에 훅이 여럿이어도 목록과 리스너는 하나다.
let beacon = null;
const knownWordBeacon = () => (beacon ||= createKnownWordBeacon());

/**
 * 아는 단어 표시 · 해제 mutation 옵션 — 누른 순간 두 캐시(known-words · known-words-all)에 반영하고(낙관적),
 * 실패하면 그 요청이 바꾼 것만 되돌린 뒤 알린다. 성공 후 동작(캐시 확정 + 실제 출제 소비자 재조회)은 그대로다.
 */
export function knownWordsMutationOptions({ client, toast, isActiveOwner, track = () => () => {} }) {
  return {
    // 쓰기가 나가 있는 동안만 track — 화면은 이미 바뀌었으니, 응답 전에 탭이 닫히면 pagehide에서 같은 요청을 keepalive로 다시 보낸다.
    mutationFn: async body => {
      const untrack = track(body);
      try {
        if (body.known) await markKnown(body.accountId, body.lang, body.wordText);
        else await unmarkKnown(body.accountId, body.lang, body.removeKeys);
      } finally { untrack(); }
    },
    // 진행 중인 재조회가 낙관 반영을 덮어쓰지 않게 멈춘다. 아직 받지 않은 캐시는 만들지 않는다(그 한 줄만 든 목록이 생긴다).
    onMutate: async body => {
      const keys = cacheKeys(body);
      await Promise.all(keys.map(queryKey => client.cancelQueries({ queryKey, exact: true })));
      const before = keys.map(queryKey => [queryKey, client.getQueryData(queryKey)]);
      for (const [queryKey, rows] of before) if (rows !== undefined) client.setQueryData(queryKey, updateKnownWords(rows, body));
      return { before };
    },
    onSuccess: (_, body) => {
      client.setQueryData(['known-words', body.accountId, body.lang], rows => updateKnownWords(rows, body));
      client.setQueryData(['known-words-all', body.accountId], rows => updateKnownWords(rows, body));
      // known과 복습 보호는 한 DB 트랜잭션이다. 성공 후 모든 실제 출제 소비자도 다시 읽는다.
      return Promise.all(['known-words', 'known-words-all', 'vocabulary-exclusions', 'vocab', 'vocab-words',
        'home-v2', 'profile-stats', 'output-words', 'book-review', 'due-vocab-index'].map(prefix =>
        client.invalidateQueries({ queryKey: [prefix, body.accountId] })));
    },
    // 되돌리기는 이 요청이 바꾼 줄만 — 함께 진행 중인 다른 단어의 낙관 반영은 남긴다.
    onError: (error, body, context) => {
      for (const [queryKey, rows] of context?.before || []) {
        if (rows !== undefined) client.setQueryData(queryKey, current => revertKnownWords(current, rows, body));
      }
      if (isActiveOwner(body.accountId)) toast(friendlyToastMessage(error, '잠시 후 다시 시도해 주세요.'), 'error');
    },
  };
}

/**
 * 같은 단어(계정 · 언어 · 표기) 요청은 한 번에 하나 — mutate는 그대로 흘려보내고, mutateAsync는 기다릴 약속을 준다.
 * 같은 방향 요청이 진행 중이면 그 약속을 다시 돌려주고(중복 요청 0), 반대 방향이면 거절한다(겹친 표시 · 해제 금지).
 */
export function createKnownWordRequests({ getOwner, mutateAsync, onPendingChange = () => {} }) {
  const inflight = new Map();
  const changed = () => onPendingChange(new Set(inflight.keys()));
  const start = body => {
    const owner = getOwner();
    if (!owner) return Promise.reject(busy('known_words_signed_out'));
    const snapshot = { ...body, accountId: owner }, key = requestKey(snapshot), known = !!snapshot.known;
    const current = inflight.get(key);
    if (current) return current.known === known ? current.promise : Promise.reject(busy('known_words_busy'));
    const entry = { known, promise: null };
    inflight.set(key, entry);
    changed();
    let request;
    try { request = Promise.resolve(mutateAsync(snapshot)); } catch (error) { request = Promise.reject(error); }
    entry.promise = request.finally(() => { if (inflight.get(key) === entry) inflight.delete(key); changed(); });
    return entry.promise;
  };
  return {
    mutate: body => { start(body).catch(() => { /* 실패 알림 · 되돌리기는 mutation 옵션이 맡는다. */ }); },
    mutateAsync: start,
  };
}

export function useKnownWords(lang = null, enabled = true) {
  const { user } = useAuth();
  const toast = useToast(), client = useQueryClient(), owner = user?.id;
  const activeOwner = useRef(owner); activeOwner.current = owner;
  const [pendingKeys, setPendingKeys] = useState(new Set());
  const query = useQuery({ queryKey: lang ? ['known-words', owner, lang] : ['known-words-all', owner],
    // 표시·해제는 onSuccess의 setQueryData + 무효화로 즉시 반영된다 — 재마운트마다 다시 받을 필요가 없다.
    queryFn: () => fetchKnownWords(owner, lang), enabled: !!owner && enabled, staleTime: 60 * 1000 });
  const mutation = useMutation(knownWordsMutationOptions({ client, toast, isActiveOwner: id => activeOwner.current === id,
    track: body => knownWordBeacon().track(body) }));
  const mutationRef = useRef(mutation); mutationRef.current = mutation;
  const requests = useRef(null);
  if (!requests.current) requests.current = createKnownWordRequests({ getOwner: () => activeOwner.current,
    mutateAsync: body => mutationRef.current.mutateAsync(body), onPendingChange: setPendingKeys });
  return { ...query, rows: query.data || [], isPendingWord: (lang, wordText) => pendingKeys.has(requestKey({accountId:owner,lang,wordText})),
    mutation: { ...mutation, mutate: requests.current.mutate, mutateAsync: requests.current.mutateAsync } };
}
