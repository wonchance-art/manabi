import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 배선 계약: ⑤ 유의어·반의어(오너 승인 2026-08-19) — 카드가 열리면 자동 조회하되
// 내용어만·캐시 우선·늦은 응답 가드, 표시는 뜻 바로 아래, 칩 탭 = 그 단어 카드로.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');

describe('유의어·반의어 배선', () => {
  // AE-R1 개정(VIEWER-V2-ROUNDS-001 §2.1 「더 알아보기 — AI로 새로 만드는 것이라 요청 버튼. 이미 만든 결과(캐시)가 있으면
  // 버튼 대신 내용」 · 접힘 0, 설계서 §7.2): details 펼침 조회 → [✦ 비슷한 말 찾기] 누름 조회 + 캐시만 보는 즉시 표시.
  it('내용어 게이트(synAntEligible)를 통과할 때만 — 캐시는 열 때 바로(peekSynAnt), 생성 조회는 요청 버튼(fetchSynAnt)', () => {
    expect(viewer).toContain("import { fetchSynAnt, peekSynAnt, synAntEligible } from '../lib/synAnt'");
    expect(viewer).toMatch(/!synAntEligible\(selectedToken, materialLang\)/);
    expect(viewer).toContain('fetchSynAnt(selectedToken, materialLang)');
    expect(viewer).toContain('peekSynAnt(selectedToken, materialLang)');
    const peek = read('src/lib/synAnt.js').match(/export async function peekSynAnt[\s\S]*?\n\}/)?.[0];
    expect(peek).toBeTruthy();
    expect(peek).not.toContain('callGemini'); // 캐시 확인은 네트워크·AI 0
  });

  it('늦게 온 응답이 다른 단어에 붙지 않는다(alive 가드)', () => {

    const effect = viewer.match(/\/\/ ⑤ 유의어·반의어[\s\S]*?\}, \[selectedToken, isSheetOpen, materialLang, synAntRequest\]\);/)?.[0];
    expect(effect).toBeTruthy();
    expect(effect).toContain('let alive = true');
    expect(effect).toContain('if (alive) setSynAnt(');
    expect(effect).toContain('return () => { alive = false; }');

  });

  it('유의어는 요청 버튼을 눌렀을 때 조회하고 빈 결과와 실패를 구분한다 — 접힘(details) 0', () => {
    expect(viewer).toContain('onClick={() => setSynAntRequest(n => n + 1)}');
    expect(viewer).not.toContain('onToggle=');
    expect(viewer).toContain('표시할 항목이 없어요.'); expect(viewer).toContain('불러오지 못했어요.');
  });

  it('칩 탭 = 그 단어 카드로 교체(handleListWordClick 재사용) — 새 상태 없음', () => {
    const chips = viewer.match(/const renderSynAntChips = [\s\S]*?\n  \)\);/)?.[0];
    expect(chips).toBeTruthy();
    expect(chips).toContain('handleListWordClick({ text: x.w, base_form: x.w, meaning: x.ko, furigana: x.r');
    expect(chips).toContain("className=\"syn-ant__chip\"");
  });

  it('스타일 존재 — 라벨·칩·읽기·뜻', () => {
    for (const cls of ['.syn-ant__row', '.syn-ant__chips', '.syn-ant__label', '.syn-ant__chip', '.syn-ant__r', '.syn-ant__ko']) {
      expect(css).toContain(cls);
    }
  });
});
