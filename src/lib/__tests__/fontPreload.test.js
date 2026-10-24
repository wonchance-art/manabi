// 글꼴 미리 받기(FONT-PRELOAD-001) — 쓰이지 않는 글꼴 조각을 모든 페이지에서 미리 받지 않는다.
// Preview b8fc2b62 실측(2026-10-17 KST, 로그아웃 10페이지 × 390 · 1440): 미리 받는 라틴 조각 7개 중 Inter(47kB)는 어느 페이지에서도
// 쓰이지 않았다 — 앱 화면은 Noto Sans KR · Manrope가 먼저다. 미리 받기만 뺀다(@font-face · 글꼴 목록은 그대로 → 그려지는 픽셀 동일).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const layout = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.jsx'), 'utf8');
const block = (name) => sliceBetween(layout, `const ${name} = `, '});');

describe('루트 글꼴 미리 받기', () => {
  it('Inter는 미리 받지 않는다 — 굵기 · 변수 · swap은 그대로(쓰는 곳은 그때 받는다)', () => {
    const inter = block('inter');
    expect(inter).toContain('preload: false,');
    expect(inter).toContain("weight: ['400', '500', '600', '700'],");
    expect(inter).toContain("variable: '--font-inter',");
    expect(inter).toContain("display: 'swap',");
  });
  it('첫 화면에 쓰이는 글꼴(KR · SC)의 미리 받기는 건드리지 않는다(SC는 범위 부품 — FONT-SC-SCOPE-001)', () => {
    // JP는 일본어를 그리는 세그먼트만 힌트를 건다(FIELD-AUDIT 2026-10-23 KST 실측 — 라틴 면을 쓰는 화면이 일부뿐) — 계약은 src/app/__tests__/fontHints.test.js.
    expect(block('notoKr')).not.toContain('preload');
    expect(block('notoJp')).toContain('preload: false,');
    const sc = fs.readFileSync(path.join(process.cwd(), 'src/components/fonts/ScFontScope.jsx'), 'utf8');
    expect(sliceBetween(sc, 'const notoSc = ', '});')).not.toContain('preload');
  });
  it('Noto Sans(병음 · 라틴 본문)는 루트에서 미리 받지 않고 그리는 세그먼트만 힌트를 건다 — 계약은 src/app/__tests__/fontHints.test.js', () => {
    expect(block('notoSans')).toContain('preload: false,');
    expect(layout).toContain('src/components/fonts/fontHints.js');
  });
});
