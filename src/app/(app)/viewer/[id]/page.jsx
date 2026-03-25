import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase';
import ViewerPage from '@/views/ViewerPage';

export async function generateMetadata({ params }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });
  const { data } = await supabase
    .from('reading_materials')
    .select('title')
    .eq('id', params.id)
    .single();
  return {
    title: data?.title ? `${data.title} | Anatomy Studio` : 'Anatomy Studio',
    description: data?.title ? `AI가 분석한 "${data.title}" 학습 자료` : undefined,
  };
}

export default function Page() {
  return <ViewerPage />;
}
