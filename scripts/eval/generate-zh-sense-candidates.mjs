#!/usr/bin/env node
// ZH-SENSE-HOLDOUT-001 — 운영 사전에 아직 행이 없는 표제어(세트의 임시 후보, provisional:*)의 사전 행을
// 운영과 같은 생성 경로로 만들어 얼린다. DB에는 쓰지 않는다.
//
// 왜: 운영에서는 그 단어를 처음 분석할 때 /api/analyze가 fetchMeaningsForMissing(같은 생성 프롬프트·light 등급·
//     정규화)으로 행을 만들어 공유 사전에 넣고, 그 뒤 요청부터 그 행이 뜻 후보가 된다. 측정 후보를 사람이 지으면
//     운영 후보와 모양(뜻 수·순서·문구)이 달라 결과가 운영을 대표하지 않는다(2026-10-08 스냅숏: 35개 중 19개 행 없음).
// 생성은 표제어와 토크나이저 품사만 보낸다(문장 없음) — 측정 문장이 새지 않으므로 보류 세트를 소모하지 않는다.
//
// 사용(Node 24, 리포 루트, 생성 키가 있는 환경 — 오너 PC 또는 M09):
//   node scripts/eval/generate-zh-sense-candidates.mjs --dry-run       # 대상 표제어·입력 품사만 출력(호출 0)
//   GEMINI_API_KEY=… node scripts/eval/generate-zh-sense-candidates.mjs [--out <file>]
// 결과 JSON(키·프롬프트 본문 없음)을 #1337에 그대로 올린다. Claude가 세트에 넣고 기대 답 번호를 다시 매긴 뒤 측정한다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './productImportHooks.mjs'; // 제품 서버 모듈의 번들러식 import를 이 프로세스에서 풀게 한다(동적 import 전에 등록)
import { pendingCandidateForms, validateHoldout } from './zhSenseHoldout.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const holdoutPath = join(root, 'docs/verification/zh-sense-holdout-20261008.json');
const generatorPath = 'src/lib/server/fetchMeanings.js';
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const mod = (rel) => import(pathToFileURL(join(root, rel)).href);

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');

const set = JSON.parse(readFileSync(holdoutPath, 'utf8'));
const problems = validateHoldout(set);
if (problems.length) { console.error(`세트 검증 실패:\n- ${problems.join('\n- ')}`); process.exit(1); }

const { tokenizeZhLine } = await mod('src/lib/server/tokenizeZh.js');
const { fetchMeaningsForMissing } = await mod(generatorPath);

// 입력 = 운영 /api/analyze의 collectMissingBaseForms가 보내는 것과 같은 {base_form, pos, reading}.
// 그 표제어가 나오는 첫 사례(id 순) 문장을 토큰화해 대상 자리 토큰의 품사·병음을 쓴다(jieba 품사는 단어 단위라 문장과 무관).
const spansOf = (tokens) => { let at = 0; return tokens.map((t) => { const s = { t, start: at }; at += String(t.text || '').length; return s; }); };
const forms = pendingCandidateForms(set).map((form) => {
  const c = [...set.cases].sort((a, b) => a.id.localeCompare(b.id)).find((x) => x.cat !== 'D' && x.target.base === form);
  const hit = spansOf(tokenizeZhLine(c.sentence)).find((s) => s.start === c.target.index && s.t.text === c.target.surface);
  return { base_form: form, pos: hit?.t.pos ?? null, reading: hit?.t.furigana ?? null, fromCase: c.id };
});

console.log(`대상 ${forms.length}개: ${forms.map((f) => `${f.base_form}(${f.pos ?? '품사 없음'})`).join(' ')}`);
if (dryRun) { console.log('dry-run — 호출 0. 키를 넣고 다시 실행하면 생성한다.'); process.exit(0); }

// 생성기는 결과를 공유 사전에 upsert한다 — 여기서는 받기만 하는 가짜 클라이언트를 넘겨 DB 쓰기를 0으로 만든다.
const captured = [];
const noDb = { from: (table) => ({ upsert: async (rows) => { captured.push({ table, rows: rows.length }); return { error: null }; } }) };

const llmLog = [];
const realInfo = console.info;
console.info = (...a) => { // callLLM 텔레메트리 줄([llm] {...} — 프롬프트 없음)에서 모델·지연만 모은다
  if (a[0] === '[llm]') { try { llmLog.push(JSON.parse(a[1])); } catch { /* 무시 */ } return; }
  realInfo(...a);
};

const { result, errors } = await fetchMeaningsForMissing(forms.map(({ base_form, pos, reading }) => ({ base_form, pos, reading })), 'Chinese', noDb, { concurrency: 1 });
console.info = realInfo;

let head = 'unknown';
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* git 없음 */ }
const rows = forms.map(({ base_form }) => {
  const r = result.get(base_form);
  return r ? { base_form, pos: r.pos, source: r.source, meanings: r.meanings.map((m) => ({ meaning: m.meaning, ...(m.pos ? { pos: m.pos } : {}) })) } : { base_form, missing: true };
});
const out = {
  set: set.id, setSha256: sha(holdoutPath), gitHead: head, generatedAt: new Date().toISOString(),
  generator: { path: generatorPath, sha256: sha(join(root, generatorPath)), fn: 'fetchMeaningsForMissing', language: 'Chinese', dbWrites: 0, upsertsCaptured: captured.length },
  llm: llmLog.map((l) => ({ route: l.route, provider: l.provider, model: l.model, tier: l.tier, ms: l.ms, ok: l.ok })),
  inputs: forms, rows, errors,
};
const file = opt('--out') || join(tmpdir(), `zh-sense-generated-${Date.now()}.json`);
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
const made = rows.filter((r) => !r.missing).length;
console.log(`생성 ${made}/${forms.length}개 · 오류 ${errors.length}건 · DB 쓰기 0 → ${file}`);
if (made < forms.length) console.log(`행 없음: ${rows.filter((r) => r.missing).map((r) => r.base_form).join(' ')} — 다시 실행해 채운다(운영도 다음 요청에서 재시도한다)`);
