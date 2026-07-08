import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang, REF_LANGS } from '@/content/refLangs';
import { assembleStudyMaterials } from '@/lib/studyMaterials';
import StudySessionPage from '@/views/StudySessionPage';
import StudyOnboarding from '@/views/StudyOnboarding';

export const metadata = { title: '오늘 학습 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/**
 * 인트로 문자 트랙 챕터 — '완전 처음' 학습자에게 "문자부터"를 안내할 대상.
 * 레지스트리에서 동적으로 판별: 인트로 레벨(OT/A0) 챕터 중 kana 필드 보유 첫 챕터(JA 히라가나),
 * 없으면 슬러그가 병음(pinyin)인 챕터(ZH). 문자 트랙이 없는 언어(EN/FR)는 null.
 * @returns {{slug:string, href:string, kind:'kana'|'pinyin'}|null}
 */
function findScriptTrack(ref) {
  if (!ref?.ALL_CHAPTERS?.length) return null;
  const intro = ref.ALL_CHAPTERS.filter(c => ref.isIntroLevel?.(c.level));
  const kanaCh = intro.find(c => c.kana);
  if (kanaCh) return { slug: kanaCh.slug, href: `${ref.base}/grammar/${kanaCh.slug}`, kind: 'kana' };
  const pinyinCh = intro.find(c => /pinyin/i.test(c.slug));
  if (pinyinCh) return { slug: pinyinCh.slug, href: `${ref.base}/grammar/${pinyinCh.slug}`, kind: 'pinyin' };
  return null;
}

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

  // ── 관심사 쿠키 — 온보딩에서 고른 이야기 취향(테마 70% 가중). 없으면 완전히 기존 동작 ──
  const interestGroup = cookieStore.get('study_interest')?.value || null;

  // ── 재료 조립 (폴백 세션·rung·dial·오늘의 문단 재료) — prefetched를 써도 라이브로 필요 ──
  const { session, paragraphMaterials, warmup, band, dial, canGenerate, coldStart } =
    await assembleStudyMaterials(supabase, user.id, lang, { interestGroup });

  // ── 내 자료 세션(?source=mine) — 프리페치를 조회·소모하지 않고 라이브 생성을 강제한다. ──
  // (프리페치 행은 그대로 보존 → 다음 일반 세션이 소비)
  const sourceMode = sp?.source === 'mine';

  // ── 프리페치된 문단 우선 사용 — 최근 48h 내 status='prefetched' 최신 1행 (테이블 부재 시 무해) ──
  // 단, 이번 세션이 주간 약점 모드(paragraphMaterials.weekly)·내 자료 모드면 프리페치를 건너뛰고 라이브 생성 경로로.
  // (프리페치 행은 남겨둠 — 다음 비약점·일반 세션에서 48h 내면 소비, 지나면 자연 만료)
  let pregenerated = null;
  if (!paragraphMaterials?.weekly && !sourceMode) {
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

  const studySession = (
    <StudySessionPage
      session={session}
      paragraphMaterials={effectiveMaterials}
      pregenerated={pregenerated}
      sourceMode={sourceMode}
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

  if (!coldStart) return studySession;

  // ── 콜드스타트 — 온보딩 데이터를 내려주고 세션 요소를 children으로 감싼다. ──
  // 표시 여부(localStorage 가드)는 클라가 판단. 정규 레벨(인트로 제외)만 칩으로 노출하되,
  // 백필용으로는 인트로 포함 전체 레벨의 챕터 slug를 순서대로 함께 넘긴다.
  const norm = s => String(s || '').toUpperCase();
  const levels = ref.LEVEL_META.map(m => ({
    key: m.key,
    label: m.label || m.key,
    isIntro: ref.isIntroLevel(m.key),
    chapterSlugs: ref.ALL_CHAPTERS.filter(c => norm(c.level) === norm(m.key)).map(c => c.slug),
  }));

  // 문자 트랙 — 인트로 레벨에서 '문자·발음 체계'를 처음 익히는 챕터('완전 처음' 학습자 안내용).
  // 레지스트리에서 동적으로: kana 필드 보유 첫 챕터(JA 히라가나) → 없으면 병음 챕터(ZH). EN/FR은 null.
  // 레지스트리(6MB)를 클라 번들에 끌어오지 않도록 slug·href만 서버에서 추려 넘긴다(§4.1).
  const scriptTrack = findScriptTrack(ref);

  return (
    <StudyOnboarding lang={lang} langName={ref.name} levels={levels} readKey={ref.readKey} scriptTrack={scriptTrack}>
      {studySession}
    </StudyOnboarding>
  );
}
