// 서버 전용 — 모델 비교 측정(LLM-BENCH-001, #1077 AA R3-b). 관리자 API(/api/admin/llm-bench)만 부른다.
//
// 같은 고정 입력(llmBenchFixture.json — scripts/eval/build-llm-bench-fixture.mjs가 제품 함수로 만든다)을 모델 하나에 보내
// 품질·지연·토큰을 잰다. 운영 요청·사전·학습 기록에는 아무것도 쓰지 않는다(호출만 하고 결과는 응답으로만 돌려준다).
//   zhSense    ZH-SENSE-HOLDOUT 문단의 판별 프롬프트(N 경로) → 운영 disambiguateZhPos와 같은 응답 처리 →
//              resolveZhTokenSense/pickZhMeaning → scoreCase(세트 채점기). PASS/FAIL/REVIEW는 세트 지정과의 대조다.
//   meanings   운영 뜻 생성 프롬프트(세트의 미생성 표제어) — 형식 유효성. 원문 응답도 돌려준다(Gemini light의 응답은
//              운영 생성 경로와 같은 입력이라, 오프라인에서 제품 정규화로 세트 후보를 채우는 데 쓴다).
//   translate  뷰어 문장 번역 프롬프트 — 형식 유효성 + 번역 줄(사람이 읽고 판정).
import fixture from './llmBenchFixture.json';
import { BENCH_MODELS, benchOnce } from './llm.js';
import { parseJsonLenient } from './fetchMeanings.js';
import { isCanonPos } from './posCanon';
import { pickZhMeaning, resolveZhTokenPos } from './disambiguateZhPos.js';
import { resolveZhTokenSense, validateZhSensePick, zhSensePickFrom } from './zhSenseReview.js';
import { scoreCase } from '../../../scripts/eval/zhSenseHoldout.mjs';
import qualityFixture from './llmBenchQualityFixture.json';
import { scoreCase as scoreConversationCase } from '../../../scripts/eval/conversationEval.mjs';
import { CONVERSATION_RESPONSE_SCHEMA, TUTOR_MAX_LINES, TUTOR_MAX_LINE_LEN, parseTutorResponse } from '../conversation/turnModel.js';
import { FEEDBACK_SCHEMA, validateFeedback } from '../writingPrompts.js';
import { PARAGRAPH_SCHEMA, stripInlineReadings, validateParagraph, verifyParagraph } from '../studyParagraph.js';

const isCanonZh = (p) => isCanonPos('Chinese', p);
const HANGUL = /[가-힣]/;
export const BENCH_CONCURRENCY = 4;

/**
 * 판별 응답 → 마크별 pick. disambiguateZhPos(운영)의 응답 처리와 같은 규칙이다 — 길이가 다르면 전부 버림,
 * 뜻 후보·묶음 마크는 validateZhSensePick → zhSensePickFrom, 나머지는 pos∈all일 때만. (OOV 분해는 채점 대상과 무관해 뺀다.)
 * 계약 테스트가 같은 응답에서 운영 함수와 같은 pick이 나오는지 대조한다.
 */
export function zhPicksFromText(text, marks) {
  const picks = new Map();
  const parsed = parseJsonLenient(text);
  if (!Array.isArray(parsed) || parsed.length !== marks.length) return { picks, lengthOk: false };
  parsed.forEach((entry, i) => {
    const mark = marks[i];
    if (mark.candidates?.length || mark.pair) {
      const pick = zhSensePickFrom(validateZhSensePick(entry, mark, isCanonZh), mark);
      if (pick) picks.set(mark.key, pick);
      return;
    }
    const all = Array.isArray(entry?.all)
      ? entry.all.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim().slice(0, 20)).filter(isCanonZh).slice(0, 4)
      : [];
    const pos = typeof entry?.pos === 'string' ? entry.pos.trim().slice(0, 20) : '';
    if (pos && all.includes(pos)) picks.set(mark.key, { pos, all });
  });
  return { picks, lengthOk: true };
}

/** 사례 결과 — 운영 라우트와 같은 결정(뜻 검수 켜짐 경로): 검증된 뜻 선택이 있으면 그것, 없으면 품사 → pickZhMeaning. */
export function zhOutcome(c, picks) {
  if (!c.token) return { blocked: '현행 토큰화가 대상과 다름' };
  const pick = picks.get(c.markKey);
  const chosen = resolveZhTokenSense(pick, c.token);
  if (chosen?.meaning) return { meaning: chosen.meaning, via: chosen.via };
  const { pos } = resolveZhTokenPos({ pick, cachedPos: c.cached?.pos, tokenPos: c.token.pos, tokenPosAll: c.token.pos_all });
  return { meaning: pickZhMeaning(c.cached?.meanings, pos), via: 'fallback' };
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const percentile = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const callMeta = (r) => ({ ok: !!r.ok, ms: r.ms, status: r.status ?? null, code: r.ok ? null : r.code, in: r.usage?.in || 0, out: r.usage?.out || 0, thinking: r.usage?.thinking || 0 });
// 오류 상세는 짧게만(키·프롬프트는 응답에 없다 — 공급자 오류 본문의 메시지 앞부분).
const errorNote = (r) => (r.ok ? null : JSON.stringify(r.detail ?? '').slice(0, 300));

/** 모델 하나 측정. 던지지 않는다 — 실패는 결과의 calls·errors로 남는다. */
export async function runBenchModel(id, { data = fixture, call = benchOnce } = {}) {
  const spec = BENCH_MODELS[id];
  if (!spec) return { model: id, error: 'unknown_model' };
  if (!process.env[spec.env]) return { model: id, label: spec.label, error: `no_key:${spec.env}` };
  const started = Date.now();
  const jobs = [
    ...data.zhSense.map((p, i) => ({ kind: 'zhSense', i, prompt: p.prompt, json: true })),
    ...data.meanings.map((m, i) => ({ kind: 'meanings', i, prompt: m.prompt, json: true })),
    ...data.translate.map((t, i) => ({ kind: 'translate', i, prompt: t.prompt, json: false })),
  ];
  const results = await pool(jobs, BENCH_CONCURRENCY, (job) => call(id, job.prompt, { json: job.json }));
  const calls = results.map((r, i) => ({ kind: jobs[i].kind, ...callMeta(r) }));
  const errors = results.flatMap((r, i) => (r.ok ? [] : [{ kind: jobs[i].kind, index: jobs[i].i, code: r.code, status: r.status, note: errorNote(r) }]));

  const verdicts = { all: {}, offered: {}, holdout: {} };
  const bump = (bucket, v) => { bucket[v] = (bucket[v] || 0) + 1; };
  let zhLengthOk = 0;
  const zhCases = [];
  data.zhSense.forEach((p, i) => {
    const r = results[jobs.findIndex((j) => j.kind === 'zhSense' && j.i === i)];
    const { picks, lengthOk } = r.ok ? zhPicksFromText(r.text, p.marks) : { picks: new Map(), lengthOk: false };
    if (lengthOk) zhLengthOk++;
    const offeredKeys = new Set(p.marks.filter((m) => m.candidates?.length).map((m) => m.key));
    for (const c of p.cases) {
      const out = r.ok ? zhOutcome(c, picks) : { error: `call: ${r.status ?? 0}` };
      const { verdict } = scoreCase(c, out);
      bump(verdicts.all, verdict);
      if (offeredKeys.has(c.markKey)) bump(verdicts.offered, verdict);
      if (c.split === 'holdout') bump(verdicts.holdout, verdict);
      zhCases.push({ id: c.id, verdict, meaning: out.meaning ?? null, via: out.via ?? null });
    }
  });

  const meanings = data.meanings.map((m, i) => {
    const r = results[jobs.findIndex((j) => j.kind === 'meanings' && j.i === i)];
    const parsed = r.ok ? parseJsonLenient(r.text) : null;
    const valid = Array.isArray(parsed) && parsed.length === m.forms.length
      && parsed.every((e) => Array.isArray(e?.meanings) && e.meanings.some((x) => HANGUL.test(String(x?.meaning ?? ''))));
    return { forms: m.forms, valid, text: r.ok ? r.text : null };
  });
  const translate = data.translate.map((t, i) => {
    const r = results[jobs.findIndex((j) => j.kind === 'translate' && j.i === i)];
    const text = r.ok ? r.text : '';
    const line = /\*\*번역\*\*\s*\n+([^\n]+)/.exec(text)?.[1]?.trim() || null;
    return { sentence: t.sentence, valid: !!line && HANGUL.test(line), translation: line };
  });

  const ms = calls.filter((c) => c.ok).map((c) => c.ms);
  const tokens = calls.reduce((a, c) => ({ in: a.in + c.in, out: a.out + c.out, thinking: a.thinking + c.thinking }), { in: 0, out: 0, thinking: 0 });
  const [pin, pout] = spec.price;
  return {
    model: id, label: spec.label, wallMs: Date.now() - started,
    calls: { total: calls.length, ok: calls.filter((c) => c.ok).length, p50: percentile(ms, 50), p95: percentile(ms, 95), max: ms.length ? Math.max(...ms) : null },
    tokens, costUsd: Number(((tokens.in * pin + (tokens.out + tokens.thinking) * pout) / 1e6).toFixed(5)),
    zhSense: { paragraphs: data.zhSense.length, lengthOk: zhLengthOk, verdicts, cases: zhCases },
    meanings: { valid: meanings.filter((m) => m.valid).length, total: meanings.length, batches: meanings },
    translate: { valid: translate.filter((t) => t.valid).length, total: translate.length, items: translate },
    perCall: calls, errors,
  };
}

// ───────────── 품질 세트(LLM-BENCH-QUALITY-001) — 회화 턴 · 작문 첨삭 · 오늘의 문단 ─────────────
// Claude 전환(LLM-CLAUDE-001)에서 Sonnet 5.5로 가는 품질 경로를 같은 입력으로 잰다. 고정 입력은 llmBenchQualityFixture.json
// (scripts/eval/build-llm-bench-quality-fixture.mjs — 운영 프롬프트 빌더 그대로, 지은 문장만). 요청 설정은 운영 호출부와 같은 값이다
// (llmBench.test가 호출부 소스와 대조한다). 판정은 둘: 사람이 읽는 줄(read) + 기계 판정(checks — 스키마 · 필드 · 길이 · 금지 표현).
// 핵심 과제 세트와 따로 돈다(POST {model, set:'quality'}) — 함수 실행 시간 상한(60초) 안에 들게.
export const QUALITY_TASKS = Object.freeze({
  conversation: Object.freeze({ route: 'conversation-turn', routeTimeoutMs: 15_000, generationConfig: Object.freeze({ temperature: 0.4, responseMimeType: 'application/json', responseSchema: CONVERSATION_RESPONSE_SCHEMA }) }),
  writing: Object.freeze({ route: 'writing-feedback', routeTimeoutMs: null, generationConfig: Object.freeze({ temperature: 0.2, responseMimeType: 'application/json', responseSchema: FEEDBACK_SCHEMA }) }),
  paragraph: Object.freeze({ route: 'study-paragraph', routeTimeoutMs: null, generationConfig: Object.freeze({ temperature: 0.6, responseMimeType: 'application/json', responseSchema: PARAGRAPH_SCHEMA }) }),
});
export const QUALITY_TIMEOUT_MS = 50_000;

/**
 * 한국어 설명 · 피드백에 나오면 안 되는 표현 — 화면 문구 표준(copy-standard §4 문구 린트)과 같은 꼴 + 형식 누출(코드 블록 · 마크다운 굵게 · JSON 낱말).
 * 학습자 화면에 그대로 붙는 글이라 같은 기준으로 본다.
 */
export const QUALITY_FORBIDDEN = Object.freeze([
  { form: '해주세요', re: /해주세요/ }, { form: '하시겠습니까', re: /하시겠습니까/ }, { form: '실패했습니다', re: /실패했습니다/ },
  { form: '```', re: /```/ }, { form: '**', re: /\*\*/ }, { form: 'JSON', re: /\bJSON\b/i },
]);
const forbiddenIn = (texts) => [...new Set(texts.flatMap((t) => QUALITY_FORBIDDEN.filter((f) => f.re.test(String(t || ''))).map((f) => f.form)))];
const squash = (s) => String(s || '').replace(/[\s.,!?。、，！？]/g, '').toLowerCase();
const koSentences = (s) => String(s || '').split(/(?<=[.!?。])\s+/).map((x) => x.trim()).filter(Boolean).length;

/** 운영 라우트(writing-feedback · study-paragraph)의 parseModelJson과 같은 규칙 — 코드 블록 → JSON.parse → 바깥 중괄호. */
export function parseModelObject(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch {}
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch {}
  }
  return null;
}

const checked = (checks) => ({ checks, pass: Object.values(checks).every((v) => v === true) });

/** 회화 한 턴 — 제품 채점기(conversationEval.scoreCase: parseTutorResponse → 교정 정책)의 판정 + 형식 검사. */
export function scoreQualityConversation(item, text, { context = qualityFixture.conversationContext, ms = null } = {}) {
  const raw = parseModelObject(text);
  const ai = text == null ? null : parseTutorResponse(text);
  const verdict = scoreConversationCase({ context, forbid: { lines: [], feedback: [] } }, item.case, text ?? null);
  const rawLines = Array.isArray(raw?.lines) ? raw.lines : [];
  const lines = ai?.lines || [];
  const checks = {
    schema: !!raw && Array.isArray(raw.lines),
    noDroppedLines: rawLines.length > 0 && rawLines.length <= TUTOR_MAX_LINES && lines.length === rawLines.length, // 한글 섞인 줄 · 60자 넘는 줄은 화면에서 버려진다
    koPresent: lines.length > 0 && lines.every((l) => HANGUL.test(l.ko || '')),
    lineLength: lines.every((l) => l.t.length <= TUTOR_MAX_LINE_LEN),
    forbidden: forbiddenIn([ai?.feedback, ...lines.map((l) => l.ko)]).length === 0,
    verdict: verdict.verdict === 'PASS',
    ...(ms != null ? { routeTimeout: ms <= QUALITY_TASKS.conversation.routeTimeoutMs } : {}),
  };
  return {
    id: item.id, language: item.language, set: item.case.set, verdict: verdict.verdict, rule: verdict.rule ?? null, metric: verdict.metric,
    ...checked(checks), forbiddenHits: forbiddenIn([ai?.feedback, ...lines.map((l) => l.ko)]),
    read: { student: item.case.text, lines: lines.map((l) => `${l.t} — ${l.ko || ''}`), feedback: ai?.feedback ?? null, focus: ai?.focus ?? null },
  };
}

/** 작문 첨삭 — 운영 validateFeedback + 아는 오류 조각을 짚었는가(또는 오류 없는 글에 거짓 지적이 없는가). */
export function scoreQualityWriting(item, text) {
  const raw = parseModelObject(text);
  const fb = validateFeedback(raw);
  const errors = (fb?.sentences || []).flatMap((s) => s.errors);
  const hit = (frag) => errors.some((e) => squash(e.part).includes(squash(frag)) || (squash(e.part) && squash(frag).includes(squash(e.part))));
  const found = (item.expect.errors || []).filter(hit);
  const why = errors.map((e) => e.why);
  const checks = {
    schema: !!fb,
    fields: !!raw && ['score', 'summary', 'levelFit', 'sentences', 'naturalness'].every((k) => k in raw),
    summaryKo: HANGUL.test(fb?.summary || '') && koSentences(fb?.summary) >= 1 && koSentences(fb?.summary) <= 4,
    whyKo: why.every((w) => HANGUL.test(w) && w.length <= 160),
    forbidden: forbiddenIn([fb?.summary, ...why, ...(fb?.naturalness || [])]).length === 0,
    expected: item.expect.clean ? errors.length === 0 : found.length === item.expect.errors.length,
  };
  return {
    id: item.id, language: item.language, ...checked(checks),
    found: item.expect.clean ? null : `${found.length}/${item.expect.errors.length}`, falseFlags: item.expect.clean ? errors.length : null,
    forbiddenHits: forbiddenIn([fb?.summary, ...why, ...(fb?.naturalness || [])]),
    read: { text: item.text, score: fb?.score ?? null, summary: fb?.summary ?? null, corrected: (fb?.sentences || []).map((s) => s.corrected), errors: errors.map((e) => `${e.part} → ${e.fix} (${e.why})`) },
  };
}

/** 오늘의 문단 — 운영 validateParagraph → verifyParagraph(결정적 2차 검증) 통과 + 재료 반영 · 형식 검사. */
export function scoreQualityParagraph(item, text) {
  const raw = parseModelObject(text);
  const validated = validateParagraph(raw);
  const para = validated ? verifyParagraph(validated) : null;
  const m = item.materials;
  const body = squash(raw?.paragraph);
  const words = [...(m.dueWords || []), ...(m.newWords || [])].map((w) => w.word);
  const used = words.filter((w) => body.includes(squash(w)));
  const sentences = validated?.sentences || [];
  const tokensJoin = sentences.filter((s) => squash(s.tokens.join('')) === squash(s.text)).length;
  const needsPron = m.language === 'Japanese' || m.language === 'Chinese';
  const checks = {
    schema: !!validated,
    verified: !!para, // 문항 3개 이상이 2차 검증을 통과(실패면 운영은 같은 프롬프트로 1회 다시 만든다)
    sentenceCount: sentences.length >= 3 && sentences.length <= 5,
    materials: used.length === words.length,
    tokensJoin: sentences.length > 0 && tokensJoin === sentences.length,
    pron: !needsPron || (sentences.length > 0 && sentences.every((s) => !!s.pron)),
    targetOnly: !HANGUL.test(raw?.paragraph || ''),
    translationKo: HANGUL.test(raw?.translation || ''),
    noInlineReading: m.language !== 'Japanese' || stripInlineReadings(raw?.paragraph || '') === (raw?.paragraph || ''),
    forbidden: forbiddenIn([raw?.translation, ...sentences.map((s) => s.ko)]).length === 0,
  };
  return {
    id: item.id, language: item.language, ...checked(checks), materials: `${used.length}/${words.length}`,
    questions: para?.questions?.length ?? 0, forbiddenHits: forbiddenIn([raw?.translation, ...sentences.map((s) => s.ko)]),
    read: { paragraph: raw?.paragraph ?? null, translation: raw?.translation ?? null, questions: (para?.questions || []).map((q) => `[${q.type}] ${q.prompt} → ${q.answer}`) },
  };
}

/** 품질 세트 — 모델 하나. 던지지 않는다. 비용은 기존 단가표(BENCH_MODELS.price)로 같은 식. */
export async function runQualityBench(id, { data = qualityFixture, call = benchOnce } = {}) {
  const spec = BENCH_MODELS[id];
  if (!spec) return { model: id, set: 'quality', error: 'unknown_model' };
  if (!process.env[spec.env]) return { model: id, label: spec.label, set: 'quality', error: `no_key:${spec.env}` };
  const started = Date.now();
  const jobs = ['conversation', 'writing', 'paragraph'].flatMap((kind) => data[kind].map((item, i) => ({ kind, i, item })));
  // 모두 한 번에 — 오래 걸리는 문단 생성이 줄 서서 함수 시간 상한을 넘지 않게(13건 내외).
  const results = await pool(jobs, jobs.length, (job) => call(id, job.item.prompt, {
    json: true, timeoutMs: QUALITY_TIMEOUT_MS, generationConfig: QUALITY_TASKS[job.kind].generationConfig,
  }));
  const calls = results.map((r, i) => ({ kind: jobs[i].kind, ...callMeta(r) }));
  const errors = results.flatMap((r, i) => (r.ok ? [] : [{ kind: jobs[i].kind, index: jobs[i].i, code: r.code, status: r.status, note: errorNote(r) }]));
  const scorer = { conversation: scoreQualityConversation, writing: scoreQualityWriting, paragraph: scoreQualityParagraph };
  const out = { conversation: [], writing: [], paragraph: [] };
  jobs.forEach((job, i) => {
    const r = results[i];
    const scored = job.kind === 'conversation'
      ? scorer.conversation(job.item, r.ok ? r.text : null, { context: data.conversationContext, ms: r.ok ? r.ms : null })
      : scorer[job.kind](job.item, r.ok ? r.text : null);
    out[job.kind].push({ ...scored, ms: r.ms ?? null, ok: !!r.ok });
  });
  const summary = (items) => ({ pass: items.filter((x) => x.pass).length, total: items.length, items });
  const ms = calls.filter((c) => c.ok).map((c) => c.ms);
  const tokens = calls.reduce((a, c) => ({ in: a.in + c.in, out: a.out + c.out, thinking: a.thinking + c.thinking }), { in: 0, out: 0, thinking: 0 });
  const [pin, pout] = spec.price;
  return {
    model: id, label: spec.label, set: 'quality', wallMs: Date.now() - started,
    calls: { total: calls.length, ok: calls.filter((c) => c.ok).length, p50: percentile(ms, 50), p95: percentile(ms, 95), max: ms.length ? Math.max(...ms) : null },
    tokens, costUsd: Number(((tokens.in * pin + (tokens.out + tokens.thinking) * pout) / 1e6).toFixed(5)),
    conversation: summary(out.conversation), writing: summary(out.writing), paragraph: summary(out.paragraph),
    perCall: calls, errors,
  };
}

/** 키 설정 여부만(값은 읽지 않는다) — 화면이 실행 전에 보여 준다. */
export function benchModelList() {
  return Object.entries(BENCH_MODELS).map(([id, s]) => ({ id, label: s.label, provider: s.provider, configured: !!process.env[s.env], env: s.env, price: s.price }));
}
