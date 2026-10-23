#!/usr/bin/env node
// 정적 · ISR 경로 산출 대조(GUEST-STATIC-001) — next build 뒤 .next/prerender-manifest.json이 src/lib/staticRoutes.js 표와 맞는지 본다.
// 빌드 추가 없음(CI e2e 빌드 산출을 읽기만 한다). 어긋나면 종료 코드 1.
import { readFileSync } from 'node:fs';
import { STATIC_ROUTES, staticRouteErrors } from '../src/lib/staticRoutes.js';

try {
  const manifest = JSON.parse(readFileSync(new URL('../.next/prerender-manifest.json', import.meta.url), 'utf8'));
  const errors = staticRouteErrors(manifest);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(JSON.stringify({ verified: STATIC_ROUTES.map(({ route, revalidate }) => `${route}${revalidate === false ? '' : ` (ISR ${revalidate}s)`}`) }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
