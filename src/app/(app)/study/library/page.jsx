import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang, REF_LANGS } from '@/content/refLangs';
import StudyLibraryPage from '@/views/StudyLibraryPage';

export const metadata = { title: '다시 읽기 서재 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/** KST 기준 이번 주 월요일 0시의 UTC ISO */
function kstWeekStartIso() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const daysSinceMon = (kst.getUTCDay() + 6) % 7;
  const ms = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
    - daysSinceMon * 86400000 - 9 * 3600 * 1000;
  return new Date(ms).toISOString();
}

/**
 * 다시 읽기 서재 + 성장 요약 — 지난 '오늘의 문단'을 어시스트 없이 재독하며 성장을 확인한다.
 * 모든 조회는 방어적 — study_paragraphs 테이블이 없거나 실패해도 빈 서재로 우아하게 폴백.
 */
export default async function Page({ searchParams }) {
  const sp = await searchParams;
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
  if (!user) return <StudyLibraryPage signedOut />;

  // ── 언어 결정: ?lang= → 프로필 학습 언어 → 일본어 ──
  let lang = sp?.lang && REF_LANGS[sp.lang] ? sp.lang : null;
  if (!lang) {
    const { data: prof } = await supabase.from('profiles').select('learning_language').eq('id', user.id).single();
    const fromProfile = Array.isArray(prof?.learning_language) ? prof.learning_language[0] : prof?.learning_language;
    lang = REF_LANGS[fromProfile] ? fromProfile : 'Japanese';
  }
  const ref = getRefLang(lang);

  // ── 지난 문단 — status='used' 최근 30행 (테이블 부재 시 빈 목록) ──
  let paragraphs = [];
  await supabase.from('study_paragraphs')
    .select('id, theme, level, paragraph, used_at, created_at')
    .eq('user_id', user.id).eq('lang', lang).eq('status', 'used')
    .order('used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(30)
    .then(({ data }) => {
      paragraphs = (data || [])
        .filter(r => r.paragraph && Array.isArray(r.paragraph.sentences) && r.paragraph.sentences.length)
        .map(r => ({
          id: r.id,
          theme: r.theme || '',
          level: r.level || '',
          at: r.used_at || r.created_at || null,
          paragraph: {
            paragraph: r.paragraph.paragraph || '',
            translation: r.paragraph.translation || '',
            sentences: (r.paragraph.sentences || []).map(s => ({ text: s.text || '', ko: s.ko || '' })),
          },
        }));
    }, () => {});

  // ── 성장 요약 (모두 방어적 count 조회) ──
  const weekStartIso = kstWeekStartIso();
  const countOf = async build => {
    let n = 0;
    await build().then(({ count }) => { n = count || 0; }, () => {});
    return n;
  };
  const [knownCount, totalVocab, passedChapters, weekSessions] = await Promise.all([
    // ① 아는 단어 근사 — interval(안정도) 7일 이상
    countOf(() => supabase.from('user_vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('language', lang).gte('interval', 7)),
    // 전체 단어 수
    countOf(() => supabase.from('user_vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('language', lang)),
    // ② 통과 챕터
    countOf(() => supabase.from('user_ref_progress')
      .select('slug', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('lang', lang).eq('passed', true)),
    // ③ 이번 주 세션 수 (used_at 기준 근사)
    countOf(() => supabase.from('study_paragraphs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('lang', lang).eq('status', 'used').gte('used_at', weekStartIso)),
  ]);

  return (
    <StudyLibraryPage
      paragraphs={paragraphs}
      summary={{ knownCount, totalVocab, passedChapters, weekSessions }}
      lang={lang}
      langCode={ref.langCode}
      langName={ref.name}
      flag={ref.flag}
      languages={Object.entries(REF_LANGS).map(([key, r]) => ({ key, name: r.name, flag: r.flag }))}
    />
  );
}
