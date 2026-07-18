import { describe, expect, it } from 'vitest';
import { FUJI_CLIMB_ACT_COPY, fujiClimbActCopy } from '../fujiClimbContent.js';
import { FUJI_CLIMB_ACTS } from '../fujiClimbScene.js';
import { KAWAGUCHIKO_DOORS } from '../kawaguchikoDoors.js';

// 후지 등산 액트 카피 — 씬 골격 act id 와 1:1, MSM형 4축([ko/ja/reading/gloss]) 계약.
// 문법 축이 가와구치코 ja 도어 4종과 겹치지 않는 것도 고정(세트 간 비중복 규율의 액트 확장).

describe('후지 등산 액트 카피 — 씬 계약', () => {
  it('4막 카피가 씬 골격 act id 와 1:1 로 존재하고 4축 필드를 갖는다', () => {
    const actIds = FUJI_CLIMB_ACTS.map((act) => act.id);
    expect(Object.keys(FUJI_CLIMB_ACT_COPY).sort()).toEqual([...actIds].sort());
    for (const actId of actIds) {
      const copy = fujiClimbActCopy(actId);
      expect(copy.title?.length).toBeGreaterThan(0);
      expect(copy.ko?.length).toBeGreaterThan(0);
      expect(copy.ja?.length).toBeGreaterThan(0);
      expect(copy.reading?.length).toBeGreaterThan(0);
      expect(copy.gloss?.length).toBeGreaterThan(0);
    }
    expect(fujiClimbActCopy('no-such-act')).toBeNull();
  });

  it('문법 각주가 ja 도어 4종의 문법 축과 겹치지 않는다(です·て형+ください·존재·こそあど 회피)', () => {
    // 도어: n5-04(です)·n5-08(てください)·n5-07(존재)·n5-10(こそあど) / 액트: て형 연결·に·見える·ましょう.
    const doorChapters = new Set(KAWAGUCHIKO_DOORS.map((door) => door.chapter));
    expect(doorChapters.size).toBe(4);
    const actGlosses = Object.values(FUJI_CLIMB_ACT_COPY).map((copy) => copy.gloss).join(' ');
    for (const marker of ['ください', 'こそあど', 'あります']) {
      expect(actGlosses.includes(marker), marker).toBe(false);
    }
  });
});
