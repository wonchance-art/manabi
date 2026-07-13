import { describe, it, expect } from 'vitest';
import { applyPeersToScene, emitPeerDistances } from '../sprites.js';

// 🔊 씬 전환 직후 음성 잔류 차단(Codex P1-2) — 공용 헬퍼(applyPeersToScene + emitPeerDistances) 수준
// 순수 검증. GameCanvas 는 각 씬 create 말미(onReady)에 최신 피어 스냅샷을 새 씬에 재적용한 뒤
// 전체 키를 1회 emit 한다 — 시나리오 "기존 근거리 피어 → 씬 전환 → 추가 peers:update 없음"에서
// 이전 씬 피어의 거리가 Infinity 로 나가야 한다(WorldPage 거리 수신부는 전달된 key 만 갱신하므로,
// 키가 빠지면 이전 근거리 값이 voice 에 남는다).

// Phaser 미의존 페이크 씬 — applyPeersToScene 이 만지는 add.image/add.text 만 체이너블로 흉내낸다.
function makeFakeScene() {
  const mkObj = (x = 0, y = 0) => ({
    x, y,
    setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; },
    setTexture() { return this; }, setFlipX() { return this; },
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
    setText() { return this; }, setStyle() { return this; },
    destroy() {},
  });
  return {
    peers: new Map(),
    fontReady: false,
    player: { x: 100, y: 100 },
    add: { image: (x, y) => mkObj(x, y), text: (x, y) => mkObj(x, y) },
    tweens: { add() {} },
  };
}

function makeBusMock() {
  const events = [];
  return { events, emit: (name, payload) => events.push({ name, payload }) };
}

describe('씬 전환 직후 전체 키 거리 emit — 타 씬 피어는 Infinity(P1-2)', () => {
  it('광장 근거리 피어 → 도시 씬 전환(추가 peers:update 없음) → 그 피어 거리가 Infinity 로 나간다', () => {
    // ① 광장 씬: 피어 p1(scene:'plaza')이 플레이어 바로 옆(1타일) — 실거리(유한) emit.
    const plaza = makeFakeScene();
    const snapshot = new Map([
      ['p1', { x: 132, y: 100, dir: 'down', nick: 'A', scene: 'plaza' }],
    ]);
    applyPeersToScene(plaza, snapshot, { charPrefix: 'pr', sceneName: 'plaza' });
    const busBefore = makeBusMock();
    emitPeerDistances(plaza, busBefore);
    expect(busBefore.events).toHaveLength(1);
    expect(Number.isFinite(busBefore.events[0].payload.p1)).toBe(true); // 근거리(유한) — 음성 대상

    // ② 도시 씬 전환: 새 씬은 peers 가 비어 있다. GameCanvas resetScenePeers 가 하는 일 그대로 —
    //    마지막 스냅샷을 도시 씬 필터로 재적용 후 즉시 거리 emit(추가 peers:update 없음).
    const city = makeFakeScene();
    applyPeersToScene(city, snapshot, { charPrefix: 'ct_pr', sceneName: 'city:fukuoka' });
    const busAfter = makeBusMock();
    emitPeerDistances(city, busAfter);

    // ③ p1 키가 빠지지 않고(전체 키 emit) Infinity 로 실린다 → voice 가 즉시 해제한다.
    expect(busAfter.events).toHaveLength(1);
    expect('p1' in busAfter.events[0].payload).toBe(true);
    expect(busAfter.events[0].payload.p1).toBe(Infinity);
  });

  it('같은 스냅샷 재적용 한 번으로 같은 씬=실거리 · 타 씬=Infinity 가 한 emit 에 함께 실린다', () => {
    // 좌표는 타일 중심으로 정렬(applyPeersToScene 은 피어를 타일 중심에 스냅) — 플레이어 (16,16)
    // = 타일(0,0) 중심, same (80,16) = 타일(2,0) 중심 → 실거리 정확히 2타일 = 64px.
    const snapshot = new Map([
      ['same', { x: 80, y: 16, dir: 'down', nick: 'S', scene: 'city:fukuoka' }], // 같은 도시(2타일)
      ['other', { x: 132, y: 100, dir: 'down', nick: 'O', scene: 'plaza' }],      // 광장(타 씬)
    ]);
    const city = makeFakeScene();
    city.player = { x: 16, y: 16 };
    applyPeersToScene(city, snapshot, { charPrefix: 'ct_pr', sceneName: 'city:fukuoka' });
    const bus = makeBusMock();
    emitPeerDistances(city, bus);
    const out = bus.events[0].payload;
    expect(out.same).toBe(64);           // 같은 씬 — 실거리(px)
    expect(out.other).toBe(Infinity);    // 타 씬 — 즉시 해제
  });

  it('타 씬 피어는 렌더 스프라이트를 만들지 않는다(otherScenePeerIds 만 채운다)', () => {
    const city = makeFakeScene();
    applyPeersToScene(city, new Map([
      ['other', { x: 10, y: 10, dir: 'down', nick: 'O', scene: 'plaza' }],
    ]), { charPrefix: 'ct_pr', sceneName: 'city:fukuoka' });
    expect(city.peers.size).toBe(0);
    expect(city.otherScenePeerIds.has('other')).toBe(true);
  });
});
