#!/usr/bin/env node
// 배포 빌드(`npm run build`) 진입점 — Google Fonts를 네트워크 대신 저장소 사본(vendor/google-fonts)에서 읽혀 `next build`를 돌린다.
//
// 왜(2026-10-13 실측): `next/font/google`은 빌드마다 10패밀리의 CSS 11개와 woff2 조각 약 950개(약 41MB)를
// Google에서 받고, 하나라도 실패하면 빌드 전체가 끝난다. 10-10 #1402 Preview(`Cannot read properties of null
// (reading '1')` — Google CSS가 확장자 없는 주소를 돌려줌)에 이어 10-13 #1419 Preview가 1회 재빌드까지
// `Failed to fetch Noto Serif KR`(ETIMEDOUT)로 ERROR였다. 재시도로는 확률만 줄 뿐이라, 같은 바이트를 저장소에 둔다.
//
// 사용자에게 가는 글꼴은 그대로다: layout의 `next/font/google` 호출은 바꾸지 않고, next가 받던 CSS·woff2만
// Google 응답 사본으로 준다(vendor/google-fonts/responses.cjs). 사본 갱신은 scripts/fonts/vendor-google-fonts.mjs.
// e2e 빌드는 이 경로를 쓰지 않는다 — `e2e:build`가 대역(e2e/fixtures/google-fonts-mock.cjs)을 쓴다.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VENDORED_FONT_RESPONSES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../vendor/google-fonts/responses.cjs',
);

// 빌드 힙 상한(BUILD-OOM-001, 2026-10-30 실측): 문학 chapters.json(33MB)이 서버 묶음에 정적으로 들어가 webpack 빌드
// 워커가 상한 없이 7.3GB까지 커졌고, Vercel 빌드 컨테이너(8GB)에서 #1611·#1612 운영 빌드가 메모리 초과로 죽었다.
// 4GB로 묶으면 V8이 일찍 GC해 같은 빌드가 총 5.6GB(단일 프로세스 5.4GB)로 통과한다. 이미 걸린 다른 상한
// (플랫폼 기본값 포함)은 덮는다 — 남겨 두면 그 값이 이긴다. 로컬 실험만 MANABI_BUILD_HEAP_MB로 바꾼다.
export const BUILD_HEAP_MB = 4096;

function buildNodeOptions(env) {
  const heap = Number(env.MANABI_BUILD_HEAP_MB) || BUILD_HEAP_MB;
  const rest = (env.NODE_OPTIONS || '').split(/\s+/).filter((flag) => flag && !/^--max-old-space-size(=|$)/.test(flag));
  return [...rest, `--max-old-space-size=${heap}`].join(' ');
}

/** `next build` 환경 — 글꼴 사본은 다른 값이 이미 지정돼 있으면(로컬 실험) 그대로 둔다. */
export function buildEnv(env = process.env) {
  return {
    ...env,
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES: env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES || VENDORED_FONT_RESPONSES,
    NODE_OPTIONS: buildNodeOptions(env),
  };
}

function runNextBuild(args) {
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve('next/dist/bin/next');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin, 'build', ...args], { stdio: 'inherit', env: buildEnv() });
    child.on('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runNextBuild(process.argv.slice(2));
}
