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
export const LEVEL_LIST_KINDS = ['vocab', 'bunkei', 'hanzi'];
export const LEVEL_KIND_LABEL = { vocab: '단어', bunkei: '문형', hanzi: '한자' };
/** 「한자」 탭(HANZI-TAB-AL-001)이 있는 레벨 — 표(src/lib/data/zhHanzi)가 있는 중국어 급수만. */
export const HANZI_TAB_LEVELS = ['H1', 'H2'];
/** 그 레벨 화면의 탭 — 중국어 HSK 1 · 2만 「한자」가 붙는다. */
export function levelKinds(lang, levelKey) {
  const key = String(levelKey || '').toUpperCase();
  return lang === 'chinese' && HANZI_TAB_LEVELS.includes(key) ? LEVEL_LIST_KINDS : ['vocab', 'bunkei'];
}

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

// ── O · X 빠른 암기 보기 옵션(LEVEL-OX-AN-001, 목업 /mnt/project-files/notes/level-list-ox-mockup.md 2판) ──
// 보기 탭은 하나만 고른다: 전체 · 글자 · 문장 · 뜻 · 소리 — 고른 것 하나만 카드에 남는다(3판, 가린 칸 없음). 나머지 설정은 ⚙ 안 스위치(오너 2026-10-15 「더 직관적이고 심플하게」).
// 「글자」 = 표제어만 보기. 위 줄 목록 종류 「단어」와 이름이 겹쳐 바꿨다(디자인 검토 2026-10-16 A안, id는 그대로 word).
export const LEVEL_VIEWS = Object.freeze([
  { id: 'all', label: '전체' }, { id: 'word', label: '글자' }, { id: 'sentence', label: '문장' },
  { id: 'meaning', label: '뜻' }, { id: 'audio', label: '소리' },
]);
/** 카드를 눌러 펼친 뒤 저절로 접히기까지(오너 지시 2026-10-15 — 다시 누르면 바로 접고, 그대로 두면 10초 뒤 접는다). */
export const LEVEL_PEEK_MS = 10_000;
/** 접히는 움직임 길이 — CSS lv-close와 같다. 움직임 줄이기 설정이면 0. */
export const LEVEL_PEEK_CLOSE_MS = 200;
export const LEVEL_PREFS_DEFAULT = Object.freeze({ view: 'all', hideKnown: false, hun: true, glyph: false, tone: false });

/** 저장된 값 → 검증한 설정. 모르는 값은 버리고 기본값으로. */
export function normalizeLevelPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const flag = (k) => (typeof src[k] === 'boolean' ? src[k] : LEVEL_PREFS_DEFAULT[k]);
  return { view: LEVEL_VIEWS.some((v) => v.id === src.view) ? src.view : 'all',
    hideKnown: flag('hideKnown'), hun: flag('hun'), glyph: flag('glyph'), tone: flag('tone') };
}

// ── 진도 · 이어 하기(LEVEL-FLOW-001, 디자인 검토 2026-10-16 · /mnt/project-files/notes/design-review-1016) ──

/**
 * 지금 탭 기준 진도 — 아는(O) · 공부 중(X) · 남은 개수. 아는 쪽이 먼저다(아는 단어가 저장돼 있어도 아는 쪽으로만 센다).
 * entries = 레벨 전체(숨기기 · 찾기 전), known · studying = 대조 키 Set.
 */
export function levelProgress(entries, known, studying) {
  let k = 0, s = 0;
  for (const e of entries || []) {
    if (known?.has(e.key)) k += 1;
    else if (studying?.has(e.key)) s += 1;
  }
  const total = (entries || []).length;
  return { total, known: k, studying: s, left: total - k - s };
}

// 병음 음절 — 성모(있으면) + 운모. 성조 부호는 모음 위에만 온다.
const PY_VOWEL = 'aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const PY_SYLLABLE = new RegExp(`(?:[zcs]h|[bpmfdtnlgkhjqxrzcsyw])?[${PY_VOWEL}]+(?:ng|n|r(?![${PY_VOWEL}]))?`, 'gi');
const PY_VOWEL_START = new RegExp(`^[${PY_VOWEL}]`, 'i');

/**
 * 붙여 쓴 병음(「báitiān」)을 음절로 가른다 — 성조 색을 음절마다 입히려고. 글자 수와 음절 수가 다르면 null(색 없이 그대로).
 * 모음으로 시작하는 음절은 병음 표기에서 앞에 「'」를 쓰므로, 「'」 없이 모음이 뒤따르면 앞 음절 끝 n · ng의 마지막 자음이
 * 뒤 음절의 성모다(蛋糕 「dàngāo」 = 「dàn|gāo」, 「dàng|āo」가 아니다).
 */
export function pinyinSyllables(reading, count) {
  const text = String(reading || '').trim();
  if (!text || !count) return null;
  const out = [];
  for (const chunk of text.split(/[\s'’·-]+/).filter(Boolean)) {
    const parts = chunk.match(PY_SYLLABLE);
    if (!parts || parts.join('').toLowerCase() !== chunk.toLowerCase()) return null;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!PY_VOWEL_START.test(parts[i + 1])) continue;
      const tail = parts[i].match(/(ng|n)$/i);
      if (!tail || parts[i].length <= tail[0].length) continue;
      const move = tail[0].slice(-1);
      parts[i] = parts[i].slice(0, -1);
      parts[i + 1] = move + parts[i + 1];
    }
    out.push(...parts);
  }
  return out.length === count ? out : null;
}

/** 이어 하기 기록 — 이 기기에만(localStorage). 배움 입구 카드가 읽는다. 계정 기록이 아니라 표시용 사본이다. */
export const LEVEL_SNAPSHOT_KEY = 'manabi:level-progress';
export function writeLevelSnapshot(storage, lang, levelKey, snap) {
  if (!storage || !lang || !levelKey) return;
  try {
    const all = JSON.parse(storage.getItem(LEVEL_SNAPSHOT_KEY) || '{}') || {};
    const cur = all[lang] && typeof all[lang] === 'object' ? all[lang] : {};
    const key = String(levelKey).toUpperCase();
    all[lang] = { last: { level: key, view: snap.view, at: snap.at }, levels: { ...(cur.levels || {}), [key]: { known: snap.known, studying: snap.studying, total: snap.total, at: snap.at } } };
    storage.setItem(LEVEL_SNAPSHOT_KEY, JSON.stringify(all));
  } catch { /* 저장소 없음 — 이어 하기 없이 */ }
}
export function readLevelSnapshot(storage, lang) {
  try {
    const v = JSON.parse(storage?.getItem(LEVEL_SNAPSHOT_KEY) || '{}')?.[lang];
    if (!v?.last?.level || !/^[A-Z0-9]{2}$/.test(v.last.level)) return null;
    const levels = {};
    for (const [k, l] of Object.entries(v.levels || {})) {
      if (/^[A-Z0-9]{2}$/.test(k) && [l?.known, l?.studying, l?.total].every((n) => Number.isInteger(n) && n >= 0)) levels[k] = l;
    }
    return { last: { level: v.last.level, view: LEVEL_VIEWS.some((x) => x.id === v.last.view) ? v.last.view : 'all' }, levels };
  } catch { return null; }
}

/**
 * 배움 입구 카드의 이어 하기 줄 — 마지막에 본 레벨로 가고, 자세한 개수는 여기에만 둔다(공부 화면은 「N개 남음」 하나 —
 * 오너 2026-10-16 「숫자가 대거 적히면 시선이 분산」). 기록이 없으면 null(1급부터 카드 그대로).
 */
export function levelResumeCard(snap, lang = 'chinese') {
  const level = snap?.last?.level;
  const l = level && snap.levels?.[level];
  if (!l || !LEVEL_LIST_LANGS[lang]?.levels.includes(level)) return null;
  return { href: levelListHref(lang, 'vocab', level), title: `${levelLabel(level)} 단어`,
    chips: [`알아요 ${l.known.toLocaleString('en-US')} / ${l.total.toLocaleString('en-US')}`, ...(l.studying > 0 ? [`공부 중 ${l.studying.toLocaleString('en-US')}`] : [])],
    meta: '이어 하기 ↗' };
}
