/**
 * 챕터 콘텐츠 오버라이드 — 서버 전용 병합 유틸.
 *
 * 챕터 원본은 정적 레지스트리(src/content/**)에 있고 SSG로 렌더된다. 오너가 웹 편집 모드에서
 * 저장한 수정본은 Supabase `content_overrides` 테이블에 (lang, slug) 키로 보관되고, 이 모듈이
 * 렌더 시 원본 위에 얕게 병합한다.
 *
 * 설계 원칙:
 *  - 서버 전용 — anon key로 Supabase REST를 직접 fetch (서버 컴포넌트/route handler에서 호출).
 *  - 모든 실패는 조용히 null/빈 Map 반환 — 빌드·프리뷰에서 DB가 불통이어도 페이지는 원본으로 렌더.
 *  - slug·level·order는 항상 base 값 강제 — 진도·이전/다음 링크·목차 연동이 깨지지 않게.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ISR 참여 — route-level revalidate와 함께 캐시. revalidatePath 시 함께 무효화된다.
const REVALIDATE = 60;

// 병합 시 항상 base가 이기는 불변 필드 — 진도·링크·목차 키
const IMMUTABLE_FIELDS = ['slug', 'level', 'order'];

function overridesReady() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** REST GET 공통 — 실패는 조용히 null */
async function restGet(pathAndQuery) {
  if (!overridesReady()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 단일 챕터 오버라이드 조회.
 * @returns {Promise<object|null>} 저장된 data(JSON) 또는 null
 */
export async function getChapterOverride(lang, slug) {
  if (!lang || !slug) return null;
  const rows = await restGet(
    `content_overrides?lang=eq.${encodeURIComponent(lang)}&slug=eq.${encodeURIComponent(slug)}&select=data&limit=1`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const data = rows[0]?.data;
  return data && typeof data === 'object' ? data : null;
}

/**
 * 한 언어의 모든 오버라이드 조회 — 목록·이전/다음 제목 병합에 사용.
 * @returns {Promise<Map<string, object>>} slug → data
 */
export async function getOverridesForLang(lang) {
  const map = new Map();
  if (!lang) return map;
  const rows = await restGet(
    `content_overrides?lang=eq.${encodeURIComponent(lang)}&select=slug,data`
  );
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (row?.slug && row?.data && typeof row.data === 'object') {
      map.set(row.slug, row.data);
    }
  }
  return map;
}

// 존재한다면 문자열(또는 null)이어야 하는 챕터/섹션 필드 — 렌더가 .split 등 문자열 연산을 함
const CHAPTER_STRING_FIELDS = ['title', 'topic', 'titleFr', 'summary', 'duration'];
const SECTION_STRING_FIELDS = ['heading', 'pattern', 'patternKo', 'body', 'tip', 'pitfall', 'vsKo', 'hanja'];

/**
 * 오버라이드 최소 구조 검증 — 렌더를 크래시시킬 수 있는 형태를 거른다.
 * 저장 API(POST)와 렌더 병합(mergeChapter) 양쪽에서 사용해, 검증을 뚫고 저장된
 * 과거 행이 있어도 렌더는 fail-closed(원본)로 버틴다.
 * 완전한 스키마 검증이 아니라 "공개 페이지를 500으로 만들 수 있는 형태" 차단이 목적.
 */
export function isValidOverride(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  for (const k of CHAPTER_STRING_FIELDS) {
    if (k in data && data[k] != null && typeof data[k] !== 'string') return false;
  }
  if ('sections' in data) {
    const sections = data.sections;
    if (!Array.isArray(sections) || sections.length === 0) return false;
    for (const s of sections) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
      for (const k of SECTION_STRING_FIELDS) {
        if (k in s && s[k] != null && typeof s[k] !== 'string') return false;
      }
      if ('examples' in s && s.examples != null && !Array.isArray(s.examples)) return false;
    }
  }
  return true;
}

/**
 * 원본 챕터 위에 오버라이드를 얕게 병합.
 * `{ ...base, ...override }` 후 slug·level·order는 base 값으로 강제 복원한다.
 * override가 falsy거나 구조 검증에 실패하면(fail-closed) base를 그대로 반환.
 */
export function mergeChapter(base, override) {
  if (!base) return base;
  if (!override || typeof override !== 'object') return base;
  if (!isValidOverride(override)) return base;
  const merged = { ...base, ...override };
  for (const key of IMMUTABLE_FIELDS) {
    if (key in base) merged[key] = base[key];
  }
  return merged;
}

/**
 * refManifest(경량 목차)에 언어별 오버라이드를 병합 — 챕터 제목·주제·요약·소요시간만.
 * manifest는 buildRefManifest() 결과(REF_LANGS 키 → { levels: [{ chapters: [...] }] }).
 * 원본을 변형하지 않고 새 객체를 반환한다. 실패 언어는 원본 유지.
 */
export async function applyManifestOverrides(manifest) {
  if (!manifest || typeof manifest !== 'object') return manifest;
  const entries = await Promise.all(
    Object.entries(manifest).map(async ([lang, ref]) => {
      const map = await getOverridesForLang(lang);
      if (map.size === 0) return [lang, ref];
      const levels = (ref.levels || []).map((lvl) => ({
        ...lvl,
        chapters: (lvl.chapters || []).map((ch) => {
          const ov = map.get(ch.slug);
          if (!ov) return ch;
          return {
            ...ch,
            title: ov.title ?? ch.title,
            topic: ov.topic ?? ch.topic,
            summary: ov.summary ?? ch.summary,
            duration: ov.duration ?? ch.duration,
          };
        }),
      }));
      return [lang, { ...ref, levels }];
    })
  );
  return Object.fromEntries(entries);
}
