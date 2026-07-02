import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang, REF_LANGS } from '@/content/refLangs';
import { refMain, refPron } from '@/views/refShared';
import { buildChapterQuiz } from '@/lib/refQuiz';
import { composeSession } from '@/lib/studySession';
import StudySessionPage from '@/views/StudySessionPage';

export const metadata = { title: '오늘 학습 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/** 배열에서 대략 고르게 n개 샘플 (요청마다 달라지도록 랜덤 시작점) */
function sample(arr, n) {
  if (!arr?.length) return [];
  const out = [];
  const start = Math.floor(Math.random() * arr.length);
  for (let i = 0; i < arr.length && out.length < n; i++) {
    out.push(arr[(start + i * 7) % arr.length]);
  }
  return [...new Set(out)].slice(0, n);
}

/**
 * 공부 모드 — 메인 학습 세션 (듀오링고 경로 + Anki 스케줄).
 * 서버가 due 어휘·due 문법·커리큘럼의 다음 챕터·독해 예문을 모아
 * ~12문항 세션을 조립한다. 콘텐츠는 서버에만 열린다.
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
  const nowIso = new Date().toISOString();

  // ── 재료 조회 (병렬) ──
  const [{ data: dueVocabRows }, { data: vocabPoolRows }, { data: dueGrammarRows }, { data: progressRows }] = await Promise.all([
    supabase.from('user_vocabulary')
      .select('id, word_text, meaning, furigana, language, interval, ease_factor, repetitions, next_review_at')
      .eq('user_id', user.id).eq('language', lang)
      .lte('next_review_at', nowIso)
      .order('next_review_at', { ascending: true }).limit(3),
    supabase.from('user_vocabulary')
      .select('meaning')
      .eq('user_id', user.id).eq('language', lang).limit(60),
    supabase.from('grammar_review')
      .select('*')
      .eq('user_id', user.id).eq('lang', lang)
      .lte('next_review_at', nowIso)
      .order('next_review_at', { ascending: true }).limit(2),
    supabase.from('user_ref_progress')
      .select('slug, passed')
      .eq('user_id', user.id).eq('lang', lang),
  ]);

  const passed = new Set((progressRows || []).filter(r => r.passed).map(r => r.slug));

  // ── 문법 due → 미니 퀴즈 ──
  const grammarDue = (dueGrammarRows || []).map(row => {
    const found = ref.getChapter(row.slug);
    if (!found) return null;
    const q = buildChapterQuiz(found.chapter, ref, { maxMeaning: 1, maxApply: 1, maxProduce: 0 });
    const items = [...q.meaning, ...q.apply];
    if (!items.length) return null;
    return {
      srs: { lang: row.lang, slug: row.slug, interval: row.interval, ease_factor: row.ease_factor, repetitions: row.repetitions, next_review_at: row.next_review_at },
      meta: { slug: row.slug, title: found.chapter.title, level: found.chapter.level, order: found.chapter.order, href: `${ref.base}/grammar/${row.slug}` },
      items,
    };
  }).filter(Boolean);

  // ── 다음 새 챕터 — 커리큘럼 순서에서 첫 미통과·퀴즈 가능 챕터 ──
  let newChapter = null;
  for (const ch of ref.ALL_CHAPTERS) {
    if (passed.has(ch.slug)) continue;
    const q = buildChapterQuiz(ch, ref, { maxMeaning: 2, maxApply: 1, maxProduce: 0 });
    const items = [...q.meaning, ...q.apply];
    if (items.length < 2) continue;                    // 퀴즈 못 만드는 챕터(카나 등)는 건너뜀
    const patternSec = ch.sections.find(s => s.pattern);
    newChapter = {
      meta: { lang, slug: ch.slug, title: ch.title, level: ch.level, order: ch.order, href: `${ref.base}/grammar/${ch.slug}` },
      teach: patternSec ? {
        pattern: patternSec.pattern,
        patternKo: patternSec.patternKo || '',
        examples: (patternSec.examples || []).slice(0, 2).map(ex => ({ main: refMain(ex), pron: refPron(ex), ko: ex.ko })),
      } : null,
      items: items.slice(0, 3),
    };
    break;
  }

  // ── 독해 소재 — 현재 레벨 문형 예문 ──
  const level = newChapter?.meta.level || grammarDue[0]?.meta.level || ref.LEVEL_META[0]?.key;
  const bunkei = ref.getBunkei?.(level);
  const exPool = (bunkei?.themes || [])
    .flatMap(t => t.items || [])
    .flatMap(i => [i.ex, i.ex2])
    .filter(ex => ex && ex.ko && refMain(ex))
    .map(ex => ({ main: refMain(ex), pron: refPron(ex), ko: ex.ko }));
  const reading = sample(exPool, 4);
  const koPool = sample(exPool, 24).map(e => e.ko);

  // ── 어휘 보기 풀 — 내 단어장 뜻 + 부족하면 레벨 어휘 사전 뜻 ──
  const meaningPool = [...new Set((vocabPoolRows || []).map(r => r.meaning).filter(Boolean))];
  if (meaningPool.length < 8) {
    const levelVocab = ref.getVocab(level);
    (levelVocab?.themes || []).flatMap(t => t.words || []).slice(0, 40).forEach(w => {
      if (w?.ko) meaningPool.push(w.ko);
    });
  }

  const session = composeSession({
    vocab: dueVocabRows || [],
    meaningPool,
    grammarDue,
    newChapter,
    reading,
    koPool,
  });

  return (
    <StudySessionPage
      session={session}
      lang={lang}
      langCode={ref.langCode}
      langName={ref.name}
      flag={ref.flag}
      readKey={ref.readKey}
      languages={Object.entries(REF_LANGS).map(([key, r]) => ({ key, name: r.name, flag: r.flag }))}
    />
  );
}
