#!/usr/bin/env node
// 영어 기본 뜻 금지 답 표(EN-MEANING-GOLD-001)를 제품 뜻 생성 파이프라인(fetchMeaningsForMissing — light 생성 +
// standard 검증, MEANING-VERIFY-001)에 그대로 돌려 채점한다. 제품 함수를 import해 부른다(복사본 없음).
//
//   공유 사전 쓰기는 **메모리 기록기**로 받는다 — 이 스크립트는 운영 DB에 접속하지 않는다.
//   stored = 기록기에 upsert된 행(운영이었다면 공유 사전에 들어갔을 뜻) · held = 저장 없이 이번 요청에만 돌려준 뜻 ·
//   empty = 뜻 없음(고친 뜻 없는 wrong 폐기·생성 실패). 출시 기준: stored FAIL = 0.
//
// 사용(Node 24, 리포 루트):
//   node scripts/eval/en-meaning-gold.mjs --dry-run       # 세트 검증 + 오프라인 배선 점검(네트워크 0, 모의 응답)
//   GEMINI_API_KEY=… node scripts/eval/en-meaning-gold.mjs # 실제 호출(배치당 생성 1 + 검증 1)
//   옵션: --only R01,P03  --out <dir>  --delay-ms 1500
// 키는 실행하는 셸의 환경 변수로만 둔다. 키·프롬프트 본문을 출력하거나 결과 파일에 기록하지 않는다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './productImportHooks.mjs'; // 제품 서버 모듈의 확장자 없는 import를 이 프로세스에서 풀게 한다(동적 import 전에 등록)
import { scoreOutcome, summarize, validateGold } from './enMeaningGold.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const goldPath = join(root, 'docs/verification/en-meaning-gold-20261012.json');
const productPaths = ['src/lib/server/fetchMeanings.js', 'src/lib/server/llm.js'];
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const mod = (rel) => import(pathToFileURL(join(root, rel)).href);

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const only = opt('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const delayMs = Number(opt('--delay-ms') ?? 1500);
const BATCH = 15; // 제품 배치 크기와 같게 — 실제 요청처럼 한 배치 = 생성 1 + 검증 1

const { fetchMeaningsForMissing, resetMeaningVerifyHolds, EN_MEANING_PROMPT_EXAMPLES } = await mod('src/lib/server/fetchMeanings.js');

const set = JSON.parse(readFileSync(goldPath, 'utf8'));
const problems = validateGold(set, { promptExamples: EN_MEANING_PROMPT_EXAMPLES });
if (problems.length) { console.error(`세트 검증 실패:\n- ${problems.join('\n- ')}`); process.exit(1); }
const cases = set.cases.filter((c) => !only || only.includes(c.id));

let head = 'unknown';
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* git 없음 */ }
const provenance = {
  gold: set.id, goldSha256: sha(goldPath), gitHead: head,
  productModulesSha256: Object.fromEntries(productPaths.map((p) => [p, sha(join(root, p))])),
  evalModuleSha256: sha(join(root, 'scripts/eval/enMeaningGold.mjs')),
  pipeline: { generate: 'light', verify: 'standard', batch: BATCH },
};

// ───────────── fetch 감시(호출 수·dry-run 차단) ─────────────
const realFetch = globalThis.fetch;
let fetchCount = 0;
const geminiText = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const byWord = new Map(cases.map((c) => [c.word, c]));
// dry-run 모의 응답: 생성은 accept[0](희귀어는 금지 답을 지어낸 것으로), 검증은 금지 답이면 wrong+accept[0] — 배선 점검용(채점 의미 없음).
function cannedReply(prompt) {
  if (prompt.includes('사전 검수자')) {
    const items = [...prompt.matchAll(/^(\d+)\. 단어 "([^"]+)" · .*? 뜻 1\) "([^"]*)"/gm)];
    return JSON.stringify(items.map(([, n, word, first]) => {
      const c = byWord.get(word);
      const bad = c?.forbidden?.includes(first);
      return { n: Number(n), verdict: bad ? 'wrong' : 'ok', fix: bad ? c.accept[0] : null, bad: [] };
    }));
  }
  const words = [...prompt.matchAll(/^\d+\. "([^"]+)"/gm)].map((m) => m[1]);
  return JSON.stringify(words.map((w) => {
    const c = byWord.get(w);
    const meaning = c?.cat === 'rare' ? c.forbidden[0] : (c?.accept?.[0] ?? '뜻');
    return { pos: '명사', ipa: '/x/', meanings: [{ meaning, pos: '명사' }] };
  }));
}
globalThis.fetch = async (url, init) => {
  fetchCount++;
  if (dryRun) {
    let prompt = '';
    try { prompt = JSON.parse(init?.body ?? '{}').contents?.[0]?.parts?.[0]?.text ?? ''; } catch { /* 무시 */ }
    return geminiText(cannedReply(prompt));
  }
  return realFetch(url, init);
};
const llmLog = [];
const realInfo = console.info;
console.info = (...a) => { // callLLM 텔레메트리 줄([llm] {...} — 프롬프트 없음)을 모아 모델·지연을 기록
  if (a[0] === '[llm]') { try { llmLog.push(JSON.parse(a[1])); } catch { /* 무시 */ } if (dryRun) return; }
  realInfo(...a);
};

if (dryRun) {
  if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = 'dry-run-fetch-is-stubbed'; // 키 검사 통과용 — fetch는 위에서 막혀 있다
  if (!process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = '';
} else if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY가 이 셸에 없습니다. 키 값은 채팅·파일에 붙이지 말고 환경 변수로만 넣으세요.');
  process.exit(2);
}

// 메모리 기록기 — 제품 코드가 부르는 supabase 체인(upsert·update)만 흉내 낸다. 운영 DB 접속 없음.
const stored = new Map();
const recorder = {
  from: () => ({
    upsert: async (rows) => { for (const r of rows) if (!stored.has(r.base_form)) stored.set(r.base_form, r); return { error: null }; },
  }),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const batches = [];
for (let i = 0; i < cases.length; i += BATCH) batches.push(cases.slice(i, i + BATCH));
resetMeaningVerifyHolds();
for (const [bi, batch] of batches.entries()) {
  const before = fetchCount;
  const logBefore = llmLog.length;
  const missing = batch.map((c) => ({ base_form: c.word, pos: null, reading: null }));
  const { result, errors } = await fetchMeaningsForMissing(missing, 'English', recorder, { concurrency: 1 });
  const log = llmLog.slice(logBefore);
  for (const c of batch) rows.push(scoreOutcome(c, { stored: stored.get(c.word) || null, returned: result.get(c.word) || null }));
  batches[bi] = {
    batch: bi, ids: batch.map((c) => c.id), calls: fetchCount - before,
    llm: log.map((l) => ({ route: l.route, tier: l.tier, model: l.model, ms: l.ms, ok: l.ok })),
    errors: errors.map((e) => ({ stage: e.stage, reason: e.reason ?? null, held: e.held ?? null, dropped: e.dropped ?? null, fixed: e.fixed ?? null })),
  };
  if (!dryRun) console.log(`[${bi + 1}/${batches.length}] ${batch.length}단어 · 호출 ${fetchCount - before}`);
  if (!dryRun && bi < batches.length - 1) await sleep(delayMs);
}

const summary = summarize(rows);
console.info = realInfo;

if (dryRun) {
  const expectCalls = batches.length * 2;
  if (fetchCount !== expectCalls) { console.error(`dry-run fetch ${fetchCount}회 ≠ 배치 ${batches.length} × (생성 1 + 검증 1)`); process.exit(1); }
  if (summary.release.status !== 'OK') { console.error(`dry-run 배선 점검 실패 — 모의 오답이 저장됨: ${summary.release.storedFail.join(',')}`); process.exit(1); }
  console.log(JSON.stringify({ ...provenance, validation: 'ok', networkCalls: 0, cases: cases.length, batches, summary }, null, 2));
  process.exit(0);
}

const startedAt = new Date().toISOString();
const out = opt('--out') || join(tmpdir(), `manabi-en-meaning-gold-${startedAt.replace(/[:.]/g, '-')}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), `${JSON.stringify({ ...provenance, finishedAt: new Date().toISOString(), summary, batches, rows }, null, 2)}\n`);
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const table = ['| ID | 단어 | 결과 | 1번 뜻 | 판정 | 사유 | 검증 |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.word} | ${r.outcome} | ${esc(r.meaning)} | ${r.verdict ?? '-'} | ${esc(r.reason)} | ${r.verify ?? '-'} |`)];
writeFileSync(join(out, 'results.md'), [
  `# ${set.id} 실행 결과`, '', `git \`${head}\` · 세트 SHA-256 \`${provenance.goldSha256}\``, '',
  `- 저장(stored): ${summary.stored.total} — PASS ${summary.stored.PASS} · FAIL ${summary.stored.FAIL} · REVIEW ${summary.stored.REVIEW}`,
  `- 보류(held, 저장 안 함): ${summary.held.total} — PASS ${summary.held.PASS} · FAIL ${summary.held.FAIL} · REVIEW ${summary.held.REVIEW}`,
  `- 뜻 없음: ${summary.empty} · 검증이 고친 뜻: ${summary.fixed}`,
  `- **출시 기준(저장 FAIL 0)**: ${summary.release.status}${summary.release.storedFail.length ? ` — ${summary.release.storedFail.join(', ')}` : ''}`, '',
  'REVIEW 행은 사람이 판정해 세트에 반영하기 전까지 통과로 세지 않는다.', '', ...table, '',
].join('\n'));
console.log(`\n출시 기준: ${summary.release.status} · 저장 ${summary.stored.total} · 보류 ${summary.held.total} · 없음 ${summary.empty}`);
console.log(`결과: ${out}/results.md · results.json (키·프롬프트 본문 없음)`);
if (summary.release.status !== 'OK') process.exitCode = 1;
