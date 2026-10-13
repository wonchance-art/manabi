#!/usr/bin/env node
// 대화 모드 평가 묶음(CONVERSATION-EVAL-001) 실행기 — CI 밖 수동 게이트(설계 CONVERSATION-V2Z-001 §9).
//
// 제품 경로를 그대로 탄다: promptForTurn(서버 프롬프트) → askTutor(llm.js standard 1회, 응답 스키마) →
// parseTutorResponse → applyCorrectionPolicy / judgeRepair. 사례마다 한 번 부른다.
//
// 사용(Node 24, 리포 루트):
//   node scripts/eval/run-conversation-eval.mjs --dry-run           # 세트 검증 + 프롬프트 조립 확인(호출 0)
//   GEMINI_API_KEY=… node scripts/eval/run-conversation-eval.mjs     # 실제 호출(220회)
//   옵션: --sets political,correction,repair,voice  --only P01,R03  --out <dir>  --delay-ms 1000
// 키는 실행하는 셸의 환경 변수로만 둔다. 키·프롬프트 본문은 출력하지 않는다.
// 결과 파일에는 판정·지표만 남긴다 — 모델 응답 원문은 정치 유도 묶음에서 쓰지 않는다(원문 서술 인용 금지).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './productImportHooks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const setPath = join(root, 'docs/verification/conversation-eval-20261014.json');
const mod = (rel) => import(pathToFileURL(join(root, rel)).href);

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const sets = (opt('--sets') || 'political,correction,repair,voice').split(',').map((s) => s.trim());
const only = opt('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const delayMs = Number(opt('--delay-ms') ?? 1000);
const outDir = opt('--out') || join(tmpdir(), 'conversation-eval'); // 리포 밖 기본 — 기록할 결과만 골라 docs/verification에 옮긴다

const { validateSet, caseState, scoreCase, summarize } = await mod('scripts/eval/conversationEval.mjs');
const { promptForTurn, askTutor } = await mod('src/lib/server/conversationTurn.js');

const set = JSON.parse(readFileSync(setPath, 'utf8'));
const problems = validateSet(set);
if (problems.length) { console.error(`세트 검증 실패:\n- ${problems.join('\n- ')}`); process.exit(1); }
const cases = set.cases.filter((c) => sets.includes(c.set) && (!only || only.includes(c.id)));
console.log(`세트 ${set.id}: ${cases.length}/${set.cases.length}개`);

if (dryRun) {
  let maxChars = 0;
  for (const c of cases) {
    const s = caseState(set, c);
    const prompt = promptForTurn({ conv: s.conv, rawText: s.rawText, text: s.text, inputMode: s.inputMode });
    maxChars = Math.max(maxChars, prompt.length);
  }
  console.log(`dry-run: 프롬프트 ${cases.length}개 조립 · 최대 ${maxChars}자 · 호출 0`);
  process.exit(0);
}

if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
  console.error('GEMINI_API_KEY(또는 GROQ_API_KEY)가 필요합니다. 세트·조립만 보려면 --dry-run.');
  process.exit(1);
}
const { callLLM } = await mod('src/lib/server/llm.js');
// askTutor는 파싱한 결과를 돌려준다. 채점기는 원문을 다시 파싱하므로, 같은 호출의 원문을 가로채 넘긴다.
const scored = [];
for (const [i, c] of cases.entries()) {
  const s = caseState(set, c);
  const prompt = promptForTurn({ conv: s.conv, rawText: s.rawText, text: s.text, inputMode: s.inputMode });
  let raw = null;
  const tap = async (...a) => { const r = await callLLM(...a); raw = r.text; return r; };
  const parsed = await askTutor(tap, prompt);
  const result = scoreCase(set, c, parsed ? raw : null);
  scored.push(result);
  console.log(`${String(i + 1).padStart(3)}/${cases.length} ${c.id} ${result.verdict}${result.rule ? ` (${result.rule})` : ''}`);
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
}
const summary = summarize(set, scored);
mkdirSync(outDir, { recursive: true });
const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '');
const file = join(outDir, `conversation-eval-${stamp}KST.json`);
writeFileSync(file, JSON.stringify({ set: set.id, at: `${stamp} KST`, summary, scored }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log(`결과: ${file}`);
process.exit(summary.pass ? 0 : 2);
