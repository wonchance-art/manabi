import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { reducedMotion } from '../reducedMotion';

// 계약: 동작 줄이기(prefers-reduced-motion)를 화면 이동이 공통으로 따른다 (MOTION-R2, 2026-10-17 KST).
// 상호작용 빈틈 조사 — 대화 끝으로 미끄러지기 · PDF 쪽 이동 · 읽기 근거로 이동 · 자료 추가 화면 4곳이 OS 설정을 무시하고
// smooth로 움직였고, 배움의 단어 복습 칸은 3.5초마다 저절로 바뀌었다.
const ROOT = process.cwd();
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
};
// 예외 — 이유와 함께. 같은 판정(matchMedia reduce)을 자체로 한다.
const ALLOW = Object.freeze({
  'src/views/ViewerPage.jsx': '뷰어는 자체 matchMedia(reduce) 검사 2곳(1183 · 1435 부근)으로 같은 판정 — 뷰어 분할 작업 중이라 손대지 않는다',
});

describe('reducedMotion()', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('창이 없으면(서버 렌더) false', () => expect(reducedMotion()).toBe(false));
  it('OS 설정을 그대로 읽는다', () => {
    const query = [];
    vi.stubGlobal('window', { matchMedia: (q) => { query.push(q); return { matches: true }; } });
    expect(reducedMotion()).toBe(true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(reducedMotion()).toBe(false);
    expect(query).toEqual(['(prefers-reduced-motion: reduce)']);
  });
});

describe("behavior: 'smooth'를 쓰는 화면은 동작 줄이기를 따른다", () => {
  const files = walk(path.join(ROOT, 'src')).map((f) => path.relative(ROOT, f).replaceAll('\\', '/'));
  const smooth = files.filter((f) => f !== 'src/lib/reducedMotion.js' && /'smooth'/.test(fs.readFileSync(f, 'utf8')));

  it('대상이 실제로 있다(공허 통과 방지)', () => expect(smooth.length).toBeGreaterThanOrEqual(6));

  it('reducedMotion(src/lib/reducedMotion.js)을 가져다 쓴다 — 예외는 이유 목록', () => {
    const missing = smooth.filter((f) => !ALLOW[f])
      .filter((f) => !/import\s*\{[^}]*\breducedMotion\b[^}]*\}\s*from\s*['"][^'"]*reducedMotion['"]/.test(fs.readFileSync(f, 'utf8')));
    expect(missing).toEqual([]);
  });

  it("smooth 줄은 그 자리에서 판정을 거친다(reducedMotion() · 같은 판정 변수)", () => {
    const bare = smooth.filter((f) => !ALLOW[f]).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
      .map((line, i) => [line, i + 1]).filter(([line]) => /behavior:\s*'smooth'/.test(line) && !/reducedMotion\(\)|if \(smooth\)/.test(line))
      .map(([line, n]) => `${f}:${n} ${line.trim()}`));
    expect(bare).toEqual([]);
  });

  it('배움의 단어 복습 칸 — 동작 줄이기면 자동 순환하지 않고 첫 단어를 고정한다', () => {
    const tiles = fs.readFileSync('src/components/learn/LearnTiles.jsx', 'utf8');
    expect(tiles).toMatch(/if \(pool\.length < 2 \|\| reducedMotion\(\)\) return undefined;\s*const t = setInterval/);
  });

  it('예외 목록의 파일은 실제로 smooth를 쓰고 자체 판정이 있다', () => {
    for (const [file, reason] of Object.entries(ALLOW)) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, file).toContain("'smooth'");
      expect(src, file).toContain('prefers-reduced-motion: reduce');
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});
