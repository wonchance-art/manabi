import { describe, expect, it, vi } from 'vitest';
<<<<<<< HEAD

// QuestReview는 supabase 클라이언트를 정적 import한다 — env 없는 테스트 계약(#400 선례) 유지용 mock.
vi.mock('../QuestReview', () => ({ GBC: { ink: '#1c2118', cream: '#f4edcf' }, gbcPanel: {}, gbcButtonPrimary: {} }));
=======
>>>>>>> origin/codex3/stamp-milestone-rewards
import { buildCityScene } from '../CityScene.js';
import { buildOverworldRegionScene } from '../overworldRegionScene.js';
import {
  QUEST_DONE_HEART_DELAYS_MS,
  STAMP_DEFAULT_DURATION_MS,
  STAMP_FACT_LINE_DURATION_MS,
  presentQuestDone,
  presentQuestScored,
  stampCollectionDurationMs,
} from '../stampCollectionPresentation.js';

const FakePhaser = {
  Scene: class {
    constructor(sceneId) { this.sceneId = sceneId; }
  },
};

function makePresentationScene() {
  return {
    spawnHeart: vi.fn(),
    tweens: { add: vi.fn() },
    time: { delayedCall: vi.fn((delay, callback) => ({ delay, callback })) },
  };
}

describe('스탬프 획득 factLine 연출', () => {
  it('지식 한 줄이 있으면 정확히 5.2초, 없으면 기존 3.5초를 유지한다', () => {
    expect(STAMP_FACT_LINE_DURATION_MS).toBe(5200);
    expect(STAMP_DEFAULT_DURATION_MS).toBe(3500);
    expect(stampCollectionDurationMs({ factLine: '한 줄 지식' })).toBe(5200);
    expect(stampCollectionDurationMs({ factLine: '' })).toBe(3500);
    expect(stampCollectionDurationMs(null)).toBe(3500);
  });
});

describe('quest:scored/done 공통 연출', () => {
  it('정답만 하트를 만들고 완료는 0/120/240ms에 세 개를 예약한다', () => {
    const scene = makePresentationScene();

    presentQuestScored(scene, { correct: false });
    presentQuestScored(scene, { correct: true });
    expect(scene.spawnHeart).toHaveBeenCalledTimes(1);

    presentQuestDone(scene);
    expect(QUEST_DONE_HEART_DELAYS_MS).toEqual([0, 120, 240]);
    expect(scene.tweens.add).toHaveBeenCalledWith({
      targets: scene,
      petJumpVal: 1,
      duration: 220,
      ease: 'Quad.easeOut',
      yoyo: true,
      repeat: 1,
    });
    expect(scene.time.delayedCall.mock.calls.map(([delay]) => delay)).toEqual([0, 120, 240]);
    for (const [, callback] of scene.time.delayedCall.mock.calls) callback();
    expect(scene.spawnHeart).toHaveBeenCalledTimes(4);
  });

  it('도시와 지역 오버월드가 같은 공통 계약으로 quest 이벤트를 위임한다', () => {
    const CityScene = buildCityScene(FakePhaser, {
      id: 'fixture-city', cols: 1, rows: 1, CITY_TILE: {},
    }, {});
    const RegionScene = buildOverworldRegionScene(FakePhaser, {
      id: 'fixture-region', sceneId: 'overworld:fixture', width: 1, height: 1,
    }, {});

    for (const Scene of [CityScene, RegionScene]) {
      const scene = Object.assign(new Scene(), makePresentationScene());
      scene.questScoredFx({ correct: true });
      scene.questDoneFx();
      expect(scene.spawnHeart).toHaveBeenCalledTimes(1);
      expect(scene.time.delayedCall.mock.calls.map(([delay]) => delay)).toEqual([0, 120, 240]);
    }
  });

  it('지역 하트는 펫 대신 플레이어 위치에서 도시와 같은 속도로 떠오른다', () => {
    const RegionScene = buildOverworldRegionScene(FakePhaser, {
      id: 'fixture-region', sceneId: 'overworld:fixture', width: 1, height: 1,
    }, {});
    const image = {
      y: 84,
      setScale: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    const scene = new RegionScene();
    scene.player = { x: 40, y: 96 };
    scene.add = { image: vi.fn(() => image) };
    scene.tweens = { add: vi.fn() };

    scene.spawnHeart();

    expect(scene.add.image).toHaveBeenCalledWith(40, 84, 'region_quest_heart_fixture-region');
    expect(image.setScale).toHaveBeenCalledWith(2);
    expect(image.setDepth).toHaveBeenCalledWith(10001);
    expect(scene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({
      targets: image,
      y: 58,
      alpha: 0,
      duration: 1100,
      ease: 'Sine.easeOut',
    }));
    scene.tweens.add.mock.calls[0][0].onComplete();
    expect(image.destroy).toHaveBeenCalledOnce();
  });
});
