// 대화 모드 순환 강화(v2-Z Z-R3, 시안 conv.html 「학습 설계」·「대화 마치기」) — 순수 함수(조회·쓰기 없음).
//
// - 고친 말은 대화 자료 metadata.conversation.turns에 이미 있다(focus.to = 고친 문장 전체). 새 표·새 이벤트 0.
// - 「못 쓴 말」: 작문 수확기(writingGaps)가 먹는 {sentence, corrected} 모양으로 파생만 한다 — 수확 규칙을 또 쓰지 않는다.
// - 다시 꺼내기: 하루 이상 지난 고친 문형을 다음 대화에서 한 번 묻는다. 맞게 쓰면 그 대화 metadata.reask에 ok가 남고,
//   두 번 맞힌 문형은 더 묻지 않는다(여러 대화의 기록을 세기만 한다 — 다른 자료에 쓰지 않는다).
// - 요약: 써 본 말 ✓ · 스스로 고친 문장 · 다음에 볼 것 · 담은 말. 점수는 없다.
import { diffGapsOf } from '../writingGaps';

export const REASK_AFTER_MS = 24 * 3600e3;
export const REASK_MAX_OK = 2;
export const NEW_WORD_TARGET = Object.freeze({ min: 1, max: 2 });
// 기능어·기호는 「새 단어」로 세지 않는다 — 조사 하나가 매 답장 새 단어 1로 잡히면 난이도 신호가 흐려진다.
const SKIP_POS = new Set(['개행', '기호', '記号', '공백', '조사', '조동사', '助詞', '助動詞', 'string']);

const squash = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const toIso = (at) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * 이 대화에서 짚은 말. state: 'fixed'(스스로 고침) · 'missed'·'avoided'·'revealed'(정답을 봄) · 'open' · 'note'(짚기만) · 'later'(넘어감).
 * @returns {Array<{text, from, to, state, at}>}
 */
export function conversationCorrections(conv) {
  const out = [];
  for (const turn of conv?.turns || []) {
    if (turn?.who !== 'me') continue;
    if (turn.focus?.to) {
      out.push({ text: turn.text || '', from: turn.focus.from || '', to: turn.focus.to, state: turn.focus.state || 'note', at: turn.at ?? null });
    }
    if (turn.later?.to) out.push({ text: turn.text || '', from: turn.later.from || '', to: turn.later.to, state: 'later', at: turn.at ?? null });
  }
  return out;
}

/**
 * 대화 교정 → 작문 「못 쓴 말」 수확 재료(writing_practice 행과 같은 모양).
 * @param {Array<{id, created_at?, language, turns}>} rows - 대화 자료 요약 행
 */
export function conversationGapRows(rows) {
  const out = [];
  for (const row of rows || []) {
    const language = row?.language;
    if (!language) continue;
    conversationCorrections({ turns: row.turns }).forEach((c, i) => {
      out.push({
        id: `conversation-${row.id}-${i}`,
        created_at: toIso(c.at) || row.created_at || null,
        language,
        sentence: c.text,
        corrected: c.to,
        errors: [],
      });
    });
  }
  return out;
}

const patternKey = (to) => squash(to);

/** 한 고친 문형의 「새로 쓴 조각」 — 다시 꺼낸 질문에 이 조각을 다 쓰면 맞힌 것으로 본다. */
export function reaskPieces(target) {
  const pieces = diffGapsOf({ sentence: target?.text || target?.from || '', corrected: target?.to || '' });
  return pieces.length ? pieces : [target?.to || ''].filter(Boolean);
}

/** 내 말이 다시 꺼낸 문형을 맞게 썼나 — 조각을 모두 포함하고, 그 턴에 새로 짚힌 곳이 없을 때. */
export function reaskSucceeded(target, userText, meTurn) {
  if (!target || meTurn?.focus) return false;
  const said = squash(userText);
  const pieces = reaskPieces(target).map(squash).filter(Boolean);
  return pieces.length > 0 && pieces.every((p) => said.includes(p));
}

/**
 * 다음 대화에서 다시 물을 문형 하나(없으면 null). 하루 이상 지난 고친 말 중 가장 최근 것.
 * 이미 두 번 맞힌 문형, 지금 다시 묻는 중인 문형은 뺀다.
 * @param {Array<{id, language, turns, reask?}>} rows - 내 최근 대화들
 */
export function reaskTarget(rows, { language, now = Date.now() } = {}) {
  const okCount = new Map();
  const pending = new Set();
  for (const row of rows || []) {
    for (const r of row?.reask || []) {
      const key = patternKey(r.to);
      if (r.ok === true) okCount.set(key, (okCount.get(key) || 0) + 1);
      else if (r.ok == null) pending.add(key);
    }
  }
  const candidates = [];
  for (const row of rows || []) {
    if (language && row?.language !== language) continue;
    for (const c of conversationCorrections({ turns: row.turns })) {
      const at = Number(new Date(c.at).getTime());
      if (!Number.isFinite(at) || now - at < REASK_AFTER_MS) continue;
      const key = patternKey(c.to);
      if (!key || (okCount.get(key) || 0) >= REASK_MAX_OK || pending.has(key)) continue;
      candidates.push({ ...c, sourceId: String(row.id), atMs: at });
    }
  }
  candidates.sort((a, b) => b.atMs - a.atMs);
  const top = candidates[0];
  return top ? { text: top.text, from: top.from, to: top.to, sourceId: top.sourceId } : null;
}

/**
 * 튜터 답장의 새 단어 수 — 내가 담았거나 아는 말이 아닌 분석 토큰(표제어 기준, 같은 말은 한 번).
 * @param {Array<{base_form?, text?, pos?}>} tokens
 * @param {Set<string>} knownSet - 내 단어장·아는 말 표제어
 */
export function newWordCount(tokens, knownSet = new Set()) {
  const seen = new Set();
  for (const t of tokens || []) {
    if (!t || SKIP_POS.has(t.pos) || t.failed) continue;
    const word = String(t.base_form || t.text || '').trim();
    if (!word || !/[\p{L}]/u.test(word)) continue;
    if (!knownSet.has(word)) seen.add(word);
  }
  return seen.size;
}

/** 다음 답장 난이도 문장(프롬프트) — 직전 답장의 새 단어 수를 목표 1~2개에 맞춘다. 기록이 없으면 null. */
export function difficultyNote(lastNewWords) {
  if (!Number.isInteger(lastNewWords)) return null;
  if (lastNewWords > NEW_WORD_TARGET.max) return `Your previous reply had about ${lastNewWords} words that are new to the student. Use simpler, more familiar words this time: aim for ${NEW_WORD_TARGET.min}-${NEW_WORD_TARGET.max} new words.`;
  if (lastNewWords < NEW_WORD_TARGET.min) return `Your previous reply had no new words for the student. You may include ${NEW_WORD_TARGET.min}-${NEW_WORD_TARGET.max} slightly new words.`;
  return `Keep about ${NEW_WORD_TARGET.min}-${NEW_WORD_TARGET.max} new words per reply, as in your previous reply.`;
}

/**
 * 대화 마치기 요약.
 * @param {object} conv - metadata.conversation
 * @param {{outputWords?: string[], savedWords?: string[]}} extra
 */
export function conversationSummary(conv, { outputWords = [], savedWords = [] } = {}) {
  const turns = conv?.turns || [];
  const mine = turns.filter((t) => t?.who === 'me');
  const ats = turns.map((t) => Number(t?.at)).filter((n) => Number.isFinite(n) && n > 1e11);
  const minutes = ats.length > 1 ? Math.max(1, Math.round((Math.max(...ats) - Math.min(...ats)) / 60000)) : null;
  const said = mine.map((t) => t.text || '').join('\n');
  const used = outputWords.filter((w) => said.includes(w));
  const corrections = conversationCorrections(conv);
  return {
    myTurns: mine.length,
    minutes,
    used,
    outputWords,
    fixed: corrections.filter((c) => c.state === 'fixed'),
    later: corrections.filter((c) => ['later', 'missed', 'avoided', 'revealed', 'note'].includes(c.state)),
    saved: savedWords,
    reaskOk: (conv?.reask || []).filter((r) => r.ok === true),
  };
}
