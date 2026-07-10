'use client';

// 🌱 학습 월드 — Phaser 게임 캔버스 (솔로 코어).
// 포켓몬 골드(GBC) 감성: 도트 그래픽 + 블럭(타일) 단위 이동.
// 외부 에셋 0 — 모든 타일/캐릭터/펫은 Graphics 픽셀맵을 generateTexture로 즉석 생성.
// phaser는 무거우므로 이 파일은 next/dynamic(ssr:false)로만 로드된다(/world 라우트 전용 청크).
//
// 통합 계약은 ./bus.js 주석 참고 — **좌표 스케일 불변**:
//   emit 'local:state' {x,y,dir}  (~100ms, x·y는 월드 px, 1타일=32px)
//   on 'peers:update' (원격 렌더) · emit 'peers:dist' (px, 500ms).
// 내부 표현만 그리드(타일 인덱스)로 다루고, 버스로 오가는 값은 예전과 동일한 32px/타일 월드 px다.
//
// ── GB 실규격 뷰포트(2× 백킹) ──
// 게임 캔버스를 320×288(=GB 화면 160×144의 2배 백킹)로 고정하고, 카메라 zoom 1로
// 32px/타일 월드를 화면상 그대로 32px/타일로 담아 **정확히 10×9타일**(=GB 필드 시야,
// 320/32=10, 288/32=9)이 유지되게 한다.
//   · 왜 2배 백킹인가: zoom 0.5(160×144 백킹)에서는 10px 닉네임 텍스트가 백킹 5px로
//     축소된 뒤 CSS 정수 확대를 거치며 한글 글리프가 뭉개졌다. 백킹을 2배(320×288)로
//     올리고 zoom을 1로 하면 화면에 보이는 도트 크기·시야는 완전히 동일하되, 텍스트는
//     백킹 픽셀을 2배 확보해 선명해진다.
//   · zoom은 렌더 스케일일 뿐 월드 좌표/버스/음성 근접 게이팅에는 영향 없다(예전과 동일 원리).
// 캔버스(320×288)는 컨테이너에 맞춰 **정수 배율**(×1/×2/×3…)로만 CSS 확대한다(도트 보존).
// 이전 160×144×정수배(최소 ×2)와 동일한 화면 크기가 되려면 320×288은 최소 ×1이어야 한다.

import { useEffect, useRef, useState } from 'react';
import bus from './bus';
import QuestReview, { GBC, gbcButtonPrimary, gbcPanel } from './QuestReview';
import {
  CHAR_W, CHAR_H, CHAR_ORIGIN_Y, PET_W, PET_H,
  CHAR_DIRS, CHAR_POSES, CHAR_WALK_CYCLE, charFrameRows,
  PET_KEYS, petFrameRows,
  BASE_TILE_PAL, CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  tonePalette, toneColor, timeOfDay,
} from './sprites';
// 🗺️ 광장 맵 데이터 — 한반도+일본 열도 실비율 도트 맵(448×384, build-map.mjs 산출).
import { MAP_W, MAP_H, decodeMap, TERRAIN, isBlocked, POI } from './mapData';
// 🧭 장소 노드(도시·공항·항구·랜드마크) + 미니맵 다운샘플(순수 함수).
import { WORLD_NODES, getNode, buildMinimap } from './worldNodes';
// 🌏 독해 트랙 "도쿄 도착" 글 1 → 월드 스토리 씬(하네다 공항). 공항 씬·텍스트박스·문답 오버레이.
import { buildAirportScene } from './airportScene';
import { StoryTextbox, AirportQuiz } from './StoryOverlay';
import { buildStoryScript } from './storyScript';
// 🔒 월드 번들 정답 격리(P1-1): 전체 트랙(n5_tokyo.js)을 정적 import하면 트리 셰이킹 불가로
// /world 청크에 30편 전 글의 questions·answer·why가 실린다(서버 스트립 P2-7 무력화).
// 월드 스토리 씬은 글 1만 쓰므로 그 데이터만 담은 scene1 모듈만 가져온다(글 1은 상시 열림 → 정당).
import scene1Text from '../../content/japanese/reading/n5_tokyo_scene1';
// 통과 기록은 본편 R3와 동일 규약을 그대로 공유(readingProgress·reviewEvents·grammarSrs).
import { READING_LANG, readingSlug, markReadingPassedLocal, markReadingPassedRemote } from '../../lib/readingProgress';
import { logReviewEvents } from '../../lib/reviewEvents';
import { enqueueGrammarReview } from '../../lib/grammarSrs';

// 프로토타입 = 글 1 하나. scene1 모듈(원본 글 1의 사본) 무수정 — 런타임에 텍스트박스 스텝으로 변환만.
const READING_TEXT_ID = 'n5-tokyo-01';
const STORY_TEXT = (scene1Text && scene1Text.id === READING_TEXT_ID) ? scene1Text : null;
const STORY_STEPS = STORY_TEXT ? buildStoryScript(STORY_TEXT) : [];

// ── 좌표 스케일 (버스 계약 불변: 1타일 = 32 월드 px) ──
const TILE = 32;            // 월드 px / 타일 (예전과 동일 — local:state·peers:dist 스케일 유지)
const TEX = 16;             // 타일 소스 텍스처 크기(px) — 도트 원본
const TSCALE = TILE / TEX;  // 소스→월드 배율 = 2 (타일·캐릭터·펫 공통: 소스 1px = 월드 2px)
const ZOOM = 1;             // 카메라 줌 → 화면상 타일 32*1 = 32px (백킹 2배 확보, 시야·도트 크기는 예전과 동일)
const VIEW_W = 320;         // 백킹 캔버스 가로(px) = 10타일 × 32px (예전 160의 2배)
const VIEW_H = 288;         // 백킹 캔버스 세로(px) = 9타일 × 32px (예전 144의 2배)
const MIN_SCALE = 1;        // 캔버스 최소 정수 배율(백킹이 2배가 됐으므로 ×1 = 예전 ×2와 동일 화면 크기)
// 월드 격자 = 실비율 도트 맵(한반도+일본, 448×384타일). 예전 40×30에서 확대 — 좌표 스케일만 커진다.
const COLS = MAP_W;
const ROWS = MAP_H;
const WORLD_W = TILE * COLS;
const WORLD_H = TILE * ROWS;
// 장식(나무·꽃·풀숲) 동시 스폰 상한 — 카메라 주변만 생성/재활용하므로 화면 밖은 즉시 회수된다.
const DECOR_CAP = 128;
// 스폰 광장 반경(타일) — 이 안은 land 보장 + 장식 비움(플레이어가 갇히지 않게).
const PLAZA_R = 5;
const STEP_MS = 200;        // 타일 1칸 이동 시간(기본 — 버스 계약 스케일 불변)
// ── 달리기(B 홀드 한정) ── B가 눌린 상태에서 방향 입력이 들어와 스텝이 시작될 때만 2배속.
// STEP_MS 200→100, CHAR_ANIM_MS 100→50. B 탭(짧게)은 여전히 취소/뜻 토글일 뿐(스텝이 없으면 무효).
const RUN_STEP_MS = 100;    // 달리기 시 타일 1칸 이동 시간
const RUN_ANIM_MS = 50;     // 달리기 시 보행 프레임 주기
const TURN_MS = 90;         // 방향만 바꾸는 유예(이 안에 떼면 제자리에서 돌기만)
const WALK_MS = 110;        // 펫 걷기 프레임 교차 주기
// 캐릭터 보행 4프레임 사이클[l,n,r,n] 진행 주기. 100ms → 400ms/사이클 = 2타일 스텝(200ms×2)에
// 딱 맞물려, 한 칸에 "발 한 번" 리듬이 자연스럽게 난다.
const CHAR_ANIM_MS = 100;
const PET_IDLE_MS = 480;    // 펫 idle(통통/꼬리) 2프레임 교차 주기 — 걷기보다 느긋하게
const QUEST_RANGE = 64;     // 표지판·게이트 상호작용 근접 반경(px)
const NODE_LABEL_RANGE = 96; // 장소 노드 이름 라벨이 뜨는 근접 반경(px)
const LABEL_DY = 18;        // 닉네임 라벨 세로 오프셋(px)

// 팔레트·픽셀맵(16×24 캐릭터·12×16 펫)·시간대 톤은 ./sprites.js로 추출했다
// (GameCanvas 경량화 + 무결성/팔레트 vitest 검증 가능). 여기선 씬이 그걸 굽기만 한다.

// 방향키/코드 → 4방향. (대각선 없음)
function keyToDir(key) {
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    default: return null;
  }
}
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const VALID_DIR = new Set(['up', 'down', 'left', 'right']);

// 결정적(재로드해도 배치 동일) 유사난수 — 나무·장식 흩뿌리기용.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// 타일 좌표 → 결정적 해시(0..1). 장식(나무/꽃/풀숲) 흩뿌리기용 — 재로드해도 배치 동일.
function tileHash(tx, ty) {
  let n = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
  n ^= n >>> 13; n = Math.imul(n, 0x5bd1e995) >>> 0; n ^= n >>> 15;
  return (n >>> 0) / 0xffffffff;
}

// ── 미니맵 오버레이 ──
// mapData 4타일→1px 다운샘플(112×96) 4색 + 노드 점 + 플레이어 점(깜빡). 캔버스는 1회 굽고
// 짧은 인터벌로 플레이어 점·깜빡임만 다시 얹는다. 씬 pTileX/pTileY 를 직접 읽는다(버스 무오염).
const MINI_FACTOR = 4;
const MINI_SCALE = 2; // 표시 배율(112×96 → 224×192 백킹, CSS 로 화면 폭에 맞춤)
const MINI_COLORS = {
  [TERRAIN.SEA]: [60, 110, 145],
  [TERRAIN.LAND]: [95, 154, 70],
  [TERRAIN.RIVER]: [63, 176, 196],
  [TERRAIN.FENCE]: [166, 67, 47],
  [TERRAIN.MOUNTAIN]: [58, 92, 50],   // 짙은 녹(산지)
  [TERRAIN.PEAK]: [200, 205, 212],    // 회백(설산)
};

function Minimap({ sceneRef, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // 베이스 비트맵 1회 생성(오프스크린) — 다운샘플 코드 → 4색 픽셀.
    const { w, h, codes } = buildMinimap(MINI_FACTOR);
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    const img = octx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < codes.length; i++) {
      const c = MINI_COLORS[codes[i]] || MINI_COLORS[TERRAIN.SEA];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);

    const W = w * MINI_SCALE, H = h * MINI_SCALE;
    const drawFrame = (blinkOn) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H);
      // 노드 점(크림).
      ctx.fillStyle = '#fff4cf';
      for (const n of WORLD_NODES) {
        const nx = (n.tile[0] / MINI_FACTOR) * MINI_SCALE, ny = (n.tile[1] / MINI_FACTOR) * MINI_SCALE;
        ctx.fillRect(Math.round(nx) - 1, Math.round(ny) - 1, 2, 2);
      }
      // 플레이어 점(노랑, 깜빡).
      const s = sceneRef.current;
      if (blinkOn && s && Number.isFinite(s.pTileX)) {
        const px = (s.pTileX / MINI_FACTOR) * MINI_SCALE, py = (s.pTileY / MINI_FACTOR) * MINI_SCALE;
        ctx.fillStyle = '#ffe24a';
        ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
      }
    };

    let blinkOn = true;
    drawFrame(blinkOn);
    const timer = setInterval(() => { blinkOn = !blinkOn; drawFrame(blinkOn); }, 260);
    return () => clearInterval(timer);
  }, [sceneRef]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', background: 'rgba(11,13,8,0.6)' }}>
      <div style={{ ...gbcPanel, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <canvas
          ref={canvasRef}
          style={{ width: 'min(78vw, 240px)', height: 'auto', imageRendering: 'pixelated', display: 'block', borderRadius: 2 }}
        />
        <button
          type="button"
          onClick={onClose}
          style={{ ...gbcButtonPrimary, fontSize: '0.7rem', padding: '3px 10px' }}
        >
          닫기 Ⓑ
        </button>
      </div>
    </div>
  );
}

// controlsRef: GBC 셸(WorldPage)이 D-pad·A·B를 게임에 주입하는 최소 인터페이스.
//   셸 마운트 시 GameCanvas가 controlsRef.current = { press, release, interact, cancel }를 채운다.
//   press/release는 키보드와 동일 경로(씬 heldDirs)로 흘려보내 홀드 연속 이동까지 재사용한다.
//   버스는 오염시키지 않는다(순수 씬 메서드 호출).
export default function GameCanvas({ userId = null, nickname = '나', pet = { key: 'dog', emoji: '🐕', level: 1, mood: 'happy' }, controlsRef = null }) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);   // 활성 씬 — React가 입력 잠금을 갱신
  const nickRef = useRef(nickname);
  const petRef = useRef(pet);
  const [nearQuest, setNearQuest] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false); // 인게임 즉석 리뷰 오버레이
  const nearQuestRef = useRef(false);   // A(상호작용) 콜백이 최신 근접 상태를 읽도록 미러
  const reviewOpenRef = useRef(false);  // B(취소) 콜백이 최신 오버레이 상태를 읽도록 미러

  // ── 장소 노드 근접 + 페리 + 미니맵 상태 ──
  const [nearNode, setNearNode] = useState(null);        // 근접한 gate 노드 { id, name, gate } | null
  const [ferryPrompt, setFerryPrompt] = useState(null);  // 페리 확인 다이얼로그 { toId, toName } | null
  const [minimapOpen, setMinimapOpen] = useState(false); // 미니맵 오버레이 열림
  const nearNodeRef = useRef(null);
  const ferryPromptRef = useRef(null);
  const minimapOpenRef = useRef(false);

  // ── 월드 스토리(공항 씬) 상태 ──
  // storyPhase: 'none'(광장) | 'walking'(줄→심사대) | 'dialogue'(텍스트박스) | 'quiz'(문답) | 'passed'(통과·출구)
  const [storyActive, setStoryActive] = useState(false); // 공항 씬 진입 여부(오버레이 게이팅)
  const [storyPhase, setStoryPhase] = useState('none');
  const [storyIdx, setStoryIdx] = useState(0);           // 현재 텍스트박스 스텝
  const [showKo, setShowKo] = useState(false);           // ja 대사 한국어 뜻 토글
  const storyActiveRef = useRef(false);
  const storyPhaseRef = useRef('none');
  // 셸 A/B 콜백이 최신 스토리 조작을 부르도록 함수 미러(렌더마다 갱신).
  const advanceStoryRef = useRef(null);
  const toggleKoRef = useRef(null);

  useEffect(() => { nickRef.current = nickname || '나'; }, [nickname]);
  useEffect(() => { petRef.current = pet || { key: 'dog', level: 1, mood: 'happy' }; }, [pet]);
  useEffect(() => { nearQuestRef.current = nearQuest; }, [nearQuest]);
  useEffect(() => { reviewOpenRef.current = reviewOpen; }, [reviewOpen]);
  useEffect(() => { nearNodeRef.current = nearNode; }, [nearNode]);
  useEffect(() => { ferryPromptRef.current = ferryPrompt; }, [ferryPrompt]);
  useEffect(() => { minimapOpenRef.current = minimapOpen; }, [minimapOpen]);
  useEffect(() => { storyActiveRef.current = storyActive; }, [storyActive]);
  useEffect(() => { storyPhaseRef.current = storyPhase; }, [storyPhase]);

  // ── GBC 셸 입력 주입 인터페이스 등록 ──
  // press/release → 씬 heldDirs(키보드와 동일 경로).
  // A(interact): 대사 중이면 "다음", 광장 게이트 근접이면 공항 진입, 표지판 근접이면 리뷰.
  // B(cancel): 대사 중이면 한국어 뜻 토글, 리뷰 열려 있으면 닫기.
  useEffect(() => {
    if (!controlsRef) return undefined;
    controlsRef.current = {
      press: (dir) => sceneRef.current?.extInputDown?.(dir),
      release: (dir) => sceneRef.current?.extInputUp?.(dir),
      // B 홀드 → 달리기 스위치(씬 플래그). 씬이 스텝 시작 시에만 소비하므로 탭 취소와 충돌하지 않는다.
      runOn: () => { if (sceneRef.current) sceneRef.current.runHeld = true; },
      runOff: () => { if (sceneRef.current) sceneRef.current.runHeld = false; },
      interact: () => {
        if (storyPhaseRef.current === 'dialogue') { advanceStoryRef.current?.(); return; }
        if (reviewOpenRef.current || storyActiveRef.current || ferryPromptRef.current) return;
        const node = nearNodeRef.current;
        if (node?.gate) {
          if (node.gate.type === 'story-scene') { sceneRef.current?.enterAirport?.(); return; }
          if (node.gate.type === 'ferry') {
            const dest = getNode(node.gate.to);
            setFerryPrompt({ toId: node.gate.to, toName: dest?.name || '' });
            return;
          }
        }
        if (nearQuestRef.current) setReviewOpen(true);
      },
      cancel: () => {
        if (storyPhaseRef.current === 'dialogue') { toggleKoRef.current?.(); return; }
        if (ferryPromptRef.current) { setFerryPrompt(null); return; }
        if (minimapOpenRef.current) { setMinimapOpen(false); return; }
        if (reviewOpenRef.current) setReviewOpen(false);
      },
    };
    return () => { if (controlsRef) controlsRef.current = null; };
  }, [controlsRef]);

  // ── 스토리 조작(대사 진행·뜻 토글) — 셸 A/B 콜백이 참조하도록 ref에 최신본을 심는다 ──
  const advanceStory = () => {
    setShowKo(false);
    setStoryIdx((i) => {
      if (i + 1 >= STORY_STEPS.length) { setStoryPhase('quiz'); return i; } // 대사 끝 → 심사관 문답
      return i + 1;
    });
  };
  advanceStoryRef.current = advanceStory;
  toggleKoRef.current = () => setShowKo((v) => !v);

  // 대사 스텝이 바뀔 때 연출: 화자 시선 전환 + 도장 장면 가벼운 흔들림(파티클 없음).
  useEffect(() => {
    if (storyPhase !== 'dialogue') return;
    const step = STORY_STEPS[storyIdx];
    if (!step) return;
    if (step.kind === 'speech') sceneRef.current?.faceForDialogue?.();
    if (step.stamp) sceneRef.current?.stampShake?.();
  }, [storyPhase, storyIdx]);

  // 스토리 페이즈 → 씬 입력 잠금(대사·문답 중 이동 정지, 걷기·통과 후엔 해제).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !storyActive) return;
    scene.inputLocked = (storyPhase === 'dialogue' || storyPhase === 'quiz');
  }, [storyPhase, storyActive]);

  // 통과 기록 — 본편 R3 handlePass와 동일 규약(같은 데이터 공유, 본편 트랙 UI는 존치).
  // async 로 원격 upsert 성공을 확인하고 반환한다: AirportQuiz.savePass 가 await 해서 성공 후에만
  // 통과 화면·출구를 열고, 실패(reject)면 재시도 UI 를 띄운다(P2-7·P2-8).
  const recordPass = async (events) => {
    // userId를 넘겨 사용자 스코프 키에 기록 — 게스트 키에 남기면 로그아웃→타 계정 로그인 시
    // 승계 루프가 진도를 복제한다(Codex P2-7). 계정 전환은 WorldPage 가 GameCanvas 를 userId 로
    // key remount 해 진행 중 AirportQuiz 를 통째로 폐기하므로, 이 recordPass 의 userId 는 항상 현재 계정이다.
    markReadingPassedLocal(READING_TEXT_ID, userId);
    if (userId) {
      const ok = await markReadingPassedRemote(userId, READING_TEXT_ID);
      if (!ok) throw new Error('reading pass upsert failed'); // {error} → savePass 재시도(재-push)
      logReviewEvents(userId, events); // AirportQuiz→buildReadingEvents 산출물 — lang:'Japanese', source:'reading'
      enqueueGrammarReview(userId, READING_LANG, readingSlug(READING_TEXT_ID));
    }
    setStoryPhase('passed');
    sceneRef.current?.openExit?.(); // 출구 게이트 열림 연출
  };

  // 리뷰·페리 확인 오버레이가 열리면 게임 입력을 잠근다(캔버스 이동 정지). 닫히면 해제.
  // (미니맵은 잠그지 않는다 — 살짝 훑어보는 오버레이라 이동을 막지 않는다.)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const lock = reviewOpen || !!ferryPrompt;
    scene.inputLocked = lock;
    if (lock) { if (scene.heldDirs) scene.heldDirs.length = 0; scene.tapTile = null; scene.runHeld = false; }
  }, [reviewOpen, ferryPrompt]);

  useEffect(() => {
    let destroyed = false;
    let game = null;
    let ro = null;    // 캔버스 정수 배율 피팅용 ResizeObserver

    // ── 버스 구독을 컴포넌트 스코프에서 등록/해제한다(리스너 누수 방지). ──
    // 기존엔 씬 'shutdown'에서 off 했지만 Phaser destroy 경로에서 shutdown이 안 뜰 수 있어,
    // 재방문마다 죽은 씬 콜백이 bus에 누적됐다. 이제 React cleanup이 off를 직접 보장한다.
    // 활성 씬(광장 또는 공항)에 위임 — 공항 씬도 quest:scored/done 연출을 받는다(옵셔널 체이닝으로 무해).
    const onPeers = (data) => sceneRef.current?.applyPeers?.(data);
    const onQuestScored = (data) => sceneRef.current?.questScoredFx?.(data);
    const onQuestDone = (data) => sceneRef.current?.questDoneFx?.(data);
    bus.on('peers:update', onPeers);
    bus.on('quest:scored', onQuestScored);
    bus.on('quest:done', onQuestDone);

    (async () => {
      const Phaser = (await import('phaser')).default;
      if (destroyed || !hostRef.current) return;

      class WorldScene extends Phaser.Scene {
        constructor() { super('world'); }

        // ── 픽셀맵을 1px 단위 fillRect로 그린다 ──
        drawMap(g, rows, pal) {
          for (let y = 0; y < rows.length; y++) {
            const row = rows[y];
            for (let x = 0; x < row.length; x++) {
              const col = pal[row[x]];
              if (col == null) continue; // '.'·미정의 = 투명
              g.fillStyle(col, 1);
              g.fillRect(x, y, 1, 1);
            }
          }
        }

        makeTex(key, rows, pal, w, h) {
          const g = this.make.graphics({ add: false });
          this.drawMap(g, rows, pal);
          g.generateTexture(key, w, h);
          g.destroy();
        }

        preload() {
          // 시간대(day/sunset/night)를 씬 생성 시 1회 확정하고, 팔레트를 그 톤으로 "구워"
          // 텍스처 자체에 GBC 감성을 입힌다(런타임 틴트 오버레이 대신 — 저채도·제한 색수 보존).
          this.mode = timeOfDay();
          this.pal = tonePalette(BASE_TILE_PAL, this.mode);
          this.charPal = {
            pc: tonePalette(CHAR_PAL_LOCAL, this.mode),
            pr: tonePalette(CHAR_PAL_REMOTE, this.mode),
          };
          this.petPal = {};
          for (const k of PET_KEYS) this.petPal[k] = tonePalette(PET_PAL[k], this.mode);

          this.buildGround();
          this.buildSand();
          this.buildFence();
          this.buildBridge();
          this.buildTerrain();    // 산지·고산(설산)·평야 질감 타일(순수 시각 · 통행 가능)
          this.buildTileAtlas();  // 개별 타일 → 1장 캔버스 아틀라스(tilemap tileset)
          this.buildTree();
          this.buildDecor();
          this.buildSign();
          this.buildNodeMarkers();
          this.buildHeart();
          this.buildLamp();
          this.buildCharSet('pc', this.charPal.pc);
          this.buildCharSet('pr', this.charPal.pr);
          this.buildPets();
        }

        // 잔디/흙길/물(3프레임 물결) — 전부 픽셀 절차 생성(this.pal = 시간대 톤).
        buildGround() {
          const C = this.pal;
          const dither = (seed) => {
            const rng = makeRng(seed); const pts = [];
            for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (rng() < 0.14) pts.push([x, y]);
            return pts;
          };
          // grass
          {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.grass1, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.grass2, 1); for (const [x, y] of dither(0x11)) g.fillRect(x, y, 1, 1);
            g.fillStyle(C.grass3, 1); g.fillRect(3, 4, 1, 2); g.fillRect(10, 7, 1, 2); g.fillRect(6, 12, 1, 2); g.fillRect(13, 2, 1, 2);
            g.generateTexture('t_grass', TEX, TEX); g.destroy();
          }
          // path (dirt) — 가장자리 살짝 어둡게
          {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.path1, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.path2, 1); for (const [x, y] of dither(0x22)) g.fillRect(x, y, 1, 1);
            g.fillStyle(C.pathE, 0.5);
            g.fillRect(0, 0, TEX, 1); g.fillRect(0, TEX - 1, TEX, 1); g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
            g.generateTexture('t_path', TEX, TEX); g.destroy();
          }
          // water — 물결 하이라이트가 아래로 흐르는 3프레임(shift로 y 이동).
          const water = (key, base, shift) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(base, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.water2, 0.9);
            const y1 = 3 + shift, y2 = 10 + shift;
            g.fillRect(2, y1, 5, 1); g.fillRect(9, y1 + 1, 4, 1);
            g.fillRect(6, y2, 5, 1); g.fillRect(1, y2 + 1, 3, 1);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          water('t_water0', C.water1, 0);
          water('t_water1', C.waterMd, 1);
          water('t_water2', C.waterDk, 2);

          // river/lake — 걸어서 건너는 얕은 물. 바다(water1=0x4bb4e0)보다 밝고 옅은 청록으로 구워
          //   "얕음"을 색으로 알린다(단일 프레임 — 정적). 시간대 톤은 toneColor로 함께 굽는다.
          const riverBase = toneColor(0x7fd0ec, this.mode);  // 강 — 바다보다 밝은 하늘 청록
          const lakeBase = toneColor(0x63c1e2, this.mode);   // 호수 — 강보다 아주 살짝 진하게(고인 물)
          const shallowHi = C.water2;                        // 흰 물결 하이라이트(바다와 공유 톤)
          const stream = (key, base) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(base, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(shallowHi, 0.7);
            g.fillRect(2, 4, 6, 1); g.fillRect(9, 8, 4, 1); g.fillRect(4, 11, 5, 1);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          stream('t_river', riverBase);
          stream('t_lake', lakeBase);
        }

        // DMZ 철조망(fence) — 통행 차단. 기둥 + 가시철선 도트 1타일 패턴(위압감 있게).
        buildFence() {
          const C = this.pal;
          const rust = toneColor(0x8a4a34, this.mode);   // 녹슨 적갈(기둥·가시)
          const rustD = toneColor(0x5e3122, this.mode);  // 그림자
          const wire = toneColor(0xbdb6a6, this.mode);   // 철선(밝은 금속)
          const g = this.make.graphics({ add: false });
          g.fillStyle(C.path2, 0.35); g.fillRect(0, 0, TEX, TEX);         // 흙 바탕(살짝)
          // 세로 기둥 2개(좌/우).
          g.fillStyle(rustD, 1); g.fillRect(3, 1, 2, 14); g.fillRect(11, 1, 2, 14);
          g.fillStyle(rust, 1); g.fillRect(3, 1, 1, 14); g.fillRect(11, 1, 1, 14);
          // 가로 철선 3줄.
          g.fillStyle(wire, 1);
          g.fillRect(0, 3, TEX, 1); g.fillRect(0, 8, TEX, 1); g.fillRect(0, 13, TEX, 1);
          // 가시(철선 위 X 도트) — 위압감.
          g.fillStyle(rust, 1);
          for (const x of [1, 6, 9, 14]) { g.fillRect(x, 2, 1, 1); g.fillRect(x, 4, 1, 1); }
          for (const x of [3, 8, 12]) { g.fillRect(x, 7, 1, 1); g.fillRect(x, 9, 1, 1); }
          g.generateTexture('t_fence', TEX, TEX); g.destroy();
        }

        // 교량(bridge) — 바다 위 통행 데크. 나무/콘크리트 데크 판자 + 양옆 난간.
        buildBridge() {
          const deck = toneColor(0xb89058, this.mode);   // 데크(웜 탠)
          const deckD = toneColor(0x8a6538, this.mode);  // 판자 이음새
          const rail = toneColor(0x6f4a28, this.mode);   // 난간
          const g = this.make.graphics({ add: false });
          g.fillStyle(deck, 1); g.fillRect(0, 0, TEX, TEX);
          g.fillStyle(deckD, 1);                          // 가로 판자 이음새
          for (let y = 2; y < TEX; y += 4) g.fillRect(0, y, TEX, 1);
          g.fillStyle(rail, 1);                           // 양옆 난간(세로)
          g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
          g.generateTexture('t_bridge', TEX, TEX); g.destroy();
        }

        // ── 지형 질감 타일(순수 시각 · 전부 통행 가능) ──
        // 산지(짙은 녹 능선+음영 도트) · 고산/설산(회백 암석+흰 설관) · 평야(밝은 황록 농지 격자 힌트).
        // toneColor 로 시간대 톤을 함께 굽는다 — 밤이면 설산이 푸르스름해지는 것은 톤 함수가 알아서 한다.
        buildTerrain() {
          // 산지 — 짙은 녹 능선 + 음영 도트.
          {
            const g = this.make.graphics({ add: false });
            const base = toneColor(0x4f7a3a, this.mode);   // 산기슭 녹
            const ridge = toneColor(0x35602b, this.mode);  // 능선 그림자(짙은 녹)
            const hi = toneColor(0x6fa048, this.mode);     // 능선 양지
            g.fillStyle(base, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(ridge, 1);
            for (let i = 0; i < 8; i++) g.fillRect(8 - i, 4 + i, 1 + i * 2, 1); // 삼각 능선(계단 도트)
            g.fillStyle(hi, 1);
            for (let i = 0; i < 6; i++) g.fillRect(8 - i, 4 + i, 1, 1);         // 왼 사면 양지
            g.fillStyle(ridge, 1);
            for (const [x, y] of [[3, 12], [11, 13], [6, 14], [13, 10], [2, 9]]) g.fillRect(x, y, 1, 1); // 음영 도트
            g.generateTexture('t_mountain', TEX, TEX); g.destroy();
          }
          // 고산/설산 — 회백 암석 + 흰 설관.
          {
            const g = this.make.graphics({ add: false });
            const rock = toneColor(0x8a8f98, this.mode);   // 회백 암석
            const rockD = toneColor(0x5f636b, this.mode);  // 암석 그림자
            const snow = toneColor(0xf2f5fa, this.mode);   // 설관(흰)
            const snowD = toneColor(0xcdd6e2, this.mode);  // 설관 음영
            g.fillStyle(rock, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(rockD, 1);
            for (const [x, y] of [[2, 11], [5, 13], [9, 12], [12, 14], [7, 10]]) g.fillRect(x, y, 2, 1); // 하부 암석 음영
            g.fillStyle(snow, 1);
            for (let i = 0; i < 6; i++) g.fillRect(8 - i, 1 + i, 1 + i * 2, 1); // 설관 삼각(상부)
            g.fillStyle(snowD, 1);
            for (let i = 0; i < 6; i++) g.fillRect(8 + i, 1 + i, 1, 1);         // 오른 사면 음영
            g.generateTexture('t_peak', TEX, TEX); g.destroy();
          }
          // 평야 — 밝은 황록 농지 + 밭이랑 격자 힌트.
          {
            const g = this.make.graphics({ add: false });
            const base = toneColor(0x9fc85a, this.mode);   // 밝은 황록
            const line = toneColor(0x84ad46, this.mode);   // 밭이랑(격자)
            const seed = toneColor(0xc4dd7e, this.mode);   // 밝은 낟알 점
            g.fillStyle(base, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(line, 1);
            g.fillRect(0, 5, TEX, 1); g.fillRect(0, 11, TEX, 1);   // 가로 이랑
            g.fillRect(5, 0, 1, TEX); g.fillRect(11, 0, 1, TEX);   // 세로 이랑
            g.fillStyle(seed, 1);
            for (const [x, y] of [[2, 2], [8, 3], [13, 8], [3, 8], [9, 13], [14, 2]]) g.fillRect(x, y, 1, 1);
            g.generateTexture('t_plain', TEX, TEX); g.destroy();
          }
        }

        // 장소 노드 마커 — kind별 절차 생성 도트(외부 에셋 0). 16×24, 발밑(하단 중앙) 정렬.
        buildNodeMarkers() {
          const C = this.pal;
          const post = toneColor(0x8a6a44, this.mode);
          const postD = toneColor(0x5e4830, this.mode);
          const drawPost = (g) => { g.fillStyle(postD, 1); g.fillRect(7, 12, 2, 12); g.fillStyle(post, 1); g.fillRect(7, 12, 1, 12); };

          // 도시 — 깃발풍(장대 + 삼각 페넌트).
          {
            const g = this.make.graphics({ add: false });
            drawPost(g);
            const flag = toneColor(0x5f9a46, this.mode), flagD = toneColor(0x3f7030, this.mode);
            g.fillStyle(flagD, 1); g.fillRect(8, 2, 6, 6);
            g.fillStyle(flag, 1); g.fillRect(8, 3, 5, 4);
            g.fillStyle(C.creamHi || 0xfffaf0, 1); g.fillRect(9, 4, 1, 1); g.fillRect(11, 5, 1, 1);
            g.generateTexture('t_node_city', TEX, TEX + 8); g.destroy();
          }
          // 공항 — ✈풍(관제탑 + 비행기 실루엣 힌트).
          {
            const g = this.make.graphics({ add: false });
            const body = toneColor(0xd8dbe2, this.mode), bodyD = toneColor(0x9aa0ab, this.mode);
            const glass = toneColor(0x3ea6d8, this.mode);
            g.fillStyle(bodyD, 1); g.fillRect(5, 6, 6, 18);           // 관제탑 몸통
            g.fillStyle(body, 1); g.fillRect(5, 6, 5, 18);
            g.fillStyle(glass, 1); g.fillRect(5, 8, 6, 2);            // 관제실 유리
            // 비행기(꼭대기 크로스).
            g.fillStyle(body, 1); g.fillRect(3, 2, 10, 1); g.fillRect(7, 0, 2, 5);
            g.generateTexture('t_node_airport', TEX, TEX + 8); g.destroy();
          }
          // 항구 — ⚓풍(닻).
          {
            const g = this.make.graphics({ add: false });
            const iron = toneColor(0x556072, this.mode), ironHi = toneColor(0x8b96a8, this.mode);
            drawPost(g);
            g.fillStyle(iron, 1);
            g.fillRect(7, 3, 2, 10);                                  // 샹크
            g.fillRect(5, 4, 6, 1);                                   // 스톡
            g.fillRect(4, 11, 1, 2); g.fillRect(11, 11, 1, 2);        // 팔 끝
            g.fillRect(4, 12, 8, 1);                                  // 크라운(아래 곡선)
            g.fillStyle(ironHi, 1); g.fillRect(6, 1, 4, 2);           // 링
            g.generateTexture('t_node_port', TEX, TEX + 8); g.destroy();
          }
          // 랜드마크 — 기념탑/타워풍.
          {
            const g = this.make.graphics({ add: false });
            const stone = toneColor(0xc7b48a, this.mode), stoneD = toneColor(0x93805a, this.mode);
            g.fillStyle(stoneD, 1); g.fillRect(6, 3, 4, 21);
            g.fillStyle(stone, 1); g.fillRect(6, 3, 3, 21);
            g.fillStyle(stoneD, 1); g.fillRect(4, 22, 8, 2);          // 받침
            g.fillStyle(stone, 1); g.fillRect(6, 0, 2, 3);            // 첨탑
            g.generateTexture('t_node_landmark', TEX, TEX + 8); g.destroy();
          }
        }

        // 해안(모래) — land 중 바다에 접한 타일. 잔디 위에 옅은 모래·잔파도 라인.
        buildSand() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          g.fillStyle(C.grass1, 1); g.fillRect(0, 0, TEX, TEX);
          g.fillStyle(C.path1, 0.85); g.fillRect(0, 11, TEX, 5);       // 아래쪽 모래톱
          g.fillStyle(C.path2, 0.9); for (const [x, y] of [[2, 13], [7, 14], [11, 12], [13, 15]]) g.fillRect(x, y, 2, 1);
          g.fillStyle(C.water2, 0.55); g.fillRect(1, 15, 4, 1); g.fillRect(8, 15, 5, 1); // 잔파도 라인
          g.generateTexture('t_sand', TEX, TEX); g.destroy();
        }

        // ── 타일 아틀라스 ──
        // 절차 생성 타일 텍스처들을 1장의 캔버스로 합쳐 Phaser tilemap tileset을 만든다.
        // (타일마다 add.image = 172k 오브젝트는 불가 → 레이어 1장 + 내장 컬링으로 전환.)
        // 인덱스: 0=빈칸, 1=잔디(land), 2/3/4=바다 3프레임, 5=모래(해안),
        //         6=강, 7=호수, 8=DMZ 철조망, 9=교량, 10=산지, 11=고산/설산, 12=평야(TERRAIN 전 코드 커버).
        buildTileAtlas() {
          // 씬 재시작(공항→광장 복귀) 시 텍스처는 전역 TextureManager에 이미 존재 →
          // createCanvas가 null을 반환하므로, 있으면 재사용(톤은 최초 로드값 유지 — generateTexture와 동일 관례).
          if (this.textures.exists('tiles')) return;
          const keys = [null, 't_grass', 't_water0', 't_water1', 't_water2', 't_sand', 't_river', 't_lake', 't_fence', 't_bridge', 't_mountain', 't_peak', 't_plain'];
          const cols = keys.length;
          const atlas = this.textures.createCanvas('tiles', cols * TEX, TEX);
          const ctx = atlas.getContext();
          for (let i = 1; i < cols; i++) {
            const src = this.textures.get(keys[i]).getSourceImage();
            ctx.drawImage(src, i * TEX, 0);
          }
          atlas.refresh();
        }

        // 나무 — 2타일 높이(수관 위 + 줄기 아래), 16×32.
        buildTree() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          // 수관(위쪽 16px 영역 중심)
          g.fillStyle(C.leafD, 1); g.fillRect(2, 3, 12, 12);
          g.fillStyle(C.leaf1, 1); g.fillRect(3, 2, 10, 11);
          g.fillStyle(C.leaf2, 1); g.fillRect(4, 2, 4, 4); g.fillRect(9, 5, 3, 3); g.fillRect(5, 8, 3, 2);
          g.fillStyle(C.leafD, 1); g.fillRect(6, 6, 1, 1); g.fillRect(10, 9, 1, 1); g.fillRect(4, 11, 1, 1);
          // 줄기(아래 절반)
          g.fillStyle(C.trunkD, 1); g.fillRect(6, 15, 4, 15);
          g.fillStyle(C.trunk, 1); g.fillRect(7, 15, 2, 15);
          g.generateTexture('t_tree', TEX, TEX * 2); g.destroy();
        }

        // 꽃(흔들림 2프레임)·풀숲(살랑 2프레임) 장식 — 비충돌, 텍스처 스왑으로 애니.
        buildDecor() {
          const C = this.pal;
          // 꽃: 꽃송이가 좌/우로 1px 기우는 2프레임(sx = 0 / 1).
          const flower = (key, sx) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.stem, 1); g.fillRect(7, 9, 1, 5);
            g.fillStyle(C.flowerP, 1);
            g.fillRect(6 + sx, 6, 4, 3); g.fillRect(7 + sx, 5, 2, 1); g.fillRect(7, 9, 2, 1);
            g.fillStyle(C.flowerC, 1); g.fillRect(7 + sx, 7, 1, 1);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          flower('t_flower0', 0);
          flower('t_flower1', 1);
          // 풀숲: 윗잎 하이라이트가 좌/우로 살랑이는 2프레임.
          const bush = (key, sx) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.bushD, 1); g.fillRect(3, 9, 10, 6);
            g.fillStyle(C.leaf1, 1); g.fillRect(4, 8, 8, 5);
            g.fillStyle(C.leaf2, 1); g.fillRect(5 + sx, 8, 2, 2); g.fillRect(9 - sx, 9, 2, 2);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          bush('t_bush0', 0);
          bush('t_bush1', 1);
        }

        // 퀘스트 픽셀 팻말 — 16×20.
        buildSign() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          g.fillStyle(C.signBorder, 1); g.fillRect(2, 2, 12, 9);
          g.fillStyle(C.signBoard, 1); g.fillRect(3, 3, 10, 7);
          g.fillStyle(C.signLine, 1); g.fillRect(4, 5, 8, 1); g.fillRect(4, 7, 6, 1);
          g.fillStyle(C.signBorder, 1); g.fillRect(7, 10, 3, 9);
          g.fillStyle(C.signPost, 1); g.fillRect(8, 10, 1, 9);
          g.generateTexture('t_sign', TEX, 20); g.destroy();
        }

        buildHeart() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          const H = C.heart, I = C.heartHi;
          g.fillStyle(H, 1);
          g.fillRect(1, 1, 2, 2); g.fillRect(5, 1, 2, 2);
          g.fillRect(0, 2, 8, 2); g.fillRect(1, 4, 6, 1); g.fillRect(2, 5, 4, 1); g.fillRect(3, 6, 2, 1);
          g.fillStyle(I, 1); g.fillRect(1, 2, 1, 1);
          g.generateTexture('t_heart', 8, 7); g.destroy();
        }

        // 밤 전용 랜턴 불빛 — 부드러운 원형 글로우(중심 밝고 밖으로 번짐). 밤에만 배치.
        buildLamp() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          const cx = 8, cy = 8;
          g.fillStyle(BASE_TILE_PAL.lampGlow, 0.28); g.fillCircle(cx, cy, 8);
          g.fillStyle(BASE_TILE_PAL.lampGlow, 0.5); g.fillCircle(cx, cy, 5);
          g.fillStyle(C.lampCore, 1); g.fillCircle(cx, cy, 2);
          g.generateTexture('t_lamp', 16, 16); g.destroy();
        }

        // 4방향 × 걷기 3패턴(n/l/r) 캐릭터, 16×24(우향은 side flipX).
        buildCharSet(prefix, pal) {
          for (const dir of CHAR_DIRS) {
            for (const pose of CHAR_POSES) {
              this.makeTex(`${prefix}_${dir}_${pose}`, charFrameRows(dir, pose), pal, CHAR_W, CHAR_H);
            }
          }
        }

        // 펫 5종 × idle 2프레임(통통/꼬리·귀), 12×16.
        buildPets() {
          for (const key of PET_KEYS) {
            const pal = this.petPal[key];
            this.makeTex(`pet_${key}_0`, petFrameRows(key, 0), pal, PET_W, PET_H);
            this.makeTex(`pet_${key}_1`, petFrameRows(key, 1), pal, PET_W, PET_H);
          }
        }

        // 텍스처 방향키(down/up/side)로 캐릭터 프레임 이름 계산.
        // 정지: 중립(n). 이동: 4프레임 사이클[l,n,r,n]을 CHAR_ANIM_MS로 진행.
        charTex(prefix, facing, moving, time, animMs = CHAR_ANIM_MS) {
          const base = (facing === 'left' || facing === 'right') ? 'side' : facing;
          const pose = moving ? CHAR_WALK_CYCLE[Math.floor(time / animMs) % CHAR_WALK_CYCLE.length] : 'n';
          return `${prefix}_${base}_${pose}`;
        }

        // animMs 기본은 CHAR_ANIM_MS(원격 피어 등). 로컬 플레이어는 달리기 중 RUN_ANIM_MS 로 빠르게.
        setCharFrame(sprite, prefix, facing, moving, time, animMs = CHAR_ANIM_MS) {
          sprite.setTexture(this.charTex(prefix, facing, moving, time, animMs));
          sprite.setFlipX(facing === 'right');
        }

        // ── 외부(GBC 셸 D-pad) 방향 입력 주입 — 키보드 keydown/keyup과 완전히 같은 경로 ──
        // heldDirs 스택을 그대로 쓰므로 홀드 연속 이동·회전 유예·탭 취소가 자동으로 동일하게 적용된다.
        extInputDown(d) {
          if (this.inputLocked || !VALID_DIR.has(d)) return;
          this.tapTile = null;
          if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
        }
        extInputUp(d) {
          this.heldDirs = this.heldDirs.filter((x) => x !== d);
        }

        create() {
          sceneRef.current = this;   // 버스 핸들러 위임 대상 · React 입력 잠금 갱신용
          this.inputLocked = false;  // 리뷰 오버레이 중 이동 잠금
          this.petJumpVal = 0;       // 퀘스트 완료 점프 연출값(0→1→0)

          this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
          this.cameras.main.setBackgroundColor(toneColor(BASE_TILE_PAL.grass1, this.mode));
          this.cameras.main.setZoom(ZOOM);
          this.cameras.main.setRoundPixels(true);

          // ── 지형 격자(한반도+일본 실비율 도트 맵) ──
          // build-map.mjs 가 구운 448×384 다치 격자를 디코드(0=sea·1=land·2=river·3=lake·4=fence·5=bridge).
          // 통행 차단은 isBlocked(sea·fence)만 — river·lake·bridge 는 걸어서 통과 가능(오너 스펙).
          this.grid = decodeMap();
          // 스폰 광장 보장: 서울(스폰)~인천공항 일대를 land 로 확정한다.
          //   래스터 결과 영종도 해안이 좁아 광장이 바다에 잘리지 않도록 수도권 사각형만 land 보장.
          const px0 = Math.min(POI.INCHEON.x, POI.SEOUL.x) - 1;
          const px1 = POI.SEOUL.x + PLAZA_R + 1;
          const py0 = POI.SEOUL.y - PLAZA_R - 1, py1 = POI.SEOUL.y + PLAZA_R + 1;
          for (let ty = py0; ty <= py1; ty++) {
            for (let tx = px0; tx <= px1; tx++) {
              if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) this.grid[ty * MAP_W + tx] = TERRAIN.LAND;
            }
          }
          this.signTileX = POI.SEOUL.x + 3; this.signTileY = POI.SEOUL.y - 3;  // 퀘스트 팻말(스폰 곁)
          this.wasNearNodeId = null;

          // 공항 스토리에서 광장으로 복귀 시 create가 다시 도므로 스토리·노드 오버레이 상태를 초기화.
          setStoryActive(false); setStoryPhase('none'); setNearNode(null); setFerryPrompt(null);

          this.waterFrame = 0;
          this.decorFrame = 0;
          this.runHeld = false;     // B 홀드 달리기 플래그
          this.decor = new Map();   // "tx,ty" → { kind, imgs:[] } — 카메라 주변만 생성/회수(상한 DECOR_CAP)

          // ── 지형 레이어(Phaser Tilemap 1장 + 내장 컬링) ──
          // 172k 타일을 add.image 로 깔 수 없으므로 tilemap 레이어 1장으로 전환.
          // 아틀라스 인덱스: 바다=2·해안(모래)=5·강=6·호수=7·철조망=8·교량=9·육지=1·산지=10·설산=11·평야=12.
          // land 계열(land·mountain·peak·plain)은 통행 가능 — 질감만 다르다. 해안(바다 인접)은 모래로 굽되
          // 산지·설산은 해안이라도 질감을 유지하고, 평야만 해안 시 모래로 접는다(모래 우선순위 보존).
          const seaTile = (tx, ty) => this.tileCode(tx, ty) === TERRAIN.SEA; // 해안 판정용(바다 인접만)
          const data = [];
          for (let y = 0; y < ROWS; y++) {
            const row = new Array(COLS);
            for (let x = 0; x < COLS; x++) {
              const c = this.grid[y * MAP_W + x];
              if (c === TERRAIN.RIVER) { row[x] = 6; continue; }
              if (c === TERRAIN.LAKE) { row[x] = 7; continue; }
              if (c === TERRAIN.FENCE) { row[x] = 8; continue; }
              if (c === TERRAIN.BRIDGE) { row[x] = 9; continue; }
              if (c === TERRAIN.MOUNTAIN) { row[x] = 10; continue; }
              if (c === TERRAIN.PEAK) { row[x] = 11; continue; }
              if (c !== TERRAIN.LAND && c !== TERRAIN.PLAIN) { row[x] = 2; continue; } // sea
              // 해안: land/plain 이면서 4-이웃에 바다(sea)가 있으면 모래(강·호수 인접은 해안 아님).
              const coast = seaTile(x - 1, y) || seaTile(x + 1, y) || seaTile(x, y - 1) || seaTile(x, y + 1);
              if (c === TERRAIN.PLAIN) { row[x] = coast ? 5 : 12; continue; }
              row[x] = coast ? 5 : 1;
            }
            data.push(row);
          }
          const tmap = this.make.tilemap({ data, tileWidth: TEX, tileHeight: TEX });
          const tileset = tmap.addTilesetImage('tiles', 'tiles', TEX, TEX, 0, 0);
          this.tmap = tmap;
          this.layer = tmap.createLayer(0, tileset, 0, 0).setScale(TSCALE).setDepth(0);

          // 팻말 — 스폰 광장 곁.
          this.signX = this.signTileX * TILE + TILE / 2;
          this.signY = this.signTileY * TILE + TILE / 2;
          this.add.image(this.signX, this.signTileY * TILE + TILE, 't_sign').setOrigin(0.5, 1).setScale(TSCALE).setDepth(this.signY);

          // ── 장소 노드 마커 — kind별 절차 마커 + 근접 시 뜨는 이름 라벨(비충돌). ──
          // gate 있는 노드는 근접 시 A로 상호작용(story-scene·ferry). 마커는 걸어서 통과 가능(스폰 도시가 막히지 않게).
          this.nodeViews = WORLD_NODES.map((node) => {
            const [tx, ty] = node.tile;
            const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
            const marker = this.add.image(wx, (ty + 1) * TILE, `t_node_${node.kind}`)
              .setOrigin(0.5, 1).setScale(TSCALE).setDepth(wy);
            const label = this.add.text(wx, ty * TILE - 2, node.name, this.labelStyle())
              .setOrigin(0.5, 1).setDepth(10000).setVisible(false);
            return { node, marker, label, wx, wy };
          });

          // 밤이면 팻말 곁 랜턴 불빛 하나(포인트 광원). additive로 은은하게 번지게.
          if (this.mode === 'night') {
            this.add.image(this.signX + TILE, this.signY, 't_lamp')
              .setScale(TSCALE).setDepth(this.signY + 1).setBlendMode(Phaser.BlendModes.ADD);
          }

          // 물 애니메이션 — 화면 안 sea 타일만 3프레임 물결 교체(전 바다 갱신은 불가).
          this.time.addEvent({ delay: 520, loop: true, callback: () => {
            this.waterFrame = (this.waterFrame + 1) % 3;
            this.animateWater();
          } });
          // 꽃·풀숲 흔들림 — 현재 스폰된 장식만 2프레임 교차(물결과 다른 주기).
          this.time.addEvent({ delay: 620, loop: true, callback: () => {
            this.decorFrame ^= 1;
            for (const [, d] of this.decor) {
              if (d.kind === 'flower') d.imgs[0].setTexture(`t_flower${this.decorFrame}`);
              else if (d.kind === 'bush') d.imgs[0].setTexture(`t_bush${this.decorFrame}`);
            }
          } });

          // ── 플레이어(그리드) — 서울(68,208) 스폰 ──
          this.pTileX = POI.SEOUL.x; this.pTileY = POI.SEOUL.y;
          this.facing = 'down';
          this.moving = false;
          this.turnGrace = 0;
          const spawnX = this.pTileX * TILE + TILE / 2;
          const spawnY = this.pTileY * TILE + TILE / 2;
          // 16×24 스프라이트: 하단 16px(=타일)이 발, 상단 8px가 타일 위로. origin Y 보정으로 발을 타일에 정렬.
          this.player = this.add.image(spawnX, spawnY, 'pc_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);

          this.nick = this.add.text(spawnX, spawnY + LABEL_DY, nickRef.current, this.labelStyle()).setOrigin(0.5, 0).setDepth(10000);

          // ── 펫(그리드 추적) ──
          this.petTargetX = this.pTileX - 1; this.petTargetY = this.pTileY;
          this.petPX = this.petTargetX * TILE + TILE / 2;
          this.petPY = this.petTargetY * TILE + TILE / 2;
          this.petFlip = false;
          this.pet = this.add.image(this.petPX, this.petPY, this.petTexKey(0)).setScale(TSCALE * this.petLevelScale());

          this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

          // ── 입력: 방향키/WASD 스택(마지막 키 우선) + 탭-투-무브 ──
          this.heldDirs = [];
          this.tapTile = null;
          this.input.keyboard.on('keydown', (e) => {
            if (e.key === 'b' || e.key === 'B') { this.runHeld = true; return; } // 달리기 홀드
            if (this.inputLocked) return; // 리뷰 오버레이 중 이동 잠금
            const d = keyToDir(e.key);
            if (!d) return;
            this.tapTile = null;
            if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
          });
          this.input.keyboard.on('keyup', (e) => {
            if (e.key === 'b' || e.key === 'B') { this.runHeld = false; return; }
            const d = keyToDir(e.key);
            if (d) this.heldDirs = this.heldDirs.filter((x) => x !== d);
          });
          this.input.on('pointerdown', (p) => {
            if (this.inputLocked) return; // 리뷰 오버레이 중 탭-이동 잠금
            this.tapTile = { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) };
            this.heldDirs.length = 0;
          });

          // ── 원격 플레이어(그리드 스텝 렌더) ──
          // 버스 구독('peers:update' 등)은 컴포넌트 스코프에서 등록됨 — 여기선 상태만 준비.
          this.peers = new Map(); // peerId -> { sprite, label, tileX, tileY, destTileX, destTileY, facing, moving }

          this.lastEmit = 0;
          this.time.addEvent({ delay: 500, loop: true, callback: () => this.emitDistances() });

          // 기분 하트(happy/excited).
          this.time.addEvent({
            delay: 2600, loop: true, callback: () => {
              const mood = petRef.current?.mood;
              if (mood === 'happy' || mood === 'excited') this.spawnHeart();
            },
          });

          this.wasNear = false;
        }

        // 퀘스트 채점 연출 — 정답이면 펫 자리에 하트 즉시.
        questScoredFx({ correct } = {}) {
          if (correct) this.spawnHeart();
        }

        // 퀘스트 완료 연출 — 펫 점프 + 하트 몇 개.
        questDoneFx() {
          if (!this.pet) return;
          this.tweens.add({ targets: this, petJumpVal: 1, duration: 220, ease: 'Quad.easeOut', yoyo: true, repeat: 1 });
          for (let i = 0; i < 3; i++) this.time.delayedCall(i * 120, () => this.spawnHeart());
        }

        // 닉네임 나메플레이트 — GBC 다이얼로그 문법(크림 박스 + 잉크 모노스페이스, 하드 엣지).
        // resolution: zoom 1 + 2배 백킹 덕에 텍스트 쿼드가 이제 fontSize와 backing px 1:1이라
        // (예전 zoom 0.5 땐 5px로 축소돼 resolution 3의 슈퍼샘플 보정이 필요했다) 기본값(1)이면
        // 충분히 선명하다. 더 올리면 nearest 필터 하에서 다운샘플 아티팩트로 오히려 다시 뭉개진다.
        labelStyle() {
          return {
            fontFamily: 'monospace', fontSize: '10px', color: GBC.ink,
            backgroundColor: GBC.cream, padding: { x: 4, y: 2 },
            resolution: 1,
          };
        }

        petTexKey(frame) {
          const key = PET_KEYS.includes(petRef.current?.key) ? petRef.current.key : 'dog';
          return `pet_${key}_${frame}`;
        }

        petLevelScale() {
          const lv = petRef.current?.level || 1;
          return Math.min(1 + (lv - 1) * 0.06, 1.6);
        }

        // 타일 지형 코드(범위 밖 = 바다). 충돌·해안·물결·장식 판정 공용.
        tileCode(tx, ty) {
          if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TERRAIN.SEA;
          return this.grid[ty * MAP_W + tx];
        }

        // 바다 타일 여부(범위 밖 = 바다) — 물결 애니 대상. river·lake 는 바다가 아니다(정적).
        isSea(tx, ty) { return this.tileCode(tx, ty) === TERRAIN.SEA; }

        // 타일 충돌 판정: isBlocked(sea·fence) + 팻말 = 막힘.
        //   river·lake·bridge 는 통행 가능(오너 스펙 "넘어갈 수 있게"). 노드 마커는 비충돌.
        blocked(tx, ty) {
          if (isBlocked(this.tileCode(tx, ty))) return true;
          if (tx === this.signTileX && ty === this.signTileY) return true;
          return false;
        }

        // 화면 안 sea 타일만 물결 프레임(2/3/4) 교체 — 전 바다(수만 타일) 갱신 회피.
        animateWater() {
          if (!this.layer) return;
          const v = this.cameras.main.worldView;
          const x0 = Math.max(0, Math.floor(v.x / TILE)), x1 = Math.min(COLS - 1, Math.ceil(v.right / TILE));
          const y0 = Math.max(0, Math.floor(v.y / TILE)), y1 = Math.min(ROWS - 1, Math.ceil(v.bottom / TILE));
          const idx = 2 + this.waterFrame; // 2·3·4
          for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) if (this.isSea(tx, ty)) this.layer.putTileAt(idx, tx, ty);
          }
        }

        // 타일 결정적 장식 종류(스폰 광장 근처·비육지는 비움). 'tree'|'flower'|'bush'|null.
        //   나무·풀숲은 land 계열에만 — 강·호수·교량·철조망·설산(PEAK) 위에는 나지 않는다.
        //   산지(MOUNTAIN)는 나무 확률↑(숲), 평야(PLAIN)는 확률↓(농지) — 간단 조정.
        decorKind(tx, ty) {
          const c = this.tileCode(tx, ty);
          if (c !== TERRAIN.LAND && c !== TERRAIN.MOUNTAIN && c !== TERRAIN.PLAIN) return null;
          if (Math.abs(tx - this.pTileX) <= PLAZA_R && Math.abs(ty - this.pTileY) <= PLAZA_R) return null;
          const r = tileHash(tx, ty);
          // 나무 임계: 산지 0.16(숲) · 육지 0.05 · 평야 0.02(드문 방풍림).
          const treeT = c === TERRAIN.MOUNTAIN ? 0.16 : c === TERRAIN.PLAIN ? 0.02 : 0.05;
          if (r < treeT) return 'tree';
          if (r < treeT + 0.022) return 'flower';
          if (r < treeT + 0.038) return 'bush';
          return null;
        }

        spawnDecor(kind, tx, ty) {
          const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
          if (kind === 'tree') {
            const img = this.add.image(cx, (ty + 1) * TILE, 't_tree').setOrigin(0.5, 1).setScale(TSCALE).setDepth((ty + 1) * TILE);
            return { kind, imgs: [img] };
          }
          if (kind === 'flower') {
            const img = this.add.image(cx, cy, `t_flower${this.decorFrame}`).setScale(TSCALE).setDepth(1);
            return { kind, imgs: [img] };
          }
          const img = this.add.image(cx, cy, `t_bush${this.decorFrame}`).setScale(TSCALE).setDepth(cy - 4);
          return { kind, imgs: [img] };
        }

        // 카메라 주변 land 타일에만 장식 생성/회수(상한 DECOR_CAP). 화면 밖은 즉시 파괴 → 무한 맵도 저비용.
        updateDecor() {
          const v = this.cameras.main.worldView;
          const m = TILE * 2; // 여유 마진(2타일) — 가장자리 팝인 완화
          const x0 = Math.max(0, Math.floor((v.x - m) / TILE)), x1 = Math.min(COLS - 1, Math.ceil((v.right + m) / TILE));
          const y0 = Math.max(0, Math.floor((v.y - m) / TILE)), y1 = Math.min(ROWS - 1, Math.ceil((v.bottom + m) / TILE));
          const need = new Set();
          for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
              const kind = this.decorKind(tx, ty);
              if (!kind) continue;
              const key = `${tx},${ty}`;
              need.add(key);
              if (!this.decor.has(key) && this.decor.size < DECOR_CAP) this.decor.set(key, this.spawnDecor(kind, tx, ty));
            }
          }
          for (const [key, d] of this.decor) {
            if (!need.has(key)) { for (const img of d.imgs) img.destroy(); this.decor.delete(key); }
          }
        }

        // 광장 → 공항 스토리 씬 전환(같은 Phaser 게임 내 씬 스위치).
        enterAirport() { this.scene.start('airport'); }

        // 페리 탑승 — 페이드 아웃 → 상대 항구 인접 land 로 순간이동 → 페이드 인. 보상·XP 없음.
        ferryTo(destId) {
          const dest = getNode(destId);
          if (!dest || !this.player) return;
          const [lx, ly] = this.findLandingTile(dest.tile[0], dest.tile[1]);
          this.heldDirs.length = 0; this.tapTile = null; this.runHeld = false;
          const cam = this.cameras.main;
          cam.fadeOut(280, 0, 0, 0);
          cam.once('camerafadeoutcomplete', () => {
            this.placePlayerAt(lx, ly);
            cam.fadeIn(280, 0, 0, 0);
          });
        }

        // 목적 항구 타일 또는 그 4-이웃 중 걸을 수 있는 land 를 착지점으로 고른다(항구 위 바다 회피).
        findLandingTile(tx, ty) {
          const walkableLand = (x, y) => this.tileCode(x, y) === TERRAIN.LAND;
          if (walkableLand(tx, ty)) return [tx, ty];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (walkableLand(tx + dx, ty + dy)) return [tx + dx, ty + dy];
          }
          return [tx, ty]; // 폴백(계약상 항구 타일은 land)
        }

        // 플레이어·펫·카메라를 해당 타일로 스냅(이동 중단).
        placePlayerAt(tx, ty) {
          this.tweens.killTweensOf(this.player);
          this.pTileX = tx; this.pTileY = ty; this.moving = false;
          const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
          this.player.setPosition(wx, wy);
          this.petTargetX = tx; this.petTargetY = ty;
          this.petPX = wx; this.petPY = wy;
          if (this.pet) this.pet.setPosition(Math.round(wx), Math.round(wy));
          this.cameras.main.centerOn(wx, wy);
        }

        // 한 타일 이동 시작(플레이어). B 홀드 중이면 2배속(달리기).
        startStep(dir) {
          const [dx, dy] = DIRV[dir];
          const prevX = this.pTileX, prevY = this.pTileY;
          this.pTileX += dx; this.pTileY += dy;
          this.moving = true;
          const dur = this.runHeld ? RUN_STEP_MS : STEP_MS; // B 홀드 한정 달리기
          const tx = this.pTileX * TILE + TILE / 2, ty = this.pTileY * TILE + TILE / 2;
          this.tweens.add({
            targets: this.player, x: tx, y: ty, duration: dur, ease: 'Linear',
            onComplete: () => { this.moving = false; this.petTargetX = prevX; this.petTargetY = prevY; },
          });
        }

        applyPeers(incoming) {
          const entries = incoming instanceof Map ? [...incoming.entries()] : Object.entries(incoming || {});
          const seen = new Set();
          for (const [id, st] of entries) {
            if (!st) continue;
            seen.add(id);
            const tileX = Math.floor(st.x / TILE);
            const tileY = Math.floor(st.y / TILE);
            let p = this.peers.get(id);
            if (!p) {
              const sx = tileX * TILE + TILE / 2, sy = tileY * TILE + TILE / 2;
              const sprite = this.add.image(sx, sy, 'pr_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);
              const label = this.add.text(sx, sy + LABEL_DY, st.nick || '', this.labelStyle()).setOrigin(0.5, 0).setDepth(10000);
              p = { sprite, label, tileX, tileY, destTileX: tileX, destTileY: tileY, facing: 'down', moving: false };
              this.peers.set(id, p);
            }
            p.destTileX = tileX; p.destTileY = tileY;
            if (VALID_DIR.has(st.dir)) p.facing = st.dir;
            if (st.nick != null) p.label.setText(st.nick);
            // 너무 먼 순간이동은 스냅(길게 기어가지 않게).
            if (!p.moving && (Math.abs(tileX - p.tileX) + Math.abs(tileY - p.tileY)) > 8) {
              p.tileX = tileX; p.tileY = tileY;
              p.sprite.setPosition(tileX * TILE + TILE / 2, tileY * TILE + TILE / 2);
            }
          }
          for (const [id, p] of this.peers) {
            if (!seen.has(id)) { p.sprite.destroy(); p.label.destroy(); this.peers.delete(id); }
          }
        }

        emitDistances() {
          if (!this.player || this.peers.size === 0) return;
          const out = {};
          for (const [id, p] of this.peers) {
            out[id] = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, p.sprite.x, p.sprite.y));
          }
          bus.emit('peers:dist', out);
        }

        spawnHeart() {
          if (!this.pet) return;
          const h = this.add.image(this.pet.x, this.pet.y - 12, 't_heart').setScale(TSCALE).setDepth(10001);
          this.tweens.add({ targets: h, y: h.y - 26, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
        }

        // 그리디 축우선 스텝(탭 이동). 막히면 정지.
        tapStepDir() {
          if (!this.tapTile) return null;
          if (this.tapTile.x === this.pTileX && this.tapTile.y === this.pTileY) { this.tapTile = null; return null; }
          let dir = null;
          if (this.tapTile.x !== this.pTileX) dir = this.tapTile.x > this.pTileX ? 'right' : 'left';
          else if (this.tapTile.y !== this.pTileY) dir = this.tapTile.y > this.pTileY ? 'down' : 'up';
          return dir;
        }

        update(time, delta) {
          // 카메라 주변 장식 생성/회수(매 프레임 — 컬링·상한으로 저비용).
          this.updateDecor();

          // ── 플레이어 이동 상태기계 (facing→step→hold 연속) ──
          if (!this.moving && !this.inputLocked) {
            const held = this.heldDirs.length ? this.heldDirs[this.heldDirs.length - 1] : null;
            if (held) {
              if (this.facing !== held) {
                this.facing = held;               // 먼저 몸만 돌린다
                this.turnGrace = time + TURN_MS;  // 이 유예 안에 떼면 제자리 회전만
              } else if (time >= this.turnGrace) {
                const [dx, dy] = DIRV[held];
                if (!this.blocked(this.pTileX + dx, this.pTileY + dy)) this.startStep(held);
                // 막히면 facing만 유지(제자리 걸음 없음)
              }
            } else {
              const tdir = this.tapStepDir();
              if (tdir) {
                this.facing = tdir;
                const [dx, dy] = DIRV[tdir];
                if (!this.blocked(this.pTileX + dx, this.pTileY + dy)) this.startStep(tdir);
                else this.tapTile = null;         // 막히면 정지
              }
            }
          }

          // 달리기 중이면 보행 프레임도 2배속(RUN_ANIM_MS). 정지·걷기 판정은 moving 그대로.
          const charAnimMs = this.runHeld ? RUN_ANIM_MS : CHAR_ANIM_MS;
          this.setCharFrame(this.player, 'pc', this.facing, this.moving, time, charAnimMs);
          this.player.setDepth(this.player.y);
          this.nick.setPosition(this.player.x, this.player.y + LABEL_DY);

          // ── 펫: 목표 타일 중심으로 수동 그리드 추적 + 뒤뚱/바운스 ──
          const petObj = petRef.current || {};
          const tgx = this.petTargetX * TILE + TILE / 2, tgy = this.petTargetY * TILE + TILE / 2;
          const pdx = tgx - this.petPX, pdy = tgy - this.petPY;
          const pdist = Math.hypot(pdx, pdy);
          const petMoving = pdist > 0.5;
          if (petMoving) {
            // 플레이어가 달리면 펫도 같은 속도로 따라붙는다(뒤처짐 방지).
            const petStepMs = this.runHeld ? RUN_STEP_MS : STEP_MS;
            const stepPx = (TILE / petStepMs) * delta;
            const k = Math.min(1, stepPx / pdist);
            this.petPX += pdx * k; this.petPY += pdy * k;
            if (Math.abs(pdx) > Math.abs(pdy)) this.petFlip = pdx < 0;
          }
          // 이동 중엔 빠른 뒤뚱(WALK_MS), 정지 중엔 느긋한 idle(PET_IDLE_MS) — 둘 다 2프레임 스왑.
          const petFrameMs = petMoving ? WALK_MS : PET_IDLE_MS;
          this.pet.setTexture(this.petTexKey(Math.floor(time / petFrameMs) % 2));
          this.pet.setScale(TSCALE * this.petLevelScale());
          this.pet.setFlipX(this.petFlip);
          let petRenderY = this.petPY;
          if (petObj.mood === 'happy' || petObj.mood === 'excited') {
            petRenderY -= Math.abs(Math.sin(time / 1000 * 6)) * 4;
          }
          petRenderY -= (this.petJumpVal || 0) * 18; // 퀘스트 완료 점프 연출
          this.pet.setPosition(Math.round(this.petPX), Math.round(petRenderY));
          this.pet.setDepth(this.petPY);

          // ── 원격 플레이어: 목적 타일까지 축우선 그리드 스텝(동일 tween) ──
          for (const [, p] of this.peers) {
            if (!p.moving) {
              const dtx = p.destTileX - p.tileX, dty = p.destTileY - p.tileY;
              if (dtx || dty) {
                const d = Math.abs(dtx) >= Math.abs(dty)
                  ? (dtx > 0 ? 'right' : 'left')
                  : (dty > 0 ? 'down' : 'up');
                const [ddx, ddy] = DIRV[d];
                p.tileX += ddx; p.tileY += ddy; p.facing = d; p.moving = true;
                const tx = p.tileX * TILE + TILE / 2, ty = p.tileY * TILE + TILE / 2;
                this.tweens.add({
                  targets: p.sprite, x: tx, y: ty, duration: STEP_MS, ease: 'Linear',
                  onComplete: () => { p.moving = false; },
                });
              }
            }
            this.setCharFrame(p.sprite, 'pr', p.facing, p.moving, time);
            p.sprite.setDepth(p.sprite.y);
            p.label.setPosition(p.sprite.x, p.sprite.y + LABEL_DY);
          }

          // ── local:state — ~100ms 스로틀 (좌표는 예전과 동일 스케일의 월드 px) ──
          if (time - this.lastEmit > 100) {
            this.lastEmit = time;
            bus.emit('local:state', { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.facing });
          }

          // 표지판 근접 → React 오버레이 토글.
          const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.signX, this.signY) < QUEST_RANGE;
          if (near !== this.wasNear) { this.wasNear = near; setNearQuest(near); }

          // ── 장소 노드 근접: 이름 라벨 토글 + 가장 가까운 gate 노드를 React 프롬프트로 통지 ──
          let nearestGate = null, nearestD = QUEST_RANGE;
          for (const v of this.nodeViews) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.wx, v.wy);
            v.label.setVisible(d < NODE_LABEL_RANGE);
            if (v.node.gate && d < nearestD) { nearestGate = v.node; nearestD = d; }
          }
          const gid = nearestGate ? nearestGate.id : null;
          if (gid !== this.wasNearNodeId) {
            this.wasNearNodeId = gid;
            setNearNode(nearestGate ? { id: nearestGate.id, name: nearestGate.name, gate: nearestGate.gate } : null);
          }
        }
      }

      // 공항 스토리 씬 — 같은 게임에 등록(WorldScene가 autostart, airport는 게이트 진입 시 start).
      // ctx: 씬 ↔ React 브리지(페이즈 통지·sceneRef 바인딩·펫/닉네임 소스). 신규 bus 이벤트 없음.
      const airportCtx = {
        petRef, nickRef,
        bindScene: (s) => { sceneRef.current = s; },
        notifyPhase: (phase) => {
          if (phase === 'walking') { setStoryActive(true); setStoryPhase('walking'); setStoryIdx(0); setShowKo(false); }
          else if (phase === 'arrived') { setStoryPhase('dialogue'); setStoryIdx(0); setShowKo(false); }
        },
      };
      const AirportScene = buildAirportScene(Phaser, airportCtx);

      // Scale.NONE — Phaser 내부 드로잉 버퍼를 320×288(2배 백킹)로 고정하고, 화면 확대는 CSS로 직접 제어한다.
      // (Phaser의 FIT/RESIZE는 비정수 배율을 허용해 도트가 뭉개진다. 정수 배율만 보장하려면
      //  CSS width/height를 320·288의 정수배로 세팅하고 image-rendering:pixelated로 굽는 편이 견고하다.)
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#7fb060',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.NONE, width: VIEW_W, height: VIEW_H },
        scene: [WorldScene, AirportScene],
      });
      gameRef.current = game;
      if (game.canvas) game.canvas.style.imageRendering = 'pixelated';

      // ── 정수 배율 피팅 — 컨테이너(셸 화면 영역)에 맞춰 ×floor(min(w/320,h/288)), 최소 ×1 ──
      // (백킹이 예전 160×144의 2배가 됐으므로 ×1이 예전 ×2와 동일한 화면 크기를 만든다.)
      const fitCanvas = () => {
        const host = hostRef.current;
        const canvas = gameRef.current?.canvas;
        if (!host || !canvas) return;
        const w = host.clientWidth, h = host.clientHeight;
        let s = Math.floor(Math.min(w / VIEW_W, h / VIEW_H));
        if (!Number.isFinite(s) || s < MIN_SCALE) s = MIN_SCALE;
        canvas.style.width = `${VIEW_W * s}px`;
        canvas.style.height = `${VIEW_H * s}px`;
      };
      fitCanvas();
      if (typeof ResizeObserver !== 'undefined' && hostRef.current) {
        ro = new ResizeObserver(fitCanvas);
        ro.observe(hostRef.current);
      }

      if (destroyed) { if (ro) { ro.disconnect(); ro = null; } game.destroy(true); gameRef.current = null; }
    })();

    return () => {
      destroyed = true;
      // 버스 off를 파이저 lifecycle과 무관하게 여기서 확실히 수행(재방문 누수 차단).
      bus.off('peers:update', onPeers);
      bus.off('quest:scored', onQuestScored);
      bus.off('quest:done', onQuestDone);
      if (ro) { ro.disconnect(); ro = null; }
      sceneRef.current = null;
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0b0d08' }}>
      {/* 캔버스(320×288, 2배 백킹)를 정수 배율로 확대한 뒤 화면 영역 중앙에 배치. 도트는 pixelated로 보존. */}
      <div ref={hostRef} style={{
        width: '100%', height: '100%',
        display: 'grid', placeItems: 'center', imageRendering: 'pixelated',
      }} />

      {/* 조작 힌트 — GBC 다이얼로그 문법(크림 칩, 하드 엣지). */}
      <div style={{
        position: 'absolute', left: 6, bottom: 6, pointerEvents: 'none',
        fontFamily: GBC.font, fontSize: '0.6rem', color: GBC.ink,
        background: GBC.cream, border: `2px solid ${GBC.border}`,
        boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`,
        padding: '3px 6px', borderRadius: 2, lineHeight: 1.35,
      }}>
        ✚ 이동 · Ⓐ 말 걸기 · Ⓑ 닫기 · Ⓑ홀드 달리기
      </div>

      {/* 표지판 근접 → '말 걸기' 프롬프트. Phaser 내 DOM 금지 → React 오버레이. (오너 지시: 게임 내에서 진행) */}
      {nearQuest && !reviewOpen && !storyActive && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          ...gbcPanel, width: 'min(90%, 360px)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🪧</span>
          <span style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.5 }}>
            표지판이 말을 걸어와요 — 지금 복습하면 펫이 자라요.
          </span>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
          >
            말 걸기
          </button>
        </div>
      )}

      {/* 우상단 미니맵 버튼(GBC 칩) — 셸 START/SELECT와 충돌 없게 게임 화면 안에 별도 배치. */}
      {!reviewOpen && !storyActive && !ferryPrompt && (
        <button
          type="button"
          aria-label={minimapOpen ? '지도 닫기' : '지도 열기'}
          onClick={() => setMinimapOpen((v) => !v)}
          style={{
            position: 'absolute', top: 6, right: 6, zIndex: 5,
            fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink, cursor: 'pointer',
            background: minimapOpen ? GBC.creamHi : GBC.cream, border: `2px solid ${GBC.border}`,
            boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
            padding: '3px 6px', lineHeight: 1,
          }}
        >
          🗺
        </button>
      )}

      {/* 미니맵 오버레이 — mapData 다운샘플 4색 + 플레이어/노드 점. B로도 닫힘(cancel). */}
      {minimapOpen && (
        <Minimap sceneRef={sceneRef} onClose={() => setMinimapOpen(false)} />
      )}

      {/* 장소 게이트 근접 → 상호작용 프롬프트(story-scene: 공항 진입 · ferry: 페리 확인). */}
      {nearNode?.gate && !storyActive && !reviewOpen && !ferryPrompt && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          ...gbcPanel, width: 'min(90%, 360px)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{nearNode.gate.type === 'ferry' ? '⚓' : '✈'}</span>
          <span style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.5 }}>
            {nearNode.name} {nearNode.gate.label} — {nearNode.gate.type === 'ferry' ? '페리를 탈까요?' : '탑승할까요?'}
          </span>
          <button
            type="button"
            onClick={() => {
              if (nearNode.gate.type === 'ferry') {
                const dest = getNode(nearNode.gate.to);
                setFerryPrompt({ toId: nearNode.gate.to, toName: dest?.name || '' });
              } else {
                sceneRef.current?.enterAirport?.();
              }
            }}
            style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
          >
            {nearNode.gate.type === 'ferry' ? '타기' : '들어가기'}
          </button>
        </div>
      )}

      {/* 페리 확인 다이얼로그 — A→여기, 확인 시 페이드 후 상대 항구로 이동. B(cancel)로 닫힘. */}
      {ferryPrompt && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.55)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(86%, 320px)', padding: '16px 16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: 8 }}>⚓</div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 14px' }}>
              {ferryPrompt.toName}행 페리를 탈까요?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { const toId = ferryPrompt.toId; setFerryPrompt(null); sceneRef.current?.ferryTo?.(toId); }}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
              >
                탑승
              </button>
              <button
                type="button"
                onClick={() => setFerryPrompt(null)}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap', background: GBC.cream, color: GBC.ink }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인게임 즉석 리뷰 — 캔버스 위 HTML, 열리면 게임 입력 잠금(useEffect). */}
      {reviewOpen && (
        <QuestReview userId={userId} onClose={() => setReviewOpen(false)} />
      )}

      {/* 공항 스토리 — 텍스트박스(대사) → 심사관 문답(통과 시 출구 개방). */}
      {storyActive && storyPhase === 'dialogue' && (
        <StoryTextbox
          step={STORY_STEPS[storyIdx]}
          index={storyIdx}
          total={STORY_STEPS.length}
          showKo={showKo}
          onToggleKo={() => setShowKo((v) => !v)}
          onNext={() => advanceStoryRef.current?.()}
          onExit={() => sceneRef.current?.returnPlaza?.()}
        />
      )}
      {storyActive && (storyPhase === 'quiz' || storyPhase === 'passed') && STORY_TEXT && (
        <AirportQuiz
          text={STORY_TEXT}
          onPass={(events) => recordPass(events)}
          onExit={() => sceneRef.current?.returnPlaza?.()}
        />
      )}
    </div>
  );
}
