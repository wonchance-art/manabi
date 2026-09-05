/**
 * 관리자 챕터 편집 API — content_overrides 읽기/쓰기.
 *
 *  GET    ?lang=&slug=   → { base, override, merged, updatedAt }
 *                          서버에서 정적 레지스트리를 import해 원본을 얻고, 오버라이드와 병합해 반환.
 *  POST   { lang, slug, data, expectedUpdatedAt }
 *                        → 읽은 버전과 일치할 때 저장 후 챕터·목록 경로 revalidate.
 *  DELETE { lang, slug } → 오버라이드 삭제(파일 버전 복원) 후 revalidate.
 *
 * 인증: requireAdmin()(쿠키 세션 + profiles.role='admin'). 쓰기는 사용자 세션 클라이언트로 수행해
 * RLS(is_admin())가 최종 방어. service_role 키는 사용하지 않는다.
 */
import { revalidatePath } from 'next/cache';
import { getRefLang } from '@/content/refLangs';
import { requireAdmin } from '@/lib/supabaseServer';
import { mergeChapter, isValidOverride, missingStoryIds } from '@/lib/contentOverrides';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 원본 챕터 조회 — 레지스트리에서 { chapter } 만 꺼낸다. 없으면 null. */
function getBaseChapter(lang, slug) {
  if (!['Japanese', 'Chinese', 'French', 'English'].includes(lang) || typeof slug !== 'string') return null;
  const ref = getRefLang(lang);
  if (!ref) return null;
  const data = ref.getChapter(slug);
  return data?.chapter || null;
}

/** 저장 후 무효화할 경로들 — 해당 챕터 상세 + 교재 목록 */
function revalidateChapter(lang, slug) {
  const ref = getRefLang(lang);
  if (ref?.base) revalidatePath(`${ref.base}/grammar/${slug}`);
  revalidatePath('/lessons');
  revalidatePath('/review/grammar');
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang');
  const slug = searchParams.get('slug');
  if (!lang || !slug) {
    return Response.json({ error: 'lang, slug가 필요합니다.' }, { status: 400 });
  }

  const base = getBaseChapter(lang, slug);
  if (!base) return Response.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 });

  // 오버라이드 + updated_at 조회 (사용자 세션 클라이언트 — select는 공개지만 일관되게 세션으로).
  const { supabase } = auth;
  const { data: row, error } = await supabase
    .from('content_overrides')
    .select('data, updated_at')
    .eq('lang', lang)
    .eq('slug', slug)
    .maybeSingle();

  // 편집에서는 조회 실패를 '수정본 없음'으로 취급하지 않는다.
  if (error) return Response.json({ error: '저장된 내용을 확인하지 못했어요. 잠시 후 다시 불러와 주세요.' }, { status: 503 });

  const override = row?.data || null;
  const merged = mergeChapter(base, override);
  return Response.json({ base, override, merged, updatedAt: row?.updated_at || null }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 JSON입니다.' }, { status: 400 });
  }
  const { lang, slug, data, expectedUpdatedAt } = body || {};
  if (!lang || !slug || !data || typeof data !== 'object') {
    return Response.json({ error: 'lang, slug, data가 필요합니다.' }, { status: 400 });
  }
  if (!Object.hasOwn(body, 'expectedUpdatedAt')) {
    return Response.json({ error: '편집 화면을 새로 열고 다시 저장해 주세요.' }, { status: 428 });
  }
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))) {
    return Response.json({ error: '수정 버전이 올바르지 않습니다. 다시 불러와 주세요.' }, { status: 400 });
  }

  // 구조 검증 — 렌더를 크래시시킬 수 있는 형태(sections가 배열이 아님, 문자열 필드에
  // 비문자열 등)는 저장 자체를 거부한다. 병합부도 같은 검증으로 fail-closed(이중 방어).
  if (!isValidOverride(data)) {
    return Response.json(
      { error: '챕터 구조가 올바르지 않습니다. sections는 비어있지 않은 배열이어야 하고, 제목·본문 등 텍스트 필드는 문자열이어야 합니다.' },
      { status: 400 }
    );
  }
  if ('title' in data && (typeof data.title !== 'string' || !data.title.trim())) {
    return Response.json({ error: '챕터 제목을 입력해 주세요.' }, { status: 400 });
  }

  // 원본 존재 확인 — 없는 슬러그에 오버라이드를 만들지 않는다.
  const base = getBaseChapter(lang, slug);
  if (!base) return Response.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 });

  // story 문항 id 불변 — 학습 기록·채점 키 연동이라 삭제·변경을 서버가 최종 차단.
  const missing = missingStoryIds(base, data);
  if (missing.length > 0) {
    return Response.json(
      { error: `story 문항 id는 삭제·변경할 수 없습니다 (기록 연동): ${missing.join(', ')}` },
      { status: 400 }
    );
  }

  // 불변 필드는 저장 데이터에서도 base로 강제(방어) — 렌더 병합과 이중 안전.
  const safeData = { ...data, slug: base.slug, level: base.level, order: base.order };

  const { supabase, user } = auth;
  const row = { lang, slug, data: safeData, updated_by: user.id, updated_at: new Date().toISOString() };
  // INSERT의 PK 충돌 또는 UPDATE의 버전 조건 불일치로 동시 저장을 원자적으로 차단한다.
  // 별도 사전 조회 + upsert는 조회와 쓰기 사이의 변경을 덮어쓸 수 있다.
  const query = expectedUpdatedAt === null
    ? supabase.from('content_overrides').insert(row)
    : supabase.from('content_overrides').update(row)
      .eq('lang', lang).eq('slug', slug).eq('updated_at', expectedUpdatedAt);
  const { data: saved, error } = await query.select('updated_at').maybeSingle();
  if (error?.code === '23505' || (!error && !saved)) {
    return Response.json({ error: '다른 편집에서 내용이 변경됐어요. 입력은 유지됩니다. 최신 내용을 확인한 뒤 다시 편집해 주세요.' }, { status: 409 });
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });

  revalidateChapter(lang, slug);
  return Response.json({ ok: true, updatedAt: saved.updated_at });
}

export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 JSON입니다.' }, { status: 400 });
  }
  const { lang, slug } = body || {};
  if (!lang || !slug) {
    return Response.json({ error: 'lang, slug가 필요합니다.' }, { status: 400 });
  }

  const { supabase } = auth;
  const { error } = await supabase
    .from('content_overrides')
    .delete()
    .eq('lang', lang)
    .eq('slug', slug);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  revalidateChapter(lang, slug);
  return Response.json({ ok: true });
}
