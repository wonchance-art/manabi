import { AVATAR_STORAGE_KEY } from './storageSchema.js';

export { AVATAR_STORAGE_KEY };

export const AVATAR_OPTIONS = {
  skin: [
    { id: 'warm', label: '웜', color: 0xf1c99a, shade: 0xd39c6a },
    { id: 'light', label: '라이트', color: 0xf6d7b8, shade: 0xd8ad82 },
    { id: 'tan', label: '탠', color: 0xc98f62, shade: 0xa96d45 },
    { id: 'deep', label: '딥', color: 0x8f5d3b, shade: 0x694027 },
  ],
  hair: [
    { id: 'brown', label: '브라운', color: 0x6b4a2a },
    { id: 'black', label: '블랙', color: 0x2c2928 },
    { id: 'chestnut', label: '체스트넛', color: 0x9a5535 },
    { id: 'ash', label: '애시', color: 0x716b66 },
    { id: 'navy', label: '네이비', color: 0x34435f },
  ],
  top: [
    { id: 'coral', label: '코랄', color: 0xd8524a },
    { id: 'blue', label: '블루', color: 0x4a86d8 },
    { id: 'green', label: '그린', color: 0x4f9254 },
    { id: 'yellow', label: '옐로', color: 0xd6a839 },
    { id: 'purple', label: '퍼플', color: 0x7b62a8 },
    { id: 'cream', label: '크림', color: 0xe6d7ac },
  ],
  bottom: [
    { id: 'denim', label: '데님', color: 0x3b4a86 },
    { id: 'charcoal', label: '차콜', color: 0x41434b },
    { id: 'olive', label: '올리브', color: 0x59643c },
    { id: 'brown', label: '브라운', color: 0x75533d },
  ],
  // ── 실루엣 그룹(v2) — 색이 아니라 도트 형태를 바꾼다. 첫 옵션 = 기존 외형(v1 저장본 하위호환). ──
  style: [
    { id: 'cap', label: '캡 모자' },
    { id: 'short', label: '숏컷' },
    { id: 'bob', label: '단발' },
    { id: 'long', label: '롱헤어' },
  ],
  outfit: [
    { id: 'tee', label: '티셔츠' },
    { id: 'coat', label: '코트' },
    { id: 'dress', label: '원피스' },
  ],
  acc: [
    { id: 'none', label: '없음' },
    { id: 'glasses', label: '안경' },
    { id: 'scarf_red', label: '빨간 목도리', color: 0xc23b3b },
    { id: 'scarf_mint', label: '민트 목도리', color: 0x3fae8c },
  ],
};

export const DEFAULT_AVATAR = Object.freeze({
  skin: 'warm',
  hair: 'brown',
  top: 'coral',
  bottom: 'denim',
  style: 'cap',
  outfit: 'tee',
  acc: 'none',
});

const optionFor = (group, id) => (
  AVATAR_OPTIONS[group].find((option) => option.id === id) || AVATAR_OPTIONS[group][0]
);

export function normalizeWorldAvatar(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    skin: optionFor('skin', source.skin).id,
    hair: optionFor('hair', source.hair).id,
    top: optionFor('top', source.top).id,
    bottom: optionFor('bottom', source.bottom).id,
    style: optionFor('style', source.style).id,
    outfit: optionFor('outfit', source.outfit).id,
    acc: optionFor('acc', source.acc).id,
  };
}

export function avatarPalette(value) {
  const avatar = normalizeWorldAvatar(value);
  const skin = optionFor('skin', avatar.skin);
  return {
    O: 0x241a12,
    H: optionFor('hair', avatar.hair).color,
    S: skin.color,
    K: skin.shade,
    P: optionFor('bottom', avatar.bottom).color,
    F: 0x2e2a28,
    B: optionFor('top', avatar.top).color,
    G: 0xb7c9de,                                        // 안경 렌즈(밝은 유리색 — 어두운 눈이 렌즈 안에 떠 보임)
    C: optionFor('acc', avatar.acc).color ?? 0xc23b3b,  // 목도리색(스카프 옵션에서)
  };
}

export function avatarSignature(value) {
  const avatar = normalizeWorldAvatar(value);
  return ['skin', 'hair', 'top', 'bottom', 'style', 'outfit', 'acc']
    .map((group) => AVATAR_OPTIONS[group].findIndex((option) => option.id === avatar[group]))
    .join('');
}

export function loadWorldAvatar(storage = globalThis?.localStorage) {
  if (!storage) return { ...DEFAULT_AVATAR };
  try {
    return normalizeWorldAvatar(JSON.parse(storage.getItem(AVATAR_STORAGE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

export function saveWorldAvatar(value, storage = globalThis?.localStorage) {
  const avatar = normalizeWorldAvatar(value);
  try { storage?.setItem(AVATAR_STORAGE_KEY, JSON.stringify(avatar)); } catch { /* 저장소 차단 시 현재 세션만 유지 */ }
  return avatar;
}
