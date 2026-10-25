import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang } from '@/content/refLangs';
import { getReadingTrack } from '@/content/japanese';
import { buildReviewQuiz } from '@/lib/refQuiz';
import { staggerBackfillRows } from '@/lib/grammarSrs';
import { loadPublishedRegistry } from '@/lib/publishedChapter';
import { buildDrillReviewQuiz, drillIdFromQueueSlug, findDrillContext } from '@/lib/drillSrs';
import GrammarReviewSession from '@/views/GrammarReviewSession';
import GuestGrammarReview from '@/views/GuestGrammarReview';
// 옛 교재 챕터 주소는 관리자 보관함으로만 열린다 — 학습자 링크는 null(VIEWER-R0-BUGS-001 버그 3).
import { learnerHref } from '@/lib/bookNavigation';
import { LANG_NAME_KO } from '@/lib/constants';
import { isPatternSlug } from '@/lib/sentencePattern';
import { buildPatternReviewItem, loadBunkeiEntries, patternUpcomingRow } from '@/lib/patternReview';

export const metadata = { title: '문법 복습' };
export const dynamic = 'force-dynamic';

/**
 * 독해 글 단위 재검증(RT-2·기획 §5) — rt: slug 는 챕터 퀴즈 빌더 대신 해당 글의
 * pattern 문항을 재출제한다. content 문항은 제외(통과 판정 밖 — RT-14).
 * 문항을 세션이 이해하는 meaning 퀴즈 형태로 매핑(보기=choices, 정답=choices[answer]).
 */
function toReadingItem(row) {
  const track = getReadingTrack('n5-tokyo');
  if (!track) return null;
  const id = row.slug.slice(3); // 'rt:' 제거
  const text = (track.texts || []).find((t) => t.id === id);
  if (!text) return null;
  const patternQ = (text.questions || []).filter((q) => q.type === 'pattern');
  if (!patternQ.length) return null;
  const meaning = patternQ.map((q) => ({
    sentence: q.q,
    full: q.choices[q.answer],
    ko: q.why || '',
    correct: q.choices[q.answer],
    distractors: q.choices.filter((_, i) => i !== q.answer),
    pron: null,
  }));
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
    langCode: 'ja',
    langName: '독해',
    title: text.title || id,
    order: text.order,
    level: track.level || 'N5',
    href: '/japanese/reading',
    quiz: { meaning, apply: [], produce: [] },
  };
}

/** drill:<id> 큐 행 → 원본 드릴 한 문항 복습 아이템. */
function toDrillItem(row, registries) {
  const drillId = drillIdFromQueueSlug(row.slug);
  const ref = registries.get(row.lang);
  const found = findDrillContext(ref, drillId);
  if (!ref || !found) return null;
  const quiz = buildDrillReviewQuiz(found.drill);
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
    title: `${found.chapter.title} · 드릴`,
    order: found.chapter.order,
    level: found.chapter.level,
    href: learnerHref(`${ref.base}/grammar/${found.chapter.slug}`),
    quiz,
  };
}

/** 큐 행 → 세션 아이템 (챕터·퀴즈 조립, 퀴즈 불가 챕터는 null) */
function toItem(row, registries, bunkei) {
  if (isPatternSlug(row.slug)) return buildPatternReviewItem(row, bunkei.get(row.lang)); // 뷰어 [문장] 탭에서 담은 패턴(bk:)
  if (drillIdFromQueueSlug(row.slug)) return toDrillItem(row, registries);
  if (typeof row.slug === 'string' && row.slug.startsWith('rt:')) return toReadingItem(row); // 독해 분기
  const ref = registries.get(row.lang);
  if (!ref) return null;
  const found = ref.getChapter(row.slug);
  if (!found) return null;                       // 콘텐츠 개편으로 사라진 슬러그는 건너뜀
  if (ref.isIntroLevel(found.chapter.level)) return null; // 인트로 레벨(OT/A0) 잔존 큐는 표시하지 않음
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
    title: found.chapter.title,
    order: found.chapter.order,
    level: found.chapter.level,
    href: learnerHref(`${ref.base}/grammar/${row.slug}`),
    quiz,
  };
}

/**
 * 문법 SRS 복습 — 서버에서 due 챕터를 조회해 챕터별 미니 퀴즈를 빌드한다.
 * 진입 시 과거에 통과했지만 큐에 없는 챕터를 자동 백필(하루 10개씩 분산).
 * 콘텐츠(레지스트리)는 서버에서만 열리므로 클라이언트 번들에 실리지 않는다.
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
  // 비로그인도 기기 큐로 복습할 수 있다 — 문항 조립은 /api/review/drills가 서버에서 한다.
  if (!user) return <GuestGrammarReview />;

  // 세션 안에서는 언어마다 한 수정본 스냅샷을 사용한다. 다른 챕터에서 가져오는 보기에도 적용.
  const registries = new Map();
  async function prepare(rows) {
    const languages = [...new Set(rows.map(row => row.lang))].filter(lang => !registries.has(lang));
    await Promise.all(languages.map(async lang => {
      const base = ['Japanese', 'Chinese', 'French', 'English'].includes(lang) ? getRefLang(lang) : null;
      if (base) registries.set(lang, await loadPublishedRegistry(lang, base));
    }));
  }

  // 오늘 복습(due 10) · 예정(30) 읽기는 백필 읽기와 함께 시작한다 — 예전에는 getUser → 백필 읽기 → (백필 쓰기) → due · 예정이 직렬이었다
  // (PERF P8 2026-10-26 KST). 백필이 실제로 쓰기를 보냈을 때만 쓰기 뒤에 두 읽기를 같은 기준 시각으로 다시 한다 — 첫 묶음은 오늘 due,
  // 나머지는 다음 날들(staggerBackfillRows)이라 둘 다 바뀔 수 있다. 쓰지 않았으면 미리 받은 결과가 직렬로 읽은 것과 같다(그 사이 쓰기 0).
  const readQueue = (nowIso) => Promise.all([
    supabase.from('grammar_review')
      .select('*')
      .eq('user_id', user.id)
      .lte('next_review_at', nowIso)
      .order('next_review_at', { ascending: true })
      .limit(10),
    supabase.from('grammar_review')
      .select('lang, slug, next_review_at')
      .eq('user_id', user.id)
      .gt('next_review_at', nowIso)
      .order('next_review_at', { ascending: true })
      .limit(30),
  ]);
  const early = readQueue(new Date().toISOString());
  early.catch(() => {}); // 백필을 기다리는 동안 거절돼도 처리 안 된 거절로 남지 않게 — 아래 await가 그대로 던진다(예전과 같은 오류 경로)
  let wrote = false;

  // ── 백필: 통과했지만 큐에 없는 챕터 등록 (기능 도입 전의 통과 기록 구제) ──
  try {
    const [{ data: passedRows }, { data: queuedRows }] = await Promise.all([
      supabase.from('user_ref_progress')
        .select('lang, slug, updated_at, check_total')
        .eq('user_id', user.id).eq('passed', true)
        .order('updated_at', { ascending: true }),
      supabase.from('grammar_review')
        .select('lang, slug')
        .eq('user_id', user.id),
    ]);
    const existing = new Set((queuedRows || []).map(r => `${r.lang}:${r.slug}`));
    await prepare(passedRows || []);
    // 퀴즈를 만들 수 있는 챕터만 (카나 챕터 등 퀴즈 없는 통과 기록은 큐 대상 아님)
    // check_total이 NULL인 행은 실제 퀴즈 통과가 아니라 온보딩 레벨 스킵 백필(read=true, passed=true,
    // check_right/check_total=NULL) 표식이므로 제외한다. 실제 퀴즈 통과는 항상 syncCheckRemote가
    // check_right/check_total을 함께 채운다 (src/lib/refProgress.js:37-39).
    const candidates = (passedRows || []).filter(p => {
      if (existing.has(`${p.lang}:${p.slug}`)) return false;
      if (p.check_total == null) return false;        // 온보딩 스킵 백필 행 — 복습 큐 대상 아님
      const ref = registries.get(p.lang);
      const ch = ref?.getChapter(p.slug)?.chapter;
      if (!ch) return false;
      if (ref.isIntroLevel(ch.level)) return false;   // 인트로 레벨(OT/A0)은 복습 백필 대상 아님
      const q = buildReviewQuiz(ch, ref);
      return q.meaning.length + q.apply.length + q.produce.length > 0;
    });
    const rows = staggerBackfillRows(user.id, candidates, existing);
    if (rows.length > 0) {
      wrote = true; // 보내는 순간부터 — 실패 · 예외여도 일부가 들어갔을 수 있으니 다시 읽는다
      await supabase.from('grammar_review')
        .upsert(rows, { onConflict: 'user_id,lang,slug', ignoreDuplicates: true });
    }
  } catch {
    // 백필 실패는 복습 진행을 막지 않는다
  }

  const [{ data: dueRows, error: dueError }, { data: upcomingRows, error: upcomingError }] =
    await (wrote ? readQueue(new Date().toISOString()) : early);
  if (dueError || upcomingError) return <div className="page-container"><section className="manabi-inline-state" role="alert"><h1>문법 복습을 불러오지 못했어요.</h1><p>연결을 확인하고 다시 시도해 주세요. 복습 기록은 그대로 남아 있어요.</p><a href="/review/grammar">다시 시도 →</a></section></div>;
  await prepare([...(dueRows || []), ...(upcomingRows || [])]);
  // 담은 패턴(bk:)은 문형 사전에서 문항을 만든다 — 그런 행이 있는 언어만 사전을 연다.
  const bunkei = new Map();
  await Promise.all([...new Set([...(dueRows || []), ...(upcomingRows || [])].filter((row) => isPatternSlug(row.slug)).map((row) => row.lang))]
    .map(async (lang) => { bunkei.set(lang, await loadBunkeiEntries(lang)); }));

  // ── 잔존 인트로 레벨(OT/A0) 큐 방어 — 표시하지 않고 본인 행을 삭제(fire-and-forget) ──
  const isIntroRow = (row) => {
    const ref = registries.get(row.lang);
    const ch = ref?.getChapter(row.slug)?.chapter;
    return !!(ch && ref.isIntroLevel(ch.level));
  };
  const staleIntroRows = [...(dueRows || []), ...(upcomingRows || [])].filter(isIntroRow);
  for (const row of staleIntroRows) {
    supabase.from('grammar_review').delete()
      .eq('user_id', user.id).eq('lang', row.lang).eq('slug', row.slug)
      .then(() => {}, () => {});   // 실패해도 복습 진행을 막지 않음
  }

  const items = (dueRows || []).map(row => toItem(row, registries, bunkei)).filter(Boolean);

  // 예정 큐 — 제목만 필요 (퀴즈 조립 없이 가볍게)
  const upcoming = (upcomingRows || []).map(row => {
    if (isPatternSlug(row.slug)) return patternUpcomingRow(row, bunkei.get(row.lang));
    const drillId = drillIdFromQueueSlug(row.slug);
    if (drillId) {
      const ref = registries.get(row.lang);
      const found = findDrillContext(ref, drillId);
      if (!ref || !found) return null;
      return {
        langName: ref.name,
        level: found.chapter.level,
        order: found.chapter.order,
        title: `${found.chapter.title} · 드릴`,
        href: learnerHref(`${ref.base}/grammar/${found.chapter.slug}`),
        dueAt: row.next_review_at,
      };
    }
    if (typeof row.slug === 'string' && row.slug.startsWith('rt:')) {
      const track = getReadingTrack('n5-tokyo');
      const text = track?.texts?.find(t => t.id === row.slug.slice(3));
      if (!text) return null;
      return { langName: LANG_NAME_KO.Japanese, level: '독해', order: text.order, title: text.title, href: '/japanese/reading', dueAt: row.next_review_at };
    }
    const ref = registries.get(row.lang);
    const ch = ref?.getChapter(row.slug)?.chapter;
    if (!ch) return null;
    if (ref.isIntroLevel(ch.level)) return null;   // 인트로 레벨 잔존 큐는 표시하지 않음
    return {
      langName: ref.name,
      level: ch.level,
      order: ch.order,
      title: ch.title,
      href: learnerHref(`${ref.base}/grammar/${row.slug}`),
      dueAt: row.next_review_at,
    };
  }).filter(Boolean);

  return <GrammarReviewSession items={items} upcoming={upcoming} />;
}
