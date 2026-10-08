#!/usr/bin/env node
// 중국어 「이 문장 뜻」 측정 세트(ZH-SENSE-HOLDOUT-001)를 현행(B0·B1)과 시안(N)으로 같은 입력에 돌려 채점한다.
// 설계: docs/manabi-viewer-v2-ad-r4.md §3 (AD-R4 PR① — 제품 코드 0).
//
//   B0  현행 + 정답 품사 가정: pickZhMeaning(후보, 기대 품사). 경계는 현행 토크나이저 결과. 호출 0(오프라인).
//   B1  현행 실제 경로: tokenizeZhLine → collectZhPosMarks → disambiguateZhPos(현행 프롬프트, light 1회/문단)
//       → resolveZhTokenPos → pickZhMeaning. 제품 함수를 그대로 import해 부른다.
//   N   제품 켜짐 경로(AD-R4 PR②·PR④ — 상수 ZH_SENSE_REVIEW·ZH_BOUNDARY_REVIEW와 무관하게 함수로 직접 부른다): 같은 마크 →
//       attachZhSenseCandidates(뜻 후보, 설계서 §4.1) + 제품 [묶음 판정] 쌍(collectZhBoundaryPairs · attachZhBoundaryPairs, §5.2) →
//       disambiguateZhPos(같은 light 1회, 프롬프트 buildZhPosPrompt, 응답 검증 validateZhSensePick §4.3) →
//       제품 경계 결정(applyZhBoundaryJoins — 등재 + join:true만 자동 묶기, 미등재 + join:true는 후보) →
//       resolveZhTokenSense로 토큰 뜻 결정(라우트와 같은 함수). D 범주는 이 최종 토큰으로 채점한다.
//       라우트와 다른 점 하나: 묶은 꼴의 뜻을 붙일 수 있는지(canJoin — 라우트는 사전 행이 있어야 묶는다, 행이 없는 등재 꼴은 같은
//       병렬 뜻 조회로 받는다)는 재지 않는다. 세트 후보 스냅숏에는 이은 꼴의 행이 없고, 뜻 조회는 경계 판정과 다른 축이기 때문이다.
//
// 사용(Node 24, 리포 루트):
//   node scripts/eval/run-zh-sense-holdout.mjs --dry-run        # 세트 검증 + B0 + 현행 토큰화·프롬프트 대조(호출 0)
//   GEMINI_API_KEY=… node scripts/eval/run-zh-sense-holdout.mjs  # B1·N 실제 호출(문단당 각 1회)
//   옵션: --arms b1,n  --split holdout|tune|all(기본 all)  --only B01,D03  --out <dir>  --delay-ms 1500
//         --offer-single    뜻 1개 행에도 후보를 붙인다(설계서 Q3 측정 — 기본은 2개 이상만)
//         --mark-all-targets 지금 마크 밖 대상(기능어 등)도 판별 대상에 넣는다(Q4 측정 — 기본은 현행 마크 그대로)
// 키는 실행하는 셸의 환경 변수로만 둔다. 키·프롬프트 본문을 출력하거나 결과 파일에 기록하지 않는다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ARMS, CATEGORIES, SPLITS, baselineB0, buildParagraphs, buildZhSensePromptDraft,
  evaluateRelease, scoreCase, summarize, validateHoldout,
} from './zhSenseHoldout.mjs';

// 제품 서버 모듈은 번들러 관례(확장자 없는 상대 import·JSON import)를 쓴다. 이 프로세스에서만 Node가 풀 수 있게 한다.
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (err) {
      if (/^\.{1,2}\//.test(specifier) && !/\.(?:[cm]?js|json)$/.test(specifier)) return next(`${specifier}.js`, context);
      throw err;
    }
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    }
    return next(url, context);
  },
});

const root = fileURLToPath(new URL('../../', import.meta.url));
const holdoutPath = join(root, 'docs/verification/zh-sense-holdout-20261008.json');
const productPaths = ['src/lib/server/disambiguateZhPos.js', 'src/lib/server/zhSenseReview.js', 'src/lib/server/zhRegistered.js', 'src/lib/server/zhBoundaryReview.js', 'src/lib/boundaryEdits.js', 'src/lib/server/tokenizeZh.js', 'src/lib/server/llm.js'];
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const mod = (rel) => import(pathToFileURL(join(root, rel)).href);

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const arms = (opt('--arms') || 'b1,n').split(',').map((s) => s.trim().toUpperCase()).filter((a) => a === 'B1' || a === 'N');
const splitOpt = opt('--split') || 'all';
const only = opt('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const delayMs = Number(opt('--delay-ms') ?? 1500);
const offerSingle = args.includes('--offer-single');
const markAllTargets = args.includes('--mark-all-targets');

const set = JSON.parse(readFileSync(holdoutPath, 'utf8'));
const problems = validateHoldout(set);
if (problems.length) { console.error(`세트 검증 실패:\n- ${problems.join('\n- ')}`); process.exit(1); }
const cases = set.cases.filter((c) => (splitOpt === 'all' || c.split === splitOpt) && (!only || only.includes(c.id)));

const { tokenizeZhLine } = await mod('src/lib/server/tokenizeZh.js');
const { collectZhPosMarks, disambiguateZhPos, resolveZhTokenPos, pickZhMeaning, splitZhToken, zhPosMarkKey } = await mod('src/lib/server/disambiguateZhPos.js');
const { attachZhSenseCandidates, createZhSenseStats, resolveZhTokenSense } = await mod('src/lib/server/zhSenseReview.js');
const { applyZhBoundaryJoins, attachZhBoundaryPairs, collectZhBoundaryPairs } = await mod('src/lib/server/zhBoundaryReview.js');

let head = 'unknown';
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* git 없음 */ }
const provenance = {
  holdout: set.id, holdoutSha256: sha(holdoutPath), gitHead: head,
  productModulesSha256: Object.fromEntries(productPaths.map((p) => [p, sha(join(root, p))])),
  evalModuleSha256: sha(join(root, 'scripts/eval/zhSenseHoldout.mjs')),
  tier: 'light', generation: { temperature: 0, timeoutMs: 15000, groq: false },
  options: { split: splitOpt, offerSingle, markAllTargets },
  provisionalCandidates: cases.filter((c) => String(c.candidatesSource || '').startsWith('provisional')).length,
};

// ───────────── 문단 준비(오프라인) ─────────────

const uniq = (xs) => [...new Set(xs)];
const spansOf = (tokens) => { let at = 0; return tokens.map((t) => { const s = { t, start: at, end: at + String(t.text || '').length }; at = s.end; return s; }); };
const tokenAt = (tokens, index) => spansOf(tokens).find((s) => s.start <= index && index < s.end) || null;
const cacheKey = (t) => t.sep_link || t.base_form;

function prepare(par) {
  const lines = par.cases.map((c) => c.sentence);
  const tokenizedLines = lines.map((line) => ({ original: line, tokens: tokenizeZhLine(line) }));
  const cache = new Map();
  for (const c of par.cases) {
    if (!c.candidates) continue;
    cache.set(c.target.base, { base_form: c.target.base, pos: uniq(c.candidates.map((m) => m.pos)).join('·'), meanings: c.candidates.map((m) => ({ meaning: m.meaning, pos: m.pos })), source: 'snapshot' });
  }
  const marks = collectZhPosMarks(tokenizedLines, cache);
  return { ...par, lines, tokenizedLines, cache, marks };
}

// 라우트 조립과 같다 — 경계 표식(사용자 기록·자동 묶기)이 붙은 토큰은 OOV 분리를 하지 않는다.
const finalTokens = (tokens, lineIdx, picks) => tokens.flatMap((t) => {
  const parts = t.boundary ? null : picks.get(zhPosMarkKey(lineIdx, t.text))?.parts;
  return parts?.length ? splitZhToken(t, parts) : [t];
});
const targetFound = (prep, c, lineIdx) => {
  const a = tokenAt(prep.tokenizedLines[lineIdx].tokens, c.target.index);
  return !!a && a.start === c.target.index && a.t.text === c.target.surface;
};
const mergedAt = (tokens, c) => {
  const a = tokenAt(tokens, c.target.index);
  return !!a && a.end >= c.target.index + c.boundary.pair[0].length + 1;
};

/**
 * 한 팔의 사례 결과(뜻 또는 경계). senseOn: N(제품 켜짐 경로 — 라우트와 같은 resolveZhTokenSense).
 * lines: 경계를 정한 뒤의 줄(N = applyZhBoundaryJoins 결과, B1 = 토크나이저 그대로).
 */
function outcomeFor(c, lineIdx, prep, picks, senseOn = false, lines = prep.tokenizedLines) {
  const tokens = finalTokens(lines[lineIdx].tokens, lineIdx, picks);
  if (c.cat === 'D') {
    const at = tokenAt(tokens, c.target.index);
    const merged = mergedAt(tokens, c);
    return { merged, autoMerged: merged && at?.t.boundary === 'ai_registered', suggested: !merged && at?.t.boundarySuggest === c.boundary.pair.join('') };
  }
  const at = tokenAt(tokens, c.target.index);
  if (!at || at.start !== c.target.index || at.t.text !== c.target.surface) {
    return { blocked: `현행 토큰화가 대상과 다름: ${at ? at.t.text : '(없음)'}` };
  }
  const t = at.t;
  const key = zhPosMarkKey(lineIdx, t.text);
  const cached = prep.cache.get(cacheKey(t));
  const { pos } = resolveZhTokenPos({ pick: picks.get(key), cachedPos: cached?.pos, tokenPos: t.pos, tokenPosAll: t.pos_all });
  const chosen = senseOn ? resolveZhTokenSense(picks.get(key), t) : null;
  if (chosen?.meaning) return { meaning: chosen.meaning, via: chosen.via, pos, ...(chosen.meaningCheck ? { meaningCheck: chosen.meaningCheck } : {}) };
  return { meaning: pickZhMeaning(cached?.meanings, pos), via: 'fallback', pos, ...(chosen?.meaningCheck ? { meaningCheck: chosen.meaningCheck } : {}) };
}

/** N 마크: 현행 마크 + 뜻 후보(제품 attachZhSenseCandidates, 설계서 §4.1) + 제품 묶음 판정 쌍(§4.2·§5.2). {marks, pairs} */
function buildN(prep) {
  const base = prep.marks.map((m) => ({ ...m }));
  if (markAllTargets) {
    prep.cases.forEach((c, lineIdx) => {
      if (c.cat === 'D') return;
      const key = zhPosMarkKey(lineIdx, c.target.surface);
      if (!base.some((m) => m.key === key)) base.push({ lineIdx, word: c.target.surface, key });
    });
  }
  const marks = attachZhSenseCandidates(base, { tokenizedLines: prep.tokenizedLines, cache: prep.cache, minMeanings: offerSingle ? 1 : 2 });
  // 라우트와 같은 규칙: 쌍은 다른 마크가 있을 때만, 단어성 판정 마크는 현행 마크(prep.marks) 기준.
  const pairs = prep.marks.length ? collectZhBoundaryPairs(prep.tokenizedLines, { cache: prep.cache, marks: prep.marks }) : [];
  return { marks: pairs.length ? attachZhBoundaryPairs(marks, pairs) : marks, pairs };
}

// ───────────── fetch 감시(호출 수·dry-run 차단) ─────────────

const realFetch = globalThis.fetch;
let fetchCount = 0;
let captured = [];
const cannedText = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }), text: async () => text });
globalThis.fetch = async (url, init) => {
  fetchCount++;
  if (dryRun) { // dry-run은 네트워크로 나가지 않는다 — 요청 본문만 잡고 빈 응답을 준다
    try { captured.push(JSON.parse(init?.body ?? '{}').contents?.[0]?.parts?.[0]?.text ?? ''); } catch { captured.push(''); }
    return cannedText('[]');
  }
  return realFetch(url, init);
};
const llmLog = [];
const realInfo = console.info;
console.info = (...a) => { // callLLM 텔레메트리 줄([llm] {...} — 프롬프트 없음)을 모아 모델·지연을 기록
  if (a[0] === '[llm]') { try { llmLog.push(JSON.parse(a[1])); } catch { /* 무시 */ } if (dryRun) return; }
  realInfo(...a);
};
const realWarn = console.warn;
console.warn = (...a) => { // dry-run의 빈 응답이 내는 「length mismatch」 경고는 예상된 것이라 숨긴다
  if (dryRun && String(a[0]).startsWith('[disambiguateZhPos] length mismatch')) return;
  realWarn(...a);
};

const paragraphs = buildParagraphs(cases).map(prepare);
const rows = [];
const parStats = [];

// B0 + 현행 프롬프트 대조(항상, 호출 0)
for (const [pi, prep] of paragraphs.entries()) {
  prep.cases.forEach((c, lineIdx) => {
    const currentMerged = c.cat === 'D' ? mergedAt(prep.tokenizedLines[lineIdx].tokens, c) : undefined;
    const out = baselineB0(c, pickZhMeaning, currentMerged);
    rows.push({ arm: 'B0', paragraph: pi, id: c.id, cat: c.cat, split: c.split, ...out, ...scoreCase(c, out) });
  });
}

let promptDrift = null;
if (dryRun) {
  if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = 'dry-run-fetch-is-stubbed'; // 현행 판별기가 키 검사를 지나야 프롬프트를 만든다. fetch는 위에서 막혀 있다.
  for (const [pi, prep] of paragraphs.entries()) {
    captured = [];
    if (prep.marks.length) await disambiguateZhPos(prep.lines, prep.marks);
    const current = captured[0] ?? '';
    const draftNoExtras = prep.marks.length ? buildZhSensePromptDraft(prep.lines, prep.marks) : '';
    if (current !== draftNoExtras && !promptDrift) promptDrift = `문단 ${pi}: N 시안(추가분 없음)이 현행 buildZhPosPrompt와 다름 — 현행 프롬프트가 바뀌었으면 시안을 먼저 맞춘다`;
    const { marks: marksN } = buildN(prep);
    const targetsFound = prep.cases.filter((c, lineIdx) => c.cat === 'D' || targetFound(prep, c, lineIdx)).length;
    parStats.push({
      paragraph: pi, split: prep.split, ids: prep.cases.map((c) => c.id), marks: prep.marks.length, marksN: marksN.length,
      offered: marksN.filter((m) => m.candidates).length, joinAsked: marksN.filter((m) => m.pair).length,
      promptCharsB1: current.length, promptCharsN: buildZhSensePromptDraft(prep.lines, marksN).length,
      targetsFound, targets: prep.cases.length,
    });
  }
}

if (!dryRun) {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY가 이 셸에 없습니다. 키 값은 채팅·파일에 붙이지 말고 환경 변수로만 넣으세요.'); process.exit(2); }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [pi, prep] of paragraphs.entries()) {
    const ps = { paragraph: pi, split: prep.split, ids: prep.cases.map((c) => c.id), marks: prep.marks.length };
    if (arms.includes('B1')) {
      const before = fetchCount;
      const logBefore = llmLog.length;
      const t0 = Date.now();
      const picks = prep.marks.length ? await disambiguateZhPos(prep.lines, prep.marks) : new Map();
      const log = llmLog.slice(logBefore).find((l) => l.route === 'disambiguateZhPos');
      Object.assign(ps, { b1Calls: fetchCount - before, b1Ms: log?.ms ?? Date.now() - t0, b1Model: log?.model ?? null, b1Ok: log?.ok ?? null, b1Picks: picks.size });
      prep.cases.forEach((c, lineIdx) => {
        const out = log && !log.ok ? { error: `call: ${log.status}` } : outcomeFor(c, lineIdx, prep, picks);
        rows.push({ arm: 'B1', paragraph: pi, id: c.id, cat: c.cat, split: c.split, ...out, ...scoreCase(c, out) });
      });
      await sleep(delayMs);
    }
    if (arms.includes('N')) {
      const { marks: marksN, pairs } = buildN(prep);
      const before = fetchCount;
      const logBefore = llmLog.length;
      const stat = createZhSenseStats(marksN);
      const picks = marksN.length ? await disambiguateZhPos(prep.lines, marksN, { senseStats: stat }) : new Map();
      const log = llmLog.slice(logBefore).find((l) => l.route === 'disambiguateZhPos');
      const error = log && !log.ok ? `call: ${log.status}` : null;
      const joined = applyZhBoundaryJoins(prep.tokenizedLines, pairs, picks); // 제품 경계 결정(라우트 4.7과 같은 함수)
      stat.joinApplied = joined.applied;
      stat.joinSuggested = joined.suggested;
      Object.assign(ps, { nCalls: fetchCount - before, nMs: log?.ms ?? null, nModel: log?.model ?? null, marksN: marksN.length, zhSense: stat });
      prep.cases.forEach((c, lineIdx) => {
        const out = error ? { error } : outcomeFor(c, lineIdx, prep, picks, true, joined.tokenizedLines);
        rows.push({ arm: 'N', paragraph: pi, id: c.id, cat: c.cat, split: c.split, ...out, ...scoreCase(c, out) });
      });
      if (pi < paragraphs.length - 1) await sleep(delayMs);
    }
    parStats.push(ps);
    console.log(`[${pi + 1}/${paragraphs.length}] ${prep.split} ${ps.ids.join(',')} B1 ${ps.b1Ms ?? '-'}ms · N ${ps.nMs ?? '-'}ms`);
  }
}

// ───────────── 집계 · 출력 ─────────────

const summary = summarize(set, rows);
const callStats = (key) => ({ calls: parStats.filter((p) => p.split === 'holdout').map((p) => p[`${key}Calls`] ?? 0), ms: parStats.filter((p) => p.split === 'holdout').map((p) => p[`${key}Ms`]) });
const release = !dryRun && arms.includes('B1') && arms.includes('N') ? evaluateRelease(set, rows, { b1: callStats('b1'), n: callStats('n') }) : null;
const composition = Object.fromEntries(CATEGORIES.map((cat) => [cat, Object.fromEntries(SPLITS.map((s) => [s, cases.filter((c) => c.cat === cat && c.split === s).length]))]));
// 현행 토크나이저가 대상을 다른 경계로 자르는 사례(B1·N에서 BLOCKED가 된다)
const blockedNow = paragraphs.flatMap((prep) => prep.cases.filter((c, lineIdx) => c.cat !== 'D' && !targetFound(prep, c, lineIdx)).map((c) => c.id));
const line = (k) => { const s = summary[k]; return s ? `PASS ${s.PASS} · FAIL ${s.FAIL} · REVIEW ${s.REVIEW} · BLOCKED ${s.BLOCKED} · ERROR ${s.ERROR}` : '-'; };

if (dryRun) {
  if (promptDrift) { console.error(promptDrift); process.exit(1); }
  if (fetchCount !== parStats.filter((p) => p.marks > 0).length) { console.error(`dry-run fetch ${fetchCount}회 ≠ 마크 있는 문단 ${parStats.filter((p) => p.marks > 0).length}개`); process.exit(1); }
  console.log(JSON.stringify({
    ...provenance, validation: 'ok', networkCalls: 0, cases: cases.length, composition, paragraphs: parStats,
    promptDraftMatchesCurrent: true,
    plannedCalls: { B1: parStats.filter((p) => p.marks > 0).length, N: parStats.filter((p) => p.marksN > 0).length },
    B0: { tune: line('B0/tune'), holdout: line('B0/holdout'), fail: rows.filter((r) => r.arm === 'B0' && r.verdict === 'FAIL').map((r) => r.id) },
    currentTokenizationMismatch: blockedNow,
  }, null, 2));
  console.info = realInfo;
  process.exit(0);
}

const startedAt = new Date().toISOString();
const out = opt('--out') || join(tmpdir(), `manabi-zh-sense-holdout-${startedAt.replace(/[:.]/g, '-')}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), `${JSON.stringify({ ...provenance, arms: ['B0', ...arms], finishedAt: new Date().toISOString(), summary, release, paragraphs: parStats, rows }, null, 2)}\n`);
const cell = (r) => (r ? `${r.verdict}${r.meaning ? ` ${r.meaning}` : r.merged != null ? ` ${r.merged ? '묶임' : '나뉨'}` : ''}` : '-').replace(/\|/g, '\\|');
const byArm = (arm, id) => rows.find((r) => r.arm === arm && r.id === id);
const table = ['| ID | 세트 | 범주 | 대상 | B0 | B1 | N | N 사유 |', '|---|---|---|---|---|---|---|---|',
  ...cases.map((c) => `| ${c.id} | ${c.split} | ${c.cat} | ${c.target.surface} | ${cell(byArm('B0', c.id))} | ${cell(byArm('B1', c.id))} | ${cell(byArm('N', c.id))} | ${(byArm('N', c.id)?.reason ?? '').replace(/\|/g, '\\|')} |`)];
const sums = ARMS.flatMap((arm) => SPLITS.map((s) => `- **${arm} / ${s}**: ${line(`${arm}/${s}`)}`));
writeFileSync(join(out, 'results.md'), [
  `# ${set.id} 실행 결과`, '', `git \`${head}\` · 세트 SHA-256 \`${provenance.holdoutSha256}\` · 임시 후보 ${provenance.provisionalCandidates}건(운영 스냅숏 교체 전이면 결과도 임시)`, '',
  ...sums, '', `**켜는 기준(보류 세트)**: ${release ? `${release.status}${release.reasons.length ? ` — ${release.reasons.join('; ')}` : ''}` : '판정 안 함(B1·N 둘 다 돌려야 함)'}`, '',
  'REVIEW 행은 사람이 판정해 기록하기 전까지 통과로 세지 않는다. 보류 세트 결과를 보고 프롬프트·후처리·기대 답을 고치면 그 보류 세트는 소모된다.', '',
  ...table, '', '## 사람 판정 양식', '', '| ID | 팔 | 결과 뜻·경계 | 판정(수락/거부) | 근거 | 판정자 |', '|---|---|---|---|---|---|', '',
].join('\n'));
console.log(`\n${sums.join('\n')}`);
if (release) console.log(`\n켜는 기준: ${release.status}${release.reasons.length ? ` — ${release.reasons.join('; ')}` : ''}`);
console.log(`\n결과: ${out}/results.md · results.json (키·프롬프트 본문 없음 — 그대로 공유 가능)`);
console.info = realInfo;
