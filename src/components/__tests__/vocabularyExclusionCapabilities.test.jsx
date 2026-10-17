// VOCAB-FLOW-001 D — 제외 목록은 부모(복습방)가 읽은 한국어 학습 능력을 넘겨받으면 다시 읽지 않는다.
// 이 목록이 마운트될 때마다 staleTime 0 쿼리가 /api/learning/capabilities를 한 번 더 보냈다(진입 · 목록 전환마다, 픽스처 실측).
// staleTime 0 계약(useLearningCapabilities)은 그대로 — 같은 한 읽기를 같이 쓴다. 넘겨받지 않으면 예전처럼 스스로 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const calls = vi.hoisted(() => []);
vi.mock('../../lib/useLearningCapabilities', () => ({
  useLearningCapabilities: language => { calls.push(language); return { review: true, save: true, known: true, exclude: true, isLoading: false, isError: false }; },
}));
const idle = { rows: [], isError: false, isSuccess: true, refetch() {}, mutation: { isPending: false, mutate() {} } };
vi.mock('../../lib/useVocabularyExclusions', () => ({ useVocabularyExclusions: () => idle }));
vi.mock('../../lib/useKnownWords', () => ({ useKnownWords: () => idle }));

import VocabularyExclusionList from '../VocabularyExclusionList';

const ROOT = path.resolve(__dirname, '../../..');
beforeEach(() => { calls.length = 0; });

describe('VocabularyExclusionList — 부모의 capabilities를 쓴다(VOCAB-FLOW-001 D)', () => {
  it('넘겨받으면 스스로 읽는 쿼리를 끈다(언어 null = 쿼리 꺼짐)', () => {
    renderToStaticMarkup(createElement(VocabularyExclusionList, { vocab: [], capabilities: { review: true, save: true, known: false, exclude: false } }));
    expect(calls).toEqual([null]);
  });
  it('넘겨받지 않으면 예전처럼 한국어 능력을 스스로 읽는다', () => {
    renderToStaticMarkup(createElement(VocabularyExclusionList, { vocab: [] }));
    expect(calls).toEqual(['Korean']);
  });
  it('복습방은 두 자리 모두 자기 koreanCapabilities를 넘긴다', () => {
    const page = fs.readFileSync(path.join(ROOT, 'src/views/VocabPage.jsx'), 'utf8');
    expect(page.match(/<VocabularyExclusionList /g)).toHaveLength(2);
    expect(page.match(/<VocabularyExclusionList [^>]*capabilities=\{koreanCapabilities\} \/>/g)).toHaveLength(2);
    expect(page).toContain("const koreanCapabilities = useLearningCapabilities('Korean');");
  });
});
