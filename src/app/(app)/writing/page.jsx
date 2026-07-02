import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang } from '@/content/refLangs';
import WritingStudioPage from '@/views/WritingStudioPage';

export const metadata = { title: '라이팅 스튜디오 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/**
 * 라이팅 스튜디오 — 최근 통과 챕터(작문 과제 추천)를 서버에서 제목·패턴과 함께
 * 조립해 내려준다. 언어 콘텐츠는 서버에만 열리므로 클라이언트 번들에 실리지 않는다.
 */
export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } = {} } = await supabase.auth.getUser();

  let recentChapters = [];
  if (user) {
    const { data } = await supabase
      .from('user_ref_progress')
      .select('lang, slug, updated_at')
      .eq('user_id', user.id)
      .eq('passed', true)
      .order('updated_at', { ascending: false })
      .limit(24);
    recentChapters = (data || []).map(r => {
      const ref = getRefLang(r.lang);
      const ch = ref?.getChapter(r.slug)?.chapter;
      if (!ch) return null;
      return {
        lang: r.lang,
        slug: r.slug,
        title: ch.title,
        level: ch.level,
        order: ch.order,
        topic: ch.topic || '',
        href: `${ref.base}/grammar/${r.slug}`,
        patterns: ch.sections
          .filter(s => s.pattern)
          .slice(0, 3)
          .map(s => ({ pattern: s.pattern, patternKo: s.patternKo || '' })),
      };
    }).filter(Boolean);
  }

  return <WritingStudioPage recentChapters={recentChapters} signedOut={!user} />;
}
