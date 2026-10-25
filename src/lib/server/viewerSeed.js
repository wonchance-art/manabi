// 뷰어 본문을 첫 HTML에 싣는다(VIEWER-SEED-001, 로그인 감사 F3② 2026-10-25 KST). 본문 `reading_materials?select=*`는 지금까지
// 브라우저가 JS를 다 받고 실행한 뒤(모바일 약 1.9초)에야 보냈다 — 서버는 generateMetadata에서 이미 같은 행을 읽는다.
// 서버가 문서 요청에서 한 번 읽어(제목도 이 결과를 쓴다) 뷰어에 넘기고, 뷰어는 하이드레이션 때 조기 조회 등록부(lib/viewerMaterial)에
// 그 행을 넣는다 — 화면은 지금과 같은 순서(불러오기 → 본문)로 그려지고, 브라우저 조회 한 번(프리플라이트 포함)이 빠진다.
//
// 계정 경계: 행은 **요청한 사람의 권한으로만** 읽는다 — 세션 쿠키가 있으면 그 접근 토큰(requireUserClaims — 토큰 갱신 없음 ·
// LIBRARY-PREFETCH-002), 없으면 anon(createSupabasePublicClient — 쿠키를 읽지도 쓰지도 않음). 그래서 실린 행은 그 계정이 브라우저에서
// 받을 행과 같다(RLS 그대로). 응답은 동적 화면이라 Cache-Control: private, no-store — 공유 캐시에 남지 않는다.
// 읽은 계정(account)을 함께 실어, 브라우저는 지금 세션 계정과 같을 때만 쓴다(lib/viewerMaterial adoptViewerSeed — 기기에 남은 옛 문서 ·
// 다른 계정이 다시 연 문서는 쓰지 않고 지금처럼 새로 받는다).
// **공개 자료(visibility 'public')만 싣는다**(오너 판단 2026-10-25 KST): 서비스 워커는 들른 문서를 기기 캐시(계정 구분 없음)에 남기므로,
// 비공개 본문을 실으면 그 캐시에 비공개 본문이 새로 남는다. 비공개 · 그 밖의 공개 범위는 지금처럼 브라우저가 받는다(제목은 지금처럼 <title>에).
// 싣지 않는 경우(null — 지금처럼 브라우저가 받는다): 숫자 id가 아님(팀 사본 local: 등) · 화면 이동(RSC 요청 — 서재 누름은 이미 조기 조회가
// 떠 있고, 서버 조회만큼 화면 조각이 늦어진다) · 쿠키는 있는데 토큰이 곧 만료/무효 · 조회 오류 · 시간 초과 · 응답이 그 id의 행이 아님.
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { createSupabasePublicClient, requireUserClaims } from '@/lib/supabaseServer';

// 쪽(본문)이 기다리는 상한 — 서재 미리 받기와 같은 800ms(LIBRARY-PREFETCH-001). 넘으면 싣지 않고 지금처럼 그린다.
export const VIEWER_SEED_BUDGET_MS = 800;
// 조회 자체의 상한 — 제목 조회와 같은 2.5초(VIEWER-META-TIMEOUT-001). 제목은 이 결과를 쪽보다 오래 기다릴 수 있다.
export const VIEWER_SEED_QUERY_TIMEOUT_MS = 2500;

const NUMERIC_ID = /^\d+$/;

/**
 * @returns {Promise<null | { id: string, row: object | null, account: string | null, servedAt: number }>}
 *   row null = 그 계정에게 보이는 행이 없다(RLS · 삭제) — 제목은 기본값, 본문은 싣지 않는다.
 */
export async function loadViewerSeed(id, { rscRequest = false, sessionCookie = false, auth = requireUserClaims,
  publicClient = createSupabasePublicClient, now = Date.now, timeoutMs = VIEWER_SEED_QUERY_TIMEOUT_MS } = {}) {
  const key = String(id ?? '');
  if (!NUMERIC_ID.test(key) || rscRequest) return null;
  try {
    let client = null, account = null;
    if (sessionCookie) {
      const session = await auth();
      if (!session?.user?.id || !session.supabase) return null;
      client = session.supabase; account = session.user.id;
    } else client = publicClient();
    const { data, error } = await client.from('reading_materials').select('*').eq('id', key)
      .abortSignal(AbortSignal.timeout(timeoutMs)).maybeSingle();
    if (error) return null;
    // 그 id의 행만 싣는다 — 다른 모양(부분 행 · 다른 id)이면 브라우저가 지금처럼 받는다.
    if (data && String(data.id) !== key) return null;
    // 키 순서는 계약이다 — id가 첫 키(브라우저가 받은 화면 조각에서 `"seed":{"id":"<id>",`로 실어 온 문서를 알아본다 · viewerSeedAdopted).
    return { id: key, row: data ?? null, account, servedAt: now() };
  } catch {
    return null;
  }
}

/**
 * 문서 요청인가 — 화면 이동 · 새로고침 관문(router.refresh)의 RSC 요청이면 거짓. Next는 RSC 머리(RSC · Next-Router-State-Tree 등)를
 * headers()에서 지운다(next/dist/server/async-storage/request-store.js getHeaders — 쪽이 요청 종류로 갈리지 않게). 그래서 브라우저가
 * 붙이는 Sec-Fetch-Dest를 본다: 문서 이동은 document, RSC fetch는 empty. 머리가 없으면(브라우저 아님) 문서로 본다.
 */
export function documentRequest(headerList) {
  const dest = headerList?.get?.('sec-fetch-dest');
  return !dest || dest === 'document';
}

/** 요청 안에서 한 번만 읽는다(generateMetadata · 쪽이 같은 결과를 쓴다 — React cache는 요청 단위). */
export const readViewerSeed = cache(async (id) => {
  try {
    const [headerList, jar] = await Promise.all([headers(), cookies()]);
    return await loadViewerSeed(id, { rscRequest: !documentRequest(headerList), sessionCookie: hasSupabaseSessionInJar(jar) });
  } catch {
    return null;
  }
});

const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve(null), Math.max(0, ms)));

/** 본문을 쪽에 실어도 되는 행 — 공개 자료만(비공개 본문을 서비스 워커 문서 캐시에 남기지 않는다). */
export const seedableRow = (row) => row?.visibility === 'public';

/** 쪽이 쓰는 몫 — 예산 안에 끝난, 실어도 되는(공개) 행이 있는 결과만. 제목(generateMetadata)은 행을 그대로 쓴다. */
export async function viewerSeedWithin(id, budgetMs = VIEWER_SEED_BUDGET_MS, read = readViewerSeed) {
  const seed = await Promise.race([read(id), timeout(budgetMs)]).catch(() => null);
  return seedableRow(seed?.row) ? seed : null;
}
