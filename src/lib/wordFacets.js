/**
 * 탭별 O · X(LEVEL-FACET-AO-001, 오너 결정 2026-10-15 KST 「계정에」) — 레벨 단어 목록의 보기 탭(단어 · 문장 · 뜻 · 소리)마다
 * 아는지 따로 기록한다. 글자를 보고 아는 것(알아보기)과 뜻을 보고 떠올리는 것(떠올리기)은 다른 기억이라(Skritter 면별 추적 ·
 * Pleco scorefile 선례) 아는 단어(user_known_words) 한 줄에 합치지 않는다. 설계 /mnt/project-files/notes/level-list-v4-review.md §2.
 *
 * 이 표는 표시 기록일 뿐이다 — 복습 일정 · 아는 단어 · 단어장에 닿지 않는다. X의 「공부 중으로 담기」는 화면이 기존 저장 경로로 따로 한다.
 * 실패 · 게스트 · 마이그레이션 미적용은 조용히(탭별 표시만 비고, 쓰기 실패는 부르는 쪽이 알린다).
 */
import { supabase } from './supabase';
import { normalizeKnownWord } from './knownWordControl';

export const WORD_FACETS = Object.freeze(['word', 'sentence', 'meaning', 'audio']);
export const isWordFacet = (facet) => WORD_FACETS.includes(facet);

export async function fetchWordFacets(userId, lang) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('user_word_facets').select('word_text, facet, mark, marked_at')
      .eq('user_id', userId).eq('lang', lang).order('word_text').order('facet').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 500) return rows;
  }
}

/** mark = 'o' | 'x' | null(지우기). */
export async function setWordFacet(userId, lang, wordText, facet, mark) {
  if (!isWordFacet(facet)) throw new Error('word_facet_invalid');
  const base = supabase.from('user_word_facets');
  const { error } = mark
    ? await base.upsert({ user_id: userId, lang, word_text: wordText, facet, mark, marked_at: new Date().toISOString() }, { onConflict: 'user_id,lang,word_text,facet' })
    : await base.delete().eq('user_id', userId).eq('lang', lang).eq('word_text', wordText).eq('facet', facet);
  if (error) throw error;
}

/** 여러 단어의 탭 표시 지우기(레벨 초기화 — LEVEL-ROUND-001 ②). 묶음 150개(.in URL 길이). */
export async function clearWordFacets(userId, lang, words) {
  const list = [...new Set(words || [])].filter(Boolean);
  for (let i = 0; i < list.length; i += 150) {
    const { error } = await supabase.from('user_word_facets').delete().eq('user_id', userId).eq('lang', lang).in('word_text', list.slice(i, i + 150));
    if (error) throw error;
  }
}

/** 지운 탭 표시 되살리기(초기화 되돌리기) — 원래 marked_at 그대로. */
export async function restoreWordFacets(userId, lang, rows) {
  for (let i = 0; i < (rows || []).length; i += 500) {
    const { error } = await supabase.from('user_word_facets').upsert(rows.slice(i, i + 500).map((r) => ({ user_id: userId, lang, word_text: r.word_text,
      facet: r.facet, mark: r.mark, ...(r.marked_at ? { marked_at: r.marked_at } : {}) })), { onConflict: 'user_id,lang,word_text,facet' });
    if (error) throw error;
  }
}

/** 행 → Map(단어 → { facet: mark }). 대조는 아는 단어와 같은 NFC 정규화. */
export function facetIndex(rows) {
  const index = new Map();
  for (const row of rows || []) {
    if (!isWordFacet(row?.facet) || (row.mark !== 'o' && row.mark !== 'x')) continue;
    const key = normalizeKnownWord(row.word_text);
    index.set(key, { ...index.get(key), [row.facet]: row.mark });
  }
  return index;
}

export const facetMark = (index, wordText, facet) => index.get(normalizeKnownWord(wordText))?.[facet] || null;

/** 네 탭 모두 O — 아는 단어로 옮길지 한 번 묻는다(자동으로 옮기지 않는다). */
export const allFacetsKnown = (index, wordText) => WORD_FACETS.every((facet) => facetMark(index, wordText, facet) === 'o');

/** 낙관적 반영 — 같은 단어 · 탭의 행을 바꾸거나 지운다. */
export function updateFacetRows(rows, { wordText, facet, mark }) {
  const next = (rows || []).filter((row) => !(row.word_text === wordText && row.facet === facet));
  if (mark) next.push({ word_text: wordText, facet, mark });
  return next;
}
