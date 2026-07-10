'use client';

// 🗺️ 전체 맵 뷰어 (관리자 전용, 실험) — 학습 월드(WorldPage/GameCanvas)의 448×384 도트 맵을
// 캔버스 1장에 통짜로 그려 줌·팬으로 훑어보는 도구. 노드 배치·콘텐츠 마운트 계획용이라
// 게임 로직은 전혀 배선하지 않는다 — mapData.js는 읽기 전용 상수/함수로만 참조한다.
//
// worldNodes.js(장소 노드 데이터)가 입고되어 정적 import 로 배선한다 — 노드 마커는 그 좌표를 쓴다.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { MAP_W, MAP_H, decodeMap, TERRAIN } from '../components/world/mapData';
import { WORLD_NODES } from '../components/world/worldNodes';
import { unproject, isCoastTile, buildPlayableGrid } from '../lib/world/mapGeo';

// 타일당 화면 px — 줌 4단계(×1~×4, 2px 기준 정수 배).
const ZOOM_LEVELS = [2, 4, 6, 8];

// GBC 톤 — 잔디 그린(육지) · 모래(해안) · 바다 블루 + 신규 지형:
// 강·호수(청록 계열, 통행 가능 물) · DMZ 철조망(적갈) · 교량(다리 갈색)
// + 지형 질감: 산(짙은 녹) · 설산(회백) · 평야(밝은 황록).
const COLORS = {
  land: '#5f9a46', coast: '#dcc07f', sea: '#3c6e91',
  river: '#3fb0c4', lake: '#2f97b8', fence: '#a6432f', bridge: '#b07a3c',
  mountain: '#3a5c32', peak: '#c8cdd4', plain: '#9fc85a',
};

const FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

// 장소 노드(worldNodes) → 뷰어 마커 형태. tile:[x,y] → 화면 배치용 x/y.
const NODE_MARKERS = WORLD_NODES.map((n) => ({ id: n.id, name: n.name, x: n.tile[0], y: n.tile[1] }));

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// 화면(뷰포트) 공간에 10×9 격자를 그린다 — 오너가 "몇 화면"으로 사고하는 단위(GBC 화면 10:9 비율).
function drawScreenGrid(ctx, w, h) {
  const cols = 10, rows = 9;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 1;
  for (let c = 1; c < cols; c++) {
    const x = Math.round((w / cols) * c) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = Math.round((h / rows) * r) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.font = '9px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillText(`${r},${c}`, (w / cols) * c + 3, (h / rows) * r + 11);
    }
  }
  ctx.restore();
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

export default function WorldMapPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  // ── 오프스크린 비트맵(2px/타일, 448×384 → 896×768) — 격자 소스 바뀔 때 다시 그린다 ──
  // playable: GameCanvas 런타임·미니맵과 동일한 buildPlayableGrid(광장 SEA→LAND) 산출을 표시(P2-6).
  // raw: build-map.mjs 원본 격자(광장 메꿈 이전). 토글로 43타일 차이를 눈으로 확인할 수 있다.
  const bitmapRef = useRef(null);
  const [bitmapReady, setBitmapReady] = useState(false);
  const [showPlayable, setShowPlayable] = useState(true);

  useEffect(() => {
    setBitmapReady(false);
    const raw = decodeMap();
    const grid = showPlayable ? buildPlayableGrid(raw) : raw;
    const w = MAP_W * 2, h = MAP_H * 2;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const seaRgb = hexToRgb(COLORS.sea);
    const landRgb = hexToRgb(COLORS.land);
    const coastRgb = hexToRgb(COLORS.coast);
    const riverRgb = hexToRgb(COLORS.river);
    const lakeRgb = hexToRgb(COLORS.lake);
    const fenceRgb = hexToRgb(COLORS.fence);
    const bridgeRgb = hexToRgb(COLORS.bridge);
    const mountainRgb = hexToRgb(COLORS.mountain);
    const peakRgb = hexToRgb(COLORS.peak);
    const plainRgb = hexToRgb(COLORS.plain);
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const code = grid[ty * MAP_W + tx];
        let rgb;
        switch (code) {
          case TERRAIN.RIVER: rgb = riverRgb; break;
          case TERRAIN.LAKE: rgb = lakeRgb; break;
          case TERRAIN.FENCE: rgb = fenceRgb; break;
          case TERRAIN.BRIDGE: rgb = bridgeRgb; break;
          case TERRAIN.MOUNTAIN: rgb = mountainRgb; break;
          case TERRAIN.PEAK: rgb = peakRgb; break;
          case TERRAIN.PLAIN: rgb = plainRgb; break;
          case TERRAIN.LAND: rgb = isCoastTile(grid, tx, ty) ? coastRgb : landRgb; break;
          default: rgb = seaRgb; break; // SEA
        }
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((ty * 2 + dy) * w + (tx * 2 + dx)) * 4;
            data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    bitmapRef.current = off;
    setBitmapReady(true);
  }, [showPlayable]);

  // ── 노드 오버레이: worldNodes(장소 노드 시스템) 정적 배선. ──
  const nodes = NODE_MARKERS;

  // ── 뷰포트 크기(반응형) ──
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ w: Math.max(240, Math.round(cr.width)), h: Math.max(200, Math.round(cr.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 줌(정수 px/타일, 2~8) · 팬(offset, 화면 px) ──
  const [zoomIdx, setZoomIdx] = useState(0);
  const [offset, setOffset] = useState(null); // 최초 1회 중앙 정렬 후 세팅
  const [showGrid, setShowGrid] = useState(false);
  const [hover, setHover] = useState(null); // { tx, ty, lon, lat }

  useEffect(() => {
    if (offset) return;
    const pxPerTile = ZOOM_LEVELS[zoomIdx];
    setOffset({ x: (size.w - MAP_W * pxPerTile) / 2, y: (size.h - MAP_H * pxPerTile) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const zoomAt = useCallback((screenX, screenY, dir) => {
    setZoomIdx((prevIdx) => {
      const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, prevIdx + dir));
      if (nextIdx === prevIdx) return prevIdx;
      const oldScale = ZOOM_LEVELS[prevIdx] / 2;
      const newScale = ZOOM_LEVELS[nextIdx] / 2;
      setOffset((prevOffset) => {
        if (!prevOffset) return prevOffset;
        const ratio = newScale / oldScale;
        return {
          x: screenX - (screenX - prevOffset.x) * ratio,
          y: screenY - (screenY - prevOffset.y) * ratio,
        };
      });
      return nextIdx;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoomIdx(0);
    setOffset({ x: (size.w - MAP_W * 2) / 2, y: (size.h - MAP_H * 2) / 2 });
  }, [size]);

  // 휠 줌 — React onWheel은 기본 passive라 preventDefault가 무시되므로 수동 리스너로 배선.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY > 0 ? -1 : 1);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ── 마우스오버/탭 → 타일 좌표 + 위경도 역산 ──
  const updateHover = useCallback((mx, my) => {
    if (!offset) return;
    const scale = ZOOM_LEVELS[zoomIdx] / 2;
    const tx = Math.floor((mx - offset.x) / scale / 2);
    const ty = Math.floor((my - offset.y) / scale / 2);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    const { lon, lat } = unproject(tx, ty);
    setHover({ tx, ty, lon, lat });
  }, [offset, zoomIdx]);

  // ── 드래그 팬 (포인터 이벤트 — 마우스/터치 공용, 핀치 줌은 버튼 줌으로 갈음) ──
  const dragRef = useRef(null);
  const handlePointerDown = useCallback((e) => {
    try { canvasRef.current?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset, moved: false };
  }, [offset]);

  const handlePointerMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) updateHover(e.clientX - rect.left, e.clientY - rect.top);
    const drag = dragRef.current;
    if (!drag || !drag.startOffset) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    setOffset({ x: drag.startOffset.x + dx, y: drag.startOffset.y + dy });
  }, [updateHover]);

  const handlePointerUp = useCallback((e) => {
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && dragRef.current && !dragRef.current.moved) {
      // 탭(이동 없는 클릭) — 모바일에서 해당 지점 좌표를 확정 표시.
      updateHover(e.clientX - rect.left, e.clientY - rect.top);
    }
    dragRef.current = null;
  }, [updateHover]);

  // ── 캔버스 드로우 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmapReady || !offset) return;
    canvas.width = size.w; canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d08';
    ctx.fillRect(0, 0, size.w, size.h);
    const scale = ZOOM_LEVELS[zoomIdx] / 2;
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(bitmapRef.current, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (showGrid) drawScreenGrid(ctx, size.w, size.h);
  }, [bitmapReady, size, zoomIdx, offset, showGrid]);

  const pxPerTile = ZOOM_LEVELS[zoomIdx];
  const visibleNodes = useMemo(() => {
    if (!offset) return [];
    return nodes
      .map((n) => ({ ...n, sx: offset.x + n.x * pxPerTile + pxPerTile / 2, sy: offset.y + n.y * pxPerTile + pxPerTile / 2 }))
      .filter((n) => n.sx > -60 && n.sx < size.w + 60 && n.sy > -30 && n.sy < size.h + 30);
  }, [nodes, offset, pxPerTile, size]);

  // ── 게이트 (WorldPage와 동일한 profiles.role==='admin' 확인 방식) ──
  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!user || !isAdmin) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>관리자 전용이에요</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
          전체 맵 뷰어는 관리자만 볼 수 있어요.
        </p>
        <Link href="/home" className="btn btn--primary">홈으로</Link>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => router.back()}>← 뒤로</Button>
        <h1 className="page-header__title" style={{ margin: 0, fontSize: '1.25rem' }}>
          전체 맵 뷰어 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>관리자</span>
        </h1>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        월드 전체 지도(관리자) — 노드 배치·콘텐츠 마운트 계획용.
      </p>

      {/* 컨트롤 행 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => zoomAt(size.w / 2, size.h / 2, -1)} disabled={zoomIdx === 0}>
          － 축소
        </Button>
        <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 84, textAlign: 'center' }}>
          타일당 {pxPerTile}px (×{scaleLabel(zoomIdx)})
        </span>
        <Button size="sm" variant="secondary" onClick={() => zoomAt(size.w / 2, size.h / 2, 1)} disabled={zoomIdx === ZOOM_LEVELS.length - 1}>
          ＋ 확대
        </Button>
        <Button size="sm" variant={showGrid ? 'primary' : 'secondary'} onClick={() => setShowGrid((v) => !v)}>
          {showGrid ? '☑' : '☐'} 화면 격자(10×9)
        </Button>
        <Button size="sm" variant={showPlayable ? 'primary' : 'secondary'} onClick={() => setShowPlayable((v) => !v)}>
          {showPlayable ? '플레이 격자' : 'raw 격자'}
        </Button>
        <Button size="sm" variant="secondary" onClick={resetView}>전체 보기</Button>
      </div>

      {/* 지도 뷰포트 */}
      <div
        ref={containerRef}
        style={{
          position: 'relative', width: '100%', height: 'min(68vh, 640px)', minHeight: 320,
          borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color, rgba(128,128,128,0.3))',
          cursor: dragRef.current?.moved ? 'grabbing' : 'grab', touchAction: 'none', background: '#0b0d08',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {!bitmapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        )}
        {/* 주요 지점 마커 — worldNodes(장소 노드) 좌표 */}
        {visibleNodes.map((n) => (
          <div
            key={n.id}
            style={{
              position: 'absolute', left: n.sx, top: n.sy, transform: 'translate(-50%, -100%)',
              pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>📍</span>
            <span style={{
              fontFamily: FONT, fontSize: '0.6rem', color: '#fffaf0', background: 'rgba(42,33,24,0.75)',
              padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap', marginTop: 1,
            }}>
              {n.name}
            </span>
          </div>
        ))}
      </div>

      {/* 하단 정보 바 — 좌표/위경도 역산 + 범례 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: FONT,
      }}>
        <span>
          {hover
            ? `타일 (${hover.tx}, ${hover.ty}) · 경도 ${hover.lon.toFixed(3)}° · 위도 ${hover.lat.toFixed(3)}°`
            : '지도 위에서 움직이거나 탭하면 좌표가 표시돼요'}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <LegendDot color={COLORS.land} label="육지" />
          <LegendDot color={COLORS.coast} label="해안" />
          <LegendDot color={COLORS.sea} label="바다" />
          <LegendDot color={COLORS.river} label="강" />
          <LegendDot color={COLORS.lake} label="호수" />
          <LegendDot color={COLORS.fence} label="DMZ" />
          <LegendDot color={COLORS.bridge} label="다리" />
          <LegendDot color={COLORS.mountain} label="산" />
          <LegendDot color={COLORS.peak} label="설산" />
          <LegendDot color={COLORS.plain} label="평야" />
        </span>
      </div>
    </div>
  );
}

function scaleLabel(zoomIdx) {
  return zoomIdx + 1; // ZOOM_LEVELS 인덱스(0~3) → 사용자 표기(×1~×4)
}
