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
    expect(normalizeWorldAvatar({ skin: 'unknown', hair: 'navy', top: 'bad', bottom: 'olive', style: 'nope', outfit: 'dress', acc: 'glasses' })).toEqual({
      skin: AVATAR_OPTIONS.skin[0].id,
      hair: 'navy',
      top: AVATAR_OPTIONS.top[0].id,
      bottom: 'olive',
      style: AVATAR_OPTIONS.style[0].id,
      outfit: 'dress',
      acc: 'glasses',
    });
  });

  it('v1 저장본(4키)은 기본 실루엣(캡·티셔츠·소품 없음)으로 채워진다 — 하위호환', () => {
    const legacy = normalizeWorldAvatar({ skin: 'deep', hair: 'ash', top: 'green', bottom: 'charcoal' });
    expect(legacy.style).toBe('cap');
    expect(legacy.outfit).toBe('tee');
    expect(legacy.acc).toBe('none');
  });

  it('팔레트는 모든 캐릭터 픽셀 키를 제공한다(안경 G·목도리 C 포함)', () => {
    expect(Object.keys(avatarPalette(DEFAULT_AVATAR)).sort()).toEqual(['B', 'C', 'F', 'G', 'H', 'K', 'O', 'P', 'S']);
  });

  it('목도리 옵션 색이 팔레트 C에 반영된다', () => {
    const red = avatarPalette({ ...DEFAULT_AVATAR, acc: 'scarf_red' });
    const mint = avatarPalette({ ...DEFAULT_AVATAR, acc: 'scarf_mint' });
    expect(red.C).toBe(0xc23b3b);
    expect(mint.C).toBe(0x3fae8c);
    expect(red.C).not.toBe(mint.C);
  });

  it('서로 다른 외형은 서로 다른 안전한 텍스처 서명을 만든다', () => {
    const first = avatarSignature(DEFAULT_AVATAR);
    const second = avatarSignature({ ...DEFAULT_AVATAR, top: 'blue' });
    const third = avatarSignature({ ...DEFAULT_AVATAR, style: 'bob', acc: 'glasses' });
    expect(first).toMatch(/^\d{7}$/);
    expect(second).not.toBe(first);
    expect(third).not.toBe(first);
  });

  it('저장 후 같은 외형을 복원한다', () => {
    const storage = memoryStorage();
    const avatar = { skin: 'deep', hair: 'ash', top: 'green', bottom: 'charcoal', style: 'long', outfit: 'coat', acc: 'scarf_mint' };
    saveWorldAvatar(avatar, storage);
    expect(loadWorldAvatar(storage)).toEqual(avatar);
  });
});
