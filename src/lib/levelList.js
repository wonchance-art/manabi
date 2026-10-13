// 레벨별 단어 · 문형 목록(LEVEL-LIST-AJ-001) — 화면과 서버가 함께 쓰는 순수 규칙.
// 인계 #1337 6119208984(8판) · 보완 6146777048(중국어 급수 = HSK 2026).
// 데이터 조립(무거운 콘텐츠 import)은 levelListData.js(서버 전용), 여기는 표기 · 대조 규칙만 둔다.
import { normalizeKnownWord } from './knownWordControl';

/** 주소의 언어 조각 → 화면 설정. 일본어 · 중국어만 연다(영어 AJ-2 · 프랑스어 FLELex 결정 전). */
export const LEVEL_LIST_LANGS = {
  japanese: { language: 'Japanese', langCode: 'ja', name: '일본어', levels: ['N5', 'N4', 'N3', 'N2', 'N1'], source: '출처 open-anki-jlpt-decks' },
  chinese: { language: 'Chinese', langCode: 'zh', name: '중국어', levels: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
    source: '출처 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행)' },
};
export const LEVEL_LIST_KINDS = ['vocab', 'bunkei'];

/** 화면 이름 — 일 「N5」, 중 「HSK 1」. 레벨 알약은 일 「N5」, 중 「1」. */
export function levelLabel(levelKey) {
  const key = String(levelKey || '').toUpperCase();
  return /^H[1-6]$/.test(key) ? `HSK ${key.slice(1)}` : key;
}
export function levelPill(levelKey) {
  const key = String(levelKey || '').toUpperCase();
  return /^H[1-6]$/.test(key) ? key.slice(1) : key;
}
export const levelListHref = (lang, kind, levelKey) => `/${lang}/${kind}/${String(levelKey).toLowerCase()}`;

/**
 * 뜻은 괄호 앞까지 — 12자 이하 괄호만 남긴다(8판 · 품사 표시 없음).
 * 「안녕하세요 (아침 인사)」 → 그대로, 「안녕하세요 (낮 인사 — 원래 …)」 → 「안녕하세요」.
 */
export function shortMeaning(text) {
  const s = String(text || '').trim();
  // 괄호 묶음을 앞에서부터 본다 — 12자 이하는 그대로 두고, 처음 만난 긴 괄호에서 끊는다(그 뒤 설명도 버린다).
  for (const m of s.matchAll(/[(（]([^()（）]*)[)）]?/g)) {
    if ([...m[1].trim()].length <= 12 && /[)）]$/.test(m[0])) continue;
    const head = s.slice(0, m.index).replace(/[\s,，·、;；—–-]+$/, '');
    return head || s;
  }
  return s;
}

/**
 * 목록 단어의 대조 키 — 저장의 word_text · 아는 단어 표기 · 숨김 대조가 같은 값을 쓴다.
 * 일본어는 레지스트리 중복 제거와 같은 정규화(첫 표기 · 〜 제거 · 공백 제거)라 뷰어 기본형(base_form)과 만난다.
 */
export function levelWordKey(word) {
  return normalizeKnownWord(String(word || '')
    .trim()
    .split(/[;；／、]/)[0]
    .trim()
    .replace(/[～〜~]/g, '')
    .replace(/\s+/g, ''));
}

/** 일본어 표제어 표기 — N5 · N4는 가나 먼저 크게 + 한자 작게, N3부터 한자 위 읽기. */
export function jaHeadMode(levelKey) {
  return ['N5', 'N4'].includes(String(levelKey || '').toUpperCase()) ? 'kana' : 'ruby';
}

const toneless = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const kataToHira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** 찾기 — 지금 레벨 안에서 표제어 · 읽기(가나는 히라가나로, 병음은 성조 없이) · 뜻. */
export function matchesLevelQuery(entry, query) {
  const q = String(query || '').trim();
  if (!q) return true;
  const plain = toneless(kataToHira(q)).replace(/\s+/g, '');
  const fields = [entry.word, entry.reading, entry.meaning, entry.pattern, entry.ko, entry.conn];
  return fields.some((f) => f && (String(f).includes(q)
    || toneless(kataToHira(f)).replace(/\s+/g, '').includes(plain)));
}

/** 아는 단어(loadKnownWords 행 + 대조 키)로 숨길 단어와 보일 단어를 가른다. */
export function splitKnown(entries, knownSet) {
  const shown = [], known = [];
  for (const e of entries || []) (knownSet?.has(e.key) ? known : shown).push(e);
  return { shown, known };
}

/**
 * 이미 단어장에 있는 목록 단어 — 처음부터 「저장됨」(인계 §4 버튼). 표기(word_text)나 기본형(base_form)이
 * 대조 키와 같으면 저장된 것으로 본다(뷰어에서 활용형으로 저장한 단어도 기본형으로 만난다).
 */
export async function fetchSavedLevelKeys(client, userId, language, keys, chunkSize = 150) {
  if (!client || !userId) return new Set();
  const unique = [...new Set((keys || []).filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += chunkSize) chunks.push(unique.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.flatMap((chunk) => ['word_text', 'base_form'].map((column) => client
    .from('user_vocabulary').select('word_text, base_form')
    .eq('user_id', userId).eq('language', language).in(column, chunk))));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  const wanted = new Set(unique);
  const saved = new Set();
  for (const row of results.flatMap((r) => r.data || [])) {
    for (const v of [row.word_text, row.base_form]) {
      const k = normalizeKnownWord(v);
      if (wanted.has(k)) saved.add(k);
    }
  }
  return saved;
}
