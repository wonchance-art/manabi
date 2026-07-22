import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createGuestAwarePositionPersister } from '../guestPositionPersistence.js';

const GAME_CANVAS_SOURCE = readFileSync(new URL('../GameCanvas.jsx', import.meta.url), 'utf8');

describe('dev guest 교통 위치 저장 스킵', () => {
  it('dev guest는 사용자·좌표 유무와 관계없이 저장 API를 호출하지 않고 성공한다', async () => {
    const request = vi.fn();
    const persistPosition = createGuestAwarePositionPersister({
      devGuest: true,
      userId: null,
      request,
    });

    await expect(persistPosition({ scene: 'overworld:emea', x: 12, y: 34 })).resolves.toBe(true);
    await expect(persistPosition(null)).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('로그인 사용자는 기존 exact POST 성공 뒤에만 저장 성공을 반환한다', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    const position = { scene: 'transsib-corridor', x: 32, y: 8 };
    const persistPosition = createGuestAwarePositionPersister({
      devGuest: false,
      userId: 'user-1',
      request,
    });

    await expect(persistPosition(position)).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('/api/world/position', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(position),
      keepalive: true,
    });
  });

  it('일반 비로그인·비정상 응답·네트워크 실패는 저장 성공으로 위장하지 않는다', async () => {
    const request = vi.fn();
    const anonymousPersist = createGuestAwarePositionPersister({ request });
    await expect(anonymousPersist({ scene: 'plaza', x: 1, y: 2 })).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();

    const failedRequest = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('offline'));
    const persistPosition = createGuestAwarePositionPersister({
      userId: 'user-1',
      request: failedRequest,
    });
    await expect(persistPosition({ scene: 'plaza', x: 1, y: 2 })).resolves.toBe(false);
    await expect(persistPosition({ scene: 'plaza', x: 1, y: 2 })).resolves.toBe(false);
  });

  it('GameCanvas 에어허브·횡단열차·지역 페리가 같은 guest-aware 저장기를 소비한다', () => {
    const airHub = GAME_CANVAS_SOURCE.match(/async flyToOverworldRegion[\s\S]*?^        }/m)?.[0];
    const corridor = GAME_CANVAS_SOURCE.match(/const corridorCtx = \{[\s\S]*?const TranssibCorridorScene/m)?.[0];
    const regions = GAME_CANVAS_SOURCE.match(/const regionScenes = [\s\S]*?^      \}\)\);/m)?.[0];

    expect(GAME_CANVAS_SOURCE).toContain(
      'const persistSessionPosition = createGuestAwarePositionPersister({ devGuest, userId });',
    );
    expect(airHub).toContain('await persistSessionPosition(destination.spawn)');
    expect(airHub).toContain('(!devGuest && !userId)');
    expect(corridor).toContain('persistPosition: persistSessionPosition');
    expect(regions).toContain('persistPosition: persistSessionPosition');
  });
});
