import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORLD_TITLES_STORAGE_KEY } from '../../../lib/world/stampMilestones.js';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';

vi.mock('../QuestReview', () => ({
  GBC: {
    cream: '#f6edcf',
    creamHi: '#fffaf0',
    creamShade: '#e4d5a6',
    ink: '#2a2118',
    inkSoft: '#5a4b38',
    border: '#2a2118',
    brown: '#8a5a2b',
    green: '#5f9a46',
    font: 'monospace',
    shadow: '4px 4px 0 rgba(42,33,24,0.35)',
  },
  gbcPanel: {},
  gbcButtonPrimary: {},
}));

import StampAlbum from '../StampAlbum.jsx';
import WorldGameMenu from '../WorldGameMenu.jsx';

const LAYOUT_PROPERTIES = new Set([
  'display',
  'flex',
  'flex-wrap',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'max-width',
  'min-width',
  'overflow-wrap',
  'overflow-x',
  'overscroll-behavior-x',
  'scrollbar-width',
  'white-space',
  'width',
  '-webkit-overflow-scrolling',
]);

function layoutStyle(markup, attribute, marker) {
  const tag = markup.match(new RegExp(`<[^>]+${attribute}="${marker}"[^>]*>`))?.[0];
  if (!tag) throw new Error(`missing layout marker: ${attribute}=${marker}`);
  const style = tag.match(/style="([^"]*)"/)?.[1] ?? '';
  return Object.fromEntries(style
    .split(';')
    .filter(Boolean)
    .map((declaration) => declaration.split(/:(.*)/s).slice(0, 2))
    .filter(([property]) => LAYOUT_PROPERTIES.has(property)));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('S8 여행 수첩 1180px 미만·375px 레이아웃', () => {
  it('앨범 패널·지역 탭·배지·푸터의 줄바꿈/가로 스크롤 스타일 스냅샷을 고정한다', () => {
    const markup = renderToStaticMarkup(
      <StampAlbum stamps={new Set(['seoul'])} onClose={() => {}} />,
    );

    expect({
      panel: layoutStyle(markup, 'data-stamp-album-layout', 'panel'),
      header: layoutStyle(markup, 'data-stamp-album-layout', 'header'),
      tabs: layoutStyle(markup, 'data-stamp-album-layout', 'tabs'),
      grid: layoutStyle(markup, 'data-stamp-album-layout', 'grid'),
      card: layoutStyle(markup, 'data-stamp-album-layout', 'card'),
      footer: layoutStyle(markup, 'data-stamp-album-layout', 'footer'),
    }).toMatchInlineSnapshot(`
      {
        "card": {
          "display": "flex",
          "gap": "3px",
          "max-width": "100%",
          "min-width": "0",
          "overflow-wrap": "anywhere",
        },
        "footer": {
          "display": "flex",
          "flex-wrap": "wrap",
          "gap": "10px",
          "min-width": "0",
        },
        "grid": {
          "display": "grid",
          "gap": "8px",
          "grid-template-columns": "repeat(auto-fill, minmax(min(84px, 100%), 1fr))",
          "min-width": "0",
        },
        "header": {
          "display": "flex",
          "flex-wrap": "wrap",
          "gap": "3px 8px",
          "min-width": "0",
        },
        "panel": {
          "display": "flex",
          "max-width": "460px",
          "min-width": "0",
          "width": "100%",
        },
        "tabs": {
          "-webkit-overflow-scrolling": "touch",
          "display": "flex",
          "gap": "6px",
          "max-width": "100%",
          "min-width": "0",
          "overflow-x": "auto",
          "overscroll-behavior-x": "contain",
          "scrollbar-width": "thin",
        },
      }
    `);
  });

  it('375px 화면에서 칭호·수첩 탭이 min-content로 바깥 폭을 밀지 않는 스타일을 고정한다', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key === WORLD_TITLES_STORAGE_KEY ? '["stamp-10"]' : null),
    });
    const stamps = new Set(STAMP_ALBUM_NODES.slice(0, 10).map(({ id }) => id));
    const markup = renderToStaticMarkup(
      <WorldGameMenu
        avatar={{}}
        stamps={stamps}
        totalPlaces={STAMP_ALBUM_NODES.length}
        onApplyAvatar={() => {}}
        onClose={() => {}}
        onOpenStampAlbum={() => {}}
        onOpenReview={() => {}}
        onOpenDictionary={() => {}}
        initialTab="codex"
      />,
    );

    expect({
      dialog: layoutStyle(markup, 'data-world-menu-layout', 'dialog'),
      header: layoutStyle(markup, 'data-world-menu-layout', 'header'),
      tabs: layoutStyle(markup, 'data-world-menu-layout', 'tabs'),
      content: layoutStyle(markup, 'data-world-menu-layout', 'content'),
    }).toMatchInlineSnapshot(`
      {
        "content": {
          "min-width": "0",
          "overflow-wrap": "anywhere",
        },
        "dialog": {
          "display": "grid",
          "grid-template-rows": "31px 30px minmax(0, 1fr)",
          "min-width": "0",
        },
        "header": {
          "display": "flex",
          "gap": "8px",
          "min-width": "0",
        },
        "tabs": {
          "display": "grid",
          "grid-template-columns": "repeat(5, minmax(0, 1fr))",
          "min-width": "0",
        },
      }
    `);
    expect(markup).toContain('첫 발자국 수집가');
  });
});
