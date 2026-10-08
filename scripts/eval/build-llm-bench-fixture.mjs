#!/usr/bin/env node
// LLM-BENCH-001 — 모델 비교 측정의 고정 입력(src/lib/server/llmBenchFixture.json)을 제품 함수로 만든다. 호출 0.
//
// 왜: 키는 Vercel에만 있고(오너 2026-10-09), 측정은 그 안의 관리자 API(/api/admin/llm-bench)에서 돈다.
//     서버에서 jieba 토큰화·마크 수집을 다시 돌리지 않도록, 운영과 같은 프롬프트와 채점 입력을 여기서 미리 얼린다.
//   zhSense    ZH-SENSE-HOLDOUT-001 문단 → run-zh-sense-holdout.mjs의 N 경로와 같은 마크(뜻 후보 --offer-single ·
//              묶음 판정 쌍) → buildZhPosPrompt. 채점 입력 = 사례(후보·허용·금지)·대상 토큰·사전 행.
//   meanings   운영 뜻 생성(fetchMeaningsForMissing)이 실제로 보내는 프롬프트를 fetch 가로채기로 잡는다 —
//              대상은 세트에서 운영 행이 아직 없는 표제어(pendingCandidateForms). 문장은 보내지 않는다.
//   translate  뷰어 문장 번역(설명 언어 ko)의 buildContextPrompt — M09 검수 문장 3개.
// 사용(Node 24, 리포 루트): node scripts/eval/build-llm-bench-fixture.mjs [--check]
//   --check  파일을 쓰지 않고 지금 커밋된 고정 입력과 같은지만 본다(계약 테스트가 부른다).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './productImportHooks.mjs';
import { buildParagraphs, pendingCandidateForms, SNAPSHOT_SOURCE, validateHoldout } from './zhSenseHoldout.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const holdoutPath = join(root, 'docs/verification/zh-sense-holdout-20261008.json');
const outPath = join(root, 'src/lib/server/llmBenchFixture.json');
const mod = (rel) => import(pathToFileURL(join(root, rel)).href);
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const check = process.argv.includes('--check');

const set = JSON.parse(readFileSync(holdoutPath, 'utf8'));
const problems = validateHoldout(set);
if (problems.length) { console.error(`세트 검증 실패:\n- ${problems.join('\n- ')}`); process.exit(1); }

const { tokenizeZhLine } = await mod('src/lib/server/tokenizeZh.js');
const { collectZhPosMarks, zhPosMarkKey } = await mod('src/lib/server/disambiguateZhPos.js');
const { attachZhSenseCandidates, buildZhPosPrompt } = await mod('src/lib/server/zhSenseReview.js');
const { attachZhBoundaryPairs, collectZhBoundaryPairs } = await mod('src/lib/server/zhBoundaryReview.js');
const { fetchMeaningsForMissing } = await mod('src/lib/server/fetchMeanings.js');
const { buildContextPrompt } = await mod('src/lib/grammarDetail.js');

// ── zhSense: run-zh-sense-holdout.mjs prepare()·buildN()과 같은 규칙(offerSingle) ──
const uniq = (xs) => [...new Set(xs)];
const spansOf = (tokens) => { let at = 0; return tokens.map((t) => { const s = { t, start: at, end: at + String(t.text || '').length }; at = s.end; return s; }); };
const snapshotRows = new Map((set.snapshot?.rows || []).map((r) => [r.base_form, r]));
const rowOf = (row) => ({ base_form: row.base_form, pos: row.pos, meanings: row.meanings.map((m) => ({ meaning: m.meaning, pos: m.pos })), source: row.source });

const zhSense = buildParagraphs(set.cases).map((par) => {
  const lines = par.cases.map((c) => c.sentence);
  const tokenizedLines = lines.map((line) => ({ original: line, tokens: tokenizeZhLine(line) }));
  const cache = new Map();
  for (const c of par.cases) {
    if (!c.candidates) continue;
    const row = String(c.candidatesSource || '').startsWith(SNAPSHOT_SOURCE) ? snapshotRows.get(c.target.base) : null;
    cache.set(c.target.base, row ? rowOf(row)
      : { base_form: c.target.base, pos: uniq(c.candidates.map((m) => m.pos)).join('·'), meanings: c.candidates.map((m) => ({ meaning: m.meaning, pos: m.pos })), source: 'provisional' });
  }
  for (const [form, row] of snapshotRows) if (!cache.has(form) && lines.some((line) => line.includes(form))) cache.set(form, rowOf(row));
  const marks0 = collectZhPosMarks(tokenizedLines, cache);
  const offered = attachZhSenseCandidates(marks0.map((m) => ({ ...m })), { tokenizedLines, cache, minMeanings: 1 });
  const pairs = marks0.length ? collectZhBoundaryPairs(tokenizedLines, { cache, marks: marks0 }) : [];
  const marks = pairs.length ? attachZhBoundaryPairs(offered, pairs) : offered;
  const cases = par.cases.flatMap((c, lineIdx) => {
    if (c.cat === 'D') return [];
    const at = spansOf(tokenizedLines[lineIdx].tokens).find((s) => s.start <= c.target.index && c.target.index < s.end);
    const token = at && at.start === c.target.index && at.t.text === c.target.surface ? at.t : null;
    const key = (t) => t.sep_link || t.base_form;
    return [{
      id: c.id, cat: c.cat, split: c.split, provisional: !String(c.candidatesSource || '').startsWith(SNAPSHOT_SOURCE),
      candidates: c.candidates || null, accept: c.accept, forbidden: c.forbidden || [],
      markKey: zhPosMarkKey(lineIdx, c.target.surface), token, cached: token ? cache.get(key(token)) || null : null,
    }];
  });
  return { ids: par.cases.map((c) => c.id), lines, prompt: marks.length ? buildZhPosPrompt(lines, marks) : null, marks, cases };
}).filter((p) => p.prompt && p.cases.length);

// ── meanings: 운영 생성 경로가 보내는 프롬프트를 그대로 잡는다(네트워크 0 · DB 0) ──
const forms = pendingCandidateForms(set).map((form) => {
  const c = [...set.cases].sort((a, b) => a.id.localeCompare(b.id)).find((x) => x.cat !== 'D' && x.target.base === form);
  const hit = spansOf(tokenizeZhLine(c.sentence)).find((s) => s.start === c.target.index && s.t.text === c.target.surface);
  return { base_form: form, pos: hit?.t.pos ?? null, reading: hit?.t.furigana ?? null };
});
const prompts = [];
const realFetch = globalThis.fetch;
const realInfo = console.info;
const realWarn = console.warn;
process.env.GEMINI_API_KEY ||= 'fixture-build-fetch-is-stubbed';
globalThis.fetch = async (_url, init) => {
  try { prompts.push(JSON.parse(init?.body ?? '{}').contents?.[0]?.parts?.[0]?.text ?? ''); } catch { prompts.push(''); }
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) };
};
console.info = () => {};
console.warn = () => {};
const noDb = { from: () => ({ upsert: async () => ({ error: null }) }) };
await fetchMeaningsForMissing(forms, 'Chinese', noDb, { concurrency: 1 });
globalThis.fetch = realFetch;
console.info = realInfo;
console.warn = realWarn;
const batches = []; // 15개씩(운영 BATCH_SIZE) — 프롬프트 순서 = 배치 순서
for (let i = 0; i < forms.length; i += 15) batches.push(forms.slice(i, i + 15).map((f) => f.base_form));
const meanings = prompts.filter(Boolean).map((prompt, i) => ({ forms: batches[i], prompt }));

// ── translate: 뷰어 문장 번역(설명 언어 ko) ──
const translate = [
  ['他坐汽车去参观博物馆。', '중국어'],
  ['今天的比赛很壮观，体育场里人很多。', '중국어'],
  ['今日は図書館で新聞を読みました。', '일본어'],
].map(([sentence, langKo]) => ({ sentence, prompt: buildContextPrompt(sentence, langKo) }));

const fixture = {
  id: 'LLM-BENCH-001',
  source: { holdout: set.id, holdoutSha256: sha(holdoutPath), offerSingle: true },
  zhSense, meanings, translate,
};
const text = `${JSON.stringify(fixture, null, 1)}\n`;
if (check) {
  const same = readFileSync(outPath, 'utf8') === text;
  console.log(same ? 'llmBenchFixture.json 최신' : 'llmBenchFixture.json이 제품 함수 결과와 다름 — 다시 생성');
  process.exit(same ? 0 : 1);
}
writeFileSync(outPath, text);
const scored = zhSense.reduce((n, p) => n + p.cases.filter((c) => c.token).length, 0);
console.log(`zhSense 문단 ${zhSense.length}개 · 채점 사례 ${scored}개 · meanings 배치 ${meanings.length}개(${forms.length}어) · translate ${translate.length}문장`);
