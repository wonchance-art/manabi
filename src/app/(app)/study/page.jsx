import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang, REF_LANGS } from '@/content/refLangs';
import { assembleStudyMaterials } from '@/lib/studyMaterials';
import StudySessionPage from '@/views/StudySessionPage';

export const metadata = { title: '오늘 학습 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/**
 * 공부 모드 — 메인 학습 세션 (듀오링고 경로 + Anki 스케줄).
 * 서버가 due 어휘·due 문법·커리큘럼의 다음 챕터·독해 예문을 모아(studyMaterials)
 * ~12문항 세션을 조립한다. 콘텐츠는 서버에만 열린다.
 * 프리페치된 문단(status='prefetched')이 있으면 즉시 그것으로 시작한다.
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
  if (!user) return <StudySessionPage signedOut />;

  // ── 언어 결정: ?lang= → 프로필 학습 언어 → 일본어 ──
  let lang = sp?.lang && REF_LANGS[sp.lang] ? sp.lang : null;
  if (!lang) {
    const { data: prof } = await supabase.from('profiles').select('learning_language').eq('id', user.id).single();
    const fromProfile = Array.isArray(prof?.learning_language) ? prof.learning_language[0] : prof?.learning_language;
    lang = REF_LANGS[fromProfile] ? fromProfile : 'Japanese';
  }
  const ref = getRefLang(lang);

  // ── 재료 조립 (폴백 세션·rung·dial·오늘의 문단 재료) — prefetched를 써도 라이브로 필요 ──
  const { session, paragraphMaterials, warmup, band, dial, canGenerate } = await assembleStudyMaterials(supabase, user.id, lang);

  // ── 프리페치된 문단 우선 사용 — 최근 48h 내 status='prefetched' 최신 1행 (테이블 부재 시 무해) ──
  // 단, 이번 세션이 주간 약점 모드(paragraphMaterials.weekly)면 프리페치를 건너뛰고 라이브 생성 경로로.
  // (프리페치 행은 남겨둠 — 다음 비약점 세션에서 48h 내면 소비, 지나면 자연 만료)
  let pregenerated = null;
  if (!paragraphMaterials?.weekly) {
    const cutoffIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    await supabase.from('study_paragraphs')
      .select('id, materials, paragraph')
      .eq('user_id', user.id).eq('lang', lang).eq('status', 'prefetched')
      .gt('created_at', cutoffIso)
      .order('created_at', { ascending: false }).limit(1)
      .then(async ({ data }) => {
        const row = data && data[0];
        if (row && row.paragraph && row.materials) {
          pregenerated = { paragraph: row.paragraph, materials: row.materials };
          // 사용 처리 — await로 유실 방지, 실패(테이블 부재 등)해도 세션은 진행
          await supabase.from('study_paragraphs')
            .update({ status: 'used', used_at: new Date().toISOString() })
            .eq('id', row.id)
            .then(() => {}, () => {});
        }
      }, () => {});
  }

  // pregenerated가 있으면 효과 매핑·새 단어 등록은 저장된 재료를 기준으로.
  const effectiveMaterials = pregenerated ? pregenerated.materials : (canGenerate ? paragraphMaterials : null);

  return (
    <StudySessionPage
      session={session}
      paragraphMaterials={effectiveMaterials}
      pregenerated={pregenerated}
      warmup={pregenerated ? [] : warmup}
      dial={dial}
      band={band}
      lang={lang}
      langCode={ref.langCode}
      langName={ref.name}
      flag={ref.flag}
      readKey={ref.readKey}
      languages={Object.entries(REF_LANGS).map(([key, r]) => ({ key, name: r.name, flag: r.flag }))}
    />
  );
}
