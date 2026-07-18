'use client';

// 🗺️ 전체 맵 뷰어 (관리자 전용, 실험) — 전국 월드와 도시 정밀맵을 한 화면에서 골라
// 줌·팬으로 훑어보는 도구. 노드 배치·콘텐츠 마운트 계획용이며 게임 로직은 배선하지 않는다.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { MAP_W, MAP_H, decodeMap, TERRAIN } from '../components/world/mapData';
import { ALL_WORLD_NODES, WORLD_NODES } from '../components/world/worldNodes';
import { CITY_MAPS } from '../components/world/cities/index.js';
import { unproject, isCoastTile, buildPlayableGrid } from '../lib/world/mapGeo';
import { cityMapMarkers, overworldRegionMarkers, worldMapMarkers } from '../lib/world/mapViewer';
import { EMEA_RAIL_NETWORK } from '../lib/world/emeaRail';
import { OVERWORLD_REGION_LIST, unprojectOverworldRegionTile } from '../lib/world/overworldRegions';

// 타일당 화면 px — 줌 4단계(×1~×4, 2px 기준 정수 배).
const DEFAULT_ZOOM_LEVELS = Object.freeze([2, 4, 6, 8]);
const OVERWORLD_ZOOM_MULTIPLIERS = Object.freeze([0.94, 1.88, 3.76, 7.52]);

// 오프스크린 비트맵 스케일 — 대형 맵(>100만 타일: 서울·부산 등)은 1px/타일로 낮춰
// ImageData 메모리를 모바일 캔버스 한계 안으로 유지한다("큰 맵 안 켜짐" 원인 수정).
function bitmapScaleFor(cols, rows) {
  return cols * rows > 1_000_000 ? 1 : 2;
}

// 국가 중심 2단 카테고리 — 도시국가·특별지역은 지리·언어권 이웃 곁에 독립 버튼으로 나란히 둔다.
// 미배정 신규 도시는 폴백 그룹으로 노출되어 유실되지 않는다(가와구치코 등 추가분은 매핑에 선등록).
const CITY_GROUP_BY_ID = Object.freeze({
  tokyo: 'jp', osaka: 'jp', kyoto: 'jp', fukuoka: 'jp', kawaguchiko: 'jp',
  seoul: 'kr', busan: 'kr',
  beijing: 'cn', shanghai: 'cn',
  taipei: 'tw', 'hong-kong': 'hk',
  'grand-paris': 'fr', marseille: 'fr', 'mont-saint-michel': 'fr', 'cote-dazur': 'fr', geneva: 'ch',
  brussels: 'be', london: 'gb',
  sydney: 'au', melbourne: 'au', brisbane: 'au', canberra: 'au',
});

const MAP_GROUP_DEFS = Object.freeze([
  { id: 'global', label: '월드·대륙', icon: '🗾' },
  { id: 'jp', label: '일본', icon: '🏯' },
  { id: 'kr', label: '한국', icon: '🏙️' },
  { id: 'cn', label: '중국', icon: '🏮' },
  { id: 'tw', label: '타이베이', icon: '🥟' },   // 도시국가·특별지역 — 중화권 곁 병렬
  { id: 'hk', label: '홍콩', icon: '⛴️' },
  { id: 'fr', label: '프랑스', icon: '🥖' },
  { id: 'ch', label: '스위스', icon: '⛰️' },
  { id: 'be', label: '벨기에', icon: '🧇' },
  { id: 'gb', label: '영국', icon: '☂️' },
  { id: 'au', label: '호주', icon: '🏄' },
  { id: 'etc', label: '기타', icon: '📌' },     // 매핑 누락 폴백 — 신규 도시 유실 방지
]);

// GBC 톤 — 잔디 그린(육지) · 모래(해안) · 바다 블루 + 신규 지형:
// 강·호수(청록 계열, 통행 가능 물) · DMZ 철조망(적갈) · 교량(다리 갈색)
// + 지형 질감: 산(짙은 녹) · 설산(회백) · 평야(밝은 황록).
const COLORS = {
  land: '#5f9a46', coast: '#dcc07f', sea: '#3c6e91',
  river: '#3fb0c4', lake: '#2f97b8', fence: '#a6432f', bridge: '#b07a3c',
  mountain: '#3a5c32', peak: '#c8cdd4', plain: '#9fc85a',
};

const CITY_COLORS = {
  0: '#373c46', 1: '#d5cbb5', 2: '#e6e0d2', 3: '#d8c48c', 4: '#78b45a',
  5: '#967850', 6: '#8c643c', 7: '#5ac85a', 8: '#3c82aa', 9: '#524e4a',
  10: '#6ea550', 11: '#3f7a6a', 12: '#e8d6a6',
};

const WORLD_LEGEND = [
  [COLORS.land, '육지'], [COLORS.coast, '해안'], [COLORS.sea, '바다'],
  [COLORS.river, '강'], [COLORS.lake, '호수'], [COLORS.fence, 'DMZ'],
  [COLORS.bridge, '다리'], [COLORS.mountain, '산'], [COLORS.peak, '설산'],
  [COLORS.plain, '평야'],
];

const CITY_LEGEND = [
  [CITY_COLORS[0], '도로'], [CITY_COLORS[1], '보도'], [CITY_COLORS[3], '광장'],
  [CITY_COLORS[4], '공원'], [CITY_COLORS[8], '바다'], [CITY_COLORS[11], '강'],
  [CITY_COLORS[9], '건물'], [CITY_COLORS[12], '해변'], [CITY_COLORS[7], '출구'],
];

const OVERWORLD_LEGEND = [
  ['#336791', '바다'], ['#729e5f', '저지대'], ['#a19c5b', '고지대'],
  ['#8b6747', '산악'], ['#e0e2da', '고산'], ['#b86296', '관망 전용 섬'],
  ['#72b8d5', '강'], ['#493d34', '철도'], ['#6f665f', '경계'],
];

const FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

const MAP_OPTIONS = Object.freeze([
  { id: 'world', name: '전국 월드', icon: '🗾', kind: 'world', cols: MAP_W, rows: MAP_H, group: 'global' },
  ...OVERWORLD_REGION_LIST.map((region) => ({
    id: `overworld-${region.id}`,
    name: region.label,
    icon: '🌍',
    kind: 'overworld',
    cols: region.width,
    rows: region.height,
    previewUrl: `/assets/overworld/map-previews/${region.id}.png`,
    region,
    group: 'global',
  })),
  ...CITY_MAPS.map((city) => ({
    id: city.id,
    name: city.name,
    icon: '🏙️',
    kind: 'city',
    cols: city.cols,
    rows: city.rows,
    city,
    group: CITY_GROUP_BY_ID[city.id] || 'etc',
  })),
]);

// 실제 지도가 있는 그룹만 버튼으로 노출한다(빈 그룹 숨김 — '기타'는 폴백 발생 시에만 등장).
const MAP_GROUPS = Object.freeze(
  MAP_GROUP_DEFS
    .map((def) => ({ ...def, maps: MAP_OPTIONS.filter((map) => map.group === def.id) }))
    .filter((groupDef) => groupDef.maps.length > 0),
);

// 뷰포트에 전체가 안 들어가는 맵은 화면맞춤(fit) 단계를 최소 줌으로 추가한다
// ("모든 맵 전체 한번에 보기" 수정 — 서울·부산 같은 대형 맵의 기본 진입이 전체 보기).
function zoomLevelsFor(map, size) {
  if (map.kind === 'overworld') {
    const fit = Math.min(size.w / map.cols, size.h / map.rows);
    return OVERWORLD_ZOOM_MULTIPLIERS.map((multiplier) => fit * multiplier);
  }
  const fit = Math.min(size.w / map.cols, size.h / map.rows);
  if (fit >= DEFAULT_ZOOM_LEVELS[0]) return DEFAULT_ZOOM_LEVELS;
  return [fit, ...DEFAULT_ZOOM_LEVELS];
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const CITY_RGB = Object.freeze(
  Object.fromEntries(Object.entries(CITY_COLORS).map(([code, color]) => [code, hexToRgb(color)])),
);

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

  const [activeMapId, setActiveMapId] = useState('world');
  const activeMap = useMemo(
    () => MAP_OPTIONS.find((map) => map.id === activeMapId) || MAP_OPTIONS[0],
    [activeMapId],
  );
  // 국가 중심 2단 내비 — 기본은 국가(그룹) 버튼, 그룹을 고르면 소속 지도가 아래 줄에 나온다.
  const [activeGroupId, setActiveGroupId] = useState('global');
  const activeGroup = useMemo(
    () => MAP_GROUPS.find((groupDef) => groupDef.id === activeGroupId) || MAP_GROUPS[0],
    [activeGroupId],
  );
  const selectGroup = useCallback((groupDef) => {
    setActiveGroupId(groupDef.id);
    // 지도 1개짜리 그룹(타이베이·홍콩·벨기에·영국 등)은 바로 그 지도를 연다.
    if (groupDef.maps.length === 1) setActiveMapId(groupDef.maps[0].id);
    else if (!groupDef.maps.some((map) => map.id === activeMapId)) setActiveMapId(groupDef.maps[0].id);
  }, [activeMapId]);
  const mapCols = activeMap.cols;
  const mapRows = activeMap.rows;

  // ── 오프스크린 비트맵 — 기존 지도는 2px/타일, 대륙 지도는 생성된 축소 미리보기를 쓴다 ──
  // playable: GameCanvas 런타임·미니맵과 동일한 buildPlayableGrid(광장 SEA→LAND) 산출을 표시(P2-6).
  // raw: build-map.mjs 원본 격자(광장 메꿈 이전). 토글로 43타일 차이를 눈으로 확인할 수 있다.
  const bitmapRef = useRef(null);
  const bitmapScaleRef = useRef({ x: 2, y: 2 });
  const [bitmapReady, setBitmapReady] = useState(false);
  const [bitmapError, setBitmapError] = useState('');
  const [showPlayable, setShowPlayable] = useState(true);

  useEffect(() => {
    setBitmapReady(false);
    setBitmapError('');
    bitmapRef.current = null;
    if (activeMap.kind === 'overworld') {
      let cancelled = false;
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        if (cancelled) return;
        bitmapRef.current = image;
        bitmapScaleRef.current = {
          x: image.naturalWidth / mapCols,
          y: image.naturalHeight / mapRows,
        };
        setBitmapReady(true);
      };
      image.onerror = () => {
        if (!cancelled) setBitmapError('대륙 지도 미리보기를 불러오지 못했어요.');
      };
      image.src = activeMap.previewUrl;
      return () => { cancelled = true; };
    }
    const raw = activeMap.kind === 'world' ? decodeMap() : null;
    const grid = activeMap.kind === 'world'
      ? (showPlayable ? buildPlayableGrid(raw) : raw)
      : activeMap.city.buildGrid();
    const pxScale = bitmapScaleFor(mapCols, mapRows);
    const w = mapCols * pxScale, h = mapRows * pxScale;
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
    for (let ty = 0; ty < mapRows; ty++) {
      for (let tx = 0; tx < mapCols; tx++) {
        const code = grid[ty * mapCols + tx];
        let rgb;
        if (activeMap.kind === 'city') {
          rgb = CITY_RGB[code] || CITY_RGB[1];
        } else {
          switch (code) {
            case TERRAIN.RIVER: rgb = riverRgb; break;
            case TERRAIN.LAKE: rgb = lakeRgb; break;
            case TERRAIN.FENCE: rgb = fenceRgb; break;
            case TERRAIN.BRIDGE: rgb = bridgeRgb; break;
            case TERRAIN.MOUNTAIN: rgb = mountainRgb; break;
            case TERRAIN.PEAK: rgb = peakRgb; break;
            case TERRAIN.PLAIN: rgb = plainRgb; break;
            case TERRAIN.LAND: rgb = isCoastTile(grid, tx, ty) ? coastRgb : landRgb; break;
            default: rgb = seaRgb; break;
          }
        }
        for (let dy = 0; dy < pxScale; dy++) {
          for (let dx = 0; dx < pxScale; dx++) {
            const idx = ((ty * pxScale + dy) * w + (tx * pxScale + dx)) * 4;
            data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    if (activeMap.kind === 'city') drawCityTransit(ctx, activeMap.city, pxScale);
    bitmapRef.current = off;
    bitmapScaleRef.current = { x: pxScale, y: pxScale };
    setBitmapReady(true);
    return undefined;
  }, [activeMap, mapCols, mapRows, showPlayable]);

  const nodes = useMemo(() => {
    if (activeMap.kind === 'world') return worldMapMarkers(WORLD_NODES);
    if (activeMap.kind === 'overworld') {
      const transportNodes = activeMap.region.id === 'emea' ? EMEA_RAIL_NETWORK.hubs : [];
      return overworldRegionMarkers(activeMap.region, ALL_WORLD_NODES, transportNodes);
    }
    return cityMapMarkers(activeMap.city);
  }, [activeMap]);

  // ── 뷰포트 크기(반응형) ──
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  const zoomLevels = useMemo(() => zoomLevelsFor(activeMap, size), [activeMap, size]);
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

  // ── 줌 · 팬(offset, 화면 px) ──
  const [zoomIdx, setZoomIdx] = useState(0);
  const [offset, setOffset] = useState(null); // 최초 1회 중앙 정렬 후 세팅
  const [showGrid, setShowGrid] = useState(false);
  const [hover, setHover] = useState(null); // { tx, ty, lon, lat }

  useEffect(() => {
    setZoomIdx(0);
    setOffset({
      x: (size.w - mapCols * zoomLevels[0]) / 2,
      y: (size.h - mapRows * zoomLevels[0]) / 2,
    });
    setHover(null);
  }, [activeMapId, mapCols, mapRows, size.h, size.w, zoomLevels]);

  const zoomAt = useCallback((screenX, screenY, dir) => {
    setZoomIdx((prevIdx) => {
      const nextIdx = Math.max(0, Math.min(zoomLevels.length - 1, prevIdx + dir));
      if (nextIdx === prevIdx) return prevIdx;
      const oldScale = zoomLevels[prevIdx];
      const newScale = zoomLevels[nextIdx];
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
  }, [zoomLevels]);

  const resetView = useCallback(() => {
    setZoomIdx(0);
    setOffset({
      x: (size.w - mapCols * zoomLevels[0]) / 2,
      y: (size.h - mapRows * zoomLevels[0]) / 2,
    });
  }, [mapCols, mapRows, size.h, size.w, zoomLevels]);

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
    const pxPerTile = zoomLevels[zoomIdx];
    const tx = Math.floor((mx - offset.x) / pxPerTile);
    const ty = Math.floor((my - offset.y) / pxPerTile);
    if (tx < 0 || ty < 0 || tx >= mapCols || ty >= mapRows) {
      setHover(null);
      return;
    }
    if (activeMap.kind === 'world') {
      setHover({ tx, ty, ...unproject(tx, ty) });
      return;
    }
    if (activeMap.kind === 'overworld') {
      setHover({ tx, ty, ...unprojectOverworldRegionTile(activeMap.region, tx + 0.5, ty + 0.5) });
      return;
    }
    setHover({ tx, ty });
  }, [activeMap, mapCols, mapRows, offset, zoomIdx, zoomLevels]);

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
    const { x: bitmapScaleX, y: bitmapScaleY } = bitmapScaleRef.current;
    const pxPerTile = zoomLevels[zoomIdx];
    ctx.translate(offset.x, offset.y);
    ctx.scale(pxPerTile / bitmapScaleX, pxPerTile / bitmapScaleY);
    ctx.drawImage(bitmapRef.current, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (showGrid) drawScreenGrid(ctx, size.w, size.h);
  }, [bitmapReady, size, zoomIdx, offset, showGrid, zoomLevels]);

  const pxPerTile = zoomLevels[zoomIdx];
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
        전국 월드, 대륙 오버월드와 도시 정밀맵을 하나씩 골라 노드 배치와 동선을 확인해요.
      </p>

      {/* 1단: 국가·권역 버튼(도시국가는 언어·지리 이웃 곁에 나란히) */}
      <div className="world-map-viewer__maps" role="tablist" aria-label="국가·권역 선택">
        {MAP_GROUPS.map((groupDef) => (
          <button
            key={groupDef.id}
            type="button"
            role="tab"
            aria-selected={activeGroup.id === groupDef.id}
            className={`world-map-viewer__map-tab${activeGroup.id === groupDef.id ? ' world-map-viewer__map-tab--active' : ''}`}
            onClick={() => selectGroup(groupDef)}
          >
            <span aria-hidden="true">{groupDef.icon}</span>
            <span>{groupDef.label}</span>
            <small>{groupDef.maps.length}</small>
          </button>
        ))}
      </div>
      {/* 2단: 선택한 그룹의 지도들 */}
      {activeGroup.maps.length > 1 && (
        <div className="world-map-viewer__maps" role="tablist" aria-label={`${activeGroup.label} 지도 선택`}>
          {activeGroup.maps.map((map) => (
            <button
              key={map.id}
              type="button"
              role="tab"
              aria-selected={activeMap.id === map.id}
              className={`world-map-viewer__map-tab${activeMap.id === map.id ? ' world-map-viewer__map-tab--active' : ''}`}
              onClick={() => setActiveMapId(map.id)}
            >
              <span aria-hidden="true">{map.icon}</span>
              <span>{map.name}</span>
              <small>{map.cols}×{map.rows}</small>
            </button>
          ))}
        </div>
      )}

      {/* 컨트롤 행 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => zoomAt(size.w / 2, size.h / 2, -1)} disabled={zoomIdx === 0}>
          － 축소
        </Button>
        <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 84, textAlign: 'center' }}>
          타일당 {formatTileScale(pxPerTile)}px (×{scaleLabel(zoomLevels, zoomIdx)})
        </span>
        <Button size="sm" variant="secondary" onClick={() => zoomAt(size.w / 2, size.h / 2, 1)} disabled={zoomIdx === zoomLevels.length - 1}>
          ＋ 확대
        </Button>
        <Button size="sm" variant={showGrid ? 'primary' : 'secondary'} onClick={() => setShowGrid((v) => !v)}>
          {showGrid ? '☑' : '☐'} 화면 격자(10×9)
        </Button>
        {activeMap.kind === 'world' && (
          <Button size="sm" variant={showPlayable ? 'primary' : 'secondary'} onClick={() => setShowPlayable((v) => !v)}>
            {showPlayable ? '플레이 격자' : 'raw 격자'}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={resetView}>전체 보기</Button>
        <span className="world-map-viewer__active-map">
          {activeMap.icon} {activeMap.name} · {mapCols}×{mapRows}
        </span>
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
            {bitmapError || <Spinner />}
          </div>
        )}
        {/* 주요 지점 마커 — 이름은 핀 hover/focus 때만 노출 */}
        {visibleNodes.map((n) => (
          <span
            key={n.id}
            className="world-map-viewer__pin"
            style={{ left: n.sx, top: n.sy }}
            role="img"
            tabIndex={0}
            aria-label={`${n.name} 위치`}
          >
            <span className="world-map-viewer__pin-label" aria-hidden="true">{n.name}</span>
            <span className="world-map-viewer__pin-icon" aria-hidden="true">📍</span>
          </span>
        ))}
      </div>

      {activeMap.kind === 'overworld' && activeMap.region.boundaryNotice && (
        <p
          role="note"
          style={{
            margin: 0, padding: '8px 10px', borderRadius: 6,
            border: '1px solid var(--border-color, rgba(128,128,128,0.3))',
            background: 'var(--bg-secondary, rgba(128,128,128,0.08))',
            color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.5,
          }}
        >
          경계 표기 안내 · {activeMap.region.boundaryNotice}
        </p>
      )}

      {/* 하단 정보 바 — 좌표/위경도 역산 + 범례 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: FONT,
      }}>
        <span>
          {hover
            ? (activeMap.kind === 'world' || activeMap.kind === 'overworld'
              ? `타일 (${hover.tx}, ${hover.ty}) · 경도 ${hover.lon.toFixed(3)}° · 위도 ${hover.lat.toFixed(3)}°`
              : `${activeMap.name} 타일 (${hover.tx}, ${hover.ty})`)
            : '지도 위에서 움직이거나 탭하면 좌표가 표시돼요'}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {(activeMap.kind === 'world'
            ? WORLD_LEGEND
            : activeMap.kind === 'overworld' ? OVERWORLD_LEGEND : CITY_LEGEND).map(([color, label]) => (
            <LegendDot key={label} color={color} label={label} />
          ))}
        </span>
      </div>
    </div>
  );
}

function drawCityTransit(ctx, city, scale = 2) {
  if (city.railways?.mask) {
    ctx.fillStyle = '#3d3028';
    for (let index = 0; index < city.railways.mask.length; index += 1) {
      if (!city.railways.mask[index]) continue;
      ctx.fillRect((index % city.cols) * scale, Math.floor(index / city.cols) * scale, scale, scale);
    }
    return;
  }
  if (!city.transit?.length) return;
  const stops = new Map(
    [...(city.stations || []), ...(city.transitPoints || [])].map((stop) => [stop.id, stop]),
  );
  ctx.lineWidth = 2;
  for (const line of city.transit) {
    if (line.mode === 'ferry') continue;
    const points = line.stopIds.map((id) => stops.get(id)?.tile).filter(Boolean);
    if (points.length < 2) continue;
    ctx.strokeStyle = '#c66e2c';
    ctx.beginPath();
    ctx.moveTo(points[0][0] * scale, points[0][1] * scale);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x * scale, y * scale);
    ctx.stroke();
  }
}

function scaleLabel(zoomLevels, zoomIdx) {
  // fit 단계가 끼면 배율이 비정수가 되므로 최소 단계 대비 상대 배율로 표기한다.
  const ratio = zoomLevels[zoomIdx] / zoomLevels[0];
  return Number.isInteger(ratio) ? ratio : ratio.toFixed(1);
}

function formatTileScale(value) {
  return value >= 1 ? value.toFixed(value >= 2 ? 0 : 1) : value.toFixed(2);
}
