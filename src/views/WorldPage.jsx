'use client';

// 🌱 학습 월드 (실험) — 게더타운풍 2D 탑다운 월드.
// 웨이브 2: 솔로 코어(GameCanvas)에 넷코드·근접 음성·펫을 배선한다.
//
// 이 파일이 유일한 통합 지점 — GameCanvas와는 bus.js 계약으로만,
// 멀티/음성/펫 로직과는 src/lib/world/* 팩토리로만 대화한다.
//   · 펫    : fetchPetInputs→derivePetState + getPetChoice → GameCanvas `pet` prop
//   · 멀티  : createWorldNet — bus 'local:state'→sendState, onPeers→bus 'peers:update'
//   · 음성  : createVoiceMesh — bus 'peers:dist'(px/32=타일)→setPeerDistance
// 모든 네트워크·마이크 실패는 조용히 삼키고 게임은 솔로로 계속된다.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { supabase } from '../lib/supabase';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import bus from '../components/world/bus';
import { createWorldNet } from '../lib/world/net';
import { createVoiceMesh } from '../lib/world/voice';
import {
  PET_SPECIES,
  getPetChoice,
  setPetChoice,
  derivePetState,
  fetchPetInputs,
} from '../lib/world/pet';

const TILE = 32;             // GameCanvas와 동일 — peers:dist(px)→타일 변환에 사용
const PEER_STALE_MS = 10000; // 이 시간 넘게 소식 없는 peer는 유령으로 보고 정리

// GBC 다이얼로그 문법 토큰 — 월드 미니바·펫 팝오버를 캔버스 오버레이와 통일한다.
// (동적 청크 분리 유지를 위해 QuestReview.jsx를 import하지 않고 동일 팔레트 값만 복제.)
const GBC = {
  cream: '#f6edcf', creamHi: '#fffaf0', creamShade: '#e4d5a6', ink: '#2a2118',
  border: '#2a2118', green: '#5f9a46', red: '#c14b38', brown: '#8a5a2b',
  font: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  shadow: '3px 3px 0 rgba(42,33,24,0.30)',
};

// ── GBC 휴대기 셸 토큰 ──
// 실물 그레이/화이트 GBC 오마주: 밝은 웜 그레이(살짝 아이보리) 바디 + 다크 퍼플-그레이 베젤.
// 실루엣은 GBC(라운드 바디 + 좌하 십자키 + 우하 대각 A/B + 중앙 START/SELECT + 스피커 그릴).
// (인게임 다이얼로그/펫 팝오버는 여전히 크림 — GBC도 대화창은 크림이라 GBC 토큰으로 유지.)
const SHELL = {
  // 웜 그레이 바디: 상단 하이라이트→하단 음영 그라데이션으로 플라스틱 볼륨감.
  body: 'linear-gradient(168deg, #e6e2db 0%, #d4d0ca 54%, #bfbab0 100%)',
  bodyEdge: '#9b958a',
  // 다크 퍼플-그레이 베젤(상단 각인 + 좌측 전원 LED 자리).
  bezel: 'linear-gradient(160deg, #524d5b 0%, #46424e 58%, #383540 100%)',
  screenOff: '#0b0d08',
  dpad: '#1c1c1e', dpadHi: '#333336', dpadDown: '#000000',
  ab: '#b0355c', abHi: '#d5637f', abDown: '#7e2440', // 크림슨-마젠타 A/B
  pill: 'linear-gradient(#4a4750, #37343b)', pillEdge: '#2a2830', // 다크그레이 알약
  led: '#e2483a', engrave: '#b7b1c1', label: '#5d584f',
};

// 십자키 버튼 — 모듈 스코프 컴포넌트(부모 리렌더 중 리마운트 방지 → 홀드 도중 release 유실 없음).
// pointer capture로 손가락이 버튼 밖으로 나가도 pointerup을 같은 요소에서 받아 확실히 release한다.
function DpadButton({ dir, char, onPress, onRelease, style }) {
  const [on, setOn] = useState(false);
  const down = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    setOn(true);
    onPress(dir);
  };
  const up = () => { setOn(false); onRelease(dir); };
  return (
    <button
      type="button"
      aria-label={dir}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        border: 'none', color: '#cfc7bb', fontSize: '0.7rem', cursor: 'pointer',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        display: 'grid', placeItems: 'center',
        background: on ? SHELL.dpadDown : SHELL.dpad,
        boxShadow: on ? 'inset 0 2px 3px rgba(0,0,0,0.5)' : '0 2px 0 rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {char}
    </button>
  );
}

// A/B 버튼(원형 크림슨-마젠타) — 동작은 기존과 동일하게 onClick(interact/cancel)에 그대로 배선하고,
// pointer 이벤트는 "눌림 시 어둡게" 시각 상태(on)만 토글한다(게임/네트워크 배선 무변경).
function AbButton({ label, ariaLabel, onClick, base, style }) {
  const [on, setOn] = useState(false);
  const off = () => setOn(false);
  return (
    <button
      type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => setOn(true)}
      onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        ...base,
        background: on
          ? `radial-gradient(circle at 38% 32%, ${SHELL.abDown}, #5e1a30)`
          : `radial-gradient(circle at 38% 32%, ${SHELL.abHi}, ${SHELL.ab})`,
        boxShadow: on ? 'inset 0 2px 4px rgba(0,0,0,0.5)' : '0 3px 0 rgba(60,40,50,0.5)',
        transform: on ? 'translateY(1px)' : 'none',
        ...style,
      }}
    >
      {label}
    </button>
  );
}

// ssr:false — phaser가 서버에서 window를 건드리지 않게 + 다른 라우트 번들에서 배제.
const GameCanvas = dynamic(() => import('../components/world/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <Spinner />
    </div>
  ),
});

// 펫 기분 → 한 줄 카피(내부 용어 금지, 따뜻한 톤).
const MOOD_LINE = {
  excited: '오늘도 신나게 공부했어요',
  happy: '함께 있으니 즐거워요',
  sleepy: '오늘 공부하면 더 신나요',
};

export default function WorldPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const userId = user?.id || null;
  const nickname = profile?.display_name || '나';

  // ── 펫 상태 ──
  // petKey는 localStorage 값이라 마운트 후에만 읽는다(SSR 안전 — 초기엔 기본 dog).
  const [petKey, setPetKey] = useState(PET_SPECIES[0].key);
  const [petState, setPetState] = useState({ level: 1, xp: 0, xpToNext: 10, mood: 'happy' });
  const [petMenuOpen, setPetMenuOpen] = useState(false);

  // ── 음성 UI 상태 ──
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [nearVoiceCount, setNearVoiceCount] = useState(0);

  // GBC 셸 → GameCanvas 입력 주입 핸들. GameCanvas가 마운트 시 { press,release,interact,cancel }를 채운다.
  const controlsRef = useRef(null);
  const press = useCallback((d) => controlsRef.current?.press(d), []);
  const release = useCallback((d) => controlsRef.current?.release(d), []);
  const interact = useCallback(() => controlsRef.current?.interact(), []);
  const cancel = useCallback(() => controlsRef.current?.cancel(), []);

  // 네트워크·음성 인스턴스(마운트 1회 생성) — 이벤트 핸들러가 참조.
  const voiceRef = useRef(null);
  // 펫 파생의 원천 입력(totalCorrect·todayCorrect·sessionsToday) — 인게임 리뷰 완료 시 낙관 성장에 쓴다.
  const petInputsRef = useRef({ totalCorrect: 0, todayCorrect: 0, sessionsToday: 0 });

  const species = useMemo(
    () => PET_SPECIES.find((p) => p.key === petKey) || PET_SPECIES[0],
    [petKey],
  );
  // GameCanvas에 흘려보낼 pet prop — 종 key(도트 스프라이트 선택)·이모지는 즉시, 레벨·기분은 학습 파생.
  const pet = useMemo(
    () => ({ key: species.key, emoji: species.emoji, level: petState.level, mood: petState.mood }),
    [species, petState.level, petState.mood],
  );

  // net 생성 시점에 최신 닉네임·펫 이모지를 읽도록 ref로 흘려보낸다.
  // (펫만 바꿔도 음성이 끊기지 않게 net은 userId에만 묶는다 — 펫은 로컬 즉시 반영,
  //  peer에게는 다음 접속 때 반영된다.)
  const identityRef = useRef({ name: nickname, pet: species.emoji });
  useEffect(() => {
    identityRef.current = { name: nickname, pet: species.emoji };
  }, [nickname, species.emoji]);

  // 저장된 펫 선택 로드(마운트 1회).
  useEffect(() => {
    setPetKey(getPetChoice());
  }, []);

  // 학습 파생 펫 상태 — 실패해도 조용히 기본값 유지.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchPetInputs(supabase, userId)
      .then((inputs) => {
        if (cancelled) return;
        petInputsRef.current = inputs;
        setPetState(derivePetState(inputs));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  // 인게임 즉석 리뷰 완료 → 펫이 그 자리에서 자란다(top5 해결).
  // 낙관 갱신으로 즉시 성장시키고(이벤트 insert 커밋 레이스 회피), 잠시 뒤 DB 진실과 재조정한다.
  useEffect(() => {
    if (!userId) return undefined;
    const onQuestDone = ({ right = 0 } = {}) => {
      const cur = petInputsRef.current;
      const next = {
        totalCorrect: (cur.totalCorrect || 0) + right,
        todayCorrect: (cur.todayCorrect || 0) + right,
        sessionsToday: 1,
      };
      petInputsRef.current = next;
      setPetState(derivePetState(next)); // 즉시 반영 — 펫 레벨/기분이 그 자리에서 갱신
      // 이벤트 insert가 커밋된 뒤 재조정(카운트 조회가 낙관치 이상일 때만 신뢰 → 레이스로 축소 방지).
      setTimeout(() => {
        fetchPetInputs(supabase, userId)
          .then((inputs) => {
            if ((inputs.totalCorrect || 0) >= (petInputsRef.current.totalCorrect || 0)) {
              petInputsRef.current = inputs;
              setPetState(derivePetState(inputs));
            }
          })
          .catch(() => {});
      }, 1500);
    };
    bus.on('quest:done', onQuestDone);
    return () => bus.off('quest:done', onQuestDone);
  }, [userId]);

  // ── 멀티 + 근접 음성 배선 (로그인 시에만; 비로그인은 솔로) ──
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const { name, pet: petEmoji } = identityRef.current;
    const net = createWorldNet({ userId, name, pet: petEmoji });
    const voice = createVoiceMesh({
      selfId: userId,
      sendSignal: net.sendSignal,
      onSignal: net.onSignal,
    });
    voiceRef.current = voice;

    // net이 준 원격 목록(Map<id,{x,y,dir,name,pet,at}>)의 최신본 — stale 정리용.
    let latestPeers = new Map();

    // net 형식 → GameCanvas 계약(peers:update) 형식으로 변환하며 stale(>10s) 제거.
    const emitPeers = (map) => {
      latestPeers = map;
      const now = Date.now();
      const out = new Map();
      for (const [id, p] of map) {
        if (p.at && now - p.at > PEER_STALE_MS) continue; // 유령 제외
        out.set(id, { x: p.x, y: p.y, dir: p.dir, emoji: p.pet, nick: p.name });
      }
      bus.emit('peers:update', out);
    };

    net.onPeers((map) => { if (!cancelled) emitPeers(map); });
    net.onPeerLeft((id) => { voice.removePeer(id); });

    // 내 위치 → net 송신.
    const onLocalState = (st) => net.sendState(st);
    bus.on('local:state', onLocalState);

    // 거리(px) → 타일(/TILE) → 음성 근접 게이팅.
    const onDist = (dists) => {
      if (!dists) return;
      for (const id in dists) voice.setPeerDistance(id, dists[id] / TILE);
    };
    bus.on('peers:dist', onDist);

    // 마이크·연결 상태 표출.
    voice.onStatus(({ micOn: on, peers }) => {
      if (cancelled) return;
      setMicOn(on);
      setNearVoiceCount(peers.filter((p) => p.connected).length);
    });

    // presence leave가 안 오고 조용히 사라진 peer(탭 얼음/끊김)를 주기적으로 청소.
    const staleTimer = setInterval(() => {
      const now = Date.now();
      let hasStale = false;
      for (const [id, p] of latestPeers) {
        if (p.at && now - p.at > PEER_STALE_MS) { hasStale = true; voice.removePeer(id); }
      }
      if (hasStale) emitPeers(latestPeers);
    }, 3000);

    net.join().catch(() => {}); // 실패는 조용히 — 게임은 솔로로 계속

    return () => {
      cancelled = true;
      clearInterval(staleTimer);
      bus.off('local:state', onLocalState);
      bus.off('peers:dist', onDist);
      net.leave();
      voice.destroy();
      voiceRef.current = null;
      setMicOn(false);
      setNearVoiceCount(0);
      bus.emit('peers:update', new Map()); // 남은 원격 캐릭터 정리
    };
  }, [userId]);

  // 언마운트/페이지 이탈 시 확실히 정리 — pagehide는 모바일 백그라운드 전환도 포함.
  useEffect(() => {
    const cleanup = () => { voiceRef.current?.disableMic(); };
    window.addEventListener('pagehide', cleanup);
    return () => window.removeEventListener('pagehide', cleanup);
  }, []);

  // ── 마이크 토글 ──
  async function toggleMic() {
    const voice = voiceRef.current;
    if (!voice || micBusy) return;
    if (micOn) { voice.disableMic(); return; }
    setMicBusy(true);
    let ok = false;
    try { ok = await voice.enableMic(); } catch { ok = false; }
    setMicBusy(false);
    if (!ok) toast('마이크 권한이 필요해요', 'warning');
    // 성공 시 micOn은 onStatus가 반영한다.
  }

  function choosePet(key) {
    setPetChoice(key);
    setPetKey(key);
    setPetMenuOpen(false);
  }

  // ── 게이트 (ListenLabPage와 동일) ──
  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!user || !isAdmin) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>실험 기능이에요</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
          관리자만 들어올 수 있는 실험실이에요.
        </p>
        <Link href="/home" className="btn btn--primary">홈으로</Link>
      </div>
    );
  }

  const moodLine = MOOD_LINE[petState.mood] || MOOD_LINE.happy;

  // A/B 원형 버튼의 정적 뼈대(색·그림자·눌림은 AbButton이 상태로 얹는다).
  const abBase = {
    width: 40, height: 40, borderRadius: '50%',
    color: '#fdeef2', fontFamily: GBC.font, fontWeight: 800, fontSize: '0.95rem',
    border: '2px solid #7e2440',
    cursor: 'pointer', touchAction: 'manipulation', lineHeight: 1,
  };
  // 버튼 옆 회색 소문자 라벨(실물 GBC의 a/b 각인 오마주).
  const abLabel = {
    fontFamily: GBC.font, fontSize: '0.5rem', fontWeight: 700, color: SHELL.label, lineHeight: 1,
  };
  // START/SELECT 다크그레이 알약 — 그룹(알약+라벨)을 -25° 기울여 실물 배치 재현.
  const pillBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: SHELL.pill, border: `2px solid ${SHELL.pillEdge}`, borderRadius: 20,
    padding: '5px 14px', boxShadow: '0 2px 0 rgba(30,28,34,0.5)', cursor: 'pointer',
  };
  const pillLabel = {
    fontFamily: GBC.font, fontWeight: 700, fontSize: '0.5rem', letterSpacing: '0.6px', color: SHELL.label,
  };
  const pillDot = { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {/* ── 상단 미니 바 (뒤로·제목·상태 요약 — 조작은 셸로 이전) ── */}
      <div style={{ width: '100%', maxWidth: 540, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => router.back()}>← 뒤로</Button>
        <h1 className="page-header__title" style={{ margin: 0, fontSize: '1.25rem' }}>
          학습 월드 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>실험</span>
        </h1>
        <div style={{ marginLeft: 'auto', fontFamily: GBC.font, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {species.emoji} Lv.{petState.level} · {moodLine}
          {micOn && nearVoiceCount > 0 && <span> · 🎤 {nearVoiceCount}</span>}
        </div>
      </div>

      {/* ── GBC 휴대기 셸 ── (라운드 바디 + 베젤/화면 + 십자키·A/B·START/SELECT·스피커 그릴) */}
      <div style={{
        width: '100%', maxWidth: 'min(96vw, 540px)',
        background: SHELL.body, border: `3px solid ${SHELL.bodyEdge}`,
        borderRadius: '18px 18px 42px 18px',
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.65), inset 0 -3px 6px rgba(120,114,104,0.35), ${GBC.shadow}`,
        padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* 베젤 + 화면 — QuestReview 오버레이는 GameCanvas 내부(inset:0)라 이 화면 영역만 덮는다 */}
        <div style={{
          position: 'relative', background: SHELL.bezel, borderRadius: '10px 10px 28px 10px',
          padding: '26px 18px 18px', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.55)',
        }}>
          {/* 전원 LED(살짝 글로우) + 라벨 — 좌측 상단 */}
          <span style={{
            position: 'absolute', top: 11, left: 15, width: 7, height: 7, borderRadius: '50%',
            background: SHELL.led, boxShadow: `0 0 5px ${SHELL.led}, inset 0 0 1px #fff`,
          }} />
          <span style={{ position: 'absolute', top: 8, left: 27, fontFamily: GBC.font, fontSize: '0.5rem', letterSpacing: '0.5px', color: '#8b8794' }}>
            POWER
          </span>
          {/* 베젤 상단 각인(소형 대문자·연회색) — 실물 "DOT MATRIX WITH STEREO SOUND" 자리, 우리 식 문구 */}
          <span style={{
            position: 'absolute', top: 9, left: 0, right: 0, textAlign: 'center',
            fontFamily: GBC.font, fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.8px', color: SHELL.engrave,
          }}>
            DOT MATRIX WITH REVIEW SOUND
          </span>
          {/* 화면 (10:9 = 160×144) */}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '10 / 9',
            background: SHELL.screenOff, borderRadius: 4, overflow: 'hidden',
            boxShadow: 'inset 0 0 0 2px #12140e',
          }}>
            <GameCanvas userId={userId} nickname={nickname} pet={pet} controlsRef={controlsRef} />
          </div>
        </div>

        {/* 화면 아래 무지개 워드마크 — GBC 로고 오마주. 본체는 다크 그레이 이탤릭 볼드,
            "COLOR" 다섯 글자는 로고처럼 글자별 원색(빨/노/초/파/보). */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, paddingTop: 2 }}>
          <span style={{
            fontFamily: '"Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
            fontStyle: 'italic', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.3px', color: '#403c47',
          }}>
            ANATOMY BOY
          </span>
          <span style={{
            fontFamily: '"Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
            fontStyle: 'italic', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.6px',
          }}>
            <span style={{ color: '#e4392e' }}>C</span>
            <span style={{ color: '#f7a800' }}>O</span>
            <span style={{ color: '#3aa53a' }}>L</span>
            <span style={{ color: '#2a6bd8' }}>O</span>
            <span style={{ color: '#8a3aa5' }}>R</span>
          </span>
        </div>

        {/* 컨트롤 행: 십자키(좌) + A/B(우, 대각) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 0' }}>
          {/* 십자키 — 3×3 그리드, 4방향만 버튼(홀드 연속 이동은 씬이 처리) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gridTemplateRows: 'repeat(3, 28px)' }}>
            <span />
            <DpadButton dir="up" char="▲" onPress={press} onRelease={release} style={{ borderRadius: '6px 6px 0 0' }} />
            <span />
            <DpadButton dir="left" char="◀" onPress={press} onRelease={release} style={{ borderRadius: '6px 0 0 6px' }} />
            <span style={{ background: SHELL.dpad, display: 'grid', placeItems: 'center' }}>
              {/* 중앙 원형 딤플(오목) */}
              <span style={{
                width: 11, height: 11, borderRadius: '50%', background: '#0c0c0d',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 1px rgba(90,90,96,0.5)',
              }} />
            </span>
            <DpadButton dir="right" char="▶" onPress={press} onRelease={release} style={{ borderRadius: '0 6px 6px 0' }} />
            <span />
            <DpadButton dir="down" char="▼" onPress={press} onRelease={release} style={{ borderRadius: '0 0 6px 6px' }} />
            <span />
          </div>

          {/* A/B — A=상호작용(말 걸기), B=취소(리뷰 닫기). 원형 크림슨-마젠타 + 옆 소문자 라벨, 대각 배치. */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, transform: 'rotate(-18deg)' }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
              <AbButton label="B" ariaLabel="B (취소·닫기)" onClick={cancel} base={abBase} />
              <span style={abLabel}>b</span>
            </div>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 3, transform: 'translateY(-12px)' }}>
              <AbButton label="A" ariaLabel="A (말 걸기·상호작용)" onClick={interact} base={abBase} />
              <span style={abLabel}>a</span>
            </div>
          </div>
        </div>

        {/* START / SELECT — START=마이크 토글, SELECT=펫 선택. 다크그레이 알약을 -25° 기울이고 아래 소형 라벨. */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: 34, paddingTop: 4 }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 4, transform: 'rotate(-25deg)' }}>
            <button
              type="button" onClick={toggleMic} disabled={micBusy}
              aria-pressed={micOn} aria-label={micOn ? '마이크 끄기 (START)' : '마이크 켜기 (START)'}
              style={{ ...pillBtn, opacity: micBusy ? 0.6 : 1 }}
            >
              <span style={{ ...pillDot, background: micOn ? GBC.green : '#26242b' }} />
            </button>
            <span style={pillLabel}>START</span>
          </div>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 4, transform: 'rotate(-25deg)' }}>
            <button
              type="button" onClick={() => setPetMenuOpen((v) => !v)}
              aria-haspopup="true" aria-expanded={petMenuOpen} aria-label="펫 선택 (SELECT)"
              style={pillBtn}
            >
              <span style={{ ...pillDot, background: '#26242b' }} />
            </button>
            <span style={pillLabel}>SELECT</span>
          </div>

          {/* 펫 선택 팝오버 (SELECT 위로) */}
          {petMenuOpen && (
            <>
              <div onClick={() => setPetMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div
                role="menu"
                style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', right: 8, zIndex: 41,
                  display: 'flex', gap: 6, padding: 8,
                  background: GBC.cream, color: GBC.ink, fontFamily: GBC.font,
                  border: `3px solid ${GBC.border}`, borderRadius: 2,
                  boxShadow: `inset 0 0 0 2px ${GBC.creamHi}, ${GBC.shadow}`,
                }}
              >
                {PET_SPECIES.map((p) => (
                  <button
                    key={p.key} type="button" role="menuitemradio"
                    aria-checked={p.key === petKey} aria-label={p.name} title={p.name}
                    onClick={() => choosePet(p.key)}
                    style={{
                      fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer',
                      background: p.key === petKey ? GBC.creamHi : 'transparent',
                      border: p.key === petKey ? `2px solid ${GBC.green}` : '2px solid transparent',
                      borderRadius: 2, padding: '4px 6px',
                    }}
                  >
                    {p.emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 스피커 그릴 — 점 패턴(대각). */}
        <div style={{
          alignSelf: 'flex-end', display: 'grid',
          gridTemplateColumns: 'repeat(4, 5px)', gridTemplateRows: 'repeat(4, 5px)', gap: 4,
          transform: 'rotate(-18deg)', opacity: 0.5, marginRight: 10, marginTop: 2,
        }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a4750', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.6)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
