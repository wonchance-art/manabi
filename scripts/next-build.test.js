import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildWithFontRetry, isFontFetchFailure } from './next-build.mjs';

// 10-10 #1402 Preview 첫 빌드 실패 로그(M09 보고)의 모양.
const UNKNOWN_FONT_ERROR = [
  'Failed to compile.',
  '',
  'src/app/layout.jsx',
  'An error occurred in `next/font`.',
  '',
  "TypeError: Cannot read properties of null (reading '1')",
  '    at next/dist/compiled/@next/font/dist/google/loader.js:122:78',
].join('\n');
const FETCH_FONT_ERROR = 'src/app/layout.jsx\n`next/font` error:\nFailed to fetch `Noto Sans KR` from Google Fonts.';
const FONT_CONFIG_ERROR = 'src/app/layout.jsx\n`next/font` error:\nUnknown font `Noto Sans XX`';
const PAGE_ERROR = "Failed to compile.\n\n./src/views/ViewerPage.jsx\nModule not found: Can't resolve './missing'";

describe('next-build: Google Fonts 일시 오류만 1회 재빌드', () => {
  it('글꼴 내려받기 실패(알 수 없는 오류·Failed to fetch)를 알아본다', () => {
    expect(isFontFetchFailure(UNKNOWN_FONT_ERROR)).toBe(true);
    expect(isFontFetchFailure(FETCH_FONT_ERROR)).toBe(true);
  });

  it('글꼴 설정 오류·다른 컴파일 오류는 재시도 대상이 아니다', () => {
    expect(isFontFetchFailure(FONT_CONFIG_ERROR)).toBe(false);
    expect(isFontFetchFailure(PAGE_ERROR)).toBe(false);
    expect(isFontFetchFailure('')).toBe(false);
    expect(isFontFetchFailure(undefined)).toBe(false);
  });

  const runner = (results) => {
    const calls = [];
    return { calls, run: async (args) => { calls.push(args); return results[calls.length - 1]; } };
  };
  const silent = () => {};

  it('첫 빌드가 성공하면 한 번만 돈다', async () => {
    const { calls, run } = runner([{ code: 0, tail: '' }]);
    expect(await buildWithFontRetry([], run, silent)).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('글꼴 실패 뒤 재빌드가 성공하면 0, 정확히 두 번', async () => {
    const { calls, run } = runner([{ code: 1, tail: UNKNOWN_FONT_ERROR }, { code: 0, tail: '' }]);
    expect(await buildWithFontRetry(['--debug'], run, silent)).toBe(0);
    expect(calls).toEqual([['--debug'], ['--debug']]);
  });

  it('글꼴 실패가 두 번이면 거기서 멈추고 실패 코드를 돌려준다 — 무한 재시도 없음', async () => {
    const { calls, run } = runner([{ code: 1, tail: FETCH_FONT_ERROR }, { code: 1, tail: FETCH_FONT_ERROR }]);
    expect(await buildWithFontRetry([], run, silent)).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it('글꼴과 무관한 실패는 재시도하지 않는다', async () => {
    const { calls, run } = runner([{ code: 1, tail: PAGE_ERROR }]);
    expect(await buildWithFontRetry([], run, silent)).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('배포 빌드 스크립트가 이 진입점을 쓰고, e2e 빌드는 대역을 유지한다', () => {
    const { scripts } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(scripts.build).toBe('node scripts/next-build.mjs');
    expect(scripts['e2e:build']).toContain('NEXT_FONT_GOOGLE_MOCKED_RESPONSES=');
  });
});
