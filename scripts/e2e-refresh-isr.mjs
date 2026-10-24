#!/usr/bin/env node
// e2e 전용 — 같은 빌드를 다른 발행 상태로 띄운 서버(E2E_PUBLISHED_BOOKS=japanese-n3 · n4)의 ISR 판을 새로 만든다(GUEST-STATIC-001 3단계).
// 왜: 책장(/lessons)과 산책은 빌드 때 구운 판을 1시간 · 5분 준다. CI는 빌드 한 번으로 서버를 여럿 띄우며 서버마다 발행 상태(대역)를 바꾸는데,
// 빌드 때 상태(N5만 발행)로 구운 책장이 그대로 나가 N3 · N4 발행 장면이 옛 판을 봤다(e2e 빌드 실측). 운영에서는 발행 API가 revalidatePath로
// 같은 일을 한다 — 여기서는 Next의 즉시 재생성 요청(x-prerender-revalidate, 이 빌드의 미리보기 키)으로 그 무효화를 흉내 낸다.
// 쓰임: node scripts/e2e-refresh-isr.mjs http://127.0.0.1:8880 /lessons /books  — 서버는 로컬 주소만, 둘째 인자부터의 접두 아래 ISR 판만
// (발행 상태에 달린 책장 · 교재 첫 화면 판 — 4단계). 산책(/discover)은 넣지 않는다: e2e 대역에 서가 조회가 없어 재생성이 일부러 실패(직전 판 유지)한다.
// 배움(/home)도 넣지 않는다: 서버마다 N5 발행이 같아(대역은 N5를 늘 발행) 빌드 때 판 그대로다.
import { readFileSync } from 'node:fs';
import { isrPaths } from '../src/lib/staticRoutes.js';

const [base, ...prefixes] = process.argv.slice(2);
try {
  const url = new URL(base);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('local_e2e_server_only');
  const manifest = JSON.parse(readFileSync(new URL('../.next/prerender-manifest.json', import.meta.url), 'utf8'));
  const paths = [...new Set((prefixes.length ? prefixes : ['/lessons']).flatMap(prefix => isrPaths(manifest, prefix)))];
  if (!paths.length) throw new Error('no_isr_paths');
  for (const path of paths) {
    const response = await fetch(new URL(path, url), { headers: { 'x-prerender-revalidate': manifest.preview.previewModeId }, redirect: 'manual' });
    if (response.status !== 200) throw new Error(`refresh_failed ${path} ${response.status}`);
  }
  console.log(JSON.stringify({ refreshed: paths }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
