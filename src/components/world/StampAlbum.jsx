// 🗾 여행 스탬프 앨범 — 수집한 방문 기념 스탬프를 도트 감성 배지 케이스로 보여준다
// (포켓몬 배지 케이스 문법: 채운 칸은 아이콘+이름, 빈 칸은 흐린 물음표 실루엣).
//
// 시맨틱(GameCanvas 와 동일 register): 스탬프는 보안성 없는 "방문 기념" — 달성·증명·보상이 아니다.
//   서버(/api/world/stamps)는 실존 노드+본인만 검증하고 방문 여부는 검증하지 않는다(위조 가능).
//   그래서 문구는 "다녀온 곳의 기념" 톤을 유지한다(마스터플랜 A 지도 비전 "다녀온 사람은 추억하고").
//
// props:
//   stamps  : Set<nodeId>  — 라이브 수집 집합(GameCanvas 낙관 갱신 반영). 여부 판정은 이걸로.
//   onClose : () => void   — 닫기(B/ESC/버튼). GameCanvas 가 오버레이 열림 동안 A 입력을 잠근다.
//
// 방문 시각(at)만 마운트 시 GET /api/world/stamps 로 추가 조회해 각 배지에 날짜를 병기(여행 일지 감성).
//   수집 여부 자체는 라이브 stamps prop 을 신뢰 — 방금 찍은 스탬프도 즉시 채워 보인다.

import { useEffect, useState } from 'react';
import { GBC, gbcPanel, gbcButtonPrimary } from './QuestReview';
import { STAMP_ALBUM_NODES } from '../../lib/world/stampUniverse';
import { stampIcon, fmtDate } from './stampIcons';

export default function StampAlbum({ stamps, onClose }) {
  const owned = stamps instanceof Set ? stamps : new Set();
  const [visitedAt, setVisitedAt] = useState({}); // { nodeId: isoString }

  // 방문 시각(at)만 추가 조회 — 수집 여부는 라이브 stamps prop 사용(낙관 갱신 즉시 반영).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/world/stamps', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.stamps)) return;
        const m = {};
        for (const s of j.stamps) if (s && s.nodeId) m[s.nodeId] = s.at;
        setVisitedAt(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ESC 로도 닫기(셸 B 는 GameCanvas cancel 이 처리). 게임 입력은 열림 동안 GameCanvas 가 잠금.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = STAMP_ALBUM_NODES.length;
  const got = STAMP_ALBUM_NODES.reduce((n, node) => n + (owned.has(node.id) ? 1 : 0), 0);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center',
      background: 'rgba(11,13,8,0.62)', padding: 12,
    }}>
      <div style={{
        ...gbcPanel,
        boxShadow: `inset 0 0 0 2px ${GBC.creamHi}, inset 0 0 0 4px ${GBC.border}, ${GBC.shadow}`,
        width: 'min(94%, 460px)', maxHeight: '88%', display: 'flex', flexDirection: 'column',
        padding: '14px 14px 12px',
      }}>
        {/* 헤더 — 제목 + 수집 카운터 */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: GBC.font, fontWeight: 700, fontSize: '0.92rem', color: GBC.ink }}>🗾 여행 스탬프</span>
          <span style={{ fontFamily: GBC.font, fontSize: '0.82rem', color: GBC.brown }}>{got} / {total}</span>
        </div>

        {/* 배지 그리드 — 채운 칸: 아이콘+이름(+방문일), 빈 칸: 흐린 ❔ 실루엣 */}
        <div style={{
          overflowY: 'auto', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, paddingRight: 2,
        }}>
          {STAMP_ALBUM_NODES.map((node) => {
            const has = owned.has(node.id);
            return (
              <div
                key={node.id}
                title={has ? node.name : '아직 안 가 본 곳'}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '8px 4px 6px', borderRadius: 2, border: `2px solid ${GBC.border}`,
                  background: has ? GBC.creamHi : 'rgba(42,33,24,0.06)',
                  boxShadow: has ? `inset 0 0 0 1px ${GBC.creamHi}` : 'none',
                  opacity: has ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: '1.5rem', lineHeight: 1, filter: has ? 'none' : 'grayscale(1)' }}>
                  {has ? stampIcon(node) : '❔'}
                </span>
                <span style={{ fontFamily: GBC.font, fontSize: '0.6rem', color: GBC.ink, textAlign: 'center', lineHeight: 1.2 }}>
                  {has ? node.name : '？'}
                </span>
                {has && visitedAt[node.id] && (
                  <span style={{ fontFamily: GBC.font, fontSize: '0.5rem', color: GBC.inkSoft, lineHeight: 1 }}>
                    {fmtDate(visitedAt[node.id])}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 푸터 — 방문 기념 문구(달성 아님) + 닫기 */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontFamily: GBC.font, fontSize: '0.56rem', color: GBC.inkSoft, lineHeight: 1.4 }}>
            다녀온 곳의 방문 기념이에요.
          </span>
          <button type="button" onClick={onClose} style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}>닫기</button>
        </div>
      </div>
    </div>
  );
}
