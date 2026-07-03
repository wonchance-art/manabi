import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRefLang } from '@/content/refLangs';
import { buildReviewQuiz } from '@/lib/refQuiz';
import { staggerBackfillRows } from '@/lib/grammarSrs';
import GrammarReviewSession from '@/views/GrammarReviewSession';

export const metadata = { title: '문법 복습 | Anatomy Studio' };
export const dynamic = 'force-dynamic';

/** 큐 행 → 세션 아이템 (챕터·퀴즈 조립, 퀴즈 불가 챕터는 null) */
function toItem(row) {
  const ref = getRefLang(row.lang);
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
    flag: ref.flag,
    title: found.chapter.title,
    order: found.chapter.order,
    level: found.chapter.level,
    href: `${ref.base}/grammar/${row.slug}`,
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
  if (!user) return <GrammarReviewSession items={[]} signedOut />;

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
    // 퀴즈를 만들 수 있는 챕터만 (카나 챕터 등 퀴즈 없는 통과 기록은 큐 대상 아님)
    // check_total이 NULL인 행은 실제 퀴즈 통과가 아니라 온보딩 레벨 스킵 백필(read=true, passed=true,
    // check_right/check_total=NULL) 표식이므로 제외한다. 실제 퀴즈 통과는 항상 syncCheckRemote가
    // check_right/check_total을 함께 채운다 (src/lib/refProgress.js:37-39).
    const candidates = (passedRows || []).filter(p => {
      if (existing.has(`${p.lang}:${p.slug}`)) return false;
      if (p.check_total == null) return false;        // 온보딩 스킵 백필 행 — 복습 큐 대상 아님
      const ref = getRefLang(p.lang);
      const ch = ref?.getChapter(p.slug)?.chapter;
      if (!ch) return false;
      if (ref.isIntroLevel(ch.level)) return false;   // 인트로 레벨(OT/A0)은 복습 백필 대상 아님
      const q = buildReviewQuiz(ch, ref);
      return q.meaning.length + q.apply.length + q.produce.length > 0;
    });
    const rows = staggerBackfillRows(user.id, candidates, existing);
    if (rows.length > 0) {
      await supabase.from('grammar_review')
        .upsert(rows, { onConflict: 'user_id,lang,slug', ignoreDuplicates: true });
    }
  } catch {
    // 백필 실패는 복습 진행을 막지 않는다
  }

  const nowIso = new Date().toISOString();
  const [{ data: dueRows }, { data: upcomingRows }] = await Promise.all([
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

  // ── 잔존 인트로 레벨(OT/A0) 큐 방어 — 표시하지 않고 본인 행을 삭제(fire-and-forget) ──
  const isIntroRow = (row) => {
    const ref = getRefLang(row.lang);
    const ch = ref?.getChapter(row.slug)?.chapter;
    return !!(ch && ref.isIntroLevel(ch.level));
  };
  const staleIntroRows = [...(dueRows || []), ...(upcomingRows || [])].filter(isIntroRow);
  for (const row of staleIntroRows) {
    supabase.from('grammar_review').delete()
      .eq('user_id', user.id).eq('lang', row.lang).eq('slug', row.slug)
      .then(() => {}, () => {});   // 실패해도 복습 진행을 막지 않음
  }

  const items = (dueRows || []).map(toItem).filter(Boolean);

  // 예정 큐 — 제목만 필요 (퀴즈 조립 없이 가볍게)
  const upcoming = (upcomingRows || []).map(row => {
    const ref = getRefLang(row.lang);
    const ch = ref?.getChapter(row.slug)?.chapter;
    if (!ch) return null;
    if (ref.isIntroLevel(ch.level)) return null;   // 인트로 레벨 잔존 큐는 표시하지 않음
    return {
      flag: ref.flag,
      level: ch.level,
      order: ch.order,
      title: ch.title,
      href: `${ref.base}/grammar/${row.slug}`,
      dueAt: row.next_review_at,
    };
  }).filter(Boolean);

  return <GrammarReviewSession items={items} upcoming={upcoming} />;
}
