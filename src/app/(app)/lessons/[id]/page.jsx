import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import LessonViewer from '@/views/LessonViewer';

const SUPABASE_URL = 'https://jdtowtxhexcweuxawrds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
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
      .eq('id', id)
      .single();
    const title = data?.title ? `${data.title} | 강의 | Anatomy Studio` : '강의 | Anatomy Studio';
    const description = data?.title ? `${data.title} — 파인만식 3단계 학습` : '단계별 패턴·표현 강의';
    return { title, description, openGraph: { title, description } };
  } catch {
    return { title: '강의 | Anatomy Studio' };
  }
}

export default function Page() {
  return <LessonViewer />;
}
