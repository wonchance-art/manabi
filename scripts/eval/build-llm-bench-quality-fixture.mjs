#!/usr/bin/env node
// LLM-BENCH-QUALITY-001 — 모델 비교 측정의 품질 세트 고정 입력(src/lib/server/llmBenchQualityFixture.json)을 제품 함수로 만든다. 호출 0.
//
// 왜: Claude 전환(LLM-CLAUDE-001)의 품질 경로(회화 · 작문 첨삭 · 오늘의 문단)는 Sonnet 5.5로 가는데, 기존 측정 세트
//     (뜻 고르기 · 뜻 생성 · 번역)는 이 과제를 재지 않았다. 같은 입력으로 Haiku 5.5 · Sonnet 5.5 · 현행 Gemini를 대조한다.
//   conversation  CONVERSATION-EVAL-001 세트(docs/verification/conversation-eval-20261014.json — 지은 문장)에서 교정 · 다시 말하기 ·
//                 음성 사례 5개 → caseState → promptForTurn(운영 서버 프롬프트). 정치 유도 묶음은 넣지 않는다.
//   writing       직접 지은 학습자 작문 5개(오류 위치를 아는 4 · 오류 없는 1) → buildFeedbackPrompt(운영 프롬프트).
//   paragraph     직접 지은 학습 재료 3개(일 · 중 · 영) → buildParagraphPrompt(운영 프롬프트).
// 실사용자 데이터 0 · 개인정보 0. 응답 스키마 · temperature는 llmBench.js의 QUALITY_TASKS(운영 호출부와 같은 값)가 붙인다.
// 사용(Node 24, 리포 루트): node scripts/eval/build-llm-bench-quality-fixture.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './productImportHooks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const convPath = join(root, 'docs/verification/conversation-eval-20261014.json');
const outPath = join(root, 'src/lib/server/llmBenchQualityFixture.json');
const mod = (rel) => import(pathToFileURL(join(root, rel)).href);
const check = process.argv.includes('--check');

const { caseState, validateSet } = await mod('scripts/eval/conversationEval.mjs');
const { promptForTurn } = await mod('src/lib/server/conversationTurn.js');
const { buildFeedbackPrompt } = await mod('src/lib/writingPrompts.js');
const { buildParagraphPrompt } = await mod('src/lib/studyParagraph.js');

// ── conversation ──
const convSet = JSON.parse(readFileSync(convPath, 'utf8'));
const problems = validateSet(convSet);
if (problems.length) { console.error(`대화 세트 검증 실패:\n- ${problems.join('\n- ')}`); process.exit(1); }
const sorted = [...convSet.cases].sort((a, b) => a.id.localeCompare(b.id));
const pick = (fn) => sorted.find(fn);
const convCases = [
  pick((c) => c.set === 'correction' && c.language === 'Chinese' && c.expect === 'error'),
  pick((c) => c.set === 'correction' && c.language === 'Japanese' && c.expect === 'error'),
  pick((c) => c.set === 'correction' && c.language === 'English' && c.expect === 'correct'),
  pick((c) => c.set === 'repair' && c.language === 'Japanese'),
  pick((c) => c.set === 'voice' && c.language === 'Chinese'),
];
const conversation = convCases.map((c) => {
  const s = caseState(convSet, c);
  return { id: c.id, language: c.language, case: c, prompt: promptForTurn({ conv: s.conv, rawText: s.rawText, text: s.text, inputMode: s.inputMode }) };
});

// ── writing — 직접 지은 문장. expect.errors = 모델이 짚어야 할 원문 조각, expect.clean = 오류 없음(거짓 지적 검사) ──
const WRITING = [
  { id: 'WJ1', language: 'Japanese', level: 'N5', prompt: '주말에 한 일을 써 보세요.', text: '私は昨日友達と映画館を行きました。映画はとても面白いでした。', expect: { errors: ['映画館を行', '面白いでした'] } },
  { id: 'WZ1', language: 'Chinese', level: 'H2', prompt: '내 친구를 소개해 보세요.', text: '他比我很高。我们每天一起去学校。', expect: { errors: ['比我很高'] } },
  { id: 'WE1', language: 'English', level: 'A2', prompt: '지난 주말에 한 일을 써 보세요.', text: 'Yesterday I go to the park with my friend. We plays soccer for two hours.', expect: { errors: ['go to the park', 'plays'] } },
  { id: 'WE2', language: 'English', level: 'A2', prompt: '좋아하는 책을 소개해 보세요.', text: 'I like reading books. My favorite book is about a small cat.', expect: { clean: true } },
  { id: 'WF1', language: 'French', level: 'A1', prompt: '여행지에서 본 것을 써 보세요.', text: 'Hier, je suis allé à la plage. La mer était très beau.', expect: { errors: ['beau'] } },
];
const writing = WRITING.map((w) => ({
  ...w,
  prompt: buildFeedbackPrompt({ language: w.language, level: w.level, text: w.text, promptType: 'free', prompt: w.prompt, chapterPatterns: null }),
  topic: w.prompt,
}));

// ── paragraph — 직접 지은 재료(운영 cleanMaterials가 만드는 모양) ──
const PARAGRAPH = [
  { id: 'PJ1', language: 'Japanese', level: 'N5', theme: '음식',
    newPattern: { pattern: '〜たいです', patternKo: '~하고 싶어요' }, duePatterns: [{ pattern: '〜ました', patternKo: '~했어요' }],
    dueWords: [{ word: '朝ごはん', meaning: '아침밥' }, { word: '店', meaning: '가게' }], newWords: [{ word: 'ラーメン', meaning: '라멘' }] },
  { id: 'PZ1', language: 'Chinese', level: 'H2', theme: '여행',
    newPattern: { pattern: '是……的', patternKo: '이미 한 일의 때 · 곳 · 방법 강조' }, duePatterns: [{ pattern: '了', patternKo: '완료' }],
    dueWords: [{ word: '火车', meaning: '기차' }, { word: '朋友', meaning: '친구' }], newWords: [{ word: '风景', meaning: '풍경' }] },
  { id: 'PE1', language: 'English', level: 'A2', theme: '날씨와 계절',
    newPattern: { pattern: 'used to + 동사원형', patternKo: '예전에 ~하곤 했다' }, duePatterns: [{ pattern: 'be going to', patternKo: '~할 예정이다' }],
    dueWords: [{ word: 'winter', meaning: '겨울' }, { word: 'snow', meaning: '눈' }], newWords: [{ word: 'cozy', meaning: '아늑한' }] },
];
const paragraph = PARAGRAPH.map(({ id, ...materials }) => ({
  id, language: materials.language, materials: { knownWords: [], whitelistWords: [], avoidThemes: [], ...materials },
  prompt: buildParagraphPrompt({ knownWords: [], whitelistWords: [], avoidThemes: [], ...materials }),
}));
for (const p of [...writing, ...paragraph]) if (!p.prompt) { console.error(`${p.id}: 프롬프트를 만들지 못함`); process.exit(1); }

const fixture = {
  id: 'LLM-BENCH-QUALITY-001',
  source: { conversation: convSet.id, conversationSha256: createHash('sha256').update(readFileSync(convPath)).digest('hex'), personalData: false },
  conversationContext: convSet.context,
  conversation, writing, paragraph,
};
const text = `${JSON.stringify(fixture, null, 1)}\n`;
if (check) {
  const same = (() => { try { return readFileSync(outPath, 'utf8') === text; } catch { return false; } })();
  console.log(same ? 'llmBenchQualityFixture.json 최신' : 'llmBenchQualityFixture.json이 제품 함수 결과와 다름 — 다시 생성');
  process.exit(same ? 0 : 1);
}
writeFileSync(outPath, text);
console.log(`conversation ${conversation.length} · writing ${writing.length} · paragraph ${paragraph.length}`);
