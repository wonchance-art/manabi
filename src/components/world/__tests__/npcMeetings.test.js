import { describe, expect, it, vi } from 'vitest';
import {
  isNpcMeetingCity,
  loadNpcMeetingIds,
  NPC_MEETING_CITY_IDS,
  npcMeetingStorageKey,
  recordNpcMeeting,
  saveNpcMeetingIds,
} from '../npcMeetings.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

function npc(id, overrides = {}) {
  return {
    id,
    kind: 'npc',
    npc: 'script',
    noStamp: true,
    ...overrides,
  };
}

describe('S13 도시 NPC 만남 localStorage 기록', () => {
  it('정본 3도시를 npc-met:<cityId> 키에 정렬된 ID 배열로 왕복한다', () => {
    const storage = memoryStorage();

    expect(NPC_MEETING_CITY_IDS).toEqual(['lyon', 'bordeaux', 'strasbourg']);
    expect(Object.isFrozen(NPC_MEETING_CITY_IDS)).toBe(true);
    expect(NPC_MEETING_CITY_IDS.every(isNpcMeetingCity)).toBe(true);
    expect(npcMeetingStorageKey('lyon')).toBe('npc-met:lyon');

    expect(saveNpcMeetingIds(
      'lyon',
      new Set(['lyon-vieux-lyon-fourviere-traboule', 'lyon-presquile-confluence-cafe']),
      storage,
    )).toBe(true);
    expect(storage.values.get('npc-met:lyon')).toBe(
      '["lyon-presquile-confluence-cafe","lyon-vieux-lyon-fourviere-traboule"]',
    );
    expect(loadNpcMeetingIds('lyon', storage)).toEqual(new Set([
      'lyon-presquile-confluence-cafe',
      'lyon-vieux-lyon-fourviere-traboule',
    ]));
  });

  it('대화 완주를 1회만 추가하고 재완주는 저장 쓰기를 반복하지 않는다', () => {
    const storage = memoryStorage();
    const args = {
      cityId: 'bordeaux',
      node: npc('bordeaux-gare-accueil', { npc: 'gare-accueil' }),
      storage,
    };

    expect(recordNpcMeeting(args)).toBe(true);
    expect(recordNpcMeeting(args)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(loadNpcMeetingIds('bordeaux', storage)).toEqual(
      new Set(['bordeaux-gare-accueil']),
    );
  });

  it('깨진 JSON·비배열은 비운 뒤 다음 완주로 복구하고 유효 문자열만 저장한다', () => {
    for (const broken of ['{broken', '{"npc":true}', 'null']) {
      const storage = memoryStorage();
      storage.values.set('npc-met:strasbourg', broken);

      expect(loadNpcMeetingIds('strasbourg', storage)).toEqual(new Set());
      expect(recordNpcMeeting({
        cityId: 'strasbourg',
        node: npc('strasbourg-gare-bretzel', { npc: 'gare-bretzel' }),
        storage,
      })).toBe(true);
      expect(storage.values.get('npc-met:strasbourg')).toBe(
        '["strasbourg-gare-bretzel"]',
      );
    }

    const storage = memoryStorage();
    expect(saveNpcMeetingIds(
      'lyon',
      new Set(['lyon-presquile-confluence-cafe', '', 7, null]),
      storage,
    )).toBe(true);
    expect(storage.values.get('npc-met:lyon')).toBe(
      '["lyon-presquile-confluence-cafe"]',
    );
  });

  it('범위 밖 도시·잘못된 ID·차단된 저장소는 throw 없이 fail-closed한다', () => {
    const storage = memoryStorage();
    expect(recordNpcMeeting({
      cityId: 'fukuoka',
      node: npc('fukuoka-konbini', { npc: 'konbini' }),
      storage,
    })).toBe(false);
    expect(recordNpcMeeting({ cityId: 'lyon', node: npc(''), storage })).toBe(false);
    expect(recordNpcMeeting({
      cityId: 'lyon',
      node: npc('stampable', { noStamp: false }),
      storage,
    })).toBe(false);
    expect(recordNpcMeeting({
      cityId: 'lyon',
      node: npc('no-script', { npc: '' }),
      storage,
    })).toBe(false);
    expect(loadNpcMeetingIds('fukuoka', storage)).toEqual(new Set());
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();

    const blocked = {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(() => { throw new Error('blocked'); }),
    };
    expect(loadNpcMeetingIds('lyon', blocked)).toEqual(new Set());
    expect(recordNpcMeeting({
      cityId: 'lyon',
      node: npc('lyon-presquile-confluence-cafe', { npc: 'lyon-presquile-cafe' }),
      storage: blocked,
    })).toBe(false);
  });
});
