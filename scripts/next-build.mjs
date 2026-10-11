#!/usr/bin/env node
// 배포 빌드(`npm run build`) 진입점 — `next build`가 Google Fonts 일시 오류로 죽으면 한 번만 다시 빌드한다.
//
// 왜(2026-10-10 실측): `next/font/google`은 빌드마다 선언한 10패밀리의 CSS와 woff2 조각 수백 개를
// fonts.gstatic에서 내려받고, 하나라도 실패하면 빌드 전체가 끝난다. 내부 재시도는 파일당 3회·수백 ms뿐이다.
// #1402 Preview 첫 빌드가 `An error occurred in \`next/font\`` + `Cannot read properties of null (reading '1')`
// (Google CSS가 확장자 없는 파일 주소를 돌려준 경우)로 실패했고, 코드 변경 없이 같은 head 재빌드는 통과했다.
// 운영 빌드가 같은 이유로 죽으면 main이 배포되지 않은 채 남는다.
//
// 범위: 글꼴 내려받기 실패로 판정될 때만 1회 재시도한다. 그 밖의 실패(타입·컴파일·prebuild 검사)는
// 재시도 없이 그대로 실패한다. 사용자에게 가는 글꼴은 그대로다(next/font/google 유지).
// e2e 빌드는 이 경로를 쓰지 않는다 — `e2e:build`가 대역(e2e/fixtures/google-fonts-mock.cjs)으로 네트워크를 끊는다.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const MAX_ATTEMPTS = 2;
const TAIL_LIMIT = 64 * 1024;

/**
 * 빌드 출력이 Google Fonts 내려받기 실패인지 판정한다.
 * - `next/font` 알려진 오류 중 내려받기 실패: "`next/font` error:\nFailed to fetch `Inter` from Google Fonts."
 * - 알 수 없는 오류(스택 동반): "An error occurred in `next/font`." — 응답 모양이 어긋난 경우(10-10 실측)
 * 설정 오류(Unknown font 등)는 `next/font` error지만 "from Google Fonts" 내려받기 문구가 없어 재시도하지 않는다.
 */
export function isFontFetchFailure(output) {
  if (typeof output !== 'string' || !output) return false;
  if (output.includes('An error occurred in `next/font`.')) return true;
  return /`next\/font` error:\s*\n\s*Failed to fetch( font)? `[^`]+`/.test(output);
}

function runNextBuild(args) {
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve('next/dist/bin/next');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin, 'build', ...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
    });
    let tail = '';
    const relay = (stream) => (chunk) => {
      stream.write(chunk);
      tail = (tail + chunk.toString()).slice(-TAIL_LIMIT);
    };
    child.stdout.on('data', relay(process.stdout));
    child.stderr.on('data', relay(process.stderr));
    child.on('close', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), tail }));
  });
}

export async function buildWithFontRetry(args = [], run = runNextBuild, log = console.error) {
  let result;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    result = await run(args);
    if (result.code === 0) return 0;
    if (attempt === MAX_ATTEMPTS || !isFontFetchFailure(result.tail)) break;
    log(`\n[next-build] Google Fonts 내려받기 실패로 판정 — 같은 소스로 한 번 더 빌드합니다 (${attempt + 1}/${MAX_ATTEMPTS}).\n`);
  }
  return result.code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await buildWithFontRetry(process.argv.slice(2));
}
