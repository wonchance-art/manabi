import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

const query = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => query.params }));
vi.mock('next/dynamic', () => ({ default: () => 'TextImport' }));
vi.mock('next/link', () => ({ default: 'Link' }));
vi.mock('../../components/materials/MaterialComposer', () => ({ default: 'MaterialComposer' }));
vi.mock('../../components/materials/SuggestionReader', () => ({ default: 'SuggestionReader' }));
import MaterialEntry from '../../components/materials/MaterialEntry';

function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...elements(tree.props.children)];
}

describe('discoverable registered text reading entry', () => {
  beforeEach(() => { query.params = new URLSearchParams(); vi.stubGlobal('React', React); });
  afterEach(() => vi.unstubAllGlobals());

  it('offers the registered Korean text-reading link on the ordinary composer entry', () => {
    const initial = elements(MaterialEntry());
    expect(initial.some(node => node.type === 'MaterialComposer')).toBe(true);
    const reading = initial.find(node => node.type === 'Link' && node.props.href === '/materials/add?language=ko');
    expect(reading).toBeTruthy();
    expect(reading.props.children.join('')).toBe('한국어 텍스트 읽기 ↗');
    expect(initial.some(node => node.type === 'Link' && node.props.href === '/notes/new')).toBe(true);
    query.params = new URLSearchParams(reading.props.href.split('?')[1]);
    expect(MaterialEntry().type).toBe('TextImport');
  });

  it.each(['ko', 'ko-KR', 'Korean'])('routes the explicitly registered %s text adapter to the shared import form', language => {
    query.params.set('language', language);
    expect(MaterialEntry().type).toBe('TextImport');
  });

  it.each(['Japanese', 'Chinese', 'English', 'French', 'de', 'unknown', ''])('retains the ordinary composer for %s rather than enabling an unregistered adapter', language => {
    query.params.set('language', language);
    expect(elements(MaterialEntry()).some(node => node.type === 'MaterialComposer')).toBe(true);
  });

  it.each(['pdf', 'epub'])('does not treat a Korean language query as %s support', source => {
    query.params.set('language', 'ko'); query.params.set(source, 'source');
    expect(elements(MaterialEntry()).some(node => node.type === 'MaterialComposer')).toBe(true);
  });

  it('preserves write-note targets and does not advertise Korean as a writing target', () => {
    query.params.set('language', 'ko'); query.params.set('direction', 'write');
    const tree = elements(MaterialEntry());
    expect(tree.some(node => node.type === 'MaterialComposer')).toBe(true);
    expect(tree.some(node => node.type === 'Link' && node.props.href.includes('language=ko'))).toBe(false);
  });

  it('preserves suggestion priority, book entry and explicit legacy import paths', () => {
    query.params = new URLSearchParams('suggestion=reading&book=book&language=ko');
    expect(MaterialEntry()).toMatchObject({ type: 'SuggestionReader', props: { id: 'reading' } });
    query.params = new URLSearchParams('book=book');
    expect(MaterialEntry().type).toBe('TextImport');
    query.params = new URLSearchParams('advanced=1&direction=write&language=ko');
    expect(MaterialEntry().type).toBe('TextImport');
  });
});
