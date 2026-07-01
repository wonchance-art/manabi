import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang } from '@/content/refLangs';
import { buildReviewQuiz } from '@/lib/refQuiz';
import GrammarReviewSession from '@/views/GrammarReviewSession';

export const metadata = { title: '문법 복습 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/**
 * 문법 SRS 복습 — 서버에서 due 챕터를 조회해 챕터별 미니 퀴즈를 빌드한다.
 * 콘텐츠(레지스트리)는 서버에서만 열리므로 클라이언트 번들에 언어 콘텐츠가 실리지 않는다.
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
  if (!user) return <GrammarReviewSession items={[]} signedOut />;

  const { data: rows } = await supabase
    .from('grammar_review')
    .select('*')
    .eq('user_id', user.id)
    .lte('next_review_at', new Date().toISOString())
    .order('next_review_at', { ascending: true })
    .limit(10);

  const items = (rows || []).map(row => {
    const ref = getRefLang(row.lang);
    if (!ref) return null;
    const found = ref.getChapter(row.slug);
    if (!found) return null;                       // 콘텐츠 개편으로 사라진 슬러그는 건너뜀
    const quiz = buildReviewQuiz(found.chapter, ref);
    if (!quiz.meaning.length && !quiz.apply.length && !quiz.produce.length) return null;
    return {
      srs: {
        lang: row.lang,
        slug: row.slug,
        interval: row.interval,
        ease_factor: row.ease_factor,
        repetitions: row.repetitions,
        next_review_at: row.next_review_at,
      },
      lang: row.lang,
      langCode: ref.langCode,
      langName: ref.name,
      flag: ref.flag,
      title: found.chapter.title,
      order: found.chapter.order,
      level: found.chapter.level,
      href: `${ref.base}/grammar/${row.slug}`,
      quiz,
    };
  }).filter(Boolean);

  return <GrammarReviewSession items={items} />;
}
