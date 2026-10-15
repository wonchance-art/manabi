import { createSupabaseServerClient } from '@/lib/supabaseServer';
import ViewerPage from '@/views/ViewerPage';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    // 팀 사본(v2-AB R2) — local:<id>는 기기 안에만 있다. 서버 조회 없이 기본 제목.
    if (String(id).startsWith('local:')) return { title: '팀 자료 사본', description: '팀 페이지에서 받아 둔 사본' };
    // 정본 서버 클라이언트(NEXT_PUBLIC_SUPABASE_URL)를 쓴다 — 운영 주소를 박아 두면 e2e 서버에서
    // 목(server-fetch-mock)을 우회해 실제 운영 DB로 나가고, 그 응답이 멎으면 문서 응답 전체가 멎는다.
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from('reading_materials')
      .select('title')
      .eq('id', id)
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
