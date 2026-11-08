import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// A11Y-LAUNCH-001 — 출시 손님 경로 접근성 점검(운영 axe 4.10 · WCAG 2.1 A/AA 위반 0, 2026-11-08 KST)에서 남은 best-practice 셋을 화면 변화 없이 고쳤다.
// 앱 틀 밖 쪽(404 · 개인정보 · 도움말 · 이용약관 · 출처)은 Layout의 <main>을 물려받지 않아 랜드마크가 없었고, 자료 목록은 h1 다음 카드 제목이 곧장 h3였다.
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('랜드마크 · 제목 순서(A11Y-LAUNCH-001)', () => {
  it.each(['src/app/not-found.jsx', 'src/app/privacy/page.jsx', 'src/app/help/page.jsx', 'src/app/terms/page.jsx', 'src/app/credits/page.jsx'])('%s: 본문이 <main> 하나 — 앱 틀 밖이라 직접 단다', (file) => {
    const src = read(file);
    expect(src).toMatch(/<div className="manabi-app"><main style=\{/);
    expect(src).toContain('</main></div>');
    expect(src.match(/<main style=/g)).toHaveLength(1);
  });

  it('자료 목록: 카드(h3) 앞에 화면 읽기용 h2 — 글자는 「함께 읽는 글」 글꼴 묶음에 있는 것만', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).toMatch(/<h2 className="sr-only">자료 목록<\/h2>\s*<div className="feature-grid">/);
    const chars = ['subset-reading.json', 'subset-reading-list.json'].map((f) => JSON.parse(read(`src/components/fonts/kr-viewer/${f}`)).chars).join('');
    for (const ch of '자료목록') expect(chars, ch).toContain(ch); // 숨긴 글이라도 렌더되므로 묶음 밖 글자는 KR 조각을 부른다
  });
});
