import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 바꾼 화면 문구가 e2e 선택자에 남지 않게(2026-10-17 KST 리뷰): COPY-FIX-001에서 문구를 바꾸자 CI 밖 e2e 4파일이 깨졌고,
// smoke의 「…를 불러오지 못했어요」 0건 단언은 옛 문구를 찾느라 늘 통과하는 검사가 됐다. 문구를 바꾸면 여기에 옛 문구를 더한다.
const RETIRED = [
  { old: '이어서 읽기', now: '이어 읽기' },
  { old: '이어서 하기', now: '이어 하기' },
  { old: '새 자료 작성', now: '자료 추가' },
  { old: '단어장을 불러오지 못했어요', now: '복습 화면을 불러오지 못했어요' },
];
const walk = (dir, test, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (!['node_modules', '__tests__', 'world'].includes(name)) walk(path, test, out); }
    else if (test(name)) out.push(path);
  }
  return out;
};
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const e2e = walk(join(process.cwd(), 'e2e'), (name) => /\.m?js$/.test(name));
const screens = ['app', 'components', 'views'].flatMap((dir) => walk(join(process.cwd(), 'src', dir), (name) => /\.(js|jsx)$/.test(name)));

describe('옛 화면 문구는 e2e에도 화면 코드에도 없다', () => {
  it('e2e 파일을 실제로 읽는다', () => expect(e2e.length).toBeGreaterThan(10));
  it.each(RETIRED)('$old → $now', ({ old, now }) => {
    expect(e2e.filter((file) => readFileSync(file, 'utf8').includes(old))).toEqual([]);
    expect(screens.filter((file) => strip(readFileSync(file, 'utf8')).includes(old))).toEqual([]);
    expect(screens.some((file) => readFileSync(file, 'utf8').includes(now))).toBe(true);
  });
});
