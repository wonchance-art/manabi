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

/** `next build` 환경 — 다른 값이 이미 지정돼 있으면(로컬 실험) 그대로 둔다. */
export function buildEnv(env = process.env) {
  return { ...env, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES || VENDORED_FONT_RESPONSES };
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
