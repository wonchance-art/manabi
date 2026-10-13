// 서버 전용 — 대화 턴 경로 본체(v2-Z Z-R1 ①, CONVERSATION-V2Z-001 §4). 라우트는 인증·분당 한도만 맡고 여기로 넘긴다.
// 새 이음새는 이 경로 하나뿐이다(새 표·새 이벤트 0). 순서: 검증 → 한도 → 프롬프트 → AI 1회 → 검증 →
// 교정 상태 머신(서버 강제) → 새 문단 분석(예산 2.5초) → 낙관 잠금 기록 → 새 문단 토큰만 응답.
// 의존성(supabase·callLLM·analyzeLines)은 주입받는다 — 단위 테스트가 네트워크 없이 전 경로를 돈다.
import {
  CONVERSATION_VERSION, CONVERSATION_DAILY_TURN_LIMIT, CONVERSATION_MAX_TURNS, CONVERSATION_RECENT_TURNS,
  CONVERSATION_EXCERPT_CHARS, CONVERSATION_MAX_INPUT_CHARS, CONVERSATION_MAX_TOPIC_CHARS, CONVERSATION_ANALYZE_BUDGET_MS,
  CONVERSATION_ANALYZED_LANGUAGES, CONVERSATION_LANGUAGES, CONVERSATION_ERRORS, CONVERSATION_RESPONSE_SCHEMA,
  conversationOf, countMyTurns, countTodayMyTurns, openRetryOf, parseTutorResponse, applyCorrectionPolicy,
  appendConversationParagraph, appendParagraphTokens, buildTurnPrompt, judgePoliticalTopic,
} from '../conversation/turnModel.js';
import { conversationSafetyRules } from '../conversation/safety.js';
import { kstDateString } from '../growthStats.js';
import { difficultyNote, newWordCount, reaskSucceeded, reaskTarget } from '../conversation/conversationLoop.js';

const MATERIAL_COLUMNS = 'id,owner_id,visibility,title,raw_text,processed_json';
const ATTEMPT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OUTPUT_WORDS = 10;

const fail = (status, error, code) => ({ status, body: { error, ...(code ? { code } : {}) } });

function cleanWords(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((w) => (typeof w === 'string' ? w.trim().slice(0, 20) : '')).filter(Boolean))].slice(0, MAX_OUTPUT_WORDS);
}

/** 새 문단 분석 — 예산을 넘거나 실패하면 null(글만 돌려주고 화면은 「다시 분석」). */
async function analyzeWithinBudget(analyzeLines, { lines, language, supabase, budgetMs }) {
  if (!CONVERSATION_ANALYZED_LANGUAGES.includes(language)) return { results: null, analysis: 'skipped' };
  let timer;
  try {
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), budgetMs); });
    const run = analyzeLines({ lines, language, supabase }).then((r) => r?.results || null, () => null);
    const out = await Promise.race([run, timeout]);
    if (out === 'timeout') return { results: null, analysis: 'timeout' };
    return out ? { results: out, analysis: 'ok' } : { results: null, analysis: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** 오늘(KST) 내 모든 대화의 내 말 수 — 대화 자료마다 기록한 day/dayTurns를 더한다(인스턴스 메모리가 아니라 DB). */
async function countTodayAcrossConversations(supabase, userId, today) {
  const { data, error } = await supabase.from('reading_materials')
    .select('id,turns:processed_json->metadata->conversation->dayTurns')
    .eq('owner_id', userId)
    .eq('processed_json->metadata->conversation->>day', today);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + (Number(row.turns) || 0), 0);
}

async function savedWordsOf(supabase, userId, materialId) {
  try {
    const { data } = await supabase.from('vocabulary_contexts')
      .select('user_vocabulary(word_text)')
      .eq('user_id', userId).eq('material_id', materialId).limit(20);
    return cleanWords((data || []).map((r) => r.user_vocabulary?.word_text));
  } catch {
    return [];
  }
}

async function readParent(supabase, userId, parentId) {
  if (parentId == null || !/^[0-9]{1,18}$/.test(String(parentId))) return null;
  const { data } = await supabase.from('reading_materials').select(MATERIAL_COLUMNS).eq('id', String(parentId)).maybeSingle();
  if (!data || (data.owner_id !== userId && data.visibility !== 'public')) return null;
  return data;
}

/** Z-R3 다시 꺼내기 — 내 최근 대화들에서 하루 이상 지난 고친 문형 하나. 실패하면 null(대화는 그대로 시작). */
async function reaskFor(supabase, userId, language, now) {
  try {
    const { data, error } = await supabase.from('reading_materials')
      .select('id,language:processed_json->metadata->conversation->>language,turns:processed_json->metadata->conversation->turns,reask:processed_json->metadata->conversation->reask')
      .eq('owner_id', userId)
      .not('processed_json->metadata->conversation', 'is', null)
      .order('id', { ascending: false })
      .limit(20);
    if (error) return null;
    return reaskTarget(data || [], { language, now });
  } catch {
    return null;
  }
}

/**
 * Z-R3 난이도 — 이번 튜터 줄의 새 단어 수(내 단어장에 없는 표제어). 정답 줄은 세지 않는다.
 * 실패하면 null(기록 없이 다음 답장은 기본 난이도).
 */
async function newWordsOf(supabase, userId, added, tutorLineNos) {
  try {
    const tutorLines = new Set(tutorLineNos);
    const tokens = added.sequence
      .filter((id) => tutorLines.has(Number(/^id_(\d+)_/.exec(id)?.[1])))
      .map((id) => added.dictionary[id]);
    if (!tokens.length) return null;
    const words = [...new Set(tokens.map((t) => String(t?.base_form || t?.text || '').trim()).filter(Boolean))].slice(0, 80);
    const { data, error } = await supabase.from('user_vocabulary').select('word_text')
      .eq('user_id', userId).in('word_text', words);
    if (error) return null;
    return newWordCount(tokens, new Set((data || []).map((r) => r.word_text)));
  } catch {
    return null;
  }
}

const lastTutorNewWords = (turns) => {
  for (let i = (turns || []).length - 1; i >= 0; i--) if (turns[i]?.who === 'tutor') return turns[i].newWords;
  return undefined;
};
const pendingReask = (conv) => (conv.reask || []).find((r) => r.ok == null) || null;

function tutorLinesOf(rawText) {
  return String(rawText || '').split('\n');
}

/** 생성 응답 받기 — 한 번 부른다(폴백은 llm.js). 평가 묶음(scripts/eval/run-conversation-eval.mjs)도 이 함수를 그대로 쓴다. */
export async function askTutor(callLLM, prompt, signal) {
  try {
    const { text } = await callLLM('standard', prompt, {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: CONVERSATION_RESPONSE_SCHEMA,
      route: 'conversation-turn',
      timeoutMs: 15_000,
      ...(signal ? { signal } : {}),
    });
    return parseTutorResponse(text);
  } catch {
    return null;
  }
}

/**
 * 이어 쓰기 프롬프트 — 최근 12턴 · 열린 교정 상태 · 오늘 복습한 말 · 이 대화에서 담은 말.
 * 평가 묶음도 이 함수로 프롬프트를 만든다(측정과 제품이 같은 문안).
 */
export function promptForTurn({ conv, rawText, text, inputMode = 'text', action = null, outputWords = [], savedWords = [], excerpt = '' }) {
  const open = openRetryOf(conv.turns);
  return buildTurnPrompt({
    language: conv.language, level: conv.level, topic: conv.topic, excerpt,
    recentTurns: (conv.turns || []).slice(-CONVERSATION_RECENT_TURNS), tutorLines: tutorLinesOf(rawText),
    userText: action === 'reveal'
      ? `(The student asked to see the answer. The correct sentence is shown to them: "${open?.focus.to}". Say "no problem" warmly and ask the next question. "feedback", "focus" and "repair" must be null.)`
      : text,
    inputMode, outputWords, savedWords,
    open: action === 'reveal' ? null : open?.focus || null,
    reask: pendingReask(conv),
    difficulty: difficultyNote(lastTutorNewWords(conv.turns)),
    safetyRules: conversationSafetyRules(conv.language),
  });
}

function nextConversation(conv, { meTurn, closeRetry, tutorTurn, now }) {
  const turns = (conv.turns || []).map((t, i) => (closeRetry && i === closeRetry.index && t.focus
    ? { ...t, focus: { ...t.focus, state: closeRetry.state } }
    : t));
  if (meTurn) turns.push(meTurn);
  turns.push(tutorTurn);
  const today = kstDateString(now);
  return {
    ...conv,
    turns,
    turnCount: (conv.turnCount || 0) + 1,
    day: today,
    dayTurns: countTodayMyTurns(turns, now),
  };
}

/**
 * @param {object} p
 * @param {string} p.userId
 * @param {object} p.body - 요청 본문
 * @param {{supabase, callLLM, analyzeLines}} p.deps
 * @param {number} [p.now]
 * @param {AbortSignal} [p.signal]
 * @returns {Promise<{status: number, body: object}>}
 */
export async function runConversationTurn({ userId, body, deps, now = Date.now(), signal, budgetMs = CONVERSATION_ANALYZE_BUDGET_MS }) {
  const { supabase, callLLM, analyzeLines } = deps;
  if (!body || typeof body !== 'object') return fail(400, 'Bad JSON');
  const action = body.action === 'reveal' ? 'reveal' : null;
  const inputMode = body.inputMode === 'voice' ? 'voice' : 'text';
  const outputWords = cleanWords(body.outputWords);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length > CONVERSATION_MAX_INPUT_CHARS) return fail(400, 'text too long');

  // 1. 시작 — 자료 id가 없으면 비공개 대화 자료를 만들고 첫 질문 턴을 돌려준다.
  if (body.materialId == null) {
    const parent = body.parentId != null ? await readParent(supabase, userId, body.parentId) : null;
    if (body.parentId != null && !parent) return fail(404, 'parent not found');
    const parentMeta = parent?.processed_json?.metadata || {};
    const language = parent ? parentMeta.language : body.language;
    if (!CONVERSATION_LANGUAGES.includes(language)) return fail(400, 'language required');
    const level = String(body.level || parentMeta.level || '').slice(0, 20);
    const topic = String(body.topic || parent?.title || '').trim().slice(0, CONVERSATION_MAX_TOPIC_CHARS);
    if (!topic) return fail(400, 'topic required');
    const attempt = typeof body.attemptId === 'string' && ATTEMPT_RE.test(body.attemptId) ? body.attemptId : null;
    if (attempt) {
      // 두 번 누름·응답 유실 — 같은 시도로 이미 만든 대화가 있으면 그것을 연다(두 벌 생성 0).
      const { data: existing } = await supabase.from('reading_materials').select('id')
        .eq('owner_id', userId).eq('processed_json->metadata->>importAttempt', attempt).limit(1);
      if (existing?.[0]?.id) return { status: 200, body: { materialId: String(existing[0].id), existing: true } };
    }

    const reask = await reaskFor(supabase, userId, language, now);
    const prompt = buildTurnPrompt({
      language, level, topic, reask,
      excerpt: parent ? String(parent.raw_text || '').slice(0, CONVERSATION_EXCERPT_CHARS) : '',
      outputWords, safetyRules: conversationSafetyRules(language), start: true,
    });
    const ai = await askTutor(callLLM, prompt, signal);
    if (!ai) return fail(502, CONVERSATION_ERRORS.noReply, 'no_reply');

    const lines = ai.lines.map((l) => l.t);
    const { rawText, startLine } = appendConversationParagraph('', lines);
    const { results, analysis } = await analyzeWithinBudget(analyzeLines, { lines, language, supabase, budgetMs });
    const ts = now;
    const conversation = {
      version: CONVERSATION_VERSION, topic, level, language,
      ...(parent ? { parentId: String(parent.id) } : {}),
      turnCount: 1, day: kstDateString(now), dayTurns: 0,
      turns: [{ who: 'tutor', lines: lines.map((_, i) => startLine + i), at: now }],
      ...(reask ? { reask: [{ ...reask, ok: null }] } : {}),
    };
    const translations = Object.fromEntries(ai.lines.filter((l) => l.ko).map((l) => [l.t, l.ko]));
    const { json, added } = appendParagraphTokens({
      sequence: [], dictionary: {}, last_idx: -1, failed_indices: [],
      metadata: { language, level, conversation, translations, ...(attempt ? { importAttempt: attempt } : {}) },
    }, { lines, startLine, results, ts, language });
    const firstNewWords = await newWordsOf(supabase, userId, added, conversation.turns[0].lines);
    if (Number.isInteger(firstNewWords)) conversation.turns[0].newWords = firstNewWords;
    const { data, error } = await supabase.from('reading_materials').insert([{
      owner_id: userId, visibility: 'private', title: topic, raw_text: rawText, processed_json: json,
    }]).select('id');
    if (error || !data?.[0]?.id) return fail(500, 'Internal Server Error');
    return {
      status: 200,
      body: {
        materialId: String(data[0].id), turnCount: 1, conversation,
        paragraph: { startLine, lines }, tokens: added, analysis, translations,
      },
    };
  }

  // 2. 이어 쓰기 — 내 대화 자료만.
  const materialId = String(body.materialId);
  if (!/^[0-9]{1,18}$/.test(materialId)) return fail(400, 'materialId invalid');
  const expectedTurn = Number(body.expectedTurn);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 0) return fail(400, 'expectedTurn required');
  const { data: material, error: readError } = await supabase.from('reading_materials')
    .select(MATERIAL_COLUMNS).eq('id', materialId).maybeSingle();
  if (readError) return fail(500, 'Internal Server Error');
  const conv = conversationOf(material);
  if (!material || material.owner_id !== userId || !conv) return fail(404, 'conversation not found');
  if ((conv.turnCount || 0) !== expectedTurn) {
    return { status: 409, body: { error: CONVERSATION_ERRORS.conflict, code: 'conflict', turnCount: conv.turnCount || 0 } };
  }
  const language = conv.language;
  const open = openRetryOf(conv.turns);

  if (action === 'reveal') {
    if (!open) return fail(409, 'no open retry', 'no_open_retry');
  } else {
    if (!text) return fail(400, 'text required');
    if (countMyTurns(conv.turns) >= CONVERSATION_MAX_TURNS) {
      return fail(409, CONVERSATION_ERRORS.conversationFull, 'conversation_full');
    }
    // 하루 한도(KST) — 서버리스에서 인스턴스 메모리는 지켜지지 않으니 내 대화 자료들의 기록에서 센다.
    let today;
    try {
      today = await countTodayAcrossConversations(supabase, userId, kstDateString(now));
    } catch {
      return fail(500, 'Internal Server Error');
    }
    if (today >= CONVERSATION_DAILY_TURN_LIMIT) {
      return { status: 429, body: { error: CONVERSATION_ERRORS.dailyLimit, code: 'daily_limit', limit: CONVERSATION_DAILY_TURN_LIMIT } };
    }
  }

  // 3. 프롬프트(서버 조립) — 최근 12턴 · 열린 교정 상태 · 오늘 복습한 말 · 이 대화에서 담은 말.
  judgePoliticalTopic(text, language); // 경계만(§13) — 기본 구현은 판정 0.
  const parent = conv.parentId ? await readParent(supabase, userId, conv.parentId) : null;
  const savedWords = await savedWordsOf(supabase, userId, materialId);
  const prompt = promptForTurn({
    conv, rawText: material.raw_text, text, inputMode, action, outputWords, savedWords,
    excerpt: parent ? String(parent.raw_text || '').slice(0, CONVERSATION_EXCERPT_CHARS) : '',
  });
  const ai = await askTutor(callLLM, prompt, signal);
  if (!ai) return fail(502, CONVERSATION_ERRORS.noReply, 'no_reply');

  // 4. 교정 상태 머신 — 다시 말하기 1개·1번·연속 금지, 정답 줄 = 처음 저장한 focus.to, 음성 동음 무시.
  const policy = applyCorrectionPolicy({
    turns: conv.turns, ai: action === 'reveal' ? null : ai, userText: text, inputMode, action, level: conv.level, now,
  });

  // 5. 새 문단 = [정답 줄] + 튜터 줄 → raw_text 한 문단. 새 줄만 분석한다.
  const tutorTexts = ai.lines.map((l) => l.t);
  const lines = policy.answerLine ? [policy.answerLine, ...tutorTexts] : tutorTexts;
  const { rawText, startLine } = appendConversationParagraph(material.raw_text, lines);
  const { results, analysis } = await analyzeWithinBudget(analyzeLines, { lines, language, supabase, budgetMs });
  const ts = now;
  const lineNos = lines.map((_, i) => startLine + i);
  const tutorTurn = {
    who: 'tutor',
    lines: policy.answerLine ? lineNos.slice(1) : lineNos,
    ...(policy.answerLine ? { answer: lineNos[0] } : {}),
    at: now,
  };
  const reaskNow = pendingReask(conv);
  const reaskOk = !!reaskNow && !!policy.meTurn && reaskSucceeded(reaskNow, text, policy.meTurn);
  let conversation = nextConversation(conv, { meTurn: policy.meTurn, closeRetry: policy.closeRetry, tutorTurn, now });
  if (reaskOk) conversation = { ...conversation, reask: (conv.reask || []).map((r) => (r === reaskNow ? { ...r, ok: true, at: now } : r)) };
  const newTranslations = Object.fromEntries(ai.lines.filter((l) => l.ko).map((l) => [l.t, l.ko]));
  const prevJson = material.processed_json || {};
  const { json, added } = appendParagraphTokens({
    ...prevJson,
    metadata: {
      ...(prevJson.metadata || {}),
      conversation,
      translations: { ...(prevJson.metadata?.translations || {}), ...newTranslations },
    },
  }, { lines, startLine, results, ts, language });
  const replyNewWords = await newWordsOf(supabase, userId, added, tutorTurn.lines);
  if (Number.isInteger(replyNewWords)) tutorTurn.newWords = replyNewWords;

  // 6. 기록 — 「turnCount = 기대값」 조건(JSON 경로 필터, 낙관 잠금). 어긋나면 409, 화면은 최신 대화를 다시 불러온다.
  const { data: written, error: writeError } = await supabase.from('reading_materials')
    .update({ raw_text: rawText, processed_json: json })
    .eq('id', materialId).eq('owner_id', userId)
    .eq('processed_json->metadata->conversation->>turnCount', String(expectedTurn))
    .select('id');
  if (writeError) return fail(500, 'Internal Server Error');
  if (!written?.length) {
    return { status: 409, body: { error: CONVERSATION_ERRORS.conflict, code: 'conflict' } };
  }

  // 7. 응답 — 새 문단 토큰만. 화면은 받은 토큰을 캐시에 합치고 대화 전체를 다시 받지 않는다.
  return {
    status: 200,
    body: {
      materialId,
      turnCount: conversation.turnCount,
      me: policy.meTurn,
      closeRetry: policy.closeRetry,
      tutor: tutorTurn,
      paragraph: { startLine, lines },
      tokens: added,
      analysis,
      translations: newTranslations,
      dayTurns: conversation.dayTurns,
      conversation, // 턴 기록(작다) — 화면이 대화 전체를 다시 받지 않고 캐시에 합친다
    },
  };
}
