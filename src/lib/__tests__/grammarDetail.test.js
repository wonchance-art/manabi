import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildContextPrompt } from '../grammarDetail.js';
import { buildPatternPromptBlock } from '../sentencePattern.js';
import { fetchSentenceTranslation } from '../sentenceTranslation.js';

describe('buildContextPrompt — 말투 조건부(맥락에 통합)', () => {
  it('번역·맥락 뒤에 말투를 두되 유의미할 때만 출력하도록 지시한다', () => {
    const p = buildContextPrompt('今天我们学习中文。', '중국어');
    expect(p.indexOf('**맥락**')).toBeGreaterThan(p.indexOf('**번역**'));
    expect(p.indexOf('**말투**')).toBeGreaterThan(p.indexOf('**맥락**'));
    expect(p).toContain('학습에 유의미할 때만');
    expect(p).toContain('통째로 생략');
  });
  it('맥락은 한 문장 — [문장] 탭 번역 아래 회색 한 줄(목업 U 4판)', () => {
    expect(buildContextPrompt('今天很好。', '중국어')).toContain('배경 설명 한 문장');
  });
  it('문형 칸은 같은 요청 끝에 — 형식 · 후보 목록 · 생략 규칙', () => {
    const p = buildContextPrompt('今天很好。', '중국어', buildPatternPromptBlock('Chinese', [{ pattern: '주어 + 很 + 형용사', ko: 'A는 ~하다' }]));
    expect(p.indexOf('**문형**')).toBeGreaterThan(p.indexOf('**말투**'));
    expect(p).toContain('1 | 주어 + 很 + 형용사 | A는 ~하다');
    expect(p).toContain('**문형** 항목(제목 포함)을 통째로 생략');
    expect(buildContextPrompt('今天很好。', '중국어')).not.toContain('**문형**');
  });
});

describe('번역 요청 하나에 문형 후보 — 요청 수 그대로', () => {
  const run = async (patch) => {
    const prompts = [];
    await fetchSentenceTranslation({ sentence: '今天很好。', locale: 'ko', language: 'Chinese', langName: '중국어', cacheKey: null,
      callAi: async (prompt) => { prompts.push(prompt); return '**번역**\n오늘은 좋다.'; }, ...patch });
    return prompts;
  };
  it('한국어 설명이면 후보를 싣고, 후보를 못 모아도 번역은 간다', async () => {
    expect((await run({ patternCandidates: async () => [{ pattern: '주어 + 很 + 형용사', ko: 'A는 ~하다' }] }))[0]).toContain('**문형**');
    const failed = await run({ patternCandidates: async () => { throw new Error('index'); } });
    expect(failed).toHaveLength(1);
    expect(failed[0]).not.toContain('**문형**');
  });
  it('캐시 적중이면 후보를 모으지 않는다(인덱스 적재 0)', async () => {
    let asked = 0;
    const storage = { getItem: () => '**번역**\n캐시', setItem: () => {} };
    const out = await fetchSentenceTranslation({ sentence: 'x', locale: 'ko', language: 'Chinese', langName: '중국어', cacheKey: 'k', storage,
      callAi: async () => { throw new Error('no'); }, patternCandidates: async () => { asked += 1; return []; } });
    expect(out.source).toBe('cache');
    expect(asked).toBe(0);
  });
});

// 배선 계약 — [문장] 탭 개편(오너 10-24 「더 쉽게와 문법 버튼 아예 없애줘」 · 「더 묻기 입력창 · 노트 저장 제거」).
describe('[문장] 탭 — 옛 [자세히] · [더 쉽게] · 질문 · 노트 저장 경로는 없다', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

  it('모달 · 인라인 해설 훅이 모두 사라졌다', () => {
    for (const gone of ['src/views/ViewerGrammarModal.jsx', 'src/lib/useGrammarAnalysis.js', 'src/lib/useGrammarDetail.js', 'src/lib/useEasierText.js', 'src/lib/useGrammarNoteSave.js']) {
      expect(fs.existsSync(path.join(process.cwd(), gone)), gone).toBe(false);
    }
    const viewer = read('src/views/ViewerPage.jsx');
    for (const gone of ['GRAMMAR_ACTIONS', 'AI 문법 해설', 'grammar.run(', 'easier.run(', 'grammar.ask(', 'saveGrammarNoteMutation', '이 문장에 대해 더 묻기', '노트에 저장']) {
      expect(viewer, gone).not.toContain(gone);
    }
  });

  it('좌측 번역·맥락은 buildContextPrompt를 쓴다(말투 통합 + 문형 칸)', () => {
    // AE-R2 PR ②(설계서 docs/manabi-viewer-v2-ae-r2.md §2·§6.1): 번역 핵심이 단일 키 모듈로 옮겨 갔다 — 같은 프롬프트,
    // signal 없이(시트를 닫아도 끝까지 받아 저장). 뷰어는 그 모듈의 쿼리를 쓴다.
    expect(read('src/lib/sentenceTranslation.js')).toContain('buildContextPrompt(sentence, langName, ');
    expect(read('src/views/ViewerPage.jsx')).toContain('queryClient.fetchQuery(sentenceTranslationQuery(');
  });
});
