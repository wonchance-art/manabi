import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// CARD-SENSES-SHIFT-001 (오너 「결정사안은 권장대로」 B안, 2026-10-17 KST): 1440 옆 패널의 채점 줄을 390 시트처럼 패널 아래에 고정.
// 원인: 옆 패널이 height:auto라 우리 사전 예문(refVocab — 콘텐츠 색인 3.2MB, 늦게 도착)이 들어오면 패널이 자라 채점 줄이 106.8px 밀렸다
// (빌드 실측 5회 중 4회). 새 규칙 없이 기존 칸 배치를 쓴다: 옆 패널 고정 높이(min-width 1120 규칙) + 390과 같은 세로 flex
// (카드 flex:1 · 본문 스크롤 · 채점 줄 flex:none). 늦게 온 내용은 본문 스크롤 안에서만 자라고, 채점 줄은 내용을 덮지 않는다(흐름 안).
const css = fs.readFileSync(path.join(process.cwd(), 'src/components/viewer/reader-controls.css'), 'utf8');
const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
const containerRules = [...css.matchAll(/@container reader \(min-width:1120px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]);

describe('1440 옆 패널 — 채점 줄이 패널 아래에 머문다', () => {
  it('옆 패널 기본 규칙은 고정 높이(sticky · height:calc(100dvh - 112px))', () => {
    expect(containerRules.some((r) => r.includes('.viewer-inspector {position:sticky;inset:auto;top:88px;flex:0 0 336px;margin:0 auto 0 0;height:calc(100dvh - 112px);'))).toBe(true);
  });
  it('마나비 셸 덮어쓰기는 top · max-height만 — height:auto로 다시 내용만큼 자라게 하지 않는다', () => {
    const shell = containerRules.map((r) => r.match(/\.manabi-app \.viewer-layout \.viewer-inspector \{([^}]*)\}/)?.[1]).filter(Boolean);
    expect(shell).toEqual(['top:80px;max-height:calc(100dvh - 104px);box-shadow:none;']);
    for (const rule of containerRules) expect(rule).not.toMatch(/\.viewer-inspector \{[^}]*height:auto/);
  });
  it('390과 같은 세로 칸 배치를 그대로 쓴다(새 규칙 없음) — 카드 flex:1 · 본문만 스크롤 · 채점 줄 flex:none', () => {
    expect(css).toContain('.viewer-inspector .viewer-side__content {height:100%;display:flex;flex-direction:column;min-height:0;}');
    expect(css).toContain('.viewer-inspector .word-detail-card {display:flex;flex-direction:column;min-height:0;max-height:100%;flex:1;}');
    expect(css).toContain('.reader-card-body {flex:1;overflow:auto;overscroll-behavior:contain;min-height:0;padding:12px 16px;}');
    expect(css).toContain('.reader-card-actions {flex:none;padding:8px 12px;');
    expect(css).not.toMatch(/\.reader-card-actions\s*\{[^}]*position:\s*(?:fixed|absolute|sticky)/); // 흐름 안 — 내용을 덮지 않는다
  });
  it('채점 줄은 카드 본문(.reader-card-body) 뒤 형제 — 본문 스크롤 밖', () => {
    const card = sliceBetween(viewer, 'const renderWordDetailCard = (classAction=null,classMeaning=null) =>', 'const renderRightPanelContent =');
    expect(card.indexOf('<div className="reader-card-body"')).toBeGreaterThan(-1);
    expect(card.indexOf('<div className="reader-card-actions">')).toBeGreaterThan(card.indexOf('<div className="reader-card-body"'));
  });
});
