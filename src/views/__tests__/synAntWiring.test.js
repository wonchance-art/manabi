import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 배선 계약: ⑤ 유의어·반의어(오너 승인 2026-08-19) — 카드가 열리면 자동 조회하되
// 내용어만·캐시 우선·늦은 응답 가드, 표시는 뜻 바로 아래, 칩 탭 = 그 단어 카드로.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');

describe('유의어·반의어 배선', () => {
  it('카드 열림 시 자동 조회 — 내용어 게이트(synAntEligible)를 통과할 때만', () => {
    expect(viewer).toContain("import { fetchSynAnt, synAntEligible } from '../lib/synAnt'");
    expect(viewer).toMatch(/!synAntEligible\(selectedToken, materialLang\)/);
    expect(viewer).toContain('fetchSynAnt(selectedToken, materialLang)');
  });

  it('늦게 온 응답이 다른 단어에 붙지 않는다(alive 가드) — 실패는 조용히(null)', () => {
    const effect = viewer.match(/\/\/ ⑤ 유의어·반의어[\s\S]*?\}, \[selectedToken, isSheetOpen, materialLang\]\);/)?.[0];
    expect(effect).toBeTruthy();
    expect(effect).toContain('let alive = true');
    expect(effect).toContain('if (alive) setSynAnt(');
    expect(effect).toContain('return () => { alive = false; }');
  });

  it('표시는 뜻 바로 아래·로딩 중엔 조용히 — 빈 결과는 아무것도 그리지 않는다', () => {
    const meaningAt = viewer.indexOf("refMeaning || selectedToken.meaning || '(뜻 없음)'");
    const synAt = viewer.indexOf('className="syn-ant"');
    const editPanelAt = viewer.indexOf('<TokenEditPanel');
    expect(meaningAt).toBeGreaterThan(-1);
    expect(synAt).toBeGreaterThan(meaningAt);
    expect(synAt).toBeLessThan(editPanelAt);
    expect(viewer).toContain('!synAnt.loading && (synAnt.syn.length > 0 || synAnt.ant.length > 0)');
  });

  it('칩 탭 = 그 단어 카드로 교체(handleListWordClick 재사용) — 새 상태 없음', () => {
    const chips = viewer.match(/const renderSynAntChips = [\s\S]*?\n  \)\);/)?.[0];
    expect(chips).toBeTruthy();
    expect(chips).toContain('handleListWordClick({ text: x.w, base_form: x.w, meaning: x.ko, furigana: x.r');
    expect(chips).toContain("className=\"syn-ant__chip\"");
  });

  it('스타일 존재 — 라벨·칩·읽기·뜻', () => {
    for (const cls of ['.syn-ant__row', '.syn-ant__label', '.syn-ant__chip', '.syn-ant__r', '.syn-ant__ko']) {
      expect(css).toContain(cls);
    }
  });
});
