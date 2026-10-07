#!/usr/bin/env node
// 한국어 기본형 뜻 미사용 표본을 운영과 같은 경로로 실제 생성해 채점한다.
//   프롬프트: src/lib/koreanWordMeaning.js buildKoreanWordMeaningPrompt (운영 클라이언트와 같은 함수)
//   호출: src/lib/server/llm.js callLLM('standard', …, {responseMimeType:'application/json', temperature:0})
//         = /api/gemini 프록시의 기본 티어·생성 설정과 같다(폴백·Groq 포함, 실제 쓰인 모델을 기록).
//   해석: parseKoreanWordMeaning (저장 전 검증과 같은 함수)
//
// 사용: GEMINI_API_KEY(필요 시 GROQ_API_KEY)를 실행하는 셸의 환경 변수로만 둔다. 키를 출력·기록하지 않는다.
//   node scripts/eval/run-korean-meaning-holdout.mjs              # 실제 생성 60건
//   node scripts/eval/run-korean-meaning-holdout.mjs --dry-run    # 표본 검증만(호출 0)
//   옵션: --out <dir> (기본: OS 임시 폴더), --only A01,E03, --delay-ms 1200
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, scoreCase, summarize, validateHoldout } from './koreanMeaningHoldout.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const holdoutPath = join(root, 'docs/verification/korean-word-meaning-holdout-20261007.json');
const promptPath = join(root, 'src/lib/koreanWordMeaning.js');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const delayMs = Number(opt('--delay-ms') ?? 1200);

const set = JSON.parse(readFileSync(holdoutPath, 'utf8'));
const problems = validateHoldout(set);
if (problems.length) { console.error('표본 검증 실패:\n- ' + problems.join('\n- ')); process.exit(1); }
const cases = set.cases.filter(c => !only || only.includes(c.id));
const { buildKoreanWordMeaningPrompt, parseKoreanWordMeaning, KOREAN_WORD_MEANING_VERSION } = await import(new URL('../../src/lib/koreanWordMeaning.js', import.meta.url));
const prompts = cases.flatMap(c => LOCALES.map(locale => ({ c, locale,
  prompt: buildKoreanWordMeaningPrompt({ surface: c.surface, lemma: c.lemma, sentence: c.sentence, locale, pos: c.pos }) })));

let head = 'unknown';
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* git 없음 */ }
const provenance = { holdout: set.id, holdoutSha256: sha(holdoutPath), promptModule: 'src/lib/koreanWordMeaning.js',
  promptModuleSha256: sha(promptPath), promptVersion: KOREAN_WORD_MEANING_VERSION, gitHead: head, tier: 'standard',
  generation: { responseMimeType: 'application/json', temperature: 0 } };

if (dryRun) {
  console.log(JSON.stringify({ ...provenance, cases: cases.length, calls: prompts.length, validation: 'ok' }, null, 2));
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY가 이 셸에 없습니다. 키 값은 채팅·파일에 붙이지 말고 환경 변수로만 넣으세요.'); process.exit(2); }

const { callLLM } = await import(new URL('../../src/lib/server/llm.js', import.meta.url));
const startedAt = new Date().toISOString();
const rows = [];
for (const [i, { c, locale, prompt }] of prompts.entries()) {
  const row = { id: c.id, cat: c.cat, locale, sentence: c.sentence, surface: c.surface, lemma: c.lemma };
  try {
    const { text, meta } = await callLLM('standard', prompt, { responseMimeType: 'application/json', temperature: 0, route: 'eval-korean-meaning-holdout' });
    row.raw = text; row.model = meta.model; row.provider = meta.provider; row.fallbackDepth = meta.fallbackDepth; row.ms = meta.ms;
    try { Object.assign(row, parseKoreanWordMeaning(text, c.lemma)); } catch (e) { row.error = `parse: ${e.message}`; }
  } catch (e) { row.error = `call: ${e?.status ?? ''} ${e?.message ?? e}`.trim(); }
  Object.assign(row, scoreCase(c[locale], row, c[LOCALES.find(l => l !== locale)]));
  rows.push(row);
  console.log(`[${i + 1}/${prompts.length}] ${c.id} ${locale} ${row.verdict} ${row.lexicalMeaning ?? ''} ${row.provider && row.provider !== 'gemini' ? `(${row.provider})` : ''}`.trim());
  if (i < prompts.length - 1) await new Promise(r => setTimeout(r, delayMs));
}

const summary = summarize(set, rows);
const out = opt('--out') || join(tmpdir(), `manabi-korean-meaning-holdout-${startedAt.replace(/[:.]/g, '-')}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ ...provenance, startedAt, finishedAt: new Date().toISOString(), summary, rows }, null, 2) + '\n');
const table = ['| ID | 언어 | 기본형 | 결과 | 생성 뜻 | 사유 | 모델 |', '|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.locale} | ${r.lemma} | ${r.verdict} | ${(r.lexicalMeaning || r.error || '').replace(/\|/g, '\\|')} | ${r.reason} | ${r.model ?? ''}${r.fallbackDepth ? ` (폴백 ${r.fallbackDepth})` : ''} |`)];
const head2 = LOCALES.map(l => { const s = summary[l]; return `- **${l}**: ${s.status} — PASS ${s.PASS} · FAIL ${s.FAIL} · REVIEW ${s.REVIEW} · BLOCKED ${s.BLOCKED} · ERROR ${s.ERROR}${s.reasons.length ? ` (${s.reasons.join('; ')})` : ''}`; });
writeFileSync(join(out, 'results.md'), [`# ${set.id} 실행 결과`, '', `프롬프트 ${provenance.promptVersion} · 모듈 SHA-256 \`${provenance.promptModuleSha256}\` · git \`${head}\``, '', ...head2, '',
  'REVIEW 행은 사람이 판정해 결과를 기록하기 전까지 통과로 세지 않는다.', '', ...table, ''].join('\n'));
console.log('\n' + head2.join('\n'));
console.log(`\n결과: ${out}/results.md · results.json (키·개인정보 없음 — 그대로 공유 가능)`);
