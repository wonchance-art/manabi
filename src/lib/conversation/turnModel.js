// 대화 모드 v2-Z — 대화 턴의 순수 규칙(CONVERSATION-V2Z-001 §3·§4·§6·§13). 서버 턴 경로와 화면이 같은 정의를 쓴다.
//
// 대화 하나 = 내 서재의 비공개 자료 한 건(reading_materials 한 행).
// - raw_text: 한 턴 = 한 문단(빈 줄 구분) — [정답 줄(있으면)] → [튜터 줄 1~3]. 내 말·피드백은 넣지 않는다.
// - processed_json: 새 문단만 분석해 덧붙인다 → 과거 문단 토큰 id(id_줄_순번_시각)는 그대로다.
// - processed_json.metadata.conversation: 턴 기록(내 말·피드백·교정 상태) · turnCount(낙관 잠금) · 오늘 턴 수.
// - processed_json.metadata.translations: 튜터 줄 → 한국어(받아 둔 번역, 문장 탭이 호출 없이 먼저 쓴다).
//
// 인계문은 표식을 metadata.composer{role:'conversation'}로 적었지만, composer version 1 행은 DB 트리거
// (protect_composer_source)가 raw_text를 못 바꾸게 막는다 — 턴마다 문단을 덧붙여야 하는 대화와 맞지 않는다.
// 그래서 표식은 metadata.conversation 하나로 두고, 원본 자료는 conversation.parentId로 잇는다(스키마 0 유지).
//
// 이 파일은 네트워크·DB를 모른다(단위 테스트 대상). 서버 조립은 lib/server/conversationTurn.js.
import { kstDateString } from '../growthStats.js';
import { HANGUL_RE } from '../bilingualSplit.js';
import { tokensCoverLine } from '../analyzeText.js';

export const CONVERSATION_VERSION = 1;
/** 하루 턴 한도(내 말 수, KST) — 오너 결정 2026-10-08. 닿아도 담기·복습은 그대로다. */
export const CONVERSATION_DAILY_TURN_LIMIT = 150;
/** 대화 하나의 내 말 상한 — 넘으면 「이어서 새 대화」 안내. */
export const CONVERSATION_MAX_TURNS = 40;
/** 분당 한도 — 기존 rateLimit(인스턴스 메모리). */
export const CONVERSATION_RATE = Object.freeze({ limit: 20, windowMs: 60_000 });
export const CONVERSATION_RECENT_TURNS = 12;
export const CONVERSATION_EXCERPT_CHARS = 1500;
export const CONVERSATION_MAX_INPUT_CHARS = 300;
export const CONVERSATION_MAX_TOPIC_CHARS = 80;
export const TUTOR_MAX_LINES = 3;
export const TUTOR_MAX_LINE_LEN = 60;
/** 새 문단 분석 예산 — 넘거나 실패하면 글만 돌려주고 화면은 「다시 분석」(기존 failed_indices 재시도). */
export const CONVERSATION_ANALYZE_BUDGET_MS = 2500;
// 못 한 줄 자동 채우기(CONV-CHAT-001) — 답장은 이미 화면에 있으니 기다릴 수 있다. 라우트 maxDuration(60초) 안.
export const CONVERSATION_FILL_BUDGET_MS = 25000;
export const CONVERSATION_FILL_MAX_LINES = 8;
/** 분석기가 받는 언어(중·일·영). 밖의 대화는 평문으로 동작한다. */
export const CONVERSATION_ANALYZED_LANGUAGES = Object.freeze(['Chinese', 'Japanese', 'English']);
export const CONVERSATION_LANGUAGES = Object.freeze(['Chinese', 'Japanese', 'English', 'French']);

export const CONVERSATION_ERRORS = Object.freeze({
  dailyLimit: '오늘은 여기까지 · 내일 다시',
  conversationFull: '이 대화는 여기까지예요 · 이어서 새 대화',
  conflict: '다른 곳에서 먼저 이어 쓴 대화예요 · 최신 대화를 불러올게요',
  noReply: '답장을 받지 못했어요',
});

export const hasHangul = (text) => HANGUL_RE.test(String(text || ''));

/** 대화 자료 표식 — 없으면 null. */
export function conversationOf(material) {
  const value = material?.processed_json?.metadata?.conversation;
  return value && value.version === CONVERSATION_VERSION && Array.isArray(value.turns) ? value : null;
}

/** 오늘(KST) 내가 보낸 턴 수 — turns[].at에서 센다(스키마 0). */
export function countTodayMyTurns(turns, now = Date.now()) {
  const today = kstDateString(now);
  return (turns || []).filter((t) => t?.who === 'me' && Number.isFinite(t.at) && kstDateString(t.at) === today).length;
}

export const countMyTurns = (turns) => (turns || []).filter((t) => t?.who === 'me').length;

/**
 * 초급 판정 — 힌트 크기(§6): 초급(HSK 1~2 · N5~N4 · A0~A2)은 핵심 단어를 짚고, 중급 이상은 규칙만 준다.
 * 수준을 모르면 초급으로 본다(힌트가 없는 것보다 있는 편이 덜 막힌다).
 */
export function isBeginnerLevel(level) {
  const code = String(level || '').trim().split(/\s+/)[0].toUpperCase();
  if (!code) return true;
  return ['OT', 'H1', 'H2', 'HSK1', 'HSK2', 'N5', 'N4', 'A0', 'A1', 'A2'].includes(code);
}

/* ─────────────── 응답 검증 ─────────────── */

/** AI 응답 스키마(Gemini responseSchema). */
export const CONVERSATION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          t: { type: 'STRING', description: 'tutor sentence in the target language only' },
          ko: { type: 'STRING', description: 'Korean translation of t' },
        },
        required: ['t', 'ko'],
      },
    },
    feedback: { type: 'STRING', nullable: true, description: 'Korean, under the student message; hint only' },
    focus: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        from: { type: 'STRING', description: "exact substring of the student's message" },
        to: { type: 'STRING', description: 'the whole corrected sentence' },
        level: { type: 'STRING', enum: ['retry', 'note'] },
        kind: { type: 'STRING', enum: ['grammar', 'word', 'homophone', 'typo'] },
        hint: { type: 'STRING', nullable: true },
      },
      required: ['from', 'to', 'level', 'kind'],
    },
    repair: { type: 'STRING', nullable: true, enum: ['ok', 'avoided', 'no'] },
  },
  required: ['lines'],
};

function parseJsonLoose(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const body = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(body); } catch { /* fallthrough */ }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(body.slice(start, end + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * 튜터 줄 검증(§4-6) — 목표어 1~3문장 · 문장마다 60자 이하 · 한글 0자.
 * 한글이 섞인 줄은 튜터 말풍선에 두지 않는다(듣기는 글 전체를 목표어 목소리 하나로 읽는다 — §12).
 * 그 줄의 내용은 버리고, 남는 줄이 없으면 null(답장을 받지 못함 → 화면 「다시 받기」).
 */
export function validateTutorLines(lines) {
  if (!Array.isArray(lines)) return null;
  const out = [];
  for (const item of lines) {
    const t = cleanText(typeof item === 'string' ? item : item?.t, 400);
    if (!t || hasHangul(t) || t.length > TUTOR_MAX_LINE_LEN) continue;
    const ko = cleanText(item?.ko, 200);
    out.push(ko ? { t, ko } : { t });
    if (out.length >= TUTOR_MAX_LINES) break;
  }
  return out.length ? out : null;
}

/**
 * 모델 응답 → 검증한 턴 재료. JSON이 깨지면 글 전체를 한 문장으로 보고 번역 없이 보인다(§4-6).
 * @returns {{lines: {t:string, ko?:string}[], feedback: string|null, focus: object|null, repair: string|null} | null}
 */
export function parseTutorResponse(text) {
  const json = parseJsonLoose(text);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    const plain = cleanText(String(text ?? '').replace(/^```[\s\S]*?\n|```$/g, ''), 400);
    const lines = validateTutorLines([{ t: plain }]);
    return lines ? { lines, feedback: null, focus: null, repair: null } : null;
  }
  const lines = validateTutorLines(json.lines);
  if (!lines) return null;
  const feedback = cleanText(json.feedback, 300) || null;
  const f = json.focus;
  const focus = f && typeof f === 'object' && cleanText(f.from, 120) && cleanText(f.to, 200)
    ? {
        from: cleanText(f.from, 120),
        to: cleanText(f.to, 200),
        level: f.level === 'retry' ? 'retry' : 'note',
        kind: ['grammar', 'word', 'homophone', 'typo'].includes(f.kind) ? f.kind : 'grammar',
        hint: cleanText(f.hint, 40) || null,
      }
    : null;
  const repair = ['ok', 'avoided', 'no'].includes(json.repair) ? json.repair : null;
  return { lines, feedback, focus, repair };
}

/* ─────────────── 판정 경계(§13) ─────────────── */

/**
 * 정치 화제 판정 경계. 기본 구현(Z-R1)은 판정 0 — 안전은 프롬프트 규칙으로만 지킨다.
 * AF 판정 층이 승인되면 판정 모델로 바꾸고, 기준값 이상이면 생성 모델 대신 TOPIC_STEER_LINES에서 한 줄을 돌려준다.
 * @returns {{p: number|null, source: 'none'}}
 */
export function judgePoliticalTopic(/* text, language */) {
  return { p: null, source: 'none' };
}

/**
 * 다시 말하기 판정 경계. 기본 구현은 생성 응답의 `repair` 필드다(§4-7). 값이 없거나 잘못되면 'no'
 * (정답 줄을 보여 준다 — 못 고친 채 넘어가는 것보다 낫다). 상태 머신(1개·1번·연속 금지)은 이 판정과 무관하게 서버가 강제한다.
 * @returns {{label: 'ok'|'avoided'|'no', source: 'generation'|'default'}}
 */
export function judgeRepair({ aiRepair } = {}) {
  if (['ok', 'avoided', 'no'].includes(aiRepair)) return { label: aiRepair, source: 'generation' };
  return { label: 'no', source: 'default' };
}

/* ─────────────── 교정 상태 머신(§4-7 · §6) ─────────────── */

/** 지금 열려 있는 다시 말하기 — 마지막 내 턴의 focus가 retry·open이고, 그 뒤에 내 턴이 없을 때만. */
export function openRetryOf(turns) {
  const list = turns || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const turn = list[i];
    if (turn?.who !== 'me') continue;
    return turn.focus?.level === 'retry' && turn.focus.state === 'open' ? { index: i, focus: turn.focus } : null;
  }
  return null;
}

/** 바로 앞 내 턴이 다시 말하기였나(열린 다시 말하기에 답한 턴) — 연속 다시 말하기 금지 판정. */
function lastMeTurn(turns) {
  for (let i = (turns || []).length - 1; i >= 0; i--) if (turns[i]?.who === 'me') return turns[i];
  return null;
}

/**
 * 서버가 강제하는 교정 규칙. AI 출력은 재료일 뿐이고, 다시 말하기 수·기회·정답 줄은 여기서 정한다.
 *
 * @param {object} p
 * @param {object[]} p.turns - 지금까지의 턴(이번 턴 전)
 * @param {{feedback, focus, repair}|null} p.ai - parseTutorResponse 결과(답 보기에서는 null 가능)
 * @param {string} [p.userText] - 이번 내 말(답 보기에서는 없음)
 * @param {'text'|'voice'} [p.inputMode]
 * @param {'reveal'} [p.action]
 * @param {string} [p.level] - 대화 수준(힌트 크기)
 * @returns {{
 *   meTurn: object|null,           // 이번에 덧붙일 내 턴(답 보기면 null)
 *   closeRetry: {index:number, state:'fixed'|'missed'|'avoided'|'revealed'}|null, // 열린 다시 말하기를 닫을 때
 *   answerLine: string|null,       // 정답 줄(처음 짚을 때 저장한 focus.to) — raw_text 문단 맨 앞에 넣는다
 *   repair: {label, source}|null,
 * }}
 */
export function applyCorrectionPolicy({ turns = [], ai = null, userText = '', inputMode = 'text', action, level, now = Date.now() }) {
  const open = openRetryOf(turns);
  if (action === 'reveal') {
    if (!open) return { meTurn: null, closeRetry: null, answerLine: null, repair: null, invalid: true };
    return { meTurn: null, closeRetry: { index: open.index, state: 'revealed' }, answerLine: open.focus.to, repair: null };
  }

  const text = String(userText || '');
  const meTurn = { who: 'me', text, inputMode: inputMode === 'voice' ? 'voice' : 'text', at: now };
  let closeRetry = null;
  let answerLine = null;
  let repair = null;

  // 이번 턴이 열린 다시 말하기에 답하는 턴이면 판정한다. 정답 줄은 AI가 다시 쓴 문장이 아니라 처음 저장한 focus.to다.
  if (open) {
    repair = judgeRepair({ focus: open.focus, retryText: text, aiRepair: ai?.repair });
    if (repair.label === 'ok') closeRetry = { index: open.index, state: 'fixed' };
    else {
      closeRetry = { index: open.index, state: repair.label === 'avoided' ? 'avoided' : 'missed' };
      answerLine = open.focus.to;
    }
  }

  let focus = ai?.focus ? { ...ai.focus } : null;
  let feedback = ai?.feedback || null;
  // 오타·문장부호는 짚지 않는다. 음성 입력이면 글자·동음 차이도 짚지 않는다(인식기 오기라서).
  if (focus && (focus.kind === 'typo' || (meTurn.inputMode === 'voice' && focus.kind === 'homophone'))) {
    focus = null;
    feedback = null;
  }
  // focus.from이 내 말 안에 없으면 버린다(엉뚱한 곳에 밑줄이 그어지지 않게). 설명은 피드백 창에 남긴다.
  if (focus && !text.includes(focus.from)) focus = null;

  const answeringRetry = !!open || lastMeTurn(turns)?.focus?.level === 'retry';
  if (open && repair?.label === 'ok' && focus) {
    // 짚은 곳은 고쳤는데 새로 틀렸다 → 이번 턴엔 짚지 않고 요약의 「다음에 볼 것」으로 보낸다.
    meTurn.later = { from: focus.from, to: focus.to };
    focus = null;
    feedback = null;
  } else if (focus && focus.level === 'retry' && answeringRetry) {
    // 다시 말하기는 연속 금지 — 바로 앞 턴이 다시 말하기였으면 이번 오류는 피드백 창만(note)으로 낮춘다.
    focus = { ...focus, level: 'note' };
  }
  if (focus) {
    const beginner = isBeginnerLevel(level);
    focus = {
      from: focus.from,
      to: focus.to,
      level: focus.level,
      kind: focus.kind,
      ...(beginner && focus.hint ? { hint: focus.hint } : {}),
      ...(focus.level === 'retry' ? { state: 'open' } : {}),
    };
  }
  if (focus) meTurn.focus = focus;
  if (feedback) meTurn.feedback = feedback;
  if (closeRetry) meTurn.repair = repair.label;
  return { meTurn, closeRetry, answerLine, repair };
}

/* ─────────────── raw_text · processed_json 덧붙이기(§3) ─────────────── */

const lineCount = (text) => (text ? String(text).split('\n').length : 0);

/**
 * 한 턴 = 한 문단. 기존 글 뒤에 빈 줄 하나를 두고 새 줄을 잇는다.
 * @returns {{rawText: string, startLine: number}} startLine = 새 문단 첫 줄 번호(raw_text.split('\n') 기준)
 */
export function appendConversationParagraph(rawText, lines) {
  const body = lines.map((l) => String(l).replace(/\n/g, ' ').trim()).join('\n');
  const prev = String(rawText || '');
  if (!prev) return { rawText: body, startLine: 0 };
  return { rawText: `${prev}\n\n${body}`, startLine: lineCount(prev) + 1 };
}

/**
 * 새 문단 분석 결과를 processed_json에 덧붙인다. 과거 토큰 id·순서는 그대로 두고, 새 id만 만든다.
 * id 모양은 analyzeHybrid와 같다 — 분석 줄 `id_<줄>_<순번>_<시각>`, 개행 `br_<줄>_<시각>`, 실패 줄 `failed_<줄>_<시각>`.
 * 그래서 화면의 「다시 분석」은 기존 analyzeText(failed_indices) 재시도를 그대로 탄다.
 *
 * @param {object} json - 지금 processed_json(없으면 빈 모양)
 * @param {object} p
 * @param {string[]} p.lines - 새 문단 줄
 * @param {number} p.startLine - appendConversationParagraph의 startLine
 * @param {object[]|null} p.results - /api/analyze 줄 결과(같은 순서). null이면 분석 못 함 → 모두 실패 줄(평문)
 * @param {number} p.ts - id 시각
 * @param {string} p.language - 줄 덮음 판정 언어
 * @returns {{json: object, added: {sequence: string[], dictionary: object}}}
 */
export function appendParagraphTokens(json, { lines, startLine, results, ts, language }) {
  const base = json && typeof json === 'object' ? json : {};
  const sequence = [...(base.sequence || [])];
  const dictionary = { ...(base.dictionary || {}) };
  const failed = [...(base.failed_indices || [])];
  const added = { sequence: [], dictionary: {} };
  const push = (id, token) => {
    sequence.push(id);
    dictionary[id] = token;
    added.sequence.push(id);
    added.dictionary[id] = token;
  };
  if (startLine > 0) {
    // 앞 문단 마지막 줄의 개행 + 빈 줄의 개행(analyzeHybrid가 전체 글을 분석했을 때와 같은 자리).
    push(`br_${startLine - 2}_${ts}`, { text: '\n', pos: '개행' });
    push(`br_${startLine - 1}_${ts}`, { text: '\n', pos: '개행' });
  }
  lines.forEach((line, li) => {
    const idx = startLine + li;
    const result = results?.[li];
    // 줄을 다 덮은 결과만 받는다(analyzeHybrid와 같은 판정) — 뒷부분이 빠진 줄을 「완료」로 두지 않는다.
    const ok = result && Array.isArray(result.sequence) && result.dictionary && !result.truncated
      && result.sequence.length > 0
      && tokensCoverLine(line, result.sequence.map((id) => result.dictionary[id]?.text ?? ''), language);
    if (ok) {
      result.sequence.forEach((srvId, k) => push(`id_${idx}_${k}_${ts}`, result.dictionary[srvId]));
    } else {
      push(`failed_${idx}_${ts}`, { text: line, pos: '미분석', failed: true, original_line_idx: idx });
      failed.push(idx);
    }
    if (li < lines.length - 1) push(`br_${idx}_${ts}`, { text: '\n', pos: '개행' });
  });
  const lastIdx = startLine + lines.length - 1;
  const next = {
    ...base,
    sequence,
    dictionary,
    last_idx: lastIdx,
    failed_indices: failed,
    status: failed.length ? 'partial' : 'completed',
  };
  return { json: next, added };
}

/** 아직 분석 못 한 줄(실패 토큰 `failed_<줄>_…`이 남은 줄) — 자동 채우기 대상. 오름차순. */
export function missingConversationLines(json) {
  const lines = new Set();
  for (const id of json?.sequence || []) {
    const m = /^failed_(\d+)_/.exec(id);
    if (m) lines.add(Number(m[1]));
  }
  return [...lines].sort((a, b) => a - b);
}

/**
 * 못 한 줄 채우기(CONV-CHAT-001) — 실패 토큰 자리에 분석 토큰을 끼운다. 다른 토큰 id·순서는 그대로다.
 * 덮음 판정은 appendParagraphTokens와 같다(줄을 다 덮은 결과만). 판정에 못 미친 줄은 그대로 실패 줄로 남는다.
 *
 * @param {object} json - 지금 processed_json
 * @param {object} p
 * @param {number[]} p.lineNos - 채울 줄 번호
 * @param {string[]} p.lines - 그 줄의 글(같은 순서)
 * @param {object[]|null} p.results - /api/analyze 줄 결과(같은 순서)
 * @param {number} p.ts - 새 id 시각
 * @param {string} p.language
 * @returns {{json: object, filled: Object<string, {remove: string, sequence: string[]}>, dictionary: object}}
 */
export function fillConversationLines(json, { lineNos, lines, results, ts, language }) {
  const base = json && typeof json === 'object' ? json : {};
  let sequence = [...(base.sequence || [])];
  const dictionary = { ...(base.dictionary || {}) };
  const filled = {};
  const addedDictionary = {};
  lineNos.forEach((lineNo, i) => {
    const line = lines[i];
    const result = results?.[i];
    const ok = result && Array.isArray(result.sequence) && result.dictionary && !result.truncated
      && result.sequence.length > 0
      && tokensCoverLine(line, result.sequence.map((id) => result.dictionary[id]?.text ?? ''), language);
    if (!ok) return;
    const at = sequence.findIndex((id) => id.startsWith(`failed_${lineNo}_`));
    if (at < 0) return;
    const remove = sequence[at];
    const ids = result.sequence.map((srvId, k) => {
      const id = `id_${lineNo}_${k}_${ts}`;
      dictionary[id] = result.dictionary[srvId];
      addedDictionary[id] = result.dictionary[srvId];
      return id;
    });
    sequence = [...sequence.slice(0, at), ...ids, ...sequence.slice(at + 1)];
    delete dictionary[remove];
    filled[lineNo] = { remove, sequence: ids };
  });
  const failed = (base.failed_indices || []).filter((n) => !(n in filled));
  return {
    json: { ...base, sequence, dictionary, failed_indices: failed, status: failed.length ? 'partial' : 'completed' },
    filled,
    dictionary: addedDictionary,
  };
}

/** 채우기 응답을 캐시에 합친다 — 그 실패 토큰이 아직 있으면 같은 자리에 끼운다. 바뀐 게 없으면 null. */
export function applyFillResult(material, body) {
  const json = material?.processed_json;
  if (!json || !body?.filled || !Object.keys(body.filled).length) return null;
  let sequence = [...(json.sequence || [])];
  const dictionary = { ...(json.dictionary || {}), ...(body.dictionary || {}) };
  const done = [];
  for (const [line, { remove, sequence: ids }] of Object.entries(body.filled)) {
    const at = sequence.indexOf(remove);
    if (at < 0) continue;
    sequence = [...sequence.slice(0, at), ...ids, ...sequence.slice(at + 1)];
    delete dictionary[remove];
    done.push(Number(line));
  }
  if (!done.length) return null;
  const failed = (json.failed_indices || []).filter((n) => !done.includes(n));
  return { ...material, processed_json: { ...json, sequence, dictionary, failed_indices: failed, status: failed.length ? 'partial' : 'completed' } };
}

/* ─────────────── 프롬프트(§4-4) ─────────────── */

const LANG_LABEL = { Chinese: 'Chinese (Mandarin, simplified)', Japanese: 'Japanese', English: 'English', French: 'French' };

/**
 * 튜터 프롬프트 — 서버에서만 조립한다. 학생 말은 지시가 아니라 대화 내용으로만 다룬다.
 * @param {object} p
 */
export function buildTurnPrompt({
  language, level, topic, excerpt, recentTurns = [], tutorLines = [], userText, inputMode = 'text',
  outputWords = [], savedWords = [], open = null, safetyRules, start = false, reask = null, difficulty = null,
}) {
  const target = LANG_LABEL[language] || language;
  const beginner = isBeginnerLevel(level);
  const history = recentTurns.map((t) => (t.who === 'me'
    ? `Student: ${t.text}`
    : `Tutor: ${(t.lines || []).map((n) => tutorLines[n]).filter(Boolean).join(' ')}`)).join('\n');
  const context = [
    topic ? `Topic: ${topic}` : null,
    excerpt ? `The student read this passage:\n"""\n${excerpt}\n"""` : null,
    `Student level: ${level || 'beginner'}`,
    outputWords.length ? `Words the student reviewed today: ${outputWords.join(', ')}. If it fits naturally, weave in ONE of them. Never force them.` : null,
    savedWords.length ? `Words the student saved in this conversation: ${savedWords.join(', ')}` : null,
    // Z-R3 다시 꺼내기 — 하루 이상 지난 고친 문형을 이 대화에서 한 번 묻는다(정답 문장은 보여 주지 않는다).
    reask?.to ? `Earlier the student corrected a sentence to: "${reask.to}". Once in this conversation, ask a question whose natural answer needs that pattern. Do not show that sentence and do not say it is a review.` : null,
    // Z-R3 난이도 — 직전 답장의 새 단어 수를 목표 1~2개에 맞춘다.
    difficulty || null,
  ].filter(Boolean).join('\n');

  const schemaNote = `Return JSON only:
{"lines":[{"t":"<${target} sentence>","ko":"<Korean translation>"}],
 "feedback":"<Korean or null>",
 "focus":{"from":"<exact substring of the student's message>","to":"<whole corrected sentence>","level":"retry|note","kind":"grammar|word|homophone|typo","hint":"<one ${target} key word or null>"} or null,
 "repair":"ok|avoided|no" or null}`;

  const lineRules = `Tutor lines ("lines"):
- 1 to ${TUTOR_MAX_LINES} short sentences, each at most ${TUTOR_MAX_LINE_LEN} characters.
- ONLY ${target}. Never put Korean (Hangul) in "t". Korean goes only in "ko" and "feedback".
- React to the content first, then keep the conversation going with one question.`;

  if (start) {
    return `You are a warm ${target} conversation mentor for a Korean learner.
${context}

Open the conversation with ONE warm, specific question${excerpt ? ' about the passage' : topic ? ' about the topic' : ''}.
${lineRules}
- "feedback", "focus" and "repair" must be null.

${safetyRules}

${schemaNote}`;
  }

  const retryBlock = open
    ? `The student is retrying ONE sentence. The structure you pointed out: "${open.from}" → expected "${open.to}".
Judge ONLY whether the student now used that structure correctly:
- "ok": the pointed structure is correct now (even if a NEW, different error appeared).
- "avoided": the student avoided the structure by rephrasing without it.
- "no": still wrong.
Put the judgement in "repair". If "ok", praise briefly in "lines" and ask the next question without repeating the corrected sentence.
If "avoided" or "no", say something like "No problem!" in ${target} and move on with a next question. Do not write the correct sentence yourself.`
    : `"repair" must be null.`;

  return `You are a warm ${target} conversation mentor for a Korean learner. You reply in ${target}; explanations for the learner are in Korean.
${context}

Conversation so far (most recent last):
${history || '(none)'}
Student (${inputMode === 'voice' ? 'speech recognition input' : 'typed'}): ${userText}

${lineRules}

Correction rules (one mentor turn):
- Point out at most ONE error, in "focus" + "feedback". Never list every error.
- level "retry": the error blurs meaning, or is at the student's level / a target pattern. "feedback" says in Korean what is wrong and gives a hint, WITHOUT giving the corrected sentence. In "lines", react to the content, then ask the student to say it again.
- level "note": small slips (naturalness, word choice). "feedback" only; continue the conversation normally.
- kind "typo" (typos, punctuation) and${inputMode === 'voice' ? ' — because this is speech recognition — kind "homophone" (same-sound characters, spelling)' : ' kind "homophone"'} are NOT corrected: set "focus" and "feedback" to null and simply use the right form naturally in your reply.
- "hint": ${beginner ? `one key ${target} word that unlocks the fix (beginner).` : 'null — give only the rule in "feedback" (intermediate or higher).'}
- If the student asks a question in Korean, answer it in "feedback" (two sentences or fewer) and in "lines" invite them to try using that expression.
- No scores or grades.
- If the student's message touches a topic covered by the safety rules, "feedback" must not comment on the content of such topics — point out ${target} language errors only.
${retryBlock}

${safetyRules}

${schemaNote}`;
}

/* ─────────────── 화면 캐시 합치기(§4-10) ─────────────── */

/**
 * 턴 응답을 지금 자료(캐시)에 합친다 — 대화 전체를 다시 받지 않는다. 서버가 기록한 것과 같은 규칙
 * (appendConversationParagraph · 받은 새 토큰 덧붙이기)이라 다시 불러와도 같은 모양이다.
 * 캐시가 응답의 바로 앞 턴이 아니면(다른 탭이 먼저 씀) null — 호출부는 자료를 다시 불러온다.
 */
export function applyTurnResult(material, body) {
  const conv = conversationOf(material);
  if (!material || !conv || !body?.conversation || !body.paragraph || !body.tokens) return null;
  if ((conv.turnCount || 0) + 1 !== body.turnCount) return null;
  const { rawText, startLine } = appendConversationParagraph(material.raw_text, body.paragraph.lines);
  if (startLine !== body.paragraph.startLine) return null;
  const json = material.processed_json || {};
  const added = body.tokens;
  const failedAdded = added.sequence
    .map((id) => /^failed_(\d+)_/.exec(id)?.[1])
    .filter((n) => n != null)
    .map(Number);
  const failed = [...(json.failed_indices || []), ...failedAdded];
  return {
    ...material,
    raw_text: rawText,
    processed_json: {
      ...json,
      sequence: [...(json.sequence || []), ...added.sequence],
      dictionary: { ...(json.dictionary || {}), ...added.dictionary },
      last_idx: startLine + body.paragraph.lines.length - 1,
      failed_indices: failed,
      status: failed.length ? 'partial' : 'completed',
      metadata: {
        ...(json.metadata || {}),
        conversation: body.conversation,
        translations: { ...(json.metadata?.translations || {}), ...(body.translations || {}) },
      },
    },
  };
}

/** 줄 번호 → 그 줄의 토큰 id(분석 줄·실패 줄). 개행 토큰은 뺀다. */
export function tokensByLineIndex(sequence) {
  const map = new Map();
  for (const id of sequence || []) {
    const m = /^(?:id|failed)_(\d+)_/.exec(id);
    if (!m) continue;
    const line = Number(m[1]);
    if (!map.has(line)) map.set(line, []);
    map.get(line).push(id);
  }
  return map;
}

/**
 * 화면 묶음 — 턴 목록을 말풍선 순서로 편다. 정답 줄(tutor.answer)은 바로 앞 내 말의 피드백 창에 붙인다.
 * @returns {{kind:'me'|'tutor', index:number, turn:object, answerLine?:number, openRetry?:boolean, fixed?:boolean}[]}
 */
export function conversationItems(conv) {
  const turns = conv?.turns || [];
  const open = openRetryOf(turns);
  const items = [];
  turns.forEach((turn, index) => {
    if (turn.who === 'me') {
      items.push({ kind: 'me', index, turn, openRetry: open?.index === index, fixed: turn.repair === 'ok' });
      return;
    }
    if (Number.isInteger(turn.answer)) {
      for (let k = items.length - 1; k >= 0; k--) {
        if (items[k].kind === 'me') { items[k] = { ...items[k], answerLine: turn.answer }; break; }
      }
    }
    items.push({ kind: 'tutor', index, turn });
  });
  return items;
}
