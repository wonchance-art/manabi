import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { COUNT_UNIT, METRICS } from '../metrics/registry.js';
import { GROWTH_COPY, GROWTH_LABELS } from '../growthStats.js';
import { VIEWER_MESSAGES } from '../viewerMessages.js';

/**
 * 계약: 지표 이름은 사전 한 곳에서 — 같은 이름이 두 값에 붙지 않는다 (STATS-MAP-001 S1, 오너 결정 2026-11-01 KST).
 * 「아는 단어」가 현황(표시 수) · 서재(안정도 7일+) · 뷰어(이 글 비율)에서 서로 다른 숫자였던 것을 되돌리지 않게.
 * 화면의 「아는 단어」 단추 · 목록(「이미 알아요」 표시 동작)은 지표가 아니라 그대로 둔다.
 */
const read = file => fs.readFileSync(file, 'utf8');

describe('지표 사전', () => {
  it('이름이 서로 겹치지 않는다', () => {
    const labels = Object.values(METRICS).map(m => m.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const m of Object.values(METRICS)) expect(m.def.length, m.label).toBeGreaterThan(10);
  });

  it('세는 단위는 단어(오너 결정 5) — 카드 종류가 들어와도 큰 숫자는 단어 단위', () => {
    expect(COUNT_UNIT).toBe('word');
  });

  it('현황 · 서재 · 뷰어 · 자료실이 사전 이름을 쓴다', () => {
    expect(GROWTH_LABELS.knownWords).toBe(METRICS.remembered.label);
    expect(GROWTH_COPY.knownWordSub).toBe(METRICS.remembered.sub);
    expect(read('src/views/ProfileStats.jsx')).toContain('label={METRICS.knownMarked.label}');
    // 뷰어 단어 현황은 한 줄(VIEWER-MEMBER-SSR-001 ㉠ 오너 2026-11-04 KST) — 자료실 배지처럼 사전의 짧은 이름을 쓴다.
    expect(Object.keys(VIEWER_MESSAGES.ko).some(key => key.startsWith(`${METRICS.textCoverage.short} {percent}%`))).toBe(true);
    expect(read('src/views/MaterialsPage.jsx')).toContain(`${METRICS.textCoverage.short} {Math.round(bf.coverage * 100)}%`);
  });

  it('통계 칸에 「아는 단어」를 지표 이름으로 다시 쓰지 않는다', () => {
    expect(read('src/views/ProfileStats.jsx')).not.toMatch(/label="아는 단어"/);
    expect(read('src/views/StudyLibraryPage.jsx')).not.toMatch(/label="아는 단어"/);
    expect(read('src/views/MaterialsPage.jsx')).not.toMatch(/% 앎</);
  });
});
