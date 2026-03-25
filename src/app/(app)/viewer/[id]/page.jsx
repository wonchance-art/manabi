import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ViewerPage from '@/views/ViewerPage';

const SUPABASE_URL = 'https://jdtowtxhexcweuxawrds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr';

export async function generateMetadata({ params }) {
  try {
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
      title: data?.title ? `${data.title} | Anatomy Studio` : '자료 뷰어 | Anatomy Studio',
      description: data?.title ? `AI가 분석한 "${data.title}" 학습 자료` : undefined,
    };
  } catch {
    return { title: '자료 뷰어 | Anatomy Studio' };
  }
}

export default function Page() {
  return <ViewerPage />;
}
