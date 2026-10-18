import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AUTH_VIEWPORT, OWNER, SCREENS, builtForE2E, createRecorder, libraryRows, markdown, reviewWords, verdictCounts, verdictLines, viewerMaterial,
} from './ux-audit-auth-core.mjs';
import { AUTH_COVERED } from './ux-audit.mjs';
import { legacyLearningSnapshot } from '../e2e/fixtures/learning-snapshot.mjs';

// 로그인 화면 점검(scripts/ux-audit-auth.mjs)의 순수 부품 — 합성 자료가 e2e 합성 백엔드 계약을 지키는지, 판정 · 보고서 모양.
describe('합성 자료', () => {
  it('복습 단어는 기존 학습 스냅숏 계약을 통과하고, 모두 복습 대상(뜻 있음 · 이미 복습함 · 기한 지남)이다', () => {
    const words = reviewWords();
    const snapshot = legacyLearningSnapshot({ actorId: OWNER, rows: words, fields: null });
    expect(snapshot.registry.every(entry => entry.eligible)).toBe(true);
    expect(new Set(words.map(w => w.id)).size).toBe(words.length);
    expect(words.length).toBeGreaterThanOrEqual(3); // 앞면 클릭 · Space · 단추, 세 펼치기 경로를 한 번씩
    for (const word of words) {
      expect(word.meaning.trim()).not.toBe(''); // 뜻 없는 표현은 줄에서 빠진다
      expect(word.repetitions).toBeGreaterThan(0); // 「처음 보는 표현」 카드 없이 곧장 채점
      expect(word.last_reviewed_at).toBeTruthy();
      expect(Date.parse(word.next_review_at)).toBeLessThan(Date.parse('2026-10-16'));
    }
    expect(words.some(w => w.source_sentence)).toBe(true); // 힌트 단추(카드 안 다른 조작) 판정용
  });
  it('서재 자료는 합성 학습자 소유 · 고유 id · 고유 제목', () => {
    const rows = libraryRows();
    expect(rows).toHaveLength(5);
    expect(rows.every(row => row.owner_id === OWNER && row.visibility === 'private')).toBe(true);
    expect(new Set(rows.map(row => row.id)).size).toBe(5);
    expect(new Set(rows.map(row => row.title)).size).toBe(5);
  });
  it('뷰어 자료는 sequence가 모두 dictionary에 있고, 줄 사이에만 개행 토큰이 있다', () => {
    const material = viewerMaterial();
    const { sequence, dictionary } = material.processed_json;
    expect(sequence.every(id => dictionary[id])).toBe(true);
    const breaks = sequence.filter(id => dictionary[id].pos === '개행');
    expect(breaks).toHaveLength(material.raw_text.split('\n').length - 1);
    expect(dictionary.id_0_2).toMatchObject({ text: '駅', meaning: '역' }); // 스크립트가 누르는 토큰
    expect(material.headwords).not.toContain('。');
  });
});

describe('판정 · 보고서', () => {
  it('실패한 판정도 남기고 다음 판정을 계속한다', () => {
    const rec = createRecorder();
    expect(rec.check('review', '앞면 클릭 → 답', true, 'ok')).toBe(true);
    expect(rec.check('review', '넘김 효과', false, 'none')).toBe(false);
    rec.error('viewer', '뷰어', new Error('Timeout 60000ms exceeded.\n  at stack'));
    expect(verdictCounts(rec.results)).toEqual({ pass: 1, fail: 2, total: 3 });
    expect(rec.results[2].detail).toBe('중단: Timeout 60000ms exceeded.');
    expect(verdictLines(rec.results)[1]).toBe('FAIL  [review] 넘김 효과 — none');
  });
  it('보고서에 폭 · 판정 표 · 캡처가 나온다(표 안의 | 는 이스케이프)', () => {
    const rec = createRecorder();
    rec.check('library', '자료 5개', true, 'a | b');
    const md = markdown({ stamp: '2026-10-16 15:10', baseURL: 'http://127.0.0.1:8879', results: rec.results, shots: [{ name: 'library-1-list.png', note: '목록' }] });
    expect(md).toContain(`${AUTH_VIEWPORT.width}×${AUTH_VIEWPORT.height}`);
    expect(md).toContain('| PASS | library | 자료 5개 | a \\| b |');
    expect(md).toContain('`library-1-list.png` — 목록');
    expect(AUTH_VIEWPORT).toMatchObject({ width: 1280, height: 800 });
  });
  it('비로그인 점검이 넘겨준 로그인 화면을 이 점검의 화면이 모두 맡는다', () => {
    expect(AUTH_COVERED).toHaveLength(3);
    expect(SCREENS).toEqual(['review', 'library', 'viewer']);
  });
});

describe('e2e 빌드 확인', () => {
  it('e2e 공개 값이 인라인된 청크가 있을 때만 참', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ux-audit-auth-'));
    try {
      expect(await builtForE2E(join(dir, 'missing'))).toBe(false);
      await mkdir(join(dir, 'static', 'chunks', 'app'), { recursive: true });
      await writeFile(join(dir, 'static', 'chunks', 'app', 'a.js'), 'createClient("https://prod.supabase.co")');
      expect(await builtForE2E(dir)).toBe(false);
      await writeFile(join(dir, 'static', 'chunks', 'app', 'b.js'), 'createClient("https://e2e.supabase.co")');
      expect(await builtForE2E(dir)).toBe(true);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
