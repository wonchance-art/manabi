/**
 * 직접 쓴 말(STATS-MAP-001 · 오너 「2번 좋네 이대로 ㄱㄱ」 2026-11-02 KST) — 담은 말을 내가 작문 · 대화에서 직접 쓴 수.
 * 자료 읽기 순환의 「산출(Output)」 정거장 숫자 — 「다시 만난 말」(들어옴)과 짝인 「나간 말」. 새 기록 · 새 테이블 없음.
 *
 * 셈 규칙(목업 「셈 규칙」 표 그대로):
 * - 쓴 곳 = 작문(writing_practice의 내 문장 — 작문 화면 · 오늘 학습 쓰기 문항) + 대화(대화 모드의 내 말, 음성 입력 포함).
 * - 담은 말 = 그 문장을 쓴 때 이미 담아 둔 말(쓴 뒤에 담은 말은 세지 않는다).
 * - 같은 말 = 담은 말 표기(또는 기본형)가 내 문장에 그대로 들어 있으면 씀. 형태소 분석이 저장돼 있지 않아 표기 대조다 —
 *   활용형(食べた ↔ 食べる)은 일부 빠질 수 있다(숫자가 작게 나오는 쪽, 부풀리지 않음).
 *   라틴 문자 말은 단어 경계로, 가나 한 글자 말은 오탐(の · は 등)이 커서 세지 않는다.
 * - 처음 씀 = 그 주 전에는 작문 · 대화에서 한 번도 쓴 적 없는 말.
 * 짝: outputWords.pickOutputWords(오늘 복습한 말을 작문 · 회화에 주입할 후보로 고름 — 들어가는 쪽)와 달리, 이 모듈은 실제로 쓴 결과를 센다.
 * 순수 모듈 — 조회는 usedWordsRows.js.
 */

const LATIN = /^[\p{Script=Latin}'’-]+$/u;
const KANA_ONE = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 담은 말 하나가 문장에 쓰였나 — 표기 또는 기본형. */
export function usesWord(text, row) {
  if (!text || !row?.word_text) return false;
  const forms = [...new Set([row.word_text, row.base_form].filter(f => typeof f === 'string' && f.trim()))];
  return forms.some(form => {
    if (KANA_ONE.test(form)) return false;
    if (LATIN.test(form)) return new RegExp(`(^|[^\\p{L}])${escape(form)}($|[^\\p{L}])`, 'iu').test(text);
    return text.includes(form);
  });
}

/**
 * @param {object} p
 * @param {Array<{kind:'writing'|'conversation', id, title, texts:Array<{text, at}>}>} p.sources - 모든 작문 · 대화(창 밖 포함 — 「처음 씀」 판정용)
 * @param {Array<{word_text, base_form, created_at}>} p.vocabRows - 담은 말
 * @param {number} p.fromMs - 창 시작(포함) · @param {number} p.untilMs - 창 끝(제외)
 * @returns {{ total, writing, conversation, firstTime, sources: Array<{kind,id,title,words:string[]}> }}
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
  let firstTime = 0;
  for (const word of used) { const t = firstEver.get(word); if (t != null && t >= fromMs) firstTime += 1; }
  return {
    total: used.size,
    writing: hits.filter(h => h.kind === 'writing').length,
    conversation: hits.filter(h => h.kind === 'conversation').length,
    firstTime,
    sources: hits,
  };
}
