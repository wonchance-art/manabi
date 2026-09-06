import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'node:fs';
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null }) }));
import VocabReview from '../../views/VocabReview';
const word = { id: 1, word_text: 'きっかけ', meaning: '계기', language: 'Japanese', source_material_id: 91001, source_sentence: '学ぶきっかけです。' };
function render(extra = {}) {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(VocabReview, {
    vocab: [word], reviewWords: [word], currentWord: word, reviewIdx: 0, reviewMode: 'flash',
    reviewFinished: false, showAnswer: false, ttsSupported: false, contextOptions: [], ...extra,
  })));
}
describe('review room recall and source contract', () => {
  it('a flash question does not expose meaning or source links before reveal', () => {
    const html = render();
    expect(html).toContain('きっかけ');
    expect(html).not.toContain('계기');
    expect(html).not.toContain('href="/viewer/');
    expect(html).toContain('정답 확인하기');
  });
  it('revealed source preserves the exact material and opens outside the session', () => {
    const html = render({ showAnswer: true });
    expect(html).toContain('계기');
    expect(html).toContain('href="/viewer/91001?sourceText=');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    for (const label of ['다시', '어려움', '알맞음', '쉬움']) expect(html).toContain(label);
  });
  it('invalid source ids never become navigable links', () => {
    const html = render({ showAnswer: true, currentWord: { ...word, source_material_id: '//other-host' } });
    expect(html).not.toContain('href="/viewer/');
  });
  it('a deleted current word renders an empty state instead of dereferencing it', () => {
    expect(() => render({ currentWord: undefined, reviewWords: [null] })).not.toThrow();
  });
  it('account changes remount all session state; queue preparation cannot revive an unmounted account', () => {
    const code = fs.readFileSync('src/views/VocabPage.jsx','utf8');
    expect(code).toContain("<VocabWorkspace key={user?.id || 'guest'} />");
    expect(code).toContain('if (!workspaceAlive.current) return;');
    expect(code).toContain('error: vocabError, refetch: refetchVocab');
  });
  it('server grammar query failures branch before a successful empty session', () => {
    const code = fs.readFileSync('src/app/(app)/review/grammar/page.jsx','utf8');
    expect(code).toContain('error: dueError');
    expect(code).toContain('error: upcomingError');
    expect(code.indexOf('if (dueError || upcomingError)')).toBeLessThan(code.indexOf('const items ='));
  });
});
