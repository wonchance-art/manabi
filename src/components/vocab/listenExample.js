'use client';
// 복습실 듣기 카드가 읽을 글(CARD-TYPES-001 「듣기 = 예문」 — 오너 승인 2026-11-01 KST): 저장한 원문 문장(source_sentence) → 그 단어의 레벨 예문 → 단어.
// 원문 문장이 있는 단어(읽기에서 담은 것)는 지금 그대로다. 원문이 없는 듣기 카드(단어 페이지에서 붙인 것)만 레벨 예문을 찾는다 —
// 찾기 · 답 면 부품(RoomLevelExample)은 그때 한 번 동적 import로 받는다(복습실 첫 화면 JS 밖). 찾지 못하거나 실패하면 단어를 읽는다.
import { useEffect, useState } from 'react';

const loadRoomLevelExample = () => import('./RoomLevelExample');
const WAIT_MS = 5000; // 받기가 멈춰도 자동 읽기가 마냥 기다리지 않게 — 그 뒤엔 단어로 읽는다(남기지 않아 다음 카드에서 다시 찾는다)
const MAX_CACHE = 500;
const cache = new Map(); // 열쇠 → { ex, View } — 찾은 결과(없음 포함). 실패 · 시간 초과는 남기지 않는다.

/** 듣기 카드가 레벨 예문을 찾아야 하는 단어의 열쇠 — 원문 문장이 있으면 null(원문을 읽는다). */
export function listenExampleKey(word) {
  if (!word?.word_text || word.source_sentence) return null;
  return `${word.language || ''}\u0000${word.word_text}`;
}

/** 읽을 글 — 원문 문장 > 레벨 예문 > 단어. 문제 면 단추 · 자동 1회가 같은 글을 쓴다. */
export function listenText(word, levelEx = null) {
  return word.source_sentence || levelEx?.text || word.word_text;
}

/** 한 번 찾기 — { ex, View }(View = 답 면 부품, 예문이 없으면 null). 찾은 결과는 남긴다. */
export function loadListenExample(word, { load = loadRoomLevelExample, waitMs = WAIT_MS } = {}) {
  const key = listenExampleKey(word);
  if (!key) return Promise.resolve({ ex: null, View: null });
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const found = load().then(async (mod) => {
    const ex = await mod.levelExampleOf(word);
    const hit = { ex: ex || null, View: ex ? mod.default : null };
    cache.set(key, hit);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return hit;
  });
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ ex: null, View: null }), waitMs); });
  return Promise.race([found, timeout]).catch(() => ({ ex: null, View: null })).finally(() => clearTimeout(timer));
}

/**
 * 듣기 카드(active)의 레벨 예문 — { pending, ex, View }. 원문 문장이 있거나 듣기 카드가 아니면 바로 { pending: false, ex: null }.
 * 찾는 동안 pending — 자동 1회는 기다렸다가 같은 글로 읽고, 단추는 그사이 단어를 읽는다.
 */
export function useListenExample(word, active) {
  const key = active ? listenExampleKey(word) : null;
  const [got, setGot] = useState(null); // { key, ex, View }
  useEffect(() => {
    if (!key || cache.has(key)) return undefined;
    let live = true;
    loadListenExample(word).then((hit) => { if (live) setGot({ key, ...hit }); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- 열쇠(언어 · 표제어)가 같으면 같은 찾기
  if (!key) return { pending: false, ex: null, View: null };
  if (cache.has(key)) return { pending: false, ...cache.get(key) };
  if (got?.key === key) return { pending: false, ex: got.ex, View: got.View };
  return { pending: true, ex: null, View: null };
}

/** 시험 · 실렌더 하네스용 — 남긴 결과를 비운다. */
export function resetListenExampleCache() {
  cache.clear();
}
