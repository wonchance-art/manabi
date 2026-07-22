import { describe, it, expect } from 'vitest';
import { stampIcon, fmtDate } from '../stampIcons';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse';

// 🗾 여행 스탬프 앨범 — 순수 로직(아이콘 매핑·날짜 포맷) 회귀. 렌더는 GameCanvas 통합 경로에서 확인.
describe('스탬프 앨범 — stampIcon(노드→배지 아이콘)', () => {
  it('전 STAMP_ALBUM_NODES 85개가 비어 있지 않은 아이콘으로 매핑된다', () => {
    expect(STAMP_ALBUM_NODES).toHaveLength(85);
    for (const n of STAMP_ALBUM_NODES) {
      const icon = stampIcon(n);
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });

  it('id 오버라이드가 kind 보다 우선(haneda→✈️, tottori→🏜️)', () => {
    const haneda = STAMP_ALBUM_NODES.find((n) => n.id === 'haneda');
    const tottori = STAMP_ALBUM_NODES.find((n) => n.id === 'tottori');
    expect(stampIcon(haneda)).toBe('✈️');
    expect(stampIcon(tottori)).toBe('🏜️');
  });

  it('npc(ramen/shrine)·peak·kind 순으로 선택', () => {
    expect(stampIcon({ id: 'x', npc: 'ramen', kind: 'npc' })).toBe('🍜');
    expect(stampIcon({ id: 'x', npc: 'shrine', kind: 'npc' })).toBe('⛩️');
    expect(stampIcon({ id: 'x', peak: 'fuji', kind: 'landmark' })).toBe('🗻'); // peak 이 kind 보다 우선
    expect(stampIcon({ id: 'x', kind: 'city' })).toBe('🏙️');
    expect(stampIcon({ id: 'x', kind: 'airport' })).toBe('✈️');
    expect(stampIcon({ id: 'x', kind: 'port' })).toBe('⚓');
    expect(stampIcon({ id: 'x', kind: 'landmark' })).toBe('⛰️');
    expect(stampIcon({ id: 'x', kind: 'unknown' })).toBe('📍'); // 폴백
  });

  it('실 노드 표본: fukuoka-ramen→🍜, dazaifu-shrine→⛩️, fuji→🗻, seoul→🏙️', () => {
    const pick = (id) => stampIcon(STAMP_ALBUM_NODES.find((n) => n.id === id));
    expect(pick('fukuoka-ramen')).toBe('🍜');
    expect(pick('dazaifu-shrine')).toBe('⛩️');
    expect(pick('fuji')).toBe('🗻');
    expect(pick('baekdu')).toBe('🗻');
    expect(pick('seoul')).toBe('🏙️');
    expect(pick('incheon-airport')).toBe('✈️');
    expect(pick('busan-port')).toBe('⚓');
    expect(pick('paris')).toBe('🏙️');
  });
});

describe('스탬프 앨범 — fmtDate(방문일 포맷)', () => {
  // fmtDate 는 로컬 타임존 Date 로 표시(사용자 방문일 감성) — 테스트 호스트 TZ 에 의존하지 않도록
  // 정확 날짜 대신 형식·0패딩·구분자를 검증한다(구현과 동일 로컬 추출로 기대값을 만들어 대조).
  it('유효 ISO → YYYY.MM.DD 형식(0 패딩·마침표 구분)', () => {
    const iso = '2026-07-13T14:06:21Z';
    expect(fmtDate(iso)).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    expect(fmtDate(iso)).toBe(`${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`);
  });

  it('한 자리 월·일도 0 패딩(길이 10 고정)', () => {
    // 로컬 TZ 무관하게 어떤 유효 시각이든 출력은 항상 YYYY.MM.DD(10자).
    for (const iso of ['2026-01-05T12:00:00Z', '2026-09-09T06:30:00Z', '2027-11-30T23:15:00Z']) {
      expect(fmtDate(iso)).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
      expect(fmtDate(iso)).toHaveLength(10);
    }
  });

  it('빈 값·잘못된 값은 빈 문자열', () => {
    expect(fmtDate('')).toBe('');
    expect(fmtDate(null)).toBe('');
    expect(fmtDate(undefined)).toBe('');
    expect(fmtDate('not-a-date')).toBe('');
  });
});
