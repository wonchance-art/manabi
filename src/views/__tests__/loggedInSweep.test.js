import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { learnReviewCount, reviewScopeQuota } from '../../lib/reviewScope.js';

// LOGGED-IN-SWEEP-002(2026-11-02 KST, 합성 무거운 계정 3,000단어 · Pixel 5 · CPU×4): 배움이 다시 그려질 때마다
// 같은 입력으로 오늘 개수(countReviewScope · 3,000행)를 다시 셌다 — 값은 입력만의 함수라 입력이 같으면 다시 세지 않는다.
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const home = codeOf(fs.readFileSync('src/views/HomePage.jsx', 'utf8'));

describe('배움 — 단어 복습 칸 숫자는 입력이 같으면 다시 세지 않는다', () => {
  it('한도 · 칸 숫자가 useMemo이고, 한도는 admission에서 읽는 두 칸(quota · compatibility)만 본다', () => {
    expect(home).toContain('const quota = useMemo(() => reviewScopeQuota(admission, { ...device, vocabIds: data?.vocab?.map(v => v.id) }),');
    expect(home).toContain('[admission.quota, admission.compatibility, device, data?.vocab]);');
    expect(home).toContain('const reviewCount = useMemo(() => learnReviewCount({ snapshot: data?.learning, lang, quota, now: data?.now }), [data?.learning, lang, quota, data?.now]);');
    // 칸 숫자의 시각은 받은 snapshot의 시각(data.now)이다 — 그릴 때의 Date.now()가 아니라서 memo가 값을 바꾸지 않는다.
    expect(home).not.toMatch(/learnReviewCount\(\{[^}]*Date\.now\(\)/);
  });

  it('reviewScopeQuota는 admission의 quota · compatibility만 읽는다(memo 의존성이 빠짐없다)', () => {
    const quota = { active: true, remaining: 4, admittedLegacyCardIds: ['a'] };
    const device = { newPerDay: 10, introIds: ['a', 'b'], vocabIds: ['a'] };
    for (const compatibility of [false, true]) {
      const bare = reviewScopeQuota({ quota, compatibility }, device);
      expect(reviewScopeQuota({ quota, compatibility, status: 'ready', controller: {}, error: null, extra: 1 }, device)).toEqual(bare);
    }
    const fn = sliceBetween(codeOf(fs.readFileSync('src/lib/reviewScope.js', 'utf8')), 'export function reviewScopeQuota(', '\n}');
    expect(fn.match(/admission\??\.\w+/g).sort()).toEqual(['admission.compatibility', 'admission?.quota']);
  });

  it('learnReviewCount는 순수하다 — 같은 입력이면 같은 숫자(memo가 숫자를 바꾸지 않는다)', () => {
    expect(learnReviewCount({ snapshot: null, lang: 'Japanese', quota: { remaining: 1 }, now: 0 })).toBe(null);
    expect(learnReviewCount({ snapshot: { projections: [] }, lang: null, quota: {}, now: 0 })).toBe(null);
    const snapshot = { projections: [], enabled: true };
    const args = { snapshot, lang: 'Japanese', quota: { active: true, remaining: 3, admittedLegacyCardIds: [] }, now: '2026-11-02T00:00:00.000Z' };
    expect(learnReviewCount(args)).toBe(learnReviewCount({ ...args }));
  });
});
