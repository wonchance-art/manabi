import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

// OFFLINE-SWEEP-001 — 오프라인 띠가 본문을 덮지 않는다.
// 390 실측(2026-10-23 KST): 머리말 아래 고정(position: fixed; top: var(--gnb-height)) 두 줄 띠가 뷰어 도구 줄(sticky top: var(--gnb-height))
// 위에 앉아 「Aa 읽기 설정」 누름을 가로챘다(Playwright: offline-banner intercepts pointer events) · /conversation/new 제목 · /vocab 사본 안내도 가렸다.
const layout = fs.readFileSync('src/components/Layout.jsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const rule = sliceBetween(css, '.offline-banner {', '}');

describe('오프라인 띠 — 본문 맨 위 흐름 안', () => {
  it('main 안 · children 바로 앞에 그린다(머리말 아래 겹치는 자리 아님)', () => {
    const main = sliceBetween(layout, '<main className="app-layout"', '</main>');
    const banner = main.indexOf('className="offline-banner"');
    expect(banner).toBeGreaterThan(0);
    expect(banner).toBeLessThan(main.indexOf('{children}'));
    expect(layout.match(/className="offline-banner"/g)).toHaveLength(1);
  });
  it('고정 · 겹침 배치를 쓰지 않는다', () => {
    expect(rule).not.toBe('');
    expect(rule).not.toMatch(/position:\s*(fixed|sticky|absolute)/);
    expect(rule).not.toMatch(/z-index/);
  });
  it('문구는 연결 끊김 표준 그대로(인터넷 연결을 확인해 주세요 + 보관 여부 한 문장)', () => {
    expect(layout).toContain('인터넷 연결을 확인해 주세요. 저장해 둔 자료·단어장은 그대로 볼 수 있어요.');
  });
});
