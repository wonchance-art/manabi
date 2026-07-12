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

// ── 배 도트(페리 항해 연출) ──
// 캐릭터 아래에 붙는 작은 배. 삼각 돛(S) + 웜 브라운 선체(H·바닥 음영 D·윤곽 O). 16×8.
// 물 위(바다·강·호수)를 건너는 로컬 플레이어(페리 항해)와, 물 타일 위에 있는 원격 피어에 얹는다.
export const BOAT_W = 16;
export const BOAT_H = 8;
export const BOAT_PAL = { O: 0x2a1e14, H: 0x9a5f2a, D: 0x6f4420, S: 0xf6edcf };
const BOAT_ROWS = [
  '................',
  '.......S........',
  '......SS........',
  '.....SSS........',
  '.OOOOOSOOOOO....',
  '.OHHHHHHHHHO....',
  '..ODDDDDDDDO....',
  '...OOOOOOOO.....',
];
export function boatFrameRows() { return BOAT_ROWS; }

// ── NPC 마커 도트(월드 노드 kind:'npc') ──
// 후쿠오카 라멘 포장마차 주인(야타이+주인장)과 다자이후 신사 미코상(토리이+미코)을 소품과 함께
// 한 장의 마커로 굽는다. 24×24, 발밑(하단 중앙) 정렬(GameCanvas buildNpcMarkers 가 origin 0.5,1).
//   · ramen  : 붉은 노렌·지붕 + 붉은 초롱(ちょうちん) + 머리띠 두른 주인 + 나무 카운터에 김 나는 그릇
//   · shrine : 붉은 鳥居(토리이) 기둥/가사기 + 그 앞에 선 미코(흰 하카마 상의·緋袴)
// 픽셀맵 무결성(24행×24열·정의된 색문자만)은 sprites.test 로 검증한다.
export const NPC_W = 24;
export const NPC_H = 24;
export const NPC_KEYS = ['ramen', 'shrine'];

export const NPC_PAL = {
  // O=윤곽 R=적(노렌/지붕) r=적 음영 C=크림 W=나무카운터 w=나무 음영 Y=초롱 빛 H=머리(검) S=피부 K=콧수염 B=셔츠 N=그릇
  ramen: { O: 0x2a1e14, R: 0xc14b38, r: 0x8a2f24, C: 0xf6edcf, W: 0xb07a3e, w: 0x6f4420, Y: 0xf2a54a, H: 0x241a12, S: 0xf1c99a, K: 0x3a2a1a, B: 0x3a6ea5, N: 0xcfd6df },
  // O=윤곽 R=주홍(토리이) r=주홍 음영 H=머리(검) S=피부 W=흰 하카마(白衣) w=흰 음영 P=緋袴(붉은 하의)
  shrine: { O: 0x2a1e14, R: 0xe24a2e, r: 0xa8331f, H: 0x241a12, S: 0xf1c99a, W: 0xf4f0e6, w: 0xcbc3b4, P: 0xd45a78 },
};

const NPC_ART = {
  ramen: [
    '....OOOOOOOOOOOOOOOO....',
    '...ORRRRRRRRRRRRRRRRO...',
    '..ORRRRRRRRRRRRRRRRRRO..',
    '..OrrrrrrrrrrrrrrrrrrO..',
    '...w......OOOO......w...',
    '...w.....OYYYYO.....w...',
    '...w.....OYCCYO.....w...',
    '...w.....OYYYYO.....w...',
    '...w......OOOO......w...',
    '..ORRRRRRRRRRRRRRRRRRO..',
    '..OrrCCrrCCrrCCrrCCrrO..',
    '..OCCrrCCrrCCrrCCrrCCO..',
    '.......ORRRRRRRRO.......',
    '.......OHHHHHHHHO.......',
    '.......OSSOSSOSSO.......',
    '.......OSSSKKSSSO.......',
    '.......OSSSSSSSSO.......',
    '.....OBBBBBBBBBBBBO.....',
    '.....OBBBBBBBBBBBBO.....',
    '..OWWWWWWWWWWWWWWWWWWO..',
    '..OWWWWWWWNNNNWWWWWWWO..',
    '..OwwwwwwwwwwwwwwwwwwO..',
    '..OwwwwwwwwwwwwwwwwwwO..',
    '..w..................w..',
  ],
  shrine: [
    '.RR..................RR.',
    '.RRRRRRRRRRRRRRRRRRRRRR.',
    '.rrrrrrrrrrrrrrrrrrrrrr.',
    '....RRR..........RRR....',
    '...RRRRRRRRRRRRRRRRRR...',
    '...rrrrrrrrrrrrrrrrrr...',
    '....RRR..........RRR....',
    '....RRR..........RRR....',
    '....RRR.OHHHHHHO.RRR....',
    '....RRR.HSSSSSSH.RRR....',
    '....RRR.SSOSSOSS.RRR....',
    '....RRR.SSSSSSSS.RRR....',
    '....RRR.OWWWWWWO.RRR....',
    '....RRR.OWWWWWWO.RRR....',
    '....RRR.OWWWWWWO.RRR....',
    '....RRR.OWwwwwWO.RRR....',
    '....RRR.OPPPPPPO.RRR....',
    '....RRR.OPPPPPPO.RRR....',
    '....RRR.OPPPPPPO.RRR....',
    '....RRR.OPPPPPPO.RRR....',
    '....RRR.OPPPPPPO.RRR....',
    '....RRR.OWWWWWWO.RRR....',
    '....RRR.OWWWWWWO.RRR....',
    '....rrr..........rrr....',
  ],
};

// NPC 마커 픽셀맵(행 배열). 미지 key 는 ramen 으로 폴백.
export function npcMarkerRows(key) {
  return NPC_ART[NPC_KEYS.includes(key) ? key : 'ramen'];
}

// ── 원격 피어 스프라이트 렌더(광장·공항 공용 헬퍼) ──
// 두 씬(WorldScene·AirportScene)이 같은 도트 렌더·닉네임 라벨·그리드 보간을 재사용한다.
//   · scene 에 붙는 상태: scene.peers(Map), scene.fontReady(bool), scene.add/scene.tweens(Phaser).
//   · 좌표 스케일(1타일=32px, 소스16, 배율2, origin 0.5)은 두 씬이 동일 → 여기 상수로 고정한다.
//   · scene 필터: 피어에 scene 이 없으면 'plaza' 로 간주(하위호환 — Codex 가 net 수신부에 scene 추가 중).
export const PEER_TILE = 32;
export const PEER_TSCALE = PEER_TILE / CHAR_TILE_PX; // = 2 (소스16 → 월드32)
export const PEER_LABEL_DY = 30;
export const PEER_LABEL_DEPTH = 15000;
const PEER_STEP_MS = 200;
const PEER_ANIM_MS = 100;
const PEER_SNAP_TILES = 8;   // 이보다 먼 목적지 갱신은 스냅(순간이동을 길게 기어가지 않게)
const PEER_BOAT_DY = 8;      // 피어 발밑 배 오프셋(월드 px)
const PEER_DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const PEER_VALID_DIR = new Set(['up', 'down', 'left', 'right']);

// 닉네임 라벨 스타일 — Galmuri9(도트) 우선, 미로드 시 모노 폴백(잉크색 + 크림 스트로크).
export function peerLabelStyle(fontReady) {
  return {
    fontFamily: fontReady ? "'Galmuri9', monospace" : 'monospace',
    fontSize: '8px', color: '#2a2118',
    stroke: '#f6edcf', strokeThickness: 3,
  };
}

// 피어 캐릭터 프레임 이름(정지=중립 n, 이동=[l,n,r,n] 사이클). prefix 로 씬별 원격 팔레트를 고른다.
function peerCharTex(prefix, facing, moving, time) {
  const base = (facing === 'left' || facing === 'right') ? 'side' : facing;
  const pose = moving ? CHAR_WALK_CYCLE[Math.floor(time / PEER_ANIM_MS) % CHAR_WALK_CYCLE.length] : 'n';
  return `${prefix}_${base}_${pose}`;
}

// 원격 목록('peers:update')을 반영 — cfg.sceneName 에 해당하는 피어만 생성/갱신하고 나머지는 정리한다.
// incoming: Map|Object<id, { x, y, dir, nick, scene? }> (좌표는 월드 px). cfg: { charPrefix, sceneName }.
export function applyPeersToScene(scene, incoming, cfg) {
  const prefix = cfg.charPrefix;
  const sceneName = cfg.sceneName;
  const entries = incoming instanceof Map ? [...incoming.entries()] : Object.entries(incoming || {});
  const seen = new Set();
  // 다른 씬 피어 id — 이 씬에 렌더하진 않지만 근접 음성 거리 emit 에서 Infinity(해제)로 실어 보낸다.
  const otherScene = new Set();
  for (const [id, st] of entries) {
    if (!st) continue;
    if ((st.scene || 'plaza') !== sceneName) { otherScene.add(id); continue; } // 다른 씬은 렌더 제외(하위호환)
    seen.add(id);
    const tileX = Math.floor(st.x / PEER_TILE);
    const tileY = Math.floor(st.y / PEER_TILE);
    let p = scene.peers.get(id);
    if (!p) {
      const sx = tileX * PEER_TILE + PEER_TILE / 2, sy = tileY * PEER_TILE + PEER_TILE / 2;
      const sprite = scene.add.image(sx, sy, `${prefix}_down_n`).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(PEER_TSCALE);
      const label = scene.add.text(sx, sy - PEER_LABEL_DY, st.nick || '', peerLabelStyle(scene.fontReady))
        .setOrigin(0.5, 1).setDepth(PEER_LABEL_DEPTH);
      p = { sprite, label, boat: null, nick: st.nick || '', tileX, tileY, destTileX: tileX, destTileY: tileY, facing: 'down', moving: false };
      scene.peers.set(id, p);
    }
    if (st.nick != null && st.nick !== p.nick) { p.nick = st.nick; p.label?.setText(st.nick); }
    p.destTileX = tileX; p.destTileY = tileY;
    if (PEER_VALID_DIR.has(st.dir)) p.facing = st.dir;
    // 너무 먼 순간이동은 스냅. 페리 항해 좌표는 연속적(100ms당 몇 타일)이라 이 임계 밑에서 자연 보간된다.
    if (!p.moving && (Math.abs(tileX - p.tileX) + Math.abs(tileY - p.tileY)) > PEER_SNAP_TILES) {
      p.tileX = tileX; p.tileY = tileY;
      p.sprite.setPosition(tileX * PEER_TILE + PEER_TILE / 2, tileY * PEER_TILE + PEER_TILE / 2);
    }
  }
  for (const [id, p] of scene.peers) {
    if (!seen.has(id)) { p.sprite.destroy(); p.label?.destroy(); p.boat?.destroy(); scene.peers.delete(id); }
  }
  scene.otherScenePeerIds = otherScene;
}

// ── 근접 음성 거리 emit (광장·공항 공용 헬퍼) ──
// 두 씬(WorldScene·AirportScene)이 같은 거리 계산·emit 을 재사용한다. 전체 피어 목록을 실어 보낸다:
//   · 같은 씬 피어(scene.peers 에 렌더 중) → 플레이어와의 실거리(px, 반올림)
//   · 다른 씬 피어(scene.otherScenePeerIds) → Infinity
// Infinity 는 voice.setPeerDistance 가 voiceGate(비유한 → 해제)로 자연 정리한다(8타일 릴리스
// 히스테리시스 밖). 그래서 씬 전환 시 ① 떠나온 씬 피어의 stale 거리로 음성이 유지되지 않고,
// ② 새 씬 피어는 실거리로 즉시 음성 대상에 편입된다. (Phaser 미의존 — Math.hypot 로 계산.)
// bus 는 호출부가 주입(sprites.js 는 bus 를 직접 import 하지 않아 순수성을 유지).
export function emitPeerDistances(scene, bus) {
  if (!scene.player) return;
  const out = {};
  for (const [id, p] of scene.peers) {
    const dx = scene.player.x - p.sprite.x, dy = scene.player.y - p.sprite.y;
    out[id] = Math.round(Math.sqrt(dx * dx + dy * dy));
  }
  const others = scene.otherScenePeerIds;
  if (others) for (const id of others) out[id] = Infinity;
  bus.emit('peers:dist', out);
}

// 매 프레임 피어 갱신 — 목적 타일까지 축우선 그리드 스텝 + 라벨/배 추적.
// cfg: { charPrefix, isWater?(tileX,tileY)=>bool }. isWater 가 주어지면 물 위 피어에 't_boat' 를 붙인다.
export function updateScenePeers(scene, time, cfg) {
  const prefix = cfg.charPrefix;
  for (const [, p] of scene.peers) {
    if (!p.moving) {
      const dtx = p.destTileX - p.tileX, dty = p.destTileY - p.tileY;
      if (dtx || dty) {
        const d = Math.abs(dtx) >= Math.abs(dty) ? (dtx > 0 ? 'right' : 'left') : (dty > 0 ? 'down' : 'up');
        const [ddx, ddy] = PEER_DIRV[d];
        p.tileX += ddx; p.tileY += ddy; p.facing = d; p.moving = true;
        const tx = p.tileX * PEER_TILE + PEER_TILE / 2, ty = p.tileY * PEER_TILE + PEER_TILE / 2;
        scene.tweens.add({ targets: p.sprite, x: tx, y: ty, duration: PEER_STEP_MS, ease: 'Linear', onComplete: () => { p.moving = false; } });
      }
    }
    p.sprite.setTexture(peerCharTex(prefix, p.facing, p.moving, time));
    p.sprite.setFlipX(p.facing === 'right');
    p.sprite.setDepth(p.sprite.y);
    if (p.label) p.label.setPosition(Math.round(p.sprite.x), Math.round(p.sprite.y) - PEER_LABEL_DY);
    // 물 위 피어엔 배 도트를 붙인다(간단한 지형 체크) — 물 밖이면 제거.
    if (cfg.isWater) {
      const onWater = cfg.isWater(p.tileX, p.tileY);
      if (onWater) {
        if (!p.boat) p.boat = scene.add.image(p.sprite.x, p.sprite.y + PEER_BOAT_DY, 't_boat').setOrigin(0.5, 0.5).setScale(PEER_TSCALE);
        p.boat.setPosition(Math.round(p.sprite.x), Math.round(p.sprite.y) + PEER_BOAT_DY).setDepth(p.sprite.y - 1);
      } else if (p.boat) { p.boat.destroy(); p.boat = null; }
    }
  }
}
