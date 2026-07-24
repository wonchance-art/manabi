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

// ── 챕터 스키마 화이트리스트 ───────────────────────────────────
// 전 언어(ja·fr·en·zh) 268챕터 실측 키 인벤토리와 일치(회귀 테스트가 라운드트립으로 고정).
// 여기 없는 키는 오버라이드에서 명시적으로 거부한다 — 에디터가 여는 키와 검증기의
// 차집합이 생기지 않게(Codex 4차 검수 종결 조건).
// 문자열(또는 null) 필드 — 렌더가 React child·.split 등 문자열 연산에 소비
const CHAPTER_STRING_FIELDS = ['title', 'topic', 'titleFr', 'summary', 'duration', 'kana'];
// 스칼라 배열·boolean 필드 — 커리큘럼 경로 표시에 소비
const CHAPTER_SCALAR_ARRAY_FIELDS = ['kanjiExempt', 'prerequisites'];
const CHAPTER_BOOLEAN_FIELDS = ['formulaic'];
// heading·패턴 박스 + 콜아웃 전체(refShared CALLOUT_ORDER: pitfall·vsKo·vsEn·hanja·etym·tip)
const SECTION_STRING_FIELDS = ['heading', 'pattern', 'patternKo', 'body', 'tip', 'pitfall', 'vsKo', 'vsEn', 'hanja', 'etym',
  // RFC v2 "실전 샌드위치" 섹션 필드
  'presentationFraming', 'transitionNote'];
// 스칼라 배열 필드 — distractors(refQuiz 보기 풀)·gojuon(GojuonChart sets)·kanjiExempt(P9 게이트)
const SECTION_SCALAR_ARRAY_FIELDS = ['distractors', 'gojuon'];
// 구조 필드 — 아래 isValidSection에서 개별 스키마 검증
const SECTION_STRUCT_FIELDS = ['examples', 'table', 'story', 'media', 'enParallel', 'hanjaBridge',
  // RFC v2 "실전 샌드위치" 구조 필드
  'audio', 'captions', 'vocabs', 'original', 'variant', 'selfCheckOptions', 'writingPrompts', 'quizItems'];
// RFC v2 boolean 필드
const SECTION_BOOLEAN_FIELDS = ['autoRegisterVocabs'];
const CHAPTER_KEYS = new Set([
  'slug', 'level', 'order', 'sections',
  'status', // 선택적 상태 필드 (DRAFT 등)
  ...CHAPTER_STRING_FIELDS,
  ...CHAPTER_SCALAR_ARRAY_FIELDS,
  ...CHAPTER_BOOLEAN_FIELDS,
]);
const SECTION_KEYS = new Set([
  'type', // RFC v2 섹션 타입
  ...SECTION_STRING_FIELDS,
  ...SECTION_SCALAR_ARRAY_FIELDS,
  ...SECTION_STRUCT_FIELDS,
  ...SECTION_BOOLEAN_FIELDS,
]);

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

// ── leaf 타입 규칙 ─────────────────────────────────────────────
// 렌더러는 leaf를 React child(<th>{h}</th> 등) 또는 문자열 연산(.split, refPron)에
// 소비한다. 객체/배열이 leaf 자리에 오면 "Objects are not valid as a React child"로
// 공개 렌더가 죽으므로, leaf는 스칼라(string/number/boolean/null)만 허용한다.
function isScalar(v) {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function isScalarArray(v) {
  return Array.isArray(v) && v.every(isScalar);
}

/** 모든 값이 스칼라인 평평한 객체 — examples 원소·story 대사 줄·media.line */
function isFlatObject(v) {
  return isPlainObject(v) && Object.values(v).every(isScalar);
}

/** 값이 스칼라 또는 스칼라 배열인 객체 — story 문항(accept·model 등 문자열 배열 보유) */
function isShallowObject(v) {
  return isPlainObject(v) && Object.values(v).every((x) => isScalar(x) || isScalarArray(x));
}

function isFlatObjectArray(v) {
  return Array.isArray(v) && v.every(isFlatObject);
}

const DIALOGUE_LANG_FIELDS = ['fr', 'ja', 'en', 'zh'];
const FLAT_EXAMPLE_TEXT_FIELDS = [...DIALOGUE_LANG_FIELDS, 'ipa', 'yomi', 'pinyin', 'ko'];
const DIALOGUE_LINE_KEYS = new Set(['speaker', ...DIALOGUE_LANG_FIELDS, 'ipa', 'ko']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** dialogue 한 줄 — story 대사처럼 평탄하며 원어 키는 정확히 하나만 허용 */
function isValidDialogueLine(v) {
  if (!isPlainObject(v)) return false;
  if (Object.keys(v).some((k) => !DIALOGUE_LINE_KEYS.has(k))) return false;
  if (!isNonEmptyString(v.speaker) || !isNonEmptyString(v.ko)) return false;
  const langFields = DIALOGUE_LANG_FIELDS.filter((k) => k in v);
  if (langFields.length !== 1 || !isNonEmptyString(v[langFields[0]])) return false;
  if ('ipa' in v && !isNonEmptyString(v.ipa)) return false;
  return true;
}

/** 기존 평탄 예문 또는 dialogue 예문. 두 형태의 원어·발음·번역 필드는 배타적이다. */
function isValidExample(v) {
  if (!isPlainObject(v)) return false;
  if (!('dialogue' in v)) return isFlatObject(v);
  if (FLAT_EXAMPLE_TEXT_FIELDS.some((k) => k in v)) return false;
  if (!Array.isArray(v.dialogue) || v.dialogue.length === 0) return false;
  if (!v.dialogue.every(isValidDialogueLine)) return false;
  return Object.entries(v).every(([k, x]) => k === 'dialogue' || isScalar(x));
}

function isValidExampleArray(v) {
  return Array.isArray(v) && v.every(isValidExample);
}

/** rows가 "평평한 객체 배열"인 블록 — enParallel({rows:[{en,fr,ko}], note})·hanjaBridge({rows:[{zh,trad,ja,read,ko}]}) */
function isFlatRowsBlock(v) {
  if (!isPlainObject(v)) return false;
  for (const [k, x] of Object.entries(v)) {
    if (k === 'rows') {
      if (x != null && !isFlatObjectArray(x)) return false;
    } else if (!isScalar(x)) return false;
  }
  return true;
}

/**
 * 섹션 하나의 렌더 가능 구조 검증 — 렌더러가 소비하는 모든 leaf까지 내려간다.
 * 화이트리스트에 없는 키는 거부(미지의 구조가 렌더러에 닿는 경로 차단).
 *  - examples: 평탄 예문 또는 dialogue([{speaker, fr|ja|en|zh, ipa?, ko}]) — 두 형태는 배타
 *  - table: caption·headers 원소·rows 셀 전부 <caption>/<th>/<td>의 직접 child → 스칼라
 *  - story: body 원소(ja/narr/speaker…)는 평평한 객체, questions는 스칼라 배열(accept·model)까지 허용
 *  - media: youtubeId·songTitle 등 스칼라 + line(가사 한 줄)만 평평한 객체
 *  - enParallel·hanjaBridge: RefParallel·RefHanjaBridge가 rows 원소의 .en/.zh 등을 소비 → rows는 평평한 객체 배열
 *  - gojuon: GojuonChart의 sets prop(sets.includes 호출) → 스칼라 배열
 */
function isValidSection(s) {
  if (!isPlainObject(s)) return false;
  for (const k of Object.keys(s)) {
    if (!SECTION_KEYS.has(k)) return false;
  }
  for (const k of SECTION_STRING_FIELDS) {
    if (k in s && s[k] != null && typeof s[k] !== 'string') return false;
  }
  for (const k of SECTION_SCALAR_ARRAY_FIELDS) {
    if (k in s && s[k] != null && !isScalarArray(s[k])) return false;
  }
  for (const k of SECTION_BOOLEAN_FIELDS) {
    if (k in s && s[k] != null && typeof s[k] !== 'boolean') return false;
  }
  if ('examples' in s && s.examples != null && !isValidExampleArray(s.examples)) return false;
  if ('table' in s && s.table != null) {
    const t = s.table;
    if (!isPlainObject(t)) return false;
    if ('caption' in t && !isScalar(t.caption)) return false;
    if ('headers' in t && t.headers != null && !isScalarArray(t.headers)) return false;
    if ('rows' in t && t.rows != null) {
      if (!Array.isArray(t.rows) || !t.rows.every(isScalarArray)) return false;
    }
  }
  if ('story' in s && s.story != null) {
    const st = s.story;
    if (!isPlainObject(st)) return false;
    if ('body' in st && st.body != null && !isFlatObjectArray(st.body)) return false;
    if ('questions' in st && st.questions != null) {
      if (!Array.isArray(st.questions) || !st.questions.every(isShallowObject)) return false;
    }
  }
  if ('media' in s && s.media != null) {
    const m = s.media;
    if (!isPlainObject(m)) return false;
    for (const [k, v] of Object.entries(m)) {
      if (k === 'line') {
        if (v != null && !isFlatObject(v)) return false;
      } else if (!isScalar(v)) return false;
    }
  }
  if ('enParallel' in s && s.enParallel != null && !isFlatRowsBlock(s.enParallel)) return false;
  if ('hanjaBridge' in s && s.hanjaBridge != null && !isFlatRowsBlock(s.hanjaBridge)) return false;

  // RFC v2 "실전 샌드위치" 섹션 검증
  if (s.type && ['authenticIntro', 'vocabPreview', 'authenticReplay', 'practiceAndRegistration'].includes(s.type)) {
    // v2 섹션 구조는 각 타입별로 고유 필드 필수 — 기본 평탄성만 검증
    // 상세 검증은 validateSectionV2(lessonModel.js)에 위임
    if (s.type === 'authenticIntro') {
      // audio: {url, sourceId, duration, license, attribution} — 평탄한 객체
      if ('audio' in s && s.audio != null && !isFlatObject(s.audio)) return false;
      // captions: {original, translation, romanized?} — 평탄한 객체
      if ('captions' in s && s.captions != null && !isFlatObject(s.captions)) return false;
    }
    if (s.type === 'vocabPreview') {
      // vocabs: [{word, meanings[], exampleSentence, note?}, ...] — 각 원소는 평탄한 객체(meanings는 스칼라 배열)
      if ('vocabs' in s && s.vocabs != null) {
        if (!Array.isArray(s.vocabs)) return false;
        for (const vocab of s.vocabs) {
          if (!isPlainObject(vocab)) return false;
          for (const [k, v] of Object.entries(vocab)) {
            if (k === 'meanings') {
              if (v != null && !isScalarArray(v)) return false;
            } else if (!isScalar(v)) return false;
          }
        }
      }
    }
    if (s.type === 'authenticReplay') {
      // original/variant: {audio: {...}, captions: {...}} — 평탄한 객체 두 계층
      const validateAudioBlock = (block) => {
        if (!isPlainObject(block)) return false;
        if ('audio' in block && block.audio != null && !isFlatObject(block.audio)) return false;
        if ('captions' in block && block.captions != null && !isFlatObject(block.captions)) return false;
        return true;
      };
      if ('original' in s && s.original != null && !validateAudioBlock(s.original)) return false;
      if ('variant' in s && s.variant != null && !validateAudioBlock(s.variant)) return false;
      // selfCheckOptions: [{label, value, fsrsSignal}, ...] — 각 원소는 평탄한 객체
      if ('selfCheckOptions' in s && s.selfCheckOptions != null) {
        if (!Array.isArray(s.selfCheckOptions)) return false;
        if (!s.selfCheckOptions.every(isFlatObject)) return false;
      }
    }
    if (s.type === 'practiceAndRegistration') {
      // writingPrompts: [string, ...] — 스칼라 배열
      if ('writingPrompts' in s && s.writingPrompts != null && !isScalarArray(s.writingPrompts)) return false;
      // quizItems: [object, ...] — 각 원소는 구조화된 객체 (pairs 배열 등 복잡 구조)
      // 상세 검증은 lessonModel에 위임하고, 여기서는 배열 존재만 확인
      if ('quizItems' in s && s.quizItems != null && !Array.isArray(s.quizItems)) return false;
    }
  }

  return true;
}

/**
 * 오버라이드 최소 구조 검증 — 렌더를 크래시시킬 수 있는 형태를 거른다.
 * 저장 API(POST)와 렌더 병합(mergeChapter) 양쪽에서 사용해, 검증을 뚫고 저장된
 * 과거 행이 있어도 렌더는 fail-closed(원본)로 버틴다.
 * 완전한 스키마 검증이 아니라 "공개 페이지를 500으로 만들 수 있는 형태" 차단이 목적.
 */
export function isValidOverride(data) {
  if (!isPlainObject(data)) return false;
  for (const k of Object.keys(data)) {
    if (!CHAPTER_KEYS.has(k)) return false;
  }
  for (const k of CHAPTER_STRING_FIELDS) {
    if (k in data && data[k] != null && typeof data[k] !== 'string') return false;
  }
  for (const k of CHAPTER_SCALAR_ARRAY_FIELDS) {
    if (k in data && data[k] != null && !isScalarArray(data[k])) return false;
  }
  for (const k of CHAPTER_BOOLEAN_FIELDS) {
    if (k in data && data[k] != null && typeof data[k] !== 'boolean') return false;
  }
  if ('sections' in data) {
    const sections = data.sections;
    if (!Array.isArray(sections) || sections.length === 0) return false;
    if (!sections.every(isValidSection)) return false;
  }
  return true;
}

/** 챕터의 story 문항 id 전부 수집 */
function collectStoryIds(chapter) {
  const ids = [];
  for (const s of chapter?.sections || []) {
    for (const q of s?.story?.questions || []) {
      if (q && q.id != null) ids.push(String(q.id));
    }
  }
  return ids;
}

/**
 * story 문항 id 불변 검증 — 원본(base)의 문항 id가 오버라이드(data)에서 삭제·변경되면
 * 그 id 목록을 반환한다(빈 배열 = 위반 없음). 학습 기록·채점 키가 id에 연동되므로
 * 저장 API가 최종 방어한다. data에 sections가 없으면(부분 오버라이드 — 얕은 병합으로
 * base sections 유지) 검증 대상이 아니다. 새 문항의 새 id 추가는 허용.
 */
export function missingStoryIds(base, data) {
  if (!data || !Array.isArray(data.sections)) return [];
  const dataIds = new Set(collectStoryIds(data));
  return collectStoryIds(base).filter((id) => !dataIds.has(id));
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
