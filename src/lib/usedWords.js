/**
 * 직접 쓴 말(STATS-MAP-001 · 오너 「2번 좋네 이대로 ㄱㄱ」 2026-11-02 KST) — 담은 말을 내가 작문 · 대화에서 직접 쓴 수.
 * 자료 읽기 순환의 「산출(Output)」 정거장 숫자 — 「다시 만난 말」(들어옴)과 짝인 「나간 말」. 새 기록 · 새 테이블 없음.
 *
 * 셈 규칙(목업 「셈 규칙」 표 그대로):
 * - 쓴 곳 = 작문(writing_practice의 내 문장 — 작문 화면 · 오늘 학습 쓰기 문항) + 대화(대화 모드의 내 말, 음성 입력 포함).
 * - 담은 말 = 그 문장을 쓴 때 이미 담아 둔 말(쓴 뒤에 담은 말은 세지 않는다).
 * - 같은 말 = 담은 말 표기(또는 기본형)가 내 문장에 그대로 들어 있으면 씀. 형태소 분석이 저장돼 있지 않아 표기 대조다 —
 *   활용형(食べた ↔ 食べる)은 일부 빠질 수 있다(숫자가 작게 나오는 쪽, 부풀리지 않음).
 *   라틴 문자 말은 단어 경계로, 가나 한 글자 말은 오탐(の · は 등)이 커서 세지 않는다. 한자 한 글자 말은 양옆이 한자가 아닐 때만
 *   (駅に行く의 駅은 셈, 学校의 学 · 过去의 去는 안 셈).
 * - 처음 씀 = 그 주 전에는 작문 · 대화에서 한 번도 쓴 적 없는 말.
 * 짝: outputWords.pickOutputWords(오늘 복습한 말을 작문 · 회화에 주입할 후보로 고름 — 들어가는 쪽)와 달리, 이 모듈은 실제로 쓴 결과를 센다.
 * 순수 모듈 — 조회는 usedWordsRows.js.
 */

const LATIN = /^[\p{Script=Latin}'’-]+$/u;
const KANA_ONE = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u;
const HAN_ONE = /^\p{Script=Han}$/u;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 담은 말 하나가 문장에 쓰였나 — 표기 또는 기본형. */
export function usesWord(text, row) {
  if (!text || !row?.word_text) return false;
  const forms = [...new Set([row.word_text, row.base_form].filter(f => typeof f === 'string' && f.trim()))];
  return forms.some(form => {
    if (KANA_ONE.test(form)) return false;
    // 한자 한 글자 말은 옆 글자도 한자면 더 긴 말의 일부로 본다(学 ⊂ 学校 · 中文 去 ⊂ 过去) — 운영 실측(2026-11-02 KST):
    // 중국어 담은 말의 20%가 한 글자, 대화 「쓴 말」 맞음 3건이 모두 한 글자 부분 일치였다. 띄어 쓰지 않는 중국어에선 대개 안 세진다(작게 셈).
    if (HAN_ONE.test(form)) return new RegExp(`(^|[^\\p{Script=Han}])${form}($|[^\\p{Script=Han}])`, 'u').test(text);
    if (LATIN.test(form)) return new RegExp(`(^|[^\\p{L}])${escape(form)}($|[^\\p{L}])`, 'iu').test(text);
    return text.includes(form);
  });
}

/**
 * @param {object} p
 * @param {Array<{kind:'writing'|'conversation', id, title, texts:Array<{text, at}>}>} p.sources - 모든 작문 · 대화(창 밖 포함 — 「처음 씀」 판정용)
 * @param {Array<{word_text, base_form, created_at}>} p.vocabRows - 담은 말
 * @param {number} p.fromMs - 창 시작(포함) · @param {number} p.untilMs - 창 끝(제외)
 * @returns {{ total, writing, conversation, firstTime, sources: Array<{kind,id,title,words:string[]}>, firstWords: string[], everUsed: string[] }}
 *   firstWords = 그 주에 처음 쓴 말(칩의 핵심 · 나감) · everUsed = 창과 상관없이 한 번이라도 쓴 말(「아직 안 써 본 말」 판정 재료).
 */
export function buildOutput({ sources = [], vocabRows = [], fromMs = -Infinity, untilMs = Infinity } = {}) {
  const saved = (vocabRows || []).filter(r => r?.word_text).map(r => ({ row: r, savedAt: Date.parse(r.created_at) }));
  const firstEver = new Map(); // 담은 말 → 처음 쓴 시각(창 밖 포함)
  const hits = [];
  for (const source of sources) {
    const words = [];
    const seen = new Set();
    for (const { text, at } of source.texts || []) {
      if (!Number.isFinite(at)) continue;
      for (const { row, savedAt } of saved) {
        if (Number.isFinite(savedAt) && savedAt > at) continue; // 쓴 뒤에 담은 말은 세지 않는다
        if (!usesWord(text, row)) continue;
        const prev = firstEver.get(row.word_text);
        if (prev == null || at < prev) firstEver.set(row.word_text, at);
        if (at >= fromMs && at < untilMs && !seen.has(row.word_text)) { seen.add(row.word_text); words.push(row.word_text); }
      }
    }
    if (words.length) hits.push({ kind: source.kind, id: source.id, title: source.title || '', words });
  }
  hits.sort((a, b) => b.words.length - a.words.length);
  const used = new Set(hits.flatMap(h => h.words));
  const firstWords = [...used].filter(word => { const t = firstEver.get(word); return t != null && t >= fromMs; });
  return {
    total: used.size,
    writing: hits.filter(h => h.kind === 'writing').length,
    conversation: hits.filter(h => h.kind === 'conversation').length,
    firstTime: firstWords.length,
    sources: hits,
    firstWords,
    everUsed: [...firstEver.keys()],
  };
}

/** 쓴 말 셈에 들 수 있는 말인가 — usesWord가 세지 않는 가나 한 글자 말, 띄어 쓰지 않는 중국어의 한자 한 글자 말(써도 거의 안 세짐)은
 *  「안 써 본 말」로도 권하지 않는다(써도 계속 「안 써 본 말」로 남는 권유가 되지 않게). */
const countable = row => [row?.word_text, row?.base_form].some(f => typeof f === 'string' && f.trim() && !KANA_ONE.test(f)
  && !(row?.language === 'Chinese' && HAN_ONE.test(f)));
const lastReviewMs = p => { const v = p?.memory?.lastReview; return v == null ? NaN : typeof v === 'number' ? v : Date.parse(v); };

/**
 * 아직 안 써 본 말(연계 4 — 직접 쓴 말 창 「아직 안 써 본 말로 작문 ›」) — 복습은 했지만 작문 · 대화에서 한 번도 쓰지 않은 담은 말.
 * 가장 최근에 복습한 말부터, 한 언어로만(작문은 한 언어로 쓴다 — 그 가운데 가장 최근에 복습한 말의 언어).
 * 이미 앎 · 제외한 말(복습 대상 아님)은 권하지 않는다.
 * @param {object} p
 * @param {Array} p.projections - 학습 snapshot projections(vocabulary · memory.lastReview · review.available)
 * @param {Iterable<string>} p.everUsed - buildOutput의 everUsed
 * @returns {{ language: string|null, words: string[] }}
 */
export function unusedReviewedWords({ projections = [], everUsed = [], cap = 3 } = {}) {
  const used = new Set(everUsed || []);
  const candidates = (projections || [])
    .filter(p => p?.review?.available === true && p.vocabulary?.word_text && !used.has(p.vocabulary.word_text)
      && countable(p.vocabulary) && Number.isFinite(lastReviewMs(p)))
    .sort((a, b) => lastReviewMs(b) - lastReviewMs(a));
  const language = candidates[0]?.vocabulary.language || null;
  const words = [];
  for (const p of candidates) {
    if ((p.vocabulary.language || null) !== language || words.includes(p.vocabulary.word_text)) continue;
    words.push(p.vocabulary.word_text);
    if (words.length >= cap) break;
  }
  return { language, words };
}

/**
 * 첨삭 결과 한 줄(연계 2) — 「담은 말 N개를 직접 썼어요」. 「직접 쓴 말」과 같은 대조(usesWord)로 방금 쓴 글을 본다.
 * 핵심(처음 씀) = 이 글을 내기(at) 전의 작문 · 대화에서 한 번도 쓴 적 없는 말. 방금 저장된 이 작문 행은 at 뒤라 빠진다
 * (기기 시계가 앞서 있으면 이 행이 「전」으로 잡혀 처음 씀이 줄어드는 쪽 — 부풀리지 않는다). sources를 못 받았으면 핵심 표시만 없다.
 * @param {object} p
 * @param {string} p.text - 첨삭을 받은 원문
 * @param {number} p.at - 원문을 낸 시각
 * @param {Array} p.vocabRows - 담은 말(word_text · base_form · created_at · language)
 * @param {Array|null} p.sources - fetchOutputSources 결과(없으면 null)
 * @param {string|null} p.language - 작문 언어(그 언어의 담은 말만)
 * @returns {{ words: string[], keys: Set<string> }}
 */
export function wordsInWriting({ text, at = Date.now(), vocabRows = [], sources = null, language = null } = {}) {
  const rows = [];
  const seen = new Set();
  for (const row of vocabRows || []) {
    if (!row?.word_text || seen.has(row.word_text) || (language && row.language && row.language !== language)) continue;
    const savedAt = Date.parse(row.created_at);
    if (Number.isFinite(savedAt) && savedAt > at) continue; // 쓴 뒤에 담은 말은 세지 않는다
    if (!usesWord(text, row)) continue;
    seen.add(row.word_text);
    rows.push(row);
  }
  const keys = new Set();
  if (Array.isArray(sources)) {
    // 담기 전에 쓴 글은 「쓴 말」로 치지 않는다(buildOutput과 같은 규칙) — 그때 쓴 것만으로 처음 씀이 지워지지 않게.
    const earlier = sources.flatMap(s => (s.texts || []).filter(t => Number.isFinite(t.at) && t.at < at));
    for (const row of rows) {
      const savedAt = Date.parse(row.created_at);
      if (!earlier.some(t => (!Number.isFinite(savedAt) || t.at >= savedAt) && usesWord(t.text, row))) keys.add(row.word_text);
    }
  }
  return { words: rows.map(r => r.word_text), keys };
}
