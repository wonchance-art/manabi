import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Noto Serif KR 600 · 700은 (app) 레이아웃 한 벌만 선언한다(FIELD-AUDIT 2026-10-23 KST — 운영 /discover 실측).
// 초판 표지(FirstEditionCoverSecond)가 같은 굵기를 다시 선언해 같은 @font-face 248개(렌더 차단 CSS 약 25KB br)가 두 벌 실렸다.
// 파일 주소가 같아 글꼴은 한 번만 받았으므로 표지는 (app)의 변수(--font-serif-kr)를 쓰면 그려지는 픽셀이 같다.
// 표지는 (app) 안(/discover · /materials · /admin)에서만 그린다 — 밖에서도 폴백 이름 "Noto Serif KR"이 남는다.
const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
};

describe('Noto Serif KR 600 · 700 단일 선언', () => {
  it('600 · 700 굵기의 Noto_Serif_KR 호출은 (app) 레이아웃 한 곳이다', () => {
    const calls = walk(path.join(ROOT, 'src')).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/Noto_Serif_KR\(\{([\s\S]*?)\}\)/g)]
      .filter((m) => /'600'|'700'/.test(m[1])).map(() => path.relative(ROOT, f).replaceAll('\\', '/')));
    expect(calls).toEqual(['src/app/(app)/layout.jsx']);
    expect(read('src/app/(app)/layout.jsx')).toContain("variable: '--font-serif-kr',");
  });
  it('초판 표지의 굵은 명조는 (app) 변수 + 같은 이름 폴백 + 한자 글꼴을 쓴다', () => {
    const cover = read('src/components/books/FirstEditionCoverSecond.jsx');
    expect(cover).toContain("const KR_BOLD = stack('--font-serif-kr', 'Noto Serif KR', HANJA);");
    expect(cover).not.toContain('--font-fe-kr-bold');
    expect(cover).toContain('const stack = (variable, family, ...rest) => [`var(${variable}, "${family}")`, `"${family}"`, ...rest].join(\', \');');
  });
});
