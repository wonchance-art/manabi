// GNB-PHONE-001 · GNB-AUTOHIDE-001 — 휴대폰 머리 52px, 긴 글 화면에서 내려 읽으면 머리 숨김(오너 2026-10-31 KST 「권장대로 A+B」).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { GNB_AUTOHIDE, isGnbAutoHideRoute, nextGnbHidden } from '../gnbAutoHide';
import { sliceBetween } from './helpers/sliceBetween';

const shell = fs.readFileSync('src/components/web/web-shell.css', 'utf8');

describe('A — 휴대폰 머리 52px', () => {
  it('셸 폭 680 이하에서 머리 · 본문 위 여백 모두 52px + 상태 표시줄(집중 읽기 제외)', () => {
    const block = sliceBetween(shell, '/* GNB-PHONE-001', '/* GNB-AUTOHIDE-001');
    expect(block).toMatch(/@container manabi-shell \(max-width:680px\)\{\.manabi-app:not\(\.manabi-app--reading\) \.app-layout\{--gnb-height:calc\(52px \+ env\(safe-area-inset-top,0px\)\)\}/);
    expect(block).toMatch(/\.manabi-app:not\(\.manabi-app--reading\) \.gnb\{--gnb-height:calc\(52px \+ env\(safe-area-inset-top,0px\)\);height:var\(--gnb-height\)\}/);
  });
});

describe('B — 긴 글 화면에서만 숨김', () => {
  it('교재 · 지역학 안쪽만 — 배움 · 단어 · 복습 · 뷰어는 아니다', () => {
    for (const p of ['/books/japanese-n5', '/books/japanese-n5/edition/x/y', '/studies/japan', '/studies/korea/seoul']) expect(isGnbAutoHideRoute(p), p).toBe(true);
    for (const p of ['/books', '/studies', '/home', '/vocab', '/chinese/vocab/h1', '/review', '/viewer/45', '/progress', null]) expect(isGnbAutoHideRoute(p), String(p)).toBe(false);
  });

  it('내려가면 숨고, 조금이라도 올리면 · 맨 위 근처면 보인다 — 작은 떨림은 무시', () => {
    let s = { hidden: false, anchor: 0 }, last = 0;
    const go = (y) => { s = nextGnbHidden({ ...s, y, lastY: last }); last = y; return s.hidden; };
    expect(go(60)).toBe(false); // 맨 위 근처
    expect(go(200)).toBe(true); // 내려 읽기
    expect(go(204)).toBe(true);
    expect(go(201)).toBe(true); // 3px 떨림은 무시
    expect(go(190)).toBe(false); // 올리면 보임
    expect(go(193)).toBe(false); // 3px 떨림
    expect(go(400)).toBe(true);
    expect(go(GNB_AUTOHIDE.topZone - 1)).toBe(false);
  });

  it('숨겨도 상태 표시줄 칸은 머리 바탕색 띠로 남고, 움직임 줄이기에선 즉시', () => {
    expect(shell).toContain('.manabi-app[data-gnb-hidden] .gnb{transform:translateY(-100%)');
    expect(shell).toMatch(/\.manabi-app\[data-gnb-hidden\]::before\{content:'';position:fixed;inset:0 0 auto;height:env\(safe-area-inset-top,0px\);background:var\(--gnb-bg,var\(--paper\)\);z-index:1001\}/);
    expect(shell).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.manabi-app \.gnb\{transition:none\}\}/);
    const layout = fs.readFileSync('src/components/Layout.jsx', 'utf8');
    expect(layout).toContain('data-gnb-hidden={gnbHidden || undefined}');
    expect(fs.readFileSync('src/lib/useGnbAutoHide.js', 'utf8')).toContain("closest('.gnb')"); // 포커스가 머리에 들어오면 보임
  });
});
