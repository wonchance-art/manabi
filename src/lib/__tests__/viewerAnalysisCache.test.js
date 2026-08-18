import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  analysisCacheKey, clearAnalysisCache, readAnalysisCache, writeAnalysisCache,
} from '../viewerAnalysisCache.js';

// 계약(§C4 재정의): 같은 문장 재지정 시 /api/analyze를 통째로 건너뛴다 —
// 문맥 판별·뜻 조회가 함께 절감된다. 교정·승격은 캐시를 무효화한다.

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _map: m,
  };
}

describe('analysisCacheKey', () => {
  it('언어·문장 단위 키(좌측 번역 viewer_tx와 대칭)', () => {
    expect(analysisCacheKey('Chinese', '今天')).toBe('viewer_an:Chinese:今天');
  });
  it('긴 문장은 잘라 키 폭주를 막는다', () => {
    expect(analysisCacheKey('Chinese', 'x'.repeat(500))).toHaveLength('viewer_an:Chinese:'.length + 200);
  });
});

describe('read/writeAnalysisCache', () => {
  let st;
  beforeEach(() => { st = fakeStorage(); });

  it('왕복 저장·복원', () => {
    const tokens = [{ text: '学习', meaning: '배우다' }];
    expect(writeAnalysisCache(st, 'k', tokens)).toBe(true);
    expect(readAnalysisCache(st, 'k')).toEqual(tokens);
  });

  it('빈 결과는 저장하지 않는다(실패를 굳히지 않음)', () => {
    expect(writeAnalysisCache(st, 'k', [])).toBe(false);
    expect(writeAnalysisCache(st, 'k', null)).toBe(false);
    expect(st.getItem('k')).toBeNull();
  });

  it('손상·형식 불일치는 null로 폴백한다', () => {
    st.setItem('bad', '{oops');
    st.setItem('shape', JSON.stringify([{ nope: 1 }]));
    st.setItem('notarr', JSON.stringify({ text: 'x' }));
    expect(readAnalysisCache(st, 'bad')).toBeNull();
    expect(readAnalysisCache(st, 'shape')).toBeNull();
    expect(readAnalysisCache(st, 'notarr')).toBeNull();
    expect(readAnalysisCache(st, 'missing')).toBeNull();
  });

  it('용량 초과 등 저장 실패는 조용히 false', () => {
    const failing = { setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(writeAnalysisCache(failing, 'k', [{ text: 'a' }])).toBe(false);
  });
});

describe('clearAnalysisCache — 교정·승격 무효화', () => {
  it('분석 캐시만 지우고 다른 캐시는 보존한다', () => {
    const st = fakeStorage({
      'viewer_an:Chinese:a': '[{"text":"a"}]',
      'viewer_an:Chinese:b': '[{"text":"b"}]',
      'viewer_tx:Chinese:a': '번역',
      'viewer_gr:Chinese:a': '문법',
      'vocab_langFilter': 'all',
    });
    expect(clearAnalysisCache(st)).toBe(2);
    expect(st.getItem('viewer_an:Chinese:a')).toBeNull();
    expect(st.getItem('viewer_tx:Chinese:a')).toBe('번역');
    expect(st.getItem('viewer_gr:Chinese:a')).toBe('문법');
    expect(st.getItem('vocab_langFilter')).toBe('all');
  });
});

describe('배선 계약', () => {
  const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');

  it('드래그 분석이 캐시를 먼저 읽고, 성공 결과를 저장한다', () => {
    expect(viewer).toContain('readAnalysisCache');
    expect(viewer).toContain('writeAnalysisCache');
    expect(viewer).toContain('analysisCacheKey(materialLang, sel)');
  });

  it('교정·승격 성공 시 캐시를 무효화한다(낡은 뜻 방지)', () => {
    expect(viewer).toContain('clearAnalysisCache');
  });
});
