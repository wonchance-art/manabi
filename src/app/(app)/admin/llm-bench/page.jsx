import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LlmBenchPanel from '@/components/admin/LlmBenchPanel';

// 관리자 전용 모델 비교 측정(LLM-BENCH-001) — 진입 차단은 학습 지표 페이지와 같은 관용구, API도 requireAdmin으로 다시 검사한다.
export const metadata = { title: '모델 비교 측정' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (prof?.role !== 'admin') redirect('/home');
  return <LlmBenchPanel />;
}
