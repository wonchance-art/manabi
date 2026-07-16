'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AVATAR_OPTIONS, avatarPalette, normalizeWorldAvatar } from '../../lib/world/avatar';
import {
  INVENTORY_CATEGORIES,
  STARTER_ITEMS,
  filterInventoryItems,
  loadInventoryFavorites,
  saveInventoryFavorites,
} from '../../lib/world/inventory';
import { charFrameRows } from './sprites';
import { GBC, gbcButtonPrimary, gbcPanel } from './QuestReview';

const TABS = [
  { id: 'avatar', icon: '🙂', label: '캐릭터' },
  { id: 'bag', icon: '🎒', label: '가방' },
  { id: 'codex', icon: '📚', label: '도감' },
  { id: 'quests', icon: '🪧', label: '임무' },
];

const fieldLabel = { skin: '피부색', hair: '머리색', top: '상의', bottom: '하의', style: '헤어스타일', outfit: '의상', acc: '소품' };
// 색 견본 버튼으로 그리는 그룹 — 나머지(실루엣 그룹)는 라벨 칩으로 그린다.
const COLOR_FIELDS = new Set(['skin', 'hair', 'top', 'bottom']);

function AvatarPreview({ avatar }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const rows = charFrameRows('down', 'n', avatar);
    const palette = avatarPalette(avatar);
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        const color = palette[rows[y][x]];
        if (color == null) continue;
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.fillRect(x * 4, y * 4, 4, 4);
      }
    }
  }, [avatar]);

  return <canvas ref={canvasRef} width={64} height={64} role="img" aria-label="캐릭터 미리보기" style={{ imageRendering: 'pixelated', width: 96, height: 96 }} />;
}

function AvatarPanel({ avatar, onApply }) {
  const [draft, setDraft] = useState(() => normalizeWorldAvatar(avatar));
  useEffect(() => setDraft(normalizeWorldAvatar(avatar)), [avatar]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 10, alignItems: 'start' }}>
      <div style={{ textAlign: 'center', background: GBC.creamShade, border: `2px solid ${GBC.border}`, padding: 4 }}>
        <AvatarPreview avatar={draft} />
        <div style={{ fontSize: '0.58rem', color: GBC.inkSoft }}>월드 공통 외형</div>
      </div>
      <div style={{ minWidth: 0 }}>
        {Object.entries(AVATAR_OPTIONS).map(([field, options]) => (
          <fieldset key={field} style={{ border: 0, margin: '0 0 7px', padding: 0 }}>
            <legend style={{ fontSize: '0.62rem', fontWeight: 700, marginBottom: 3 }}>{fieldLabel[field]}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {options.map((option) => {
                const selected = draft[field] === option.id;
                const swatch = COLOR_FIELDS.has(field);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={selected}
                    onClick={() => setDraft((current) => ({ ...current, [field]: option.id }))}
                    title={option.label}
                    style={{
                      ...(swatch
                        ? { width: 27, height: 22, background: `#${option.color.toString(16).padStart(6, '0')}` }
                        : {
                          height: 22, padding: '0 7px', fontSize: '0.58rem', fontWeight: 700,
                          color: GBC.ink, background: GBC.creamShade, display: 'inline-flex', alignItems: 'center', gap: 4,
                        }),
                      padding: swatch ? 2 : '0 7px', cursor: 'pointer',
                      border: selected ? `3px solid ${GBC.green}` : `2px solid ${GBC.border}`,
                      boxShadow: selected ? `0 0 0 1px ${GBC.creamHi}` : 'none',
                    }}
                  >
                    {!swatch && (
                      <>
                        {option.color != null && (
                          <span aria-hidden style={{ width: 8, height: 8, background: `#${option.color.toString(16).padStart(6, '0')}`, border: `1px solid ${GBC.border}`, display: 'inline-block' }} />
                        )}
                        {option.label}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <button type="button" onClick={() => onApply(draft)} style={{ ...gbcButtonPrimary, width: '100%', marginTop: 2 }}>
          이 모습으로 적용
        </button>
      </div>
    </div>
  );
}

function BagPanel({ onAction }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [favorites, setFavorites] = useState(() => loadInventoryFavorites());
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const items = useMemo(
    () => filterInventoryItems(STARTER_ITEMS, { query, category })
      .sort((a, b) => Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id))),
    [query, category, favoriteSet],
  );
  const toggleFavorite = (id) => {
    setFavorites((current) => saveInventoryFavorites(
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    ));
  };

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="가방 검색"
        aria-label="가방 검색"
        style={{ width: '100%', boxSizing: 'border-box', fontFamily: GBC.font, fontSize: '0.65rem', padding: '6px 7px', background: GBC.creamHi, color: GBC.ink, border: `2px solid ${GBC.border}` }}
      />
      <div style={{ display: 'flex', gap: 3, margin: '6px 0' }}>
        {INVENTORY_CATEGORIES.map((item) => (
          <button key={item.id} type="button" onClick={() => setCategory(item.id)} aria-pressed={category === item.id} style={{ ...gbcButtonPrimary, flex: 1, padding: '3px 2px', fontSize: '0.57rem', background: category === item.id ? GBC.green : GBC.cream, color: category === item.id ? GBC.creamHi : GBC.ink }}>
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        {items.map((item) => (
          <article key={item.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 6, alignItems: 'center', border: `2px solid ${GBC.border}`, background: GBC.creamHi, padding: 5 }}>
            <span style={{ fontSize: '1.15rem' }}>{item.icon}</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.64rem' }}>{item.name}</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: '0.54rem', lineHeight: 1.4, color: GBC.inkSoft }}>{item.description}</span>
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              <button type="button" aria-label={`${item.name} 즐겨찾기`} aria-pressed={favoriteSet.has(item.id)} onClick={() => toggleFavorite(item.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: favoriteSet.has(item.id) ? '#d6a839' : GBC.inkSoft }}>★</button>
              <button type="button" onClick={() => onAction(item.action)} style={{ ...gbcButtonPrimary, padding: '3px 5px', fontSize: '0.52rem' }}>{item.actionLabel}</button>
            </div>
          </article>
        ))}
        {items.length === 0 && <p style={{ textAlign: 'center', fontSize: '0.62rem', color: GBC.inkSoft }}>맞는 물건이 없어요.</p>}
      </div>
    </div>
  );
}

function CodexPanel({ stampCount, totalPlaces, onOpenStampAlbum, onOpenDictionary }) {
  const percent = totalPlaces ? Math.min(100, Math.round((stampCount / totalPlaces) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <section style={{ border: `2px solid ${GBC.border}`, background: GBC.creamHi, padding: 8 }}>
        <strong style={{ fontSize: '0.7rem' }}>🗾 여행 도감</strong>
        <p style={{ margin: '5px 0', fontSize: '0.58rem', lineHeight: 1.45 }}>방문 기념 스탬프 {stampCount}/{totalPlaces} · {percent}%</p>
        <div style={{ height: 8, border: `2px solid ${GBC.border}`, background: GBC.creamShade }}>
          <div style={{ width: `${percent}%`, height: '100%', background: GBC.green }} />
        </div>
        <button type="button" onClick={onOpenStampAlbum} style={{ ...gbcButtonPrimary, width: '100%', marginTop: 7 }}>스탬프 앨범 열기</button>
      </section>
      <section style={{ border: `2px solid ${GBC.border}`, background: GBC.creamHi, padding: 8 }}>
        <strong style={{ fontSize: '0.7rem' }}>📖 단어 사전</strong>
        <p style={{ margin: '5px 0 7px', fontSize: '0.58rem', lineHeight: 1.45 }}>월드에서 만난 일본어를 기존 단어장과 함께 찾아봐요.</p>
        <button type="button" onClick={onOpenDictionary} style={{ ...gbcButtonPrimary, width: '100%' }}>내 단어 사전 열기</button>
      </section>
    </div>
  );
}

function QuestPanel({ stampCount, totalPlaces, onOpenReview, onOpenStampAlbum }) {
  const quests = [
    { id: 'review', icon: '🧠', title: '오늘의 즉석 복습', detail: '지금 풀 수 있는 복습 문제를 확인해요.', action: onOpenReview, label: '복습 시작' },
    { id: 'explore', icon: '🧭', title: '새 장소 발견', detail: `기념 스탬프 ${stampCount}/${totalPlaces}`, action: onOpenStampAlbum, label: '진행 보기' },
    { id: 'talk', icon: '💬', title: '도시 사람에게 말 걸기', detail: '가게와 명소 앞에서 Ⓐ를 눌러 회화를 시작해요.', label: '진행 중' },
  ];
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {quests.map((quest) => (
        <section key={quest.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 6, alignItems: 'center', border: `2px solid ${GBC.border}`, background: GBC.creamHi, padding: 7 }}>
          <span style={{ fontSize: '1.1rem' }}>{quest.icon}</span>
          <div>
            <strong style={{ display: 'block', fontSize: '0.64rem' }}>{quest.title}</strong>
            <span style={{ display: 'block', marginTop: 3, fontSize: '0.54rem', lineHeight: 1.4, color: GBC.inkSoft }}>{quest.detail}</span>
          </div>
          <button type="button" disabled={!quest.action} onClick={quest.action} style={{ ...gbcButtonPrimary, padding: '4px 6px', fontSize: '0.52rem', opacity: quest.action ? 1 : 0.65 }}>{quest.label}</button>
        </section>
      ))}
    </div>
  );
}

export default function WorldGameMenu({
  avatar,
  stamps,
  totalPlaces,
  onApplyAvatar,
  onClose,
  onOpenStampAlbum,
  onOpenReview,
  onOpenDictionary,
}) {
  const [tab, setTab] = useState('avatar');
  const stampCount = stamps?.size || 0;
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  const switchAndRun = (nextTab, action) => {
    if (action === 'codex') setTab('codex');
    else if (action === 'quests') setTab('quests');
    else if (action === 'dictionary') onOpenDictionary();
    else setTab(nextTab);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="여행 수첩" style={{ position: 'absolute', inset: 5, zIndex: 45, ...gbcPanel, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateRows: '31px 30px 1fr' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 7px', background: GBC.creamShade, borderBottom: `2px solid ${GBC.border}` }}>
        <strong style={{ fontSize: '0.72rem' }}>📒 여행 수첩</strong>
        <button type="button" onClick={onClose} style={{ ...gbcButtonPrimary, padding: '2px 7px', fontSize: '0.58rem' }}>닫기 Ⓑ</button>
      </header>
      <nav aria-label="여행 수첩 메뉴" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `2px solid ${GBC.border}` }}>
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} style={{ border: 0, borderRight: `1px solid ${GBC.border}`, background: tab === item.id ? GBC.green : GBC.cream, color: tab === item.id ? GBC.creamHi : GBC.ink, fontFamily: GBC.font, fontSize: '0.55rem', fontWeight: 700, cursor: 'pointer' }}>
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <div style={{ overflowY: 'auto', padding: 8, background: GBC.cream }}>
        {tab === 'avatar' && <AvatarPanel avatar={avatar} onApply={onApplyAvatar} />}
        {tab === 'bag' && <BagPanel onAction={(action) => switchAndRun(tab, action)} />}
        {tab === 'codex' && <CodexPanel stampCount={stampCount} totalPlaces={totalPlaces} onOpenStampAlbum={onOpenStampAlbum} onOpenDictionary={onOpenDictionary} />}
        {tab === 'quests' && <QuestPanel stampCount={stampCount} totalPlaces={totalPlaces} onOpenReview={onOpenReview} onOpenStampAlbum={onOpenStampAlbum} />}
      </div>
    </div>
  );
}
