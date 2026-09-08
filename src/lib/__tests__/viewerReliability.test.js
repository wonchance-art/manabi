import { describe, expect, it } from 'vitest';
import { contextualMeaning, referenceMatchesContext, createViewerRequestGate, viewerCacheKey, viewerCommandAllowed } from '../viewerReliability';

describe('viewer context and requests', () => {
  it('keeps the contextual sense, including absent meaning, without substituting a dictionary sense', () => {
    const token = { text: '盛', meaning: '담다', furigana: 'chéng' };
    expect(contextualMeaning(token)).toBe('담다');
    expect(referenceMatchesContext(token, { ko: '성대하다', pinyin: 'shèng' })).toBe(false);
    expect(referenceMatchesContext(token, { ko: '담다', pinyin: 'shèng' })).toBe(false);
    expect(referenceMatchesContext(token, { ko: '담다', pinyin: 'chéng' })).toBe(true);
    expect(contextualMeaning({ text: '盛' })).toBe('');
  });
  it('invalidates an older word/selection request even if its network ignores abort', () => {
    const gate = createViewerRequestGate(), a = gate.start(), b = gate.start();
    expect(a.signal.aborted).toBe(true);
    expect(gate.isCurrent(a)).toBe(false);
    expect(gate.isCurrent(b)).toBe(true);
    gate.cancel();
    expect(gate.isCurrent(b)).toBe(false);
  });
  it('distinguishes the full text, account, document revision and sense without exposing text in keys', async () => {
    const prefix = 'a'.repeat(200), scope = ['owner', 'material', 'r1', 'Chinese'];
    const key = await viewerCacheKey('viewer_an', scope, prefix + '甲');
    expect(key).not.toBe(await viewerCacheKey('viewer_an', scope, prefix + '乙'));
    expect(key).not.toBe(await viewerCacheKey('viewer_an', ['other', ...scope.slice(1)], prefix + '甲'));
    expect(key).not.toBe(await viewerCacheKey('viewer_an', ['owner', 'material', 'r2', 'Chinese'], prefix + '甲'));
    expect(key).not.toContain(prefix);
    expect(key).toBe(await viewerCacheKey('viewer_an', scope, prefix + '甲'));
  });
  it('does not grade hidden cards, modal backgrounds, composing input or held keys', () => {
    const event = { target: { closest: selector => selector === '.word-detail-card' ? { getClientRects: () => [1] } : null } };
    expect(viewerCommandAllowed(event, { cardOpen: true, blocked: false })).toBe(true);
    expect(viewerCommandAllowed(event, { cardOpen: false, blocked: false })).toBe(false);
    expect(viewerCommandAllowed(event, { cardOpen: true, blocked: true })).toBe(false);
    expect(viewerCommandAllowed({ ...event, isComposing: true }, { cardOpen: true })).toBe(false);
    expect(viewerCommandAllowed({ ...event, repeat: true }, { cardOpen: true })).toBe(false);
    expect(viewerCommandAllowed({ target: { closest: () => null } }, { cardOpen: true })).toBe(false);
  });
});
