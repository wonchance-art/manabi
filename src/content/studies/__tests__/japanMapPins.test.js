import { describe, expect, it } from 'vitest';
import { JP_MAP_PINS, JP_MAP_THEMES } from '../japanMapPins.js';
import { getStudyDoc } from '../index.js';

// 지도 핀 계약 — 테마·문서 링크·좌표가 전부 실재와 맞아야 한다(문서 근거주의).
describe('일본학 지도 핀 계약', () => {
  const themeIds = new Set(JP_MAP_THEMES.map((t) => t.id));

  it('테마의 근거 문서가 전부 실존한다', () => {
    for (const t of JP_MAP_THEMES) {
      expect(getStudyDoc('japan', t.doc), `${t.id} → ${t.doc}`).not.toBeNull();
    }
  });

  it('핀 id는 유일하고, 테마는 유효하며, 설명이 있다', () => {
    expect(new Set(JP_MAP_PINS.map((p) => p.id)).size).toBe(JP_MAP_PINS.length);
    for (const p of JP_MAP_PINS) {
      expect(p.themes.length, p.id).toBeGreaterThan(0);
      for (const t of p.themes) expect(themeIds.has(t), `${p.id} → ${t}`).toBe(true);
      expect(p.desc?.length, p.id).toBeGreaterThan(10);
    }
  });

  it('좌표는 본토 지도 범위(투영 bbox) 안에 있다', () => {
    for (const p of JP_MAP_PINS) {
      expect(p.lat, p.id).toBeGreaterThan(30.8);
      expect(p.lat, p.id).toBeLessThan(45.8);
      expect(p.lng, p.id).toBeGreaterThan(129);
      expect(p.lng, p.id).toBeLessThan(146.2);
    }
  });

  it('모든 테마에 핀이 3개 이상 있다(빈 필터 방지)', () => {
    for (const t of JP_MAP_THEMES) {
      const n = JP_MAP_PINS.filter((p) => p.themes.includes(t.id)).length;
      expect(n, t.id).toBeGreaterThanOrEqual(3);
    }
  });
});
