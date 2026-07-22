import { describe, expect, it, vi } from 'vitest';
import { buildOverworldRegionScene } from '../overworldRegionScene.js';

const FakePhaser = {
  Scene: class {
    constructor(sceneId) { this.sceneId = sceneId; }
  },
};

const EMEA = { id: 'emea', sceneId: 'overworld:emea', width: 720, height: 720 };

function makeScene() {
  const RegionScene = buildOverworldRegionScene(FakePhaser, EMEA, {});
  const scene = new RegionScene();
  scene.cameras = { main: { fadeOut: vi.fn(), fadeIn: vi.fn() } };
  return scene;
}

describe('채널터널 구간 런타임 연출', () => {
  it('런던↔파리 운행 상태에 대칭적인 터널 metadata를 싣는다', () => {
    const scene = makeScene();
    const londonToParis = scene.railStatus({
      phase: 'riding',
      terminalId: 'paris-rail-hub',
      fromId: 'london-rail-hub',
      toId: 'paris-rail-hub',
    });
    const parisToLondon = scene.railStatus({
      phase: 'riding',
      terminalId: 'london-rail-hub',
      fromId: 'paris-rail-hub',
      toId: 'london-rail-hub',
    });

    expect(londonToParis.segmentPresentation).toEqual({
      serviceId: 'eurostar',
      kind: 'channel-tunnel',
      label: '영불해협 해저터널',
      fadeMs: 260,
    });
    expect(parisToLondon.segmentPresentation).toEqual(londonToParis.segmentPresentation);
  });

  it('채널 구간 출발·도착에만 260ms black fade를 적용한다', () => {
    const scene = makeScene();
    const channel = { fromId: 'london-rail-hub', toId: 'paris-rail-hub' };
    const surface = { fromId: 'paris-rail-hub', toId: 'berlin-rail-hub' };

    scene.beginRailSegmentPresentation(channel);
    scene.finishRailSegmentPresentation(channel);
    scene.beginRailSegmentPresentation(surface);
    scene.finishRailSegmentPresentation(surface);

    expect(scene.cameras.main.fadeOut).toHaveBeenCalledTimes(1);
    expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(260, 0, 0, 0);
    expect(scene.cameras.main.fadeIn).toHaveBeenCalledTimes(1);
    expect(scene.cameras.main.fadeIn).toHaveBeenCalledWith(260, 0, 0, 0);
  });

  it('정차·종착 상태에는 운행 구간 metadata를 남기지 않는다', () => {
    const scene = makeScene();
    expect(scene.railStatus({
      phase: 'stopped',
      terminalId: 'rome-rail-hub',
      stopId: 'paris-rail-hub',
    }).segmentPresentation).toBeNull();
  });
});
