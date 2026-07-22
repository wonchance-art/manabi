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
import { overworldRegionAirSpawn } from '../lib/world/overworldRegions';
import { createVoiceMesh } from '../lib/world/voice';
import { createVoiceUnreachableNotifier } from '../lib/world/voiceNotify';
import { createWorldChat } from '../lib/world/chat';
import { getMuted, isMuted, toggleMute, onChange as onMuteChange } from '../lib/world/muteStore';
import { isPersistablePosition, normalizePositionScene } from '../lib/world/session';
import { cultureChapterHref, frenchChapterHref, trackChapterHref, readingTextHref } from '../components/world/cultureDoors';
// 도트 폰트(Galmuri9) @font-face — /world 라우트 전용 client 컴포넌트에서만 로드된다.
import './galmuri9.css';
import {
  PET_SPECIES,
  getPetChoice,
  setPetChoice,
  derivePetState,
  fetchPetInputs,
} from '../lib/world/pet';
import { DEFAULT_AVATAR, loadWorldAvatar, saveWorldAvatar } from '../lib/world/avatar';

const TILE = 32;             // GameCanvas와 동일 — peers:dist(px)→타일 변환에 사용
const PEER_STALE_MS = 10000; // 이 시간 넘게 소식 없는 peer는 유령으로 보고 정리

// GBC 다이얼로그 문법 토큰 — 월드 미니바·펫 팝오버를 캔버스 오버레이와 통일한다.
// (동적 청크 분리 유지를 위해 QuestReview.jsx를 import하지 않고 동일 팔레트 값만 복제.)
const GBC = {
  cream: '#f6edcf', creamHi: '#fffaf0', creamShade: '#e4d5a6', ink: '#2a2118',
  inkSoft: '#5a4b38',
  border: '#2a2118', green: '#5f9a46', red: '#c14b38', brown: '#8a5a2b',
  // 도트 폰트 우선(Galmuri9, galmuri9.css @font-face) → 월드 내 모든 대화창·게이트·팝오버·채팅이
  // 즉시 도트 폰트가 된다. 미로드 창엔 기존 모노스페이스 폴백.
  font: '"Galmuri9", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
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
// onHoldStart/onHoldEnd(선택) — B 버튼 홀드 달리기용. pointerdown→Start, up/leave/cancel→End.
// onClick(탭 취소)은 pointerup 뒤에 발생하므로, 홀드 종료 후에도 기존 탭 동작과 충돌하지 않는다.
function AbButton({ label, ariaLabel, onClick, base, style, onHoldStart, onHoldEnd }) {
  const [on, setOn] = useState(false);
  const off = () => { setOn(false); onHoldEnd?.(); };
  return (
    <button
      type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => { setOn(true); onHoldStart?.(); }}
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

// 멀티 전용 게이트 차단 화면(오너 요구 1) — GameCanvas 대신 화면 영역(inset:0)을 채운다.
// status 별 안내 + (해당 시) 재시도 버튼. 연결 중·재연결·스폰 조회 중은 스피너만(자동 진행).
function WorldGate({ status, reason, spawnLoading, onRetry, retrying }) {
  const COPY = {
    duplicate: { icon: '🔒', title: '이미 접속 중이에요', body: '다른 기기나 탭에서 학습 월드에 접속 중이에요. 그쪽을 닫고 다시 시도해 주세요.' },
    'lease-error': { icon: '⚠️', title: '잠시 확인이 필요해요', body: '지금은 멀티 접속을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.' },
    failed: { icon: '📡', title: '연결하지 못했어요', body: '멀티 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.' },
  };
  // duplicate 는 net 이 info.reason 으로 계정/IP 를 구분해 준다(하위호환: reason 없으면 일반 문구).
  // 'duplicate-ip' 문구는 하위호환용으로 남겨둔다 — 현재 IP 동시접속 차단은 해제됐지만(같은 IP 허용),
  // 미래에 IP 차단을 재활성하면(claim_world_session_v2 에 duplicate-ip 복원) 이 문구가 다시 쓰인다.
  const DUP_COPY = {
    'duplicate-account': COPY.duplicate,
    'duplicate-ip': { icon: '🔒', title: '같은 네트워크에서 접속 중이에요', body: '같은 인터넷(IP)에서 이미 다른 접속이 있어요. 그쪽이 끝난 뒤 다시 시도해 주세요.' },
  };
  // spawn 조회 중이거나 connected 전이라 아직 gate 사유가 없으면(연결 중/재연결) 스피너만.
  const info = spawnLoading ? null : (status === 'duplicate' && DUP_COPY[reason]) || COPY[status];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16, background: SHELL.screenOff }}>
      <div style={{ maxWidth: 260, textAlign: 'center', color: '#cfc7bb', fontFamily: GBC.font }}>
        {info ? (
          <>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>{info.icon}</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>{info.title}</div>
            <p style={{ fontSize: '0.68rem', lineHeight: 1.5, opacity: 0.85, marginBottom: 14 }}>{info.body}</p>
            <Button size="sm" variant="secondary" onClick={onRetry} disabled={retrying}>
              {retrying ? '확인 중…' : '다시 시도'}
            </Button>
          </>
        ) : (
          <>
            <Spinner />
            <p style={{ fontSize: '0.68rem', lineHeight: 1.5, opacity: 0.85, marginTop: 12 }}>멀티 접속을 준비하고 있어요…</p>
          </>
        )}
      </div>
    </div>
  );
}

// 펫 기분 → 한 줄 카피(내부 용어 금지, 따뜻한 톤).
const MOOD_LINE = {
  excited: '오늘도 신나게 공부했어요',
  happy: '함께 있으니 즐거워요',
  sleepy: '오늘 공부하면 더 신나요',
};

const CHAT_LOG_MAX = 50; // 세션 로그 보관 상한(펼침 스크롤에 보이는 최근 개수)

// 신고 사유 — world_reports.reason 에 저장되는 값(코드)과 사용자에게 보이는 라벨.
// 3지선다(스팸/욕설 · 부적절한 이름 · 기타)로 단순하게. reason 코드는 마이그레이션·관리 열람과 공유.
const REPORT_REASONS = [
  { code: 'spam_abuse', label: '스팸·욕설' },
  { code: 'bad_name', label: '부적절한 이름' },
  { code: 'other', label: '기타' },
];

// ── 포켓몬 대화창풍 도트 채팅 박스 ──
// 평상시 = 한 칸(최근 메시지, 타자기 효과 + 대기 ▼). 탭하면 아래로 로그(최근 ~50)가 펼쳐진다.
// 이중 테두리·크림 배경·잉크 텍스트(기존 GBC 다이얼로그 문법 재사용) + 도트 폰트(GBC.font=Galmuri9).
// 모듈 스코프 컴포넌트 — 부모 리렌더로 리마운트되지 않아 입력 focus·타자기 상태가 유지된다.
function WorldChatBox({ messages, selfId, status, guest = false, expanded, onToggle, inputValue, onInputChange, onSubmit, inputRef }) {
  const latest = messages.length ? messages[messages.length - 1] : null;
  const [shown, setShown] = useState(0);
  const logRef = useRef(null);

  // ① 타자기 효과 — 최신 메시지를 글자 하나씩(~30ms/자) 드러낸다.
  useEffect(() => {
    if (!latest) { setShown(0); return undefined; }
    setShown(0);
    let i = 0;
    const total = latest.text.length;
    const t = setInterval(() => {
      i += 1; setShown(i);
      if (i >= total) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [latest ? latest.id : null]);

  // 펼침·새 메시지 시 로그를 맨 아래로 스크롤.
  useEffect(() => {
    if (expanded && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [expanded, messages.length]);

  const typing = !!latest && shown < latest.text.length;
  const shownText = latest ? latest.text.slice(0, shown) : '';

  // ④ 이중 테두리(포켓몬 4세대풍) — 바깥 잉크 + 안쪽 크림 링 + 다시 잉크 링.
  const panel = {
    position: 'relative',
    background: GBC.cream, color: GBC.ink, fontFamily: GBC.font,
    border: `3px solid ${GBC.border}`, borderRadius: 6,
    boxShadow: `inset 0 0 0 2px ${GBC.creamHi}, inset 0 0 0 4px ${GBC.border}, ${GBC.shadow}`,
  };
  // ③ 화자명은 「이름」 스타일로 본문 앞에.
  const speaker = { fontWeight: 700, marginRight: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* 대화창 한 칸 — 탭/Enter로 아래 로그 펼침/접기 */}
      <div
        role="button" tabIndex={0} aria-expanded={expanded}
        aria-label={expanded ? '채팅 로그 접기' : '채팅 로그 펼치기'}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{ ...panel, cursor: 'pointer', minHeight: 46, padding: '10px 12px', fontSize: '0.72rem', lineHeight: 1.5 }}
      >
        {latest ? (
          <span>
            <span style={{ ...speaker, color: latest.userId === selfId ? GBC.green : GBC.brown }}>「{latest.name}」</span>
            {shownText}
          </span>
        ) : (
          <span style={{ color: GBC.inkSoft }}>
            {guest ? '로그인하면 여기서 만난 사람과 이야기할 수 있어요.' : status === 'connected' ? '여기서 만난 사람과 이야기해 보세요.' : '연결 중…'}
          </span>
        )}
        {/* ② 대기 중 우하단 깜빡이는 ▼ (타자기 끝 + 접힌 상태) */}
        {latest && !typing && !expanded && (
          <span style={{ position: 'absolute', right: 9, bottom: 6, fontSize: '0.6rem', animation: 'worldChatBlink 1s steps(1) infinite' }}>▼</span>
        )}
      </div>

      {/* 펼침 — 아래로 확장되는 로그 스크롤(최근 ~50) + 접기 */}
      {expanded && (
        <div style={{ ...panel, padding: '8px 10px' }}>
          <div ref={logRef} style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.68rem', lineHeight: 1.5 }}>
            {messages.length === 0 ? (
              <span style={{ color: GBC.inkSoft }}>아직 대화가 없어요.</span>
            ) : messages.map((m) => (
              <div key={m.id}>
                <span style={{ ...speaker, color: m.userId === selfId ? GBC.green : GBC.brown }}>「{m.name}」</span>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              type="button" onClick={onToggle}
              style={{ fontFamily: GBC.font, fontSize: '0.62rem', color: GBC.inkSoft, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
            >▲ 접기</button>
          </div>
        </div>
      )}

      {/* 입력 한 줄 + 전송 (입력 필드도 Galmuri) */}
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          maxLength={120}
          enterKeyHint="send"
          aria-label="채팅 메시지 입력"
          placeholder={guest ? '로그인 후 이용할 수 있어요' : status === 'connected' ? '메시지 입력…' : '연결 중…'}
          disabled={guest}
          style={{
            flex: 1, minWidth: 0, fontFamily: GBC.font, fontSize: '0.72rem', color: GBC.ink,
            background: GBC.creamHi, border: `2px solid ${GBC.border}`, borderRadius: 4, padding: '9px 10px',
          }}
        />
        <button
          type="submit" aria-label="전송"
          style={{
            fontFamily: GBC.font, fontWeight: 700, fontSize: '0.7rem', color: GBC.creamHi,
            background: GBC.green, border: `2px solid ${GBC.border}`, borderRadius: 4, padding: '0 14px', cursor: 'pointer',
          }}
        >전송</button>
      </form>
    </div>
  );
}

// ── 근처 사람 패널 (presence 기반) ──
// "👥 근처 N명" 버튼으로 여닫는 GBC 도트 패널. 각 행 = 닉네임 + [🔇 음소거] + [🚩 신고].
// 음소거는 muteStore(채팅 수신 드랍) + voice.mutePeer(있으면 음성까지) 를 부모가 배선한다.
// 신고는 사유 3지선다 → onReport(Promise<bool>) → 성공 시 도트 토스트("접수됐어요").
// 모듈 스코프 — 부모 리렌더로 리마운트되지 않아 사유 선택·접수 알림 상태가 유지된다.
function NearPeoplePanel({ peers, selfId, mutedSet, onToggleMute, onReport }) {
  const [reportFor, setReportFor] = useState(null); // 사유 선택이 열린 대상 id
  const [notice, setNotice] = useState(null);       // 도트 토스트 문구(자동 소멸)
  const noticeTimer = useRef(null);
  const mountedRef = useRef(true);                   // 비동기 신고 in-flight 중 언마운트 가드(P2-2)

  // 언마운트(패널 접힘) 시: mounted 플래그 내림 + 소멸 타이머 정리. strict-mode 재마운트도 안전하게 true 복원.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);

  // peers 변경으로 사유 선택 중이던 대상이 근처에서 사라지면 열린 선택지를 닫는다(상태 누수 방지, P2-2 ①).
  useEffect(() => {
    if (reportFor && !peers.some((p) => p.id === reportFor)) setReportFor(null);
  }, [peers, reportFor]);

  const flash = (msg) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  };

  const pickReason = async (targetId, reason) => {
    setReportFor(null);
    const ok = await onReport(targetId, reason);
    if (!mountedRef.current) return; // 응답 도착 전 패널이 닫혔으면 setState/flash 스킵(P2-2 ②)
    flash(ok ? '🚩 접수됐어요. 살펴볼게요.' : '⚠️ 접수하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  };

  // 나를 뺀 근처 사람들(신고·뮤트 대상은 타인만).
  const others = peers.filter((p) => p.id && p.id !== selfId);

  const panel = {
    background: GBC.cream, color: GBC.ink, fontFamily: GBC.font,
    border: `3px solid ${GBC.border}`, borderRadius: 6,
    boxShadow: `inset 0 0 0 2px ${GBC.creamHi}, inset 0 0 0 4px ${GBC.border}, ${GBC.shadow}`,
    padding: '8px 10px',
  };
  const chip = {
    fontFamily: GBC.font, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
    border: `2px solid ${GBC.border}`, borderRadius: 4, padding: '3px 6px', lineHeight: 1,
    background: GBC.creamHi, color: GBC.ink,
  };

  return (
    <div style={panel} role="region" aria-label="근처 사람">
      {notice && (
        <div style={{
          marginBottom: 6, fontSize: '0.62rem', fontWeight: 700, color: GBC.ink,
          background: GBC.creamShade, border: `2px solid ${GBC.border}`, borderRadius: 4, padding: '5px 7px',
        }}>
          {notice}
        </div>
      )}
      {others.length === 0 ? (
        <span style={{ fontSize: '0.66rem', color: GBC.inkSoft }}>아직 근처에 아무도 없어요.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 168, overflowY: 'auto' }}>
          {others.map((p) => {
            const muted = mutedSet.has(p.id);
            const picking = reportFor === p.id;
            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: muted ? 0.5 : 1 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    「{p.name || '익명'}」{muted && <span style={{ fontSize: '0.58rem', color: GBC.inkSoft }}> · 음소거됨</span>}
                  </span>
                  <button
                    type="button"
                    aria-pressed={muted}
                    aria-label={muted ? `${p.name || '익명'} 음소거 해제` : `${p.name || '익명'} 음소거`}
                    onClick={() => onToggleMute(p.id)}
                    style={{ ...chip, background: muted ? GBC.red : GBC.creamHi, color: muted ? GBC.creamHi : GBC.ink }}
                  >🔇</button>
                  <button
                    type="button"
                    aria-label={`${p.name || '익명'} 신고`}
                    onClick={() => setReportFor(picking ? null : p.id)}
                    style={{ ...chip, background: picking ? GBC.creamShade : GBC.creamHi }}
                  >🚩</button>
                </div>
                {/* 사유 3지선다 — 고르면 즉시 접수 */}
                {picking && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r.code} type="button"
                        onClick={() => pickReason(p.id, r.code)}
                        style={{ ...chip, background: GBC.creamHi, fontWeight: 500 }}
                      >{r.label}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WorldPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const userId = user?.id || null;
  // dev 전용 게스트 열람(오너 지시 2026-07-22 — 라이브 검수·게스트 모드 사전 검증).
  // 프로덕션 빌드에서는 항상 꺼진다. 멀티 전용 원칙(오너 요구 1)은 제품 경로에서 불변 —
  // dev 게스트만 오프라인 단독 입장으로 단락한다(스폰 기본·저장/스탬프는 조용히 실패).
  const devGuest = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_WORLD_DEV_GUEST === '1';
  // dev 게스트 전용 스폰 오버라이드(검수 하니스): ?spawn=air:emea | city:lyon | overworld:emea@512,300
  // 제품 경로(로그인 유저)는 절대 타지 않는다 — devGuest 분기에서만 호출.
  const parseDevGuestSpawn = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = new URLSearchParams(window.location.search).get('spawn');
      if (!raw) return null;
      const [scenePart, xy] = raw.split('@');
      if (scenePart.startsWith('air:')) return overworldRegionAirSpawn(scenePart.slice(4));
      if (!scenePart.includes(':')) return null;
      const [x, y] = (xy || '').split(',').map(Number);
      return Number.isFinite(x) && Number.isFinite(y) ? { scene: scenePart, x, y } : { scene: scenePart };
    } catch { return null; }
  };
  const nickname = profile?.display_name || '나';

  // ── 펫 상태 ──
  // petKey는 localStorage 값이라 마운트 후에만 읽는다(SSR 안전 — 초기엔 기본 dog).
  const [petKey, setPetKey] = useState(PET_SPECIES[0].key);
  const [petState, setPetState] = useState({ level: 1, xp: 0, xpToNext: 10, mood: 'happy' });
  const [petMenuOpen, setPetMenuOpen] = useState(false);
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const avatarRef = useRef(DEFAULT_AVATAR);

  // ── 음성 UI 상태 ──
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [nearVoiceCount, setNearVoiceCount] = useState(0);

  // ── 도트 채팅 상태 (net.js 무접촉 — 자체 world-chat 채널) ──
  const [chatMessages, setChatMessages] = useState([]);     // 세션 로그(최근 CHAT_LOG_MAX개)
  const [chatStatus, setChatStatus] = useState('connecting'); // 'connecting' | 'connected'
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatRef = useRef(null);
  const chatInputRef = useRef(null);

  // ── 근처 사람 패널 + 뮤트 상태 ──
  // peers: presence 기반 근처 사람 목록({id,name}) — net.onPeers 수신분에서 추출.
  // mutedIds: muteStore 영속 뮤트 목록(로컬) — onChange 구독으로 라이브 반영.
  const [peers, setPeers] = useState([]);
  const [peoplePanelOpen, setPeoplePanelOpen] = useState(false);
  const [mutedIds, setMutedIds] = useState(() => getMuted());
  const mutedSet = useMemo(() => new Set(mutedIds), [mutedIds]);

  // ── 멀티 접속 상태 (멀티 전용 게이트) ──
  // 오너 요구 1: 멀티로만 작동 — 임대 실패/미연결 시 솔로 폴백이 아니라 월드(GameCanvas) 자체를
  // 렌더하지 않고 차단 화면을 보인다. net.onStatus 가 주는 상태값만으로 판단(net.js 무변경).
  //   'connecting'(초기·아직 판정 전) | 'connected'(멀티 정상 — 유일한 입장 허용 상태) |
  //   'duplicate'(다른 기기/탭 접속 중) | 'lease-error'(임대 판정 불가) |
  //   'failed'(멀티 서버 연결 실패) | 'reconnecting'(재연결 중).
  const [worldStatus, setWorldStatus] = useState('connecting');
  const [worldStatusReason, setWorldStatusReason] = useState(null); // duplicate-account | duplicate-ip | null
  // 중복 접속 판정 방식: 'lease'(world_sessions 서버 권위) | 'presence'(마이그레이션
  // 미적용 강등 — UX 가드). 강등일 때만 상태줄에 작은 표기(과하지 않게 — 툴팁 수준).
  const [worldGuard, setWorldGuard] = useState(null);
  // "다시 시도" 재판정(join) 진행 중 — 버튼 비활성화로 연타(중복 claim 발사)를 막는다(P2-4).
  const [worldRetrying, setWorldRetrying] = useState(false);

  // ── 재접속 스폰 좌표 ──
  // 오너 요구 3: 재접속 시 나간 자리에서 스폰. 입장 시 GET /api/world/position 으로 본인 마지막
  // 좌표를 받아 GameCanvas initialSpawn 으로 넘긴다. undefined=조회 중(월드 렌더 보류),
  // null=저장 없음(기본 서울), { scene, x, y }=그 자리 스폰.
  const [worldSpawn, setWorldSpawn] = useState(undefined);
  // 실시간 최근 좌표(타일) — local:state 수신마다 갱신. 주기 저장·beacon·재연결 재스폰의 원천.
  const livePosRef = useRef(null);

  // GBC 셸 → GameCanvas 입력 주입 핸들. GameCanvas가 마운트 시 { press,release,interact,cancel }를 채운다.
  const controlsRef = useRef(null);
  const press = useCallback((d) => controlsRef.current?.press(d), []);
  const release = useCallback((d) => controlsRef.current?.release(d), []);
  const interact = useCallback(() => controlsRef.current?.interact(), []);
  const cancel = useCallback(() => controlsRef.current?.cancel(), []);
  const openCultureChapter = useCallback((chapter, track) => {
    // track 명시 도어 우선(영어·프랑스어 동형 슬러그 구분) → 레거시 폴백(일본어→프랑스어, 상호 배타).
    const href = (track ? trackChapterHref(track, chapter) : null)
      ?? cultureChapterHref(chapter) ?? frenchChapterHref(chapter);
    if (href) router.push(href);
  }, [router]);
  const openReadingText = useCallback((reading) => {
    const href = readingTextHref(reading);
    if (href) router.push(href);
  }, [router]);
  const openDictionary = useCallback(() => router.push('/vocab'), [router]);
  const applyAvatar = useCallback((next) => {
    const saved = saveWorldAvatar(next);
    avatarRef.current = saved;
    setAvatar(saved);
  }, []);
  // B 홀드 → 달리기(씬 플래그). 탭(짧게)의 취소 동작은 onClick=cancel 이 그대로 유지한다.
  const runOn = useCallback(() => controlsRef.current?.runOn?.(), []);
  const runOff = useCallback(() => controlsRef.current?.runOff?.(), []);

  // 네트워크·음성 인스턴스(마운트 1회 생성) — 이벤트 핸들러가 참조.
  const voiceRef = useRef(null);
  const netRef = useRef(null); // 중복 접속 배너의 "다시 시도" 버튼이 net.join()을 재호출하는 데 씀.
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
    const savedAvatar = loadWorldAvatar();
    avatarRef.current = savedAvatar;
    setAvatar(savedAvatar);
  }, []);

  // 뮤트 목록 구독 — 등록 즉시 현재값 1회 통지 + 이후 토글마다 갱신(패널 재렌더용).
  useEffect(() => onMuteChange(setMutedIds), []);

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
    if (!userId) {
      // dev 게스트: 멀티·스폰 조회를 건너뛰고 오프라인 단독 입장(연결 상태 단락).
      if (devGuest) { setWorldStatus('connected'); setWorldSpawn(parseDevGuestSpawn()); }
      return undefined;
    }
    let cancelled = false;

    const { name, pet: petEmoji } = identityRef.current;
    const net = createWorldNet({ userId, name, pet: petEmoji });
    netRef.current = net;
    const voice = createVoiceMesh({
      selfId: userId,
      sendSignal: net.sendSignal,
      onSignal: net.onSignal,
    });
    voiceRef.current = voice;

    // ── 영속 뮤트 → voice 동기화(P1-3) ──
    // 재접속(voice 재생성) 직후 저장된 뮤트를 voice 에 seed 하고, 이후 토글도 이 구독으로 일원화한다.
    // (구독이 muteStore 변경마다 diff 를 voice 에 반영하므로, 패널 토글의 직접 호출은 불필요해졌다.)
    // mutePeer 는 멱등이라 아직 연결 안 된 상대여도 안전(연결 시 저장된 뮤트 상태로 재생 볼륨이 결정됨).
    getMuted().forEach((id) => voice.mutePeer?.(id, true));
    let prevMuted = new Set(getMuted());
    const unsubscribeMute = onMuteChange((ids) => {
      const next = new Set(ids);
      for (const id of next) if (!prevMuted.has(id)) voice.mutePeer?.(id, true);
      for (const id of prevMuted) if (!next.has(id)) voice.mutePeer?.(id, false);
      prevMuted = next;
    });

    // 같은 계정의 다른 세션이 이미 접속 중이면 net이 스스로 멀티를 포기(솔로 유지)하고
    // 'duplicate'를 알려온다 — 배너로 안내하고, 그 외 상태(connected 등)에서는 배너를 접는다.
    // connected 의 info.enforcement 로 판정 방식(서버 임대/강등 휴리스틱)도 함께 받는다.
    net.onStatus((s, info) => {
      if (cancelled) return;
      setWorldStatus(s);
      // duplicate 사유(계정/IP) — 차단 화면 문구 분기용. 그 외 상태에선 초기화.
      setWorldStatusReason(s === 'duplicate' ? info?.reason || null : null);
      if (s === 'connected') setWorldGuard(info?.enforcement || null);
    });

    // net이 준 원격 목록(Map<id,{x,y,dir,name,pet,at}>)의 최신본 — stale 정리용.
    let latestPeers = new Map();

    // net 형식 → GameCanvas 계약(peers:update) 형식으로 변환하며 stale(>10s) 제거.
    const emitPeers = (map) => {
      latestPeers = map;
      const now = Date.now();
      const out = new Map();
      for (const [id, p] of map) {
        if (p.at && now - p.at > PEER_STALE_MS) continue; // 유령 제외
        // scene — 씬별 피어 렌더 필터(플라자/공항)용. net(Codex) 수신부가 보존한 값을 그대로
        // 전파하고, 없으면 undefined(수신측 (p.scene||'plaza') 하위호환 규칙이 처리).
        out.set(id, { x: p.x, y: p.y, dir: p.dir, emoji: p.pet, nick: p.name, scene: p.scene, avatar: p.avatar });
      }
      bus.emit('peers:update', out);
      // 근처 사람 패널용 목록({id,name}) — GameCanvas 계약과 별개로 React 상태에도 반영.
      setPeers(Array.from(out, ([id, p]) => ({ id, name: p.nick })));
    };

    net.onPeers((map) => { if (!cancelled) emitPeers(map); });
    net.onPeerLeft((id) => { voice.removePeer(id); });

    // 내 위치 → net 송신.
    const onLocalState = (st) => net.sendState({ ...st, avatar: avatarRef.current });
    bus.on('local:state', onLocalState);

    // 거리(px) → 타일(/TILE) → 음성 근접 게이팅.
    const onDist = (dists) => {
      if (!dists) return;
      for (const id in dists) voice.setPeerDistance(id, dists[id] / TILE);
    };
    bus.on('peers:dist', onDist);

    // 마이크·연결 상태 표출. voice-unreachable(대칭형 NAT 등 ICE 실패)은 마이크 on/off와
    // 무관하게 1회 토스트로 안내하고 채팅으로 유도한다 — 수신 전용(listener-only) 경로도
    // ICE 실패를 겪으므로 status 자체로 판정(voiceNotify 상태기, 회복 시 재무장).
    const shouldNotifyVoiceUnreachable = createVoiceUnreachableNotifier();
    voice.onStatus(({ micOn: on, peers, status }) => {
      if (cancelled) return;
      setMicOn(on);
      setNearVoiceCount(peers.filter((p) => p.connected).length);
      if (shouldNotifyVoiceUnreachable(status)) {
        toast('지금 네트워크에서는 음성이 안 닿아요. 채팅으로 이야기해 보세요!', 'info');
      }
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
      unsubscribeMute();
      bus.off('local:state', onLocalState);
      bus.off('peers:dist', onDist);
      net.leave();
      voice.destroy();
      voiceRef.current = null;
      netRef.current = null;
      setMicOn(false);
      setNearVoiceCount(0);
      setPeers([]);
      setWorldStatus('connecting');
      setWorldGuard(null);
      setWorldRetrying(false);
      bus.emit('peers:update', new Map()); // 남은 원격 캐릭터 정리
    };
  }, [userId]);

  // ── 도트 채팅 배선 (net.js·voice 와 독립 — 자체 world-chat 채널) ──
  // 수신·로컬 에코 메시지를 세션 로그에 쌓고(최근 CHAT_LOG_MAX), 각 메시지를 bus 'chat:msg'로
  // 흘려 GameCanvas 가 해당 캐릭터 위에 도트 말풍선을 띄우게 한다. 연결 실패는 조용히(status만).
  // (닉네임 확정 시 채널을 다시 열지만, 그 시점 로그는 비어 있어 사용자에겐 무해하다.)
  useEffect(() => {
    if (!userId) return undefined;
    // isMuted 주입 — 수신 broadcast 에서 뮤트한 상대의 메시지를 드랍(로그·말풍선까지 차단).
    // muteStore.isMuted 는 매 수신 시 최신 localStorage 를 읽으므로 뮤트 토글이 즉시 반영된다.
    const chat = createWorldChat({ client: supabase, userId, name: nickname, isMuted });
    chatRef.current = chat;
    chat.onMessage((m) => {
      setChatMessages((prev) => {
        const next = [...prev, m];
        return next.length > CHAT_LOG_MAX ? next.slice(next.length - CHAT_LOG_MAX) : next;
      });
      bus.emit('chat:msg', m);
    });
    chat.onStatus((s) => setChatStatus(s));
    return () => {
      chat.leave();
      chatRef.current = null;
      setChatMessages([]);
      setChatStatus('connecting');
      setChatInput('');
    };
  }, [userId, nickname]);

  // 전송 — 성공 시에만 입력을 비우고(스로틀 거부 시 입력 유지), 전송 후 focus 를 유지한다.
  const onChatSubmit = useCallback((e) => {
    e?.preventDefault?.();
    const sent = chatRef.current?.send(chatInput);
    if (sent) setChatInput('');
    chatInputRef.current?.focus();
  }, [chatInput]);

  // ── 근처 사람: 음소거 토글 + 신고 ──
  // 음소거: muteStore 영속(채팅 수신 드랍)만 여기서 토글한다. 근접 음성 반영(voice.mutePeer)은
  //   voice effect 의 onMuteChange 구독으로 일원화돼(P1-3), 이 토글도 그 구독을 거쳐 voice 에 닿는다.
  const onToggleMutePeer = useCallback((id) => {
    toggleMute(id);
  }, []);

  // 신고: world_reports 에 사용자 세션 클라이언트로 직접 insert(RLS 방어 — reporter=auth.uid()).
  //   같은 (reporter,target,reason) 재신고는 ignoreDuplicates(ON CONFLICT DO NOTHING)로 무해화한다.
  //   (테이블에 UPDATE 정책이 없어 — 신고는 불변 로그 — DO UPDATE 대신 DO NOTHING 이어야 한다.)
  //   반환: 성공 여부(중복 무시도 에러 아님 → true).
  const onReportPeer = useCallback(async (targetId, reason) => {
    if (!userId || !targetId) return false;
    try {
      const { error } = await supabase
        .from('world_reports')
        .upsert(
          { reporter: userId, target: targetId, reason },
          { onConflict: 'reporter,target,reason', ignoreDuplicates: true },
        );
      return !error;
    } catch {
      return false;
    }
  }, [userId]);

  // ── 재접속 스폰 좌표 조회 (입장 시 1회, userId별) ──
  // GET /api/world/position → 본인 마지막 좌표. 실패/없음이면 null(기본 서울 스폰).
  // 조회가 끝나야(undefined→null|obj) GameCanvas 를 렌더한다(create() 가 스폰을 1회 고정하므로).
  useEffect(() => {
    if (!userId) { if (!devGuest) setWorldSpawn(null); return undefined; }
    let cancelled = false;
    setWorldSpawn(undefined);
    livePosRef.current = null;
    fetch('/api/world/position', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setWorldSpawn(d?.position ?? null); })
      .catch(() => { if (!cancelled) setWorldSpawn(null); }); // 조회 실패는 조용히 — 기본 스폰
    return () => { cancelled = true; };
  }, [userId]);

  // ── 좌표 실시간 기록 → 주기 저장 + 이탈 시 최종 저장 ──
  // 오너 요구 3: bus 'local:state'(GameCanvas emit {x,y(px),dir,scene})를 받아 타일좌표로 바꿔
  // 최근 위치를 보관하고, 10초 스로틀로 POST(변했을 때만) + pagehide 는 sendBeacon + 언마운트 최종 저장.
  // 이 effect 는 userId 생애 동안 살아 있어(재연결로 GameCanvas 가 잠깐 언마운트돼도) 최근 좌표를 유지한다.
  useEffect(() => {
    if (!userId) return undefined;
    let lastSentAt = 0;
    let lastSentKey = '';

    const bodyOf = (p) => JSON.stringify({ scene: p.scene, x: p.x, y: p.y });
    const postPosition = (p) => {
      // keepalive — 탭 전환 직전 발사돼도 완주하게 한다. 실패는 조용히(스폰은 있으면 좋은 편의).
      fetch('/api/world/position', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: bodyOf(p), keepalive: true,
      }).catch(() => {});
    };
    const beaconPosition = (p) => {
      try {
        const ok = typeof navigator !== 'undefined' && navigator.sendBeacon
          && navigator.sendBeacon('/api/world/position', new Blob([bodyOf(p)], { type: 'application/json' }));
        if (!ok) postPosition(p);
      } catch { postPosition(p); }
    };

    const onLocalState = (st) => {
      // persistable 계약(session.js): 페리 항해·물 타일·공항 좌표(persistable:false)는 저장에서 제외한다.
      // livePosRef 갱신까지 스킵해 마지막 유효 플라자 좌표를 유지 → 재접속·재연결 재스폰·pagehide beacon
      // 모두 그 좌표를 쓴다(beacon 은 livePosRef.current 를 읽으므로 자동으로 동일하게 처리됨).
      if (!isPersistablePosition(st)) return;
      // 저장 씬 보존 — 도시 정밀맵과 횡단철도 플랫폼은 그대로 실어 재접속 스폰에 쓴다.
      // isPersistablePosition 이 공항·운행 중·알 수 없는 씬을 먼저 걸러낸다.
      const rawScene = typeof st.scene === 'string' ? st.scene : '';
      const scene = normalizePositionScene(rawScene);
      const x = Math.floor((st.x || 0) / TILE);
      const y = Math.floor((st.y || 0) / TILE);
      if (x < 0 || y < 0) return;
      const pos = { scene, x, y };
      livePosRef.current = pos;
      const now = Date.now();
      const key = `${scene}:${x}:${y}`;
      // 10초마다, 그리고 자리가 바뀌었을 때만 저장(정지 중 불필요한 왕복 억제).
      if (now - lastSentAt >= 10000 && key !== lastSentKey) {
        lastSentAt = now; lastSentKey = key;
        postPosition(pos);
      }
    };
    bus.on('local:state', onLocalState);

    const onHide = () => { if (livePosRef.current) beaconPosition(livePosRef.current); };
    window.addEventListener('pagehide', onHide);

    return () => {
      bus.off('local:state', onLocalState);
      window.removeEventListener('pagehide', onHide);
      if (livePosRef.current) beaconPosition(livePosRef.current); // 언마운트(이탈·계정 전환) 최종 저장
    };
  }, [userId]);

  // 중복 접속 배너의 "다시 시도" — net이 스스로 중복 판정을 다시 받도록 join()을 재호출한다.
  // (leave() 는 호출하지 않음 — leave 후엔 이 net 인스턴스가 영구히 재사용 불가해진다.)
  // 진행 중엔 버튼을 잠가 중복 claim 발사를 막는다(P2-4 — net 쪽 in-flight 가드와 이중 방어).
  const retryWorldNet = useCallback(() => {
    if (worldRetrying) return;
    setWorldRetrying(true);
    Promise.resolve(netRef.current?.join())
      .catch(() => {})
      .finally(() => setWorldRetrying(false));
  }, [worldRetrying]);

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

  // ── 게이트 ──
  // 학습 월드는 전체 로그인 유저에게 개방된다(오너 확정). 비로그인만 로그인 안내로 차단한다.
  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!user && !devGuest) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>로그인이 필요해요</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
          로그인하면 학습 월드에 들어올 수 있어요.
        </p>
        <Link href="/auth" className="btn btn--primary">로그인하기</Link>
      </div>
    );
  }

  const moodLine = MOOD_LINE[petState.mood] || MOOD_LINE.happy;

  // 멀티 전용 게이트(오너 요구 1): 멀티 정상 연결 + 스폰 좌표 조회 완료일 때만 월드를 연다.
  const worldReady = worldStatus === 'connected' && worldSpawn !== undefined;

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
          {/* 강등 모드(서버 임대 미적용 — presence 휴리스틱) 표기는 작게, 툴팁으로 부연만. */}
          {worldGuard === 'presence' && (
            <span
              title="중복 접속 확인이 간이 방식으로 동작 중이에요 (서버 확인 미적용)"
              style={{ opacity: 0.65, fontSize: '0.62rem' }}
            >
              {' '}· 간이 보호
            </span>
          )}
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
            {/* 멀티 전용 게이트(오너 요구 1): 멀티가 정상 연결(worldStatus==='connected')되고 스폰
                좌표 조회가 끝났을 때만 GameCanvas 를 렌더한다. 그 외(연결 중·중복·임대오류·연결실패)엔
                솔로 폴백 대신 차단 화면을 보인다 — 월드는 멀티로만 작동한다. */}
            {worldReady ? (
              /* 계정 전환 격리(P1-4): userId 기반 key 로 GameCanvas 를 remount 한다. 전환 시 진행 중
                 공항 스토리·AirportQuiz(미완료 문답)가 통째로 언마운트되어 폐기되므로, A 계정에서 시작한
                 문답이 B 계정으로 기록될 여지가 없다. 이 페이지의 net/voice 는 이미 userId effect 로
                 재배선되고, 캔버스 remount 는 침습이 이 한 줄 key 로 국한돼(GameCanvas 내부 상태 리셋
                 로직 불필요) 가장 단순하고 확실한 경계다.
                 initialSpawn: 재연결 재스폰은 최근 좌표(livePosRef) 우선, 최초 진입은 조회한 저장 좌표. */
              <GameCanvas
                key={userId || 'guest'}
                userId={userId}
                devGuest={devGuest}
                nickname={nickname}
                pet={pet}
                avatar={avatar}
                controlsRef={controlsRef}
                initialSpawn={livePosRef.current || worldSpawn || null}
                canAccessPreviewRegions={profile?.role === 'admin'}
                onOpenChapter={openCultureChapter}
                onOpenReading={profile?.role === 'admin' ? openReadingText : null}
                onOpenDictionary={openDictionary}
                onAvatarChange={applyAvatar}
              />
            ) : (
              <WorldGate status={worldStatus} reason={worldStatusReason} spawnLoading={worldSpawn === undefined} onRetry={retryWorldNet} retrying={worldRetrying} />
            )}
          </div>
        </div>

        {/* ── 근처 사람 (presence) — 👥 버튼으로 여닫는 도트 패널: 음소거·신고 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => setPeoplePanelOpen((v) => !v)}
            aria-expanded={peoplePanelOpen}
            aria-label={peoplePanelOpen ? '근처 사람 닫기' : '근처 사람 열기'}
            style={{
              alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: GBC.font, fontWeight: 700, fontSize: '0.64rem', color: GBC.ink,
              background: GBC.cream, border: `2px solid ${GBC.border}`, borderRadius: 4,
              padding: '5px 9px', cursor: 'pointer',
              boxShadow: `inset 0 0 0 2px ${GBC.creamHi}`,
            }}
          >
            👥 근처 {peers.filter((p) => p.id !== userId).length}명 {peoplePanelOpen ? '▲' : '▼'}
          </button>
          {peoplePanelOpen && (
            <NearPeoplePanel
              peers={peers}
              selfId={userId}
              mutedSet={mutedSet}
              onToggleMute={onToggleMutePeer}
              onReport={onReportPeer}
            />
          )}
        </div>

        {/* ── 포켓몬 대화창풍 도트 채팅 (게임 화면 바로 아래 · 십자키 위) ── */}
        {/* 평상시 한 칸 → 탭하면 아래로 로그가 펼쳐진다("현재 칸에서 아래로 확장"). */}
        <WorldChatBox
          messages={chatMessages}
          selfId={userId}
          status={chatStatus}
          guest={devGuest && !userId}
          expanded={chatExpanded}
          onToggle={() => setChatExpanded((v) => !v)}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onSubmit={onChatSubmit}
          inputRef={chatInputRef}
        />

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
              <AbButton label="B" ariaLabel="B (취소·닫기·홀드 달리기)" onClick={cancel} base={abBase} onHoldStart={runOn} onHoldEnd={runOff} />
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
