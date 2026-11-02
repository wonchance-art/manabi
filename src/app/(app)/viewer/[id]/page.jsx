import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { readViewerSeed, viewerSeedWithin } from '@/lib/server/viewerSeed';
import { viewerSsrGuardScript, viewerSsrRow } from '@/lib/viewerSsr';
import ViewerLoading from '@/components/viewer/ViewerLoading';
import ViewerPage from '@/views/ViewerPage';

// 제목 조회가 느려도 페이지를 막지 않는다 — 넘으면 기본 제목(VIEWER-META-TIMEOUT-001).
// 전에는 운영 주소 · 키를 박아 두어 e2e도 운영 DB로 나갔고, 그쪽이 느려지자 /viewer 서버 렌더가 30초 넘게 멈췄다(2026-10-15 KST CI).
const VIEWER_META_TIMEOUT_MS = 2500;

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    // 팀 사본(v2-AB R2) — local:<id>는 기기 안에만 있다. 서버 조회 없이 기본 제목.
    if (String(id).startsWith('local:')) return { title: '팀 자료 사본', description: '팀 페이지에서 받아 둔 사본' };
    // 문서 요청은 쪽이 본문을 실으려고 읽는 행(VIEWER-SEED-001 — 같은 요청 · 같은 계정 권한)에서 제목을 꺼낸다. 싣지 않는 요청
    // (화면 이동 · 토큰 만료 직전 · 실패)은 지금처럼 제목만 읽는다.
    const seed = await readViewerSeed(id);
    const data = seed ? seed.row : await (await createSupabaseServerClient())
      .from('reading_materials')
      .select('title')
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(VIEWER_META_TIMEOUT_MS))
      .single()
      .then(({ data: row }) => row);
    const title = data?.title ? `${data.title}` : '자료 뷰어';
    const description = data?.title ? `AI가 분석한 "${data.title}" 학습 자료` : 'AI 언어 해부 학습';
    return {
      title,
      description,
      openGraph: { title, description },
    };
  } catch {
    return { title: '자료 뷰어' };
  }
}

// 본문 싣기(VIEWER-SEED-001)는 이 경계 안에서 기다린다 — 기다리는 동안 첫 HTML은 지금 뷰어의 첫 그림(불러오기)과 같은 마크업이다.
// 쪽 전체를 async로 두면 (app)/loading.jsx(늦게 보이는 「화면 불러오는 중…」)가 첫 그림이 된다.
export default function Page({ params, searchParams }) {
  return <Suspense fallback={<ViewerLoading />}><SeededViewerPage params={params} searchParams={searchParams} /></Suspense>;
}

// 손님의 분석된 공개 자료면 본문까지 서버가 그린다(VIEWER-SSR-001, lib/viewerSsr). 본문 앞의 스크립트가 첫 그림 전에 이 기기 설정이
// 서버 그림(기본 설정)과 맞는지 보고, 어긋나면 본문을 감추고 불러오기 그림을 보인다(뷰어가 설정을 다 읽은 뒤 뗀다).
async function SeededViewerPage({ params, searchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const seed = await viewerSeedWithin(id);
  const ssr = viewerSsrRow(seed, id, query);
  return (
    <>
      {ssr && <script dangerouslySetInnerHTML={{ __html: viewerSsrGuardScript({ language: ssr.processed_json?.metadata?.language || 'Japanese', servedAt: seed.servedAt }) }} />}
      {ssr && <div className="viewer-ssr-hold"><ViewerLoading /></div>}
      <ViewerPage seed={seed ?? undefined} />
    </>
  );
}
