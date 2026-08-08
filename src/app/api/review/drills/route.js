import { NextResponse } from 'next/server';
import { getRefLang } from '@/content/refLangs';
import { buildDrillReviewQuiz, drillIdFromQueueSlug, findDrillContext } from '@/lib/drillSrs';

/**
 * 게스트 복습 큐(localStorage) → 세션 문항 조립.
 *
 * 왜 서버인가: `findDrillContext`는 언어별 전 챕터 레지스트리를 순회한다. 클라이언트에서 하면
 * 콘텐츠 번들을 통째로 내려받게 되므로(챕터 수백 개), 조립만 서버에서 하고 결과만 보낸다.
 *
 * 이 라우트는 **공개 콘텐츠만** 다룬다 — 인증도, 사용자 데이터도, 쓰기도 없다.
 * 입력은 게스트가 보낸 큐 행이지만 신뢰하지 않는다: slug로 실제 드릴을 찾아 서버 콘텐츠로만
 * 문항을 만들고, 요청에 실려 온 문항·정답은 일절 쓰지 않는다.
 */
const MAX_ROWS = 60; // 한 세션에 이보다 많이 필요할 일이 없다 — 무한 확장 차단

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  const items = [];

  for (const row of rows) {
    if (!row || typeof row.lang !== 'string' || typeof row.slug !== 'string') continue;
    const drillId = drillIdFromQueueSlug(row.slug);
    if (!drillId) continue;
    const ref = getRefLang(row.lang);
    if (!ref) continue;
    const found = findDrillContext(ref, drillId);
    if (!found) continue;
    const quiz = buildDrillReviewQuiz(found.drill);
    if (!quiz.meaning.length && !quiz.apply.length && !quiz.produce.length) continue;

    items.push({
      // srs는 게스트 기기 상태 그대로 되돌려준다 — 서버는 보관하지 않는다.
      srs: {
        lang: row.lang,
        slug: row.slug,
        interval: row.interval ?? 0,
        ease_factor: row.ease_factor ?? 0,
        repetitions: row.repetitions ?? 0,
        next_review_at: row.next_review_at ?? null,
      },
      lang: row.lang,
      langCode: ref.langCode,
      langName: ref.name,
      flag: ref.flag,
      title: `${found.chapter.title} · 드릴`,
      order: found.chapter.order,
      level: found.chapter.level,
      href: `${ref.base}/grammar/${found.chapter.slug}`,
      quiz,
    });
  }

  return NextResponse.json({ items });
}
