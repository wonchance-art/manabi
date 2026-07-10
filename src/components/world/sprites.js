// 🌱 학습 월드 — 절차 생성 스프라이트/팔레트 데이터 (외부 에셋 0).
//
// GameCanvas.jsx가 부팅 시 1회 generateTexture로 굽는 "도트 원본"을 여기 모았다.
// 분리 이유:
//   1) GameCanvas가 가벼워진다(픽셀맵 문자열이 컴포넌트 밖으로).
//   2) 픽셀맵 무결성(모든 프레임이 규격 크기·미정의 색문자 0)을 vitest로 검증 가능.
//   3) 시간대 팔레트(day/sunset/night)를 순수 함수로 스냅샷 테스트 가능.
//
// 픽셀맵 문법: 행 문자열 배열 + 문자→색 매핑. '.'·미정의 = 투명.
//   캐릭터는 16×16(한 칸 — 오리지널 포켓몬 골드 필드 스프라이트 비율),
//   펫은 12×16. 우향 캐릭터는 side(좌향)를 flipX로 낸다.
//
// **좌표 불변**: 타일 16×16 그리드·줌은 GameCanvas가 그대로 유지한다.
//   캐릭터는 이제 딱 한 칸(16×16)이라 origin 0.5로 타일 중심에 정렬된다.

// ── 규격 상수 ──
export const CHAR_W = 16;
export const CHAR_H = 16;   // 한 칸(1타일) — 골드 필드 스프라이트처럼 타일에 꼭 맞음
export const CHAR_TILE_PX = 16; // 점유 타일 소스 크기(= CHAR_H)
export const PET_W = 12;
export const PET_H = 16;

// 앵커 = 타일 중심(0.5). 16×16 스프라이트가 타일 한 칸에 정확히 담긴다.
export const CHAR_ORIGIN_Y = (CHAR_H - CHAR_TILE_PX / 2) / CHAR_H; // = 8/16 = 0.5

// ── 캐릭터 상반신 (16×12) — 방향별 고정, 아래에 다리 4행을 붙여 16행(한 칸) 완성 ──
// 재작화 목표: 오리지널 포켓몬 골드(GSC) 필드 스프라이트 비율 — 머리 크게, 몸통 압축, 한 칸에 담김.
//   · 챙 있는 캡(H) — 정면은 이마 위 어두운 챙(O 가로줄), 측면은 앞으로 튀어나온 챙
//   · 얼굴 눈(O) + 입 음영(K), 몸통(B 셔츠)·팔(양옆 B 소매+S 손)·팔레트 문자 그대로
//   · up은 캡 뒷면 + 등에 배낭(P 블록), side는 챙 방향성이 뚜렷한 프로필 + 등 배낭(P)
// 1px 어두운 윤곽선(O)으로 실루엣을 또렷하게 유지. 몸통은 cols4~11(정면)·4~9(측면) 정렬.
const CHAR_TOP = {
  // 정면: 캡 크라운(H) → 챙(O 가로줄) → 얼굴(S·눈 O·입 K) → 어깨/팔(B·손 S) → 몸통(B).
  down: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '....OOOOOOOO....',
    '....OSSSSSSO....',
    '....OSOSSOSO....',
    '....OSSKKSSO....',
    '...OBBBBBBBBO...',
    '..OSBBBBBBBBSO..',
    '..OSBBBBBBBBSO..',
    '...OBBBBBBBBO...',
  ],
  // 뒷모습: 캡 뒷면(H, 얼굴 없음) → 목(K) → 어깨/팔(B·손 S) → 등 배낭(P 블록).
  up: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '....OHHHHHHO....',
    '.....OKKKKO.....',
    '...OBBBBBBBBO...',
    '..OSBPPPPPPBSO..',
    '..OSBPPPPPPBSO..',
    '...OBPPPPPPBO...',
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
    '..OKSSHHHO......',
    '...OBBBBBBO.....',
    '..OSBBBBPPO.....',
    '...OBBBBPPO.....',
    '...OBBBBBBO.....',
  ],
};

// ── 다리 4행(13~16행 = 인덱스 12~15) — 걷기 3패턴(n:중립/l:왼발/r:오른발) ──
// 정면(down·up 공용)과 측면(side)으로 나뉜다. 4프레임 사이클 [l,n,r,n]로 쓴다.
const CHAR_LEGS = {
  front: {
    n: [
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '....OFFFFFFO....',
      '.....FFFFFF.....',
    ],
    l: [
      '...OPPPPPPPPO...',
      '...OPPPPPPPPO...',
      '..OFFO..OFFO....',
      '...FF....FF.....',
    ],
    r: [
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
      '...OFFFFFO......',
      '....FFFFF.......',
    ],
    l: [
      '...OPPPPPPO.....',
      '...OPPPPPPO.....',
      '..OFFO.OFFO.....',
      '..FF....FF......',
    ],
    r: [
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

// 한 캐릭터 프레임(16행 = 한 칸) = 상반신 12행 + 다리 4행.
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

// ── 기본 팔레트 (GBC풍 제한 색수, 0xRRGGBB) ──
// day 톤 원본. sunset/night는 tonePalette로 톤을 굽는다(런타임 틴트 오버레이 대신
// 텍스처 자체를 그 톤으로 구워 GBC 감성 보존).
//
// 방향성: 젤다 꿈꾸는 섬 DX 야외 톤 — 차분한 초록에서 벗어나 밝고 쨍한 채도로.
//   · 잔디  : 옐로-그린 필드(밝고 채도 높게), 나무·풀숲은 더 진한 그린 + 웜 브라운 줄기
//     → 필드(grass1 밝은 옐로그린) vs 수관(leaf1 진한 그린)이 명료히 대비되도록 분리
//   · 길/광장: 웜 탠-크림(이전보다 밝고 따뜻하게) — 모래-체커 감성
//   · 물    : 밝은 시안-블루 + 거의 흰 물결 하이라이트
//   · 꽃    : 선명한 레드 꽃잎 + 옐로 심(원색 포인트)
//   · 표지판: 웜 레드-브라운 테두리 + 크림 보드
// (시간대 톤 검수: TONE 계수는 유지 — day 기준색만 밝아져 sunset은 더 따뜻하게,
//  night는 여전히 명도↓·청 시프트로 자연스럽게 어두워진다. night<day 명도 불변식 통과.)
export const BASE_TILE_PAL = {
  grass1: 0x8cc152, grass2: 0x6fa63a, grass3: 0xb2db6e,
  path1: 0xe8d6a0, path2: 0xd4bd82, pathE: 0xb89a68,
  water1: 0x4bb4e0, water2: 0xd6f0fb, waterDk: 0x2f92c8, waterMd: 0x3ea6d8,
  trunk: 0x9a5f2a, trunkD: 0x6f4420,
  leaf1: 0x4aa63a, leaf2: 0x74c84e, leafD: 0x2f7a2a,
  flowerP: 0xe23f34, flowerC: 0xf6c528, stem: 0x4aa63a, bushD: 0x2f7a2a,
  heart: 0xe0556a, heartHi: 0xf59caa,
  signPost: 0x9a5f2a, signBoard: 0xe0c188, signBorder: 0x9c4a2a, signLine: 0x9c4a2a,
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

// ── 강(RIVER) 오토타일 — 도트 물줄기 ──
// RIVER 타일을 "땅 바탕 + 폭 3px 물줄기"로 그린다. 4방향 이웃(RIVER/LAKE/SEA)의 연결 여부를
// 비트마스크(N=1,E=2,S=4,W=8)로 받아, 중앙 허브에서 연결된 변까지 뻗는 물줄기 사각형 목록을 낸다.
//   · 직선(N+S·E+W)·코너(NE/NW/SE/SW)·T·십자·끝(단일)·고립(0)이 전부 이 한 함수로 절차 생성돼
//     이웃 타일과 변 중앙(세로: cols6~8 / 가로: rows6~8)에서 반드시 만나 물줄기가 끊기지 않는다.
//   · 순수 함수(입력 mask → 출력 rects) — vitest로 경계·연결 불변식을 검증한다. 좌표는 16×16 타일 로컬 px.
export const RIVER_N = 1, RIVER_E = 2, RIVER_S = 4, RIVER_W = 8;
export function riverStreamRects(mask) {
  const rects = [[6, 6, 3, 3]]; // 중앙 허브(cols6~8·rows6~8) — 어떤 조합이든 물줄기가 만나는 지점
  if (mask & RIVER_N) rects.push([6, 0, 3, 6]); // 위 변까지(rows0~5)
  if (mask & RIVER_S) rects.push([6, 9, 3, 7]); // 아래 변까지(rows9~15)
  if (mask & RIVER_W) rects.push([0, 6, 6, 3]); // 왼 변까지(cols0~5)
  if (mask & RIVER_E) rects.push([9, 6, 7, 3]); // 오른 변까지(cols9~15)
  return rects;
}
