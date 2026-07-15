import { describe, expect, it } from 'vitest';
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  avatarPalette,
  avatarSignature,
  loadWorldAvatar,
  normalizeWorldAvatar,
  saveWorldAvatar,
} from '../avatar';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

describe('월드 캐릭터 커스터마이징', () => {
  it('외부 입력은 허용된 옵션으로만 정규화한다', () => {
    expect(normalizeWorldAvatar({ skin: 'unknown', hair: 'navy', top: 'bad', bottom: 'olive' })).toEqual({
      skin: AVATAR_OPTIONS.skin[0].id,
      hair: 'navy',
      top: AVATAR_OPTIONS.top[0].id,
      bottom: 'olive',
    });
  });

  it('팔레트는 모든 캐릭터 픽셀 키를 제공한다', () => {
    expect(Object.keys(avatarPalette(DEFAULT_AVATAR)).sort()).toEqual(['B', 'F', 'H', 'K', 'O', 'P', 'S']);
  });

  it('서로 다른 외형은 서로 다른 안전한 텍스처 서명을 만든다', () => {
    const first = avatarSignature(DEFAULT_AVATAR);
    const second = avatarSignature({ ...DEFAULT_AVATAR, top: 'blue' });
    expect(first).toMatch(/^\d{4}$/);
    expect(second).not.toBe(first);
  });

  it('저장 후 같은 외형을 복원한다', () => {
    const storage = memoryStorage();
    const avatar = { skin: 'deep', hair: 'ash', top: 'green', bottom: 'charcoal' };
    saveWorldAvatar(avatar, storage);
    expect(loadWorldAvatar(storage)).toEqual(avatar);
  });
});
