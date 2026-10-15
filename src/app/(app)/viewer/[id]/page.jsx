import { createSupabaseServerClient } from '@/lib/supabaseServer';
import ViewerPage from '@/views/ViewerPage';

// 제목 조회가 느려도 페이지를 막지 않는다 — 넘으면 기본 제목(VIEWER-META-TIMEOUT-001).
// 전에는 운영 주소 · 키를 박아 두어 e2e도 운영 DB로 나갔고, 그쪽이 느려지자 /viewer 서버 렌더가 30초 넘게 멈췄다(2026-10-15 KST CI).
const VIEWER_META_TIMEOUT_MS = 2500;

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    // 팀 사본(v2-AB R2) — local:<id>는 기기 안에만 있다. 서버 조회 없이 기본 제목.
    if (String(id).startsWith('local:')) return { title: '팀 자료 사본', description: '팀 페이지에서 받아 둔 사본' };
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from('reading_materials')
      .select('title')
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(VIEWER_META_TIMEOUT_MS))
      .single();
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

export default function Page() {
  return <ViewerPage />;
}
