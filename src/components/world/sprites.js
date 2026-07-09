// 🌱 학습 월드 — 절차 생성 스프라이트/팔레트 데이터 (외부 에셋 0).
//
// GameCanvas.jsx가 부팅 시 1회 generateTexture로 굽는 "도트 원본"을 여기 모았다.
// 분리 이유:
//   1) GameCanvas가 가벼워진다(픽셀맵 문자열이 컴포넌트 밖으로).
//   2) 픽셀맵 무결성(모든 프레임이 규격 크기·미정의 색문자 0)을 vitest로 검증 가능.
//   3) 시간대 팔레트(day/sunset/night)를 순수 함수로 스냅샷 테스트 가능.
//
// 픽셀맵 문법: 행 문자열 배열 + 문자→색 매핑. '.'·미정의 = 투명.
//   캐릭터는 16×24(세로 확장 — 머리가 타일 위로 삐져나오는 포켓몬 GSC 비율),
//   펫은 12×16. 우향 캐릭터는 side(좌향)를 flipX로 낸다.
//
// **좌표 불변**: 타일 16×16 그리드·줌 1.5는 GameCanvas가 그대로 유지한다.
//   여기서 커지는 건 "그려지는 스프라이트의 세로 픽셀"뿐 — origin 보정으로 발이 타일에 정렬된다.

// ── 규격 상수 ──
export const CHAR_W = 16;
export const CHAR_H = 24;   // 하단 16px(=1타일)이 점유 타일, 상단 8px가 타일 위로 삐져나옴
export const CHAR_TILE_PX = 16; // 발이 정렬되는 타일 소스 크기(하단 16px)
export const PET_W = 12;
export const PET_H = 16;

// 캐릭터가 타일 위로 삐져나오는 만큼(소스 px). origin 계산에 쓴다.
// 앵커(=타일 중심)는 하단에서 CHAR_TILE_PX/2 위 → 위에서부터 (CHAR_H - 8)번째 행.
export const CHAR_ORIGIN_Y = (CHAR_H - CHAR_TILE_PX / 2) / CHAR_H; // = 16/24 = 0.6667

// ── 캐릭터 상반신 (16×18) — 방향별 고정, 아래에 다리 6행을 붙여 24행 완성 ──
// 재작화 목표: 포켓몬 GSC 주인공(골드) 수준의 명료함.
//   · 챙 있는 캡(H) — 정면은 이마 위 어두운 챙(O 가로줄), 측면은 앞으로 튀어나온 챙
//   · 얼굴 2px 눈(O) + 입 음영(K), 몸통(B 셔츠)·팔(양옆 B 소매+S 손)·팔레트 문자 그대로
//   · up은 캡 뒷면 + 등에 배낭 힌트(P 블록), side는 챙 방향성이 뚜렷한 프로필
// 1px 어두운 윤곽선(O)으로 실루엣을 또렷하게 유지. 몸통/다리는 cols4~11(정면)·4~9(측면) 정렬.
const CHAR_TOP = {
  // 정면: 캡 크라운(H) → 챙(O 가로줄) → 얼굴(S·눈 O·입 K) → 목(K) → 어깨/팔(B·손 S) → 몸통(B).
  down: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '...OOOOOOOOOO...',
    '....OSSSSSSO....',
    '....OSOSSOSO....',
    '....OSSSSSSO....',
    '....OSSKKSSO....',
    '.....OSSSSO.....',
    '.....OKKKKO.....',
    '...OBBBBBBBBO...',
    '..OBBBBBBBBBBO..',
    '..OSBBBBBBBBSO..',
    '..OSBBBBBBBBSO..',
    '...OBBBBBBBBO...',
    '...OBBBBBBBBO...',
    '...OBBBBBBBBO...',
  ],
  // 뒷모습: 캡 뒷면(H, 얼굴 없음) → 목(K) → 어깨/팔(B·손 S) → 등 배낭 힌트(P 블록).
  up: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '.....OHHHHO.....',
    '.....OKKKKO.....',
    '...OBBBBBBBBO...',
    '..OBBBBBBBBBBO..',
    '..OSBBBBBBBBSO..',
    '..OSBPPPPPPBSO..',
    '..OSBPPPPPPBSO..',
    '...OBPPPPPPBO...',
    '...OBBBBBBBBO...',
    '...OBBBBBBBBO...',
    '...OBBBBBBBBO...',
  ],
  // 좌향 프로필(우향은 flipX). 앞(왼쪽)으로 캡 챙(O)이 튀어나오고, 얼굴 S·눈 O가 앞을 본다.
  // 뒤통수 쪽(오른쪽)은 캡(H), 등에는 배낭(P). 몸통은 cols4~9로 측면 다리와 정렬.
  side: [
    '................',
    '....OOOOO.......',
    '...OHHHHHHO.....',
    '...OHHHHHHO.....',
    '.OOOOOHHHHO.....',
    '..OSSSHHHHO.....',
    '..OSOSHHHHO.....',
    '..OSSSHHHHO.....',
    '..OKSSHHHO......',
    '...OSSHHO.......',
    '...OKKKKO.......',
    '...OBBBBBBO.....',
    '..OSBBBBBBO.....',
    '..OSBBBBPPO.....',
    '...OBBBBPPO.....',
    '...OBBBBBBO.....',
    '...OBBBBBBO.....',
    '...OBBBBBBO.....',
  ],
};

// ── 다리 6행(19~24행 = 인덱스 18~23) — 걷기 3패턴(n:중립/l:왼발/r:오른발) ──
// 정면(down·up 공용)과 측면(side)으로 나뉜다. 4프레임 사이클 [l,n,r,n]로 쓴다.
const CHAR_LEGS = {
  front: {
    n: [
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '....OFFFFFFO....',
      '.....FFFFFF.....',
    ],
    l: [
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '..OFFO..OFFO....',
      '...FF....FF.....',
    ],
    r: [
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '....OFFO..OFFO..',
      '.....FF....FF...',
    ],
  },
  side: {
    n: [
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OFFFFFO......',
      '....FFFFF.......',
    ],
    l: [
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '..OFFO.OFFO.....',
      '..FF....FF......',
    ],
    r: [
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '...OFFFFFO......',
      '...FFFFFF.......',
    ],
  },
};

export const CHAR_DIRS = ['down', 'up', 'side'];
export const CHAR_POSES = ['n', 'l', 'r'];
// 걷기 4프레임 사이클(왼발-중립-오른발-중립).
export const CHAR_WALK_CYCLE = ['l', 'n', 'r', 'n'];

// 한 캐릭터 프레임(24행) = 상반신 18행 + 다리 6행.
export function charFrameRows(dir, pose) {
  const top = CHAR_TOP[dir];
  const group = dir === 'side' ? 'side' : 'front';
  const legs = CHAR_LEGS[group][pose];
  return top.concat(legs);
}

// ── 펫 (12×16) — 5종, 각 2프레임(idle 통통 튀기/꼬리·귀 흔들기 = 종별 개성) ──
// 두 프레임은 다리 교차(걷기)와 함께 종별 포인트(꼬리/귀/머리)가 1px 흔들려 idle에서도 살아있게.
// 팔레트 문자: O=윤곽, B=몸통, D=음영, N=코, P=코(핑크), W=배/등 하이라이트.
const PET_FRAMES = {
  dog: [
    [
      '............',
      '............',
      '.OO......OO.',
      '.OBO....OBO.',
      '..OBBBBBBBO.',
      '..OBOBBOBO..',
      '..OBBBNBBO..',
      '..OBBBBBBO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBDO',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '..OO...OO...',
      '............',
    ],
    [
      '............',
      '............',
      '.OO......OO.',
      '.OBO....OBOD',
      '..OBBBBBBBO.',
      '..OBOBBOBO..',
      '..OBBBNBBO..',
      '..OBBBBBBO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '...OO.OO....',
      '............',
    ],
  ],
  cat: [
    [
      '............',
      '.OO....OO...',
      '.OBO..OBO...',
      '.OBBBBBBBO..',
      '..OBOBBOBO..',
      '..OBBBNBBO..',
      '..OBBBBBBO..',
      '..OBBBBBBO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '..OO...OO...',
      '............',
    ],
    [
      'O...........',
      'OBO....OO...',
      '.OBO..OBO...',
      '.OBBBBBBBO..',
      '..OBOBBOBO..',
      '..OBBBNBBO..',
      '..OBBBBBBO..',
      '..OBBBBBBO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '...OO.OO....',
      '............',
    ],
  ],
  rabbit: [
    [
      '..OO..OO....',
      '..OB..OB....',
      '..OB..OB....',
      '..OBBBBBBO..',
      '..OBOBBOBO..',
      '..OBBBPBBO..',
      '..OBBBBBBO..',
      '..OBBBBBBO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '..OO...OO...',
      '............',
    ],
    [
      '..OO..OO....',
      '..OB..OB....',
      '..OBBBBBBO..',
      '..OBBBBBBO..',
      '..OBOBBOBO..',
      '..OBBBPBBO..',
      '..OBBBBBBO..',
      '..OBBBBBBO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '...OO.OO....',
      '............',
    ],
  ],
  fox: [
    [
      '............',
      '.OO....OO...',
      '.OBO..OBO...',
      '.OBBBBBBBO..',
      '..OBOBBOBO..',
      '..OBBBNBBO..',
      '..OWWWWWWO..',
      '..OWWWWWWO..',
      '.OBWWWWWWBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBDO',
      '.OBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '..OO...OO...',
      '............',
    ],
    [
      '............',
      '.OO....OO...',
      '.OBO..OBO...',
      '.OBBBBBBBO..',
      '..OBOBBOBO..',
      '..OBBBNBBO..',
      '..OWWWWWWO..',
      '..OWWWWWWO..',
      '.OBWWWWWWBO.',
      '.OBBBBBBBBO.',
      'DOBBBBBBBBO.',
      'OBBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '...OO.OO....',
      '............',
    ],
  ],
  turtle: [
    [
      '............',
      '............',
      '...OOOOOO...',
      '..OBBBBBBO..',
      '.OBBDDBBBBO.',
      '.OBDBBBBDBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '..OWWWWWWO..',
      '..OWWWWWWO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '..OO...OO...',
      '............',
    ],
    [
      '............',
      '............',
      '...OOOOOO...',
      '..OBBBBBBO..',
      '.OBDBBBBDBO.',
      '.OBBDDBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '..OWWWWWWO..',
      '..OWWWWWWO..',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.OBBBBBBBBO.',
      '.ODDO.ODDO..',
      '...OO.OO....',
      '............',
    ],
  ],
};

export const PET_KEYS = ['dog', 'cat', 'rabbit', 'fox', 'turtle'];

export function petFrameRows(key, frame) {
  const set = PET_FRAMES[PET_KEYS.includes(key) ? key : 'dog'];
  return set[frame ? 1 : 0];
}

// ── 기본 팔레트 (GBC풍 제한 색수·저채도, 0xRRGGBB) ──
// day 톤 원본. sunset/night는 tonePalette로 톤을 굽는다(런타임 틴트 오버레이 대신
// 텍스처 자체를 그 톤으로 구워 GBC 감성 보존).
export const BASE_TILE_PAL = {
  grass1: 0x7fb060, grass2: 0x679a4c, grass3: 0x94c56f,
  path1: 0xd8c48f, path2: 0xc2aa72, pathE: 0xa8895a,
  water1: 0x5a9fd4, water2: 0x9ccbe8, waterDk: 0x3f7fb0, waterMd: 0x4c8fc4,
  trunk: 0x8a5a2b, trunkD: 0x6b431f,
  leaf1: 0x4f9e3c, leaf2: 0x6ec24e, leafD: 0x367a2b,
  flowerP: 0xe8748e, flowerC: 0xf4d24a, stem: 0x4f9e3c, bushD: 0x367a2b,
  heart: 0xe0556a, heartHi: 0xf59caa,
  signPost: 0x8a5a2b, signBoard: 0xd8b483, signBorder: 0x6b431f, signLine: 0x6b431f,
  lampGlow: 0xffdd88, lampCore: 0xfff2c4,
};

// 캐릭터 팔레트(로컬/원격은 셔츠색 B만 다름).
export const CHAR_PAL_LOCAL = { O: 0x241a12, H: 0x6b4a2a, S: 0xf1c99a, K: 0xd39c6a, P: 0x3b4a86, F: 0x2e2a28, B: 0xd8524a };
export const CHAR_PAL_REMOTE = { ...CHAR_PAL_LOCAL, B: 0x4a86d8 };

// 펫 팔레트(종별 실루엣+고유색).
export const PET_PAL = {
  dog: { O: 0x3a2a1a, B: 0xc8955a, D: 0x9a6a3a, N: 0x2a1e14 },
  cat: { O: 0x2b2b32, B: 0xb0b4be, D: 0x7c828e, N: 0xe89ab0 },
  rabbit: { O: 0x4a4642, B: 0xf2f0ec, D: 0xd6d0c6, P: 0xe89ab0 },
  fox: { O: 0x5a3016, B: 0xe07a34, D: 0xb85a20, W: 0xf5efe2, N: 0x2a2018 },
  turtle: { O: 0x2f5a28, B: 0x5aa64c, D: 0x3a7a32, W: 0xdfeeb0 },
};

// ── 시간대 GBC 팔레트 (day/sunset/night) ──
// 채널 곱(mul)+더하기(add)로 텍스처 톤을 굽는다. 저채도·제한 색수 유지가 목표라 변화폭은 절제.
//   day    : 원본(아침·한낮, 06~16시)
//   sunset : 따뜻하게(노을, 16~19시) — 적/황 up, 청 down
//   night  : 어둡게+청색 시프트(19~06시) — 명도 down, 청 살짝 up (창문 불빛 포인트 별도)
export const TONE = {
  day: { mul: [1, 1, 1], add: [0, 0, 0] },
  sunset: { mul: [1.05, 0.90, 0.74], add: [20, 4, -2] },
  night: { mul: [0.50, 0.58, 0.84], add: [4, 6, 22] },
};

function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function shadeColor(hex, t) {
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  return (clamp8(r * t.mul[0] + t.add[0]) << 16)
    | (clamp8(g * t.mul[1] + t.add[1]) << 8)
    | clamp8(b * t.mul[2] + t.add[2]);
}

// 팔레트 객체 전체를 한 톤으로 굽는다(값→색만 변환, 키 유지).
export function tonePalette(pal, mode) {
  const t = TONE[mode] || TONE.day;
  const out = {};
  for (const k in pal) out[k] = shadeColor(pal[k], t);
  return out;
}

// 단색 하나만 톤 적용(배경색 등).
export function toneColor(hex, mode) {
  return shadeColor(hex, TONE[mode] || TONE.day);
}

// 현지 시각 → 시간대. (테스트 위해 date 주입 가능, 기본 new Date)
export function timeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'sunset';
  return 'night';
}
export const TONE_MODES = ['day', 'sunset', 'night'];
