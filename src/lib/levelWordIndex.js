// 단어 페이지 찾기 — 전 레벨 사전(HSK 단어 페이지 개편, 오너 확정 2026-10-19 KST · 문서 「찾기 (전 레벨 사전)」).
// 지금 레벨만이 아니라 HSK 1–7 전체에서 찾고, 지금 레벨 결과를 위에 둔다. 색인은 처음 찾기를 열 때만 받는다
// (/api/level-index/chinese — 정적 응답). 이 모듈은 순수 함수만 — 서버 조립(색인 줄 만들기)과 화면(찾기)이 같이 쓴다.
//
// 찾는 말: 한자 · 병음(성조 기호 jīngyàn, 무성조 jingyan, 숫자 jing1yan4, ü 흔들림 lv · lu) · 한국어 뜻(경험).
// 순서: 정확 일치 → 앞 일치 → 포함. 같은 순위 안에서는 낮은 급수 → 짧은 표제어 → 색인 순서(병음 순).

// JLPT 단어 페이지(mode 'ja') — 찾는 말: 가나(가타카나는 히라가나로 맞춘다) · 한자 · 한국어 뜻. N5–N1 전체, 같은 순위면 낮은 레벨(N5 쪽) 먼저.

/** 색인 한 줄 — [표제어, 병음, 짧은 뜻, 급수(1–7)]. 대조 키는 표제어(levelWordKey가 표제어와 다른 줄은 색인에서 뺀다).
 *  일본어는 [표제어, 읽기, 짧은 뜻, 급수(5–1), 글자별 읽기?]. */
export const INDEX_FIELDS = Object.freeze(['word', 'reading', 'meaning', 'level']);

const HAN = /\p{Script=Han}/u;
const HANGUL = /[가-힣ㄱ-ㅎ]/u;
const KANA = /[ぁ-ゖァ-ヺー]/u;

/** 가나 비교 꼴 — 가타카나를 히라가나로, 공백 · 가운뎃점 · 물결표를 뺀다. */
export function kanaKey(text) {
  return String(text || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s　・〜~]/g, '');
}

/** 병음 비교 꼴 — 성조 기호 · 숫자 · 공백 · 따옴표를 빼고, ü(u + ¨) · v를 u로 모은다. */
export function pinyinKey(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/v/g, 'u').replace(/[0-5\s'’·-]/g, '');
}

/** 한 줄의 비교 꼴 — 화면이 색인을 받을 때 한 번만 만든다. */
export function indexEntry(row, at, mode = 'zh') {
  const [word, reading, meaning, level, kr] = row;
  const base = { word, key: word, reading, meaning, level, at, mean: String(meaning || '').replace(/\s+/g, '') };
  return mode === 'ja' ? { ...base, kana: kanaKey(reading || word), ...(kr ? { kr } : {}) } : { ...base, py: pinyinKey(reading) };
}

/** 찾는 말의 종류 — 'han'(한자) · 'ko'(한글) · 'py'(라틴 = 병음). 빈 말이면 null. */
export function queryKind(query, mode = 'zh') {
  const q = String(query || '').trim();
  if (!q) return null;
  if (HAN.test(q)) return 'han';
  if (HANGUL.test(q)) return 'ko';
  if (mode === 'ja') return KANA.test(q) && kanaKey(q) ? 'kana' : null;
  return pinyinKey(q) ? 'py' : null;
}

/** 0 정확 · 1 앞 · 2 포함 · -1 없음. */
function rankIn(field, q) {
  if (!field || !q) return -1;
  if (field === q) return 0;
  if (field.startsWith(q)) return 1;
  return field.includes(q) ? 2 : -1;
}

/** 뜻은 쉼표 · 쌍반점으로 나뉜 낱말 단위로도 정확 · 앞 일치를 본다(「경험, 체험」의 「체험」도 정확 일치). */
function meaningRank(entry, q) {
  let best = rankIn(entry.mean, q);
  if (best === 0) return 0;
  for (const part of String(entry.meaning || '').split(/[,，;；/]/)) {
    const r = rankIn(part.replace(/\s+/g, ''), q);
    if (r >= 0 && (best < 0 || r < best)) best = r;
    if (best === 0) break;
  }
  return best;
}

export function entryRank(entry, kind, q) {
  if (kind === 'han') return rankIn(entry.word, q);
  if (kind === 'ko') return meaningRank(entry, q);
  if (kind === 'py') return rankIn(entry.py, q);
  if (kind === 'kana') return rankIn(entry.kana, q);
  return -1;
}

/**
 * 찾기 — { kind, current:[…], other:[…], total }. current = 지금 급수(level), other = 나머지 급수.
 * 각 항목에 rank를 싣는다(0 정확 · 1 앞 · 2 포함). levelRank = 같은 순위 안 레벨 순서(일본어는 N5 = 5가 먼저 → (l) => -l).
 */
export function searchLevelIndex(entries, query, level, { mode = 'zh', levelRank = (l) => l } = {}) {
  const kind = queryKind(query, mode);
  const empty = { kind, current: [], other: [], total: 0 };
  if (!kind || !entries?.length) return empty;
  const raw = String(query).trim();
  const q = kind === 'py' ? pinyinKey(raw) : kind === 'kana' ? kanaKey(raw) : raw.replace(/\s+/g, '');
  const hits = [];
  for (const e of entries) {
    const rank = entryRank(e, kind, q);
    if (rank >= 0) hits.push({ ...e, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || levelRank(a.level) - levelRank(b.level) || [...a.word].length - [...b.word].length || a.at - b.at);
  const current = hits.filter((e) => e.level === level);
  const other = hits.filter((e) => e.level !== level);
  return { kind, current, other, total: hits.length };
}
