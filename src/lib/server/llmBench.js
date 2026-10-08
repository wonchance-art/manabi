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

/** 키 설정 여부만(값은 읽지 않는다) — 화면이 실행 전에 보여 준다. */
export function benchModelList() {
  return Object.entries(BENCH_MODELS).map(([id, s]) => ({ id, label: s.label, provider: s.provider, configured: !!process.env[s.env], env: s.env, price: s.price }));
}
