import { describe, expect, it, vi } from 'vitest';

import {
  createVoiceMesh,
  falloffVolume,
  peerPlaybackVolume,
} from '../voice.js';

function createMesh() {
  const statuses = [];
  const voice = createVoiceMesh({
    selfId: 'self',
    sendSignal: vi.fn(),
    onSignal: vi.fn(),
  });
  voice.onStatus((status) => statuses.push(status));
  return { voice, statuses };
}

describe('peerPlaybackVolume — 로컬 상대 음소거', () => {
  it('음소거면 거리와 무관하게 0, 해제면 거리 감쇠를 그대로 사용한다', () => {
    expect(peerPlaybackVolume(2, true)).toBe(0);
    expect(peerPlaybackVolume(2, false)).toBe(falloffVolume(2));
  });
});

describe('createVoiceMesh 상대별 음소거 API', () => {
  it('mutePeer/getMuted와 onStatus muted 플래그를 함께 갱신한다', () => {
    const { voice, statuses } = createMesh();
    voice.setPeerDistance('peer-a', 2);
    voice.mutePeer('peer-a', true);

    const peer = statuses.at(-1).peers.find(({ id }) => id === 'peer-a');
    expect(peer).toMatchObject({ muted: true, volume: 0 });
    expect(voice.getMuted()).toEqual(new Set(['peer-a']));

    const snapshot = voice.getMuted();
    snapshot.clear();
    expect(voice.getMuted()).toEqual(new Set(['peer-a']));
  });

  it('연결 제거·재선정 뒤에도 음소거를 유지하고 해제 시 현재 거리 볼륨을 복원한다', () => {
    const { voice, statuses } = createMesh();
    voice.setPeerDistance('peer-a', 1);
    voice.mutePeer('peer-a', true);
    voice.removePeer('peer-a');
    voice.setPeerDistance('peer-a', 3);

    let peer = statuses.at(-1).peers.find(({ id }) => id === 'peer-a');
    expect(peer).toMatchObject({ muted: true, volume: 0 });

    voice.mutePeer('peer-a', false);
    peer = statuses.at(-1).peers.find(({ id }) => id === 'peer-a');
    expect(peer.muted).toBe(false);
    expect(peer.volume).toBe(falloffVolume(3));
    expect(voice.getMuted()).toEqual(new Set());
  });

  it('피어가 아직 없어도 음소거 선택을 세션에 보관한다', () => {
    const { voice, statuses } = createMesh();
    voice.mutePeer('peer-later', true);
    voice.setPeerDistance('peer-later', 1);

    expect(statuses.at(-1).peers.find(({ id }) => id === 'peer-later'))
      .toMatchObject({ muted: true, volume: 0 });

    voice.destroy();
    expect(voice.getMuted()).toEqual(new Set());
  });
});
