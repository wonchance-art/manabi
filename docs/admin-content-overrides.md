# 관리자 웹 챕터 편집 모드 (content_overrides)

오너가 웹에서 직접 문법 챕터의 제목·내용을 수정하는 기능. 챕터 **원본은 정적 JS(`src/content/**`)**
에 그대로 두고, 수정본만 Supabase `content_overrides` 테이블에 저장해 **렌더 시 원본 위에 병합**한다.

## 구성 요소

| 파일 | 역할 |
| --- | --- |
| `supabase/migrations/20260712_content_overrides.sql` | `content_overrides(lang, slug, data jsonb, updated_at, updated_by)` 테이블 + RLS + updated_at 트리거 |
| `src/lib/contentOverrides.js` | 서버 전용 병합 유틸 — `getChapterOverride`, `getOverridesForLang`, `mergeChapter`, `applyManifestOverrides` |
| `src/lib/supabaseServer.js` | 쿠키 세션 기반 서버 클라이언트 + `requireAdmin()` |
| `src/app/api/admin/chapter/route.js` | GET(병합본 조회)·POST(upsert)·DELETE(복원) route handler |
| `src/components/admin/InlineEdit.jsx` | 본문 각 요소를 감싸는 인라인 편집 래퍼(관리자만 연필 표시, 작은 static 클라이언트 컴포넌트) |
| `src/components/admin/InlineEditForm.jsx` | 연필 클릭 시에만 dynamic import되는 편집 폼(값 fetch·패치·저장) |
| `src/components/admin/ChapterAdminStrip.jsx` | 챕터 하단 슬림 스트립(관리자만) — 수정본 배지 + 파일 버전 복원 |
| `src/views/AdminPage.jsx` | «📝 콘텐츠» 탭 — 오버라이드 목록·복원·JSON 수확 |

## 병합 의미론

- **얕은 병합**: `{ ...base, ...override }`. override에 있는 최상위 키만 덮어쓰고, 나머지는 원본 유지.
  - 예: override에 `title`, `summary`만 있으면 그 둘만 바뀌고 `sections` 등은 원본 그대로.
  - 섹션 단위 부분 병합은 하지 않는다 — 섹션을 고치려면 `sections` 배열 전체를 저장한다(에디터가 그렇게 한다).
- **불변 필드(base 강제)**: `slug`, `level`, `order`. override에 들어와도 항상 원본 값으로 되돌린다.
  진도·이전/다음 링크·목차 연동이 깨지지 않게 하기 위함. 렌더 병합(`mergeChapter`)과 저장 API(POST) 양쪽에서 이중으로 강제한다.
- **실패 안전**: 오버라이드 조회(`src/lib/contentOverrides.js`)의 모든 실패는 조용히 `null`/빈 `Map`을 반환한다.
  빌드·프리뷰에서 DB가 불통이어도 페이지는 원본으로 정상 렌더된다.

## 편집 UX — 인라인 연필(창·오버레이 없음)

편집은 **원래 챕터 페이지 그대로**, 각 문장·요소의 오른쪽 끝(넓은 화면에선 본문 컬럼 밖 오른쪽 여백,
좁은 화면에선 요소 우상단)에 뜨는 작은 연필(`✎`)로 한다. 연필은 **관리자 계정에만** 보이고,
클릭하면 그 자리에서 해당 요소가 편집 폼으로 바뀐다(새 창·모달·오버레이 없음).

- **비관리자·비로그인**: 연필도 폼 코드도 로드되지 않는다. `InlineEdit`는 값(챕터 원문)을 props로 받지 않고
  추가 DOM 없이 children만 렌더한다 — 일반 유저 RSC 페이로드에 편집용 값이 실리지 않는다.
- **값 해석**: 연필 클릭 시에만 `GET /api/admin/chapter`로 merged 챕터를 fetch(챕터당 1회, 모듈 캐시 공유)해
  `path`로 값을 읽는다. 편집 폼(`InlineEditForm`)은 첫 클릭 시 dynamic import로 분리돼 챕터 페이지 First Load JS에 들어가지 않는다.
- **경로(path) 규약**:
  - `title` · `topic` · `titleFr` · `summary` (챕터 스칼라. `topic,titleFr`처럼 콤마로 한 줄 다중 편집)
  - `sections.{i}.{heading|pattern|patternKo|tip|pitfall|vsKo|vsEn|hanja|etym}`
  - `sections.{i}.body.p{j}` — body를 `\n\n`로 split한 j번째 문단(저장 시 `\n\n`로 재결합)
  - `sections.{i}.examples.{j}` — 예문 객체(kind=`example`, 기존 칸만 수정)
  - `sections.{i}.{table|story|media}` — 블록(kind=`json`)
- **저장**: merged 복제에 path만 패치 → `POST /api/admin/chapter`로 **전체 data**를 upsert(기존 API 그대로).
  성공 시 모듈 캐시를 무효화하고 `router.refresh()`. 실패 시 폼 안에 인라인 에러를 띄운다.
- **하단 스트립(`ChapterAdminStrip`)**: 수정본이 있으면 «수정본 적용 중» 배지 + «파일 버전으로 복원»(DELETE, 확인) 버튼만.

## 즉시 반영 경로

1. 저장 직후 서버가 `revalidatePath('<base>/grammar/<slug>')` 와 `revalidatePath('/lessons')` 로 해당 경로를 무효화.
2. 챕터 상세·문법 목록 페이지는 `export const revalidate = 60`(ISR)이라, 무효화 후 다음 요청에서 새 병합본으로 재생성된다.
   그 외에는 60초 주기로 갱신된다.

병합이 적용되는 렌더 지점:
- 챕터 상세(`ReferenceChapterPage.jsx`) — 본문 + 이전/다음 제목.
- `generateMetadata` — 챕터 상세 `<title>`·description.
- 문법 목록(`/lessons`) — 챕터 제목·주제·요약·소요시간(`applyManifestOverrides`).

## 인증 흐름

- 판정: `requireAdmin()`가 쿠키 세션에서 유저를 확인하고 `profiles.role = 'admin'`을 검사.
- **service_role 키는 절대 쓰지 않는다.** 쓰기는 사용자 세션 클라이언트(anon key + 쿠키)로 수행하고,
  RLS(`is_admin()` 정책)가 DB 레벨의 최종 방어선이다. UI 게이트(`useAuth().isAdmin`)는 편의일 뿐.

## 수확(harvest) 워크플로

오버라이드는 임시 저장소다. 검증된 내용은 파일로 옮겨 정본화한다.

1. `/admin` → «📝 콘텐츠» 탭에서 대상 행의 `data` JSON을 펼쳐 복사.
2. 해당 챕터의 원본 파일(`src/content/<lang>/grammar/<level>.js`)에 반영.
3. `node scripts/check-content.mjs` (콘텐츠 게이트) 통과 확인 — 슬러그·링크·요미가나·챕터 한자 레벨 등.
4. 게이트 통과 후 «📝 콘텐츠» 탭에서 해당 행 «복원(삭제)» → `content_overrides`에서 제거(파일 버전이 정본이 됨).

## 주의

- **오버라이드는 `check-content.mjs` 게이트를 거치지 않는다.** 웹 편집은 즉시 반영되므로, 게이트는 수확(파일 반영) 시점에만 걸린다.
  요미가나 정렬·챕터 레벨 초과 한자 등 규칙 위반 여지가 있으니, 오버라이드는 임시로만 쓰고 검증 후 파일로 정본화하는 것을 원칙으로 한다.
- 저장 데이터에서 `slug`/`level`/`order`는 서버가 항상 원본으로 강제한다(변경 불가). 스토리 문항 `questions[].id` 등
  구조 변경은 kind=`json` 편집(스토리·표·미디어 블록)에서만 가능하며, 서버 검증(`isValidOverride`)이 렌더 안전을 지킨다.
