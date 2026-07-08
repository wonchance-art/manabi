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
import { useEffect, useMemo, useRef, useState } from 'react';
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

  // 네트워크·음성 인스턴스(마운트 1회 생성) — 이벤트 핸들러가 참조.
  const voiceRef = useRef(null);

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
      .then((inputs) => { if (!cancelled) setPetState(derivePetState(inputs)); })
      .catch(() => {});
    return () => { cancelled = true; };
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

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── 상단 미니 바 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => router.back()}>← 뒤로</Button>
        <h1 className="page-header__title" style={{ margin: 0, fontSize: '1.25rem' }}>
          학습 월드 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>실험</span>
        </h1>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 펫 선택 팝오버 + 레벨·기분 한 줄 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setPetMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={petMenuOpen}
              aria-label="펫 바꾸기"
              style={{
                fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
                background: 'var(--bg-card, #fff)', border: '1px solid var(--border, rgba(0,0,0,0.12))',
                borderRadius: 10, padding: '4px 8px',
              }}
            >
              {species.emoji}
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Lv.{petState.level} · {moodLine}
            </span>

            {petMenuOpen && (
              <>
                {/* 바깥 클릭 닫기 */}
                <div
                  onClick={() => setPetMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div
                  role="menu"
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 41,
                    display: 'flex', gap: 6, padding: 8,
                    background: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border, rgba(0,0,0,0.12))', borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  }}
                >
                  {PET_SPECIES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={p.key === petKey}
                      aria-label={p.name}
                      title={p.name}
                      onClick={() => choosePet(p.key)}
                      style={{
                        fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer',
                        background: p.key === petKey ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent',
                        border: p.key === petKey ? '1px solid var(--brand, #6aa84f)' : '1px solid transparent',
                        borderRadius: 8, padding: '4px 6px',
                      }}
                    >
                      {p.emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 마이크 토글 (근접 음성) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={toggleMic}
              disabled={micBusy}
              aria-pressed={micOn}
              aria-label={micOn ? '마이크 끄기' : '마이크 켜기'}
              title={micOn ? '마이크 끄기' : '마이크 켜기'}
              style={{
                fontSize: '1.2rem', lineHeight: 1, cursor: micBusy ? 'default' : 'pointer',
                opacity: micBusy ? 0.6 : 1,
                background: micOn ? 'var(--brand, #6aa84f)' : 'var(--bg-card, #fff)',
                border: '1px solid var(--border, rgba(0,0,0,0.12))',
                borderRadius: 10, padding: '5px 9px',
                filter: micOn ? 'none' : 'grayscale(0.4)',
              }}
            >
              {micOn ? '🎤' : '🔇'}
            </button>
            {micOn && nearVoiceCount > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                근처 {nearVoiceCount}명과 연결됨
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 게임 캔버스 ── (부모가 높이를 정해줘야 Phaser RESIZE가 채운다) */}
      <div style={{
        width: '100%', height: 'min(72vh, 640px)',
        borderRadius: 12, overflow: 'hidden', background: '#bfe3b5',
        border: '1px solid var(--border)',
      }}>
        <GameCanvas nickname={nickname} pet={pet} />
      </div>
    </div>
  );
}
