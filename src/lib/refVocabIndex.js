'use client';
// 레퍼런스 어휘 인덱스(오너 승인 ②) — "우리가 갖고 있는 단어 사전"(콘텐츠 정본)의
// 급수·뜻·병음·예문·한자 노트를 단어 키로 조회한다. 급수는 단어의 고정 사실이라
// 저장하지 않고 표시 시점에 계산한다(오너 확정: 자동 분류·필터 방식 — 스키마 무변경,
// 기존 저장 단어 소급 적용, 복습 큐 오염 없음).
// 콘텐츠 전체는 무겁기 때문에 언어별 1회 지연 로드(뷰어·단어장에서 쓸 때만).
// 뷰어는 전체를 받지 않는다(ZH-REFVOCAB-SHARD-001, 2026-11-08 KST): 낱말 카드 · 한자 창은 그 글자의 조각(/api/zh-ref, src/lib/zhRefShards.js)만
// 받는다 — 자료를 열자마자 전체(JS 청크 39개 · 폰 1.8MB · PC 4.2MB 전송)를 받던 것. 조각을 못 받으면(오프라인 · 옛 배포) 전체 색인으로 물러난다.

import { useEffect, useState } from 'react';
import { buildVocabIndex, loadZhRefVocabSets } from './zhRefVocabSets';
import { fetchZhRefShard, zhRefShardOf } from './zhRefShards';

export { buildVocabIndex } from './zhRefVocabSets';

let zhIndexPromise = null;
let zhIndexLoaded = null;

/** 언어별 인덱스 로드 — 현재 중국어(승인 범위). 미지원 언어는 null. */
export function loadRefVocabIndex(language) {
  if (language !== 'Chinese') return Promise.resolve(null);
  zhIndexPromise ||= loadZhRefVocabSets().then(buildVocabIndex).then((ix) => { zhIndexLoaded = ix; return ix; });
  return zhIndexPromise;
}

let zhFullWarmed = false;
/**
 * 낱말을 한 번 고른 뒤(읽는 사람) 유휴 시간에 전체 색인을 받는다 — 끊긴 뒤에 처음 고르는 낱말도 예문 · 한자 정보가 뜨게(전에는 열자마자
 * 전체를 받아 그랬다). 자료 하나가 쓰는 조각은 보통 100개 남짓(brotli 약 800KB)이라 자료 단위 조각 미리 받기는 전체(742KB)보다 크다.
 * 고르지 않고 나가는 사람은 아무것도 받지 않는다. 한 번만 건다.
 */
export function warmZhRefFullIndex(schedule = (fn) => (typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 5000 }) : setTimeout(fn, 2000))) {
  if (zhFullWarmed) return;
  zhFullWarmed = true;
  schedule(() => { loadRefVocabIndex('Chinese').catch(() => { zhFullWarmed = false; }); });
}

/** 인덱스 자체 훅(한자 창 같은 표제어 밖 조회용, AE-R4) — 같은 1회 로드 캐시를 쓴다. 미지원 언어·로딩 중은 null. */
export function useRefVocabIndex(language) {
  const [index, setIndex] = useState(null);
  useEffect(() => {
    let alive = true;
    loadRefVocabIndex(language).then((ix) => { if (alive) setIndex(ix); }).catch(() => {});
    return () => { alive = false; };
  }, [language]);
  return index;
}

const shardPromises = new Map();

/**
 * 중국어 조각 하나(표제어 → { level, word }) — 낱말 · 글자의 첫 글자 조각. 같은 조각은 한 번만 받는다.
 * 실패하면 전체 색인으로 물러난다(서비스 워커가 남긴 조각도 없을 때 — 끊김 · 옛 배포). 실패한 받기는 남기지 않아 다음에 다시 시도한다.
 */
export function loadZhRefShard(text) {
  const shard = zhRefShardOf(text);
  if (shard < 0) return Promise.resolve(null);
  if (zhIndexLoaded) return Promise.resolve(zhIndexLoaded); // 전체를 이미 받았으면 조각을 따로 받지 않는다
  let pending = shardPromises.get(shard);
  if (!pending) {
    pending = fetchZhRefShard(shard).catch(() => {
      shardPromises.delete(shard);
      return loadRefVocabIndex('Chinese');
    });
    shardPromises.set(shard, pending);
  }
  return pending;
}

/** 단어의 사전 항목 조회 훅 — 중국어는 낱말을 고를 때 그 조각만 받는다(고르기 전에는 받지 않는다 · 고른 뒤 유휴 시간에 전체). 미지원 언어 · 빈 낱말은 null. */
export function useRefVocabEntry(language, word) {
  const key = language === 'Chinese' && word ? word : null;
  const [found, setFound] = useState({ key: null, entry: null });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    loadZhRefShard(key).then((map) => { if (alive) setFound({ key, entry: map?.get(key) || null }); }).catch(() => {});
    warmZhRefFullIndex();
    return () => { alive = false; };
  }, [key]);
  return found.key === key ? found.entry : null;
}

/**
 * 한자 창 색인 훅(AE-R4) — 창이 열리면(글자 ch) 그 글자의 조각을 바로 쓰고, 뒤에서 전체 색인을 받아 이어 쓴다(창 안에서 다른 글자로 옮겨
 * 갈 때를 위해). 그 글자의 결과는 조각과 전체가 같다(조각 = 그 글자를 가진 단어 전부). 창이 한 번도 안 열리면 아무것도 받지 않는다.
 */
export function useZhRefPopoverIndex(ch) {
  const [state, setState] = useState({ full: null, shard: null, ch: null });
  useEffect(() => {
    if (!ch || state.full) return undefined;
    let alive = true;
    loadZhRefShard(ch).then((map) => { if (alive) setState((cur) => (cur.full ? cur : { ...cur, shard: map, ch })); }).catch(() => {});
    loadRefVocabIndex('Chinese').then((full) => { if (alive) setState((cur) => ({ ...cur, full })); }).catch(() => {});
    return () => { alive = false; };
  }, [ch, state.full]);
  if (state.full) return state.full;
  return state.ch === ch ? state.shard : null;
}
