import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

// 색 체계 정리(설계안 https://claude.ai/artifact/Bz7Uc4dsZb4nmZXHpBQktL — 오너 「설계 승인」 2026-11-04 KST).
// 단계마다 결정된 값을 여기서 고정한다. 화면 벽 실측(https://claude.ai/artifact/SNM91N7kjTrRts5qkYr5WJ)이 근거.
const read = (p) => readFileSync(p, 'utf8');
const cssFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return ['__tests__', 'world', 'textbookEditions'].includes(e.name) ? [] : cssFiles(p);
  return /\.css$/.test(e.name) ? [p] : [];
});

describe('단계 2-① 교재 보조 글자 = 셸 --muted (오너 「거의 똑같네. 통일 ㄱ」 2026-11-04 KST)', () => {
  // 교재 화면 12장면만 보조 글자가 교재 스타일시트 직접 값 #796D70(따뜻한 회갈색)이었다 — 나머지 98장면은 셸 #65675F.
  // 시안: https://claude.ai/artifact/4h8MyVDmm4axpwWWnKiDSU. 교재 판본별 스타일(content/textbookEditions, 편집 데이터)은 범위 밖.
  it('학습 웹 CSS에 옛 교재 회갈색 #796D70이 다시 들어오지 않는다', () => {
    const hits = cssFiles('src').filter((f) => /#796d70/i.test(read(f)));
    expect(hits).toEqual([]);
  });

  it('교재 셸 블록은 보조 글자 토큰을 다시 정의하지 않는다 — 셸(web-shell.css)이 정본', () => {
    const block = read('src/components/books/reading-shell.css').match(/\.manabi-app\{[^}]*\}/)?.[0] || '';
    expect(block).not.toMatch(/--text-secondary:|--text-muted:|--muted:/);
    expect(read('src/components/books/reading-content.css').match(/\.book-reading-content\{[^}]*\}/)?.[0]).not.toMatch(/--muted:/);
    expect(read('src/components/web/web-shell.css')).toMatch(/\.manabi-app\{[^}]*--muted:#65675f;[^}]*--text-secondary:var\(--muted\);[^}]*--text-muted:var\(--muted\)/);
  });

  it('교재 보조 글자 자리는 var(--muted)를 쓴다', () => {
    const shell = read('src/components/books/reading-shell.css');
    for (const sel of ['.manabi-app .gnb__link{', '.manabi-eyebrow{', '.manabi-section-heading>span{']) {
      expect(sliceBetween(shell, sel, '}'), sel).toContain('color:var(--muted)');
    }
    expect(read('src/components/books/study-route.css')).toContain('.book-recall-links strong{font-size:12px;color:var(--muted)}');
  });
});
