# 『となり』 앱 연동 설계 — 일본어 원문 매거진을 기존 학습 도구로 읽게 하기

- 상태: **설계안(구현 전)** · 2026-10-14 KST · 작성 Claude
- 범위: 일본어 원문으로 쓴 『となり』 각 호를 앱에 **어떻게 싣고**, 학습자가 **어디서 발견하고**, **어떤 화면에서 읽고 단어를 저장하는가**.
  코드 변경 없음. 구현은 아래 §7 순서와 계약으로 별도 PR에서 한다.
- 전제: [README 「방향 전환」](README.md#방향-전환-오너-2026-10-14-kst--일본어-원문-매거진) — 기사는 일본어 원문, 읽기 보조(형태소 분석·단어 카드·루비·단어 저장 → FSRS)는 **기존 뷰어**가 맡는다.
  오너 규칙: 기존 부품 재사용, 새 이음새 금지(CLAUDE.md 제품 나침반 3문).

---

## 0. 결론 먼저

**권고: (A) 정본 문학책 파이프라인에 두 번째 공급자 `tonari`를 붙여, 각 호를 「책」 한 권(꼭지 = 장)으로 싣는다.**
시각적인 「판」(표지·숫자 도표·지도·출처 노트)은 /studies 아래 서버 렌더 **호 목차 페이지** 하나로만 두고, 본문 읽기는 전부 `/viewer/[id]`로 보낸다.

| 3문 | 답 |
|---|---|
| ⑴ 어느 정거장 | **자료 읽기 순환의 「콘텐츠 공급」**(§1.1 — 직접·PDF·책 옆에 「정본 책」으로). 그 뒤 자동 분석 → 뷰어 → 저장 → FSRS → 본문 귀환은 기존 그대로 |
| ⑵ 재사용 | `literaturePublish.js` 준비→분석→공개, `/api/admin/literature`, `LiteraturePublishPanel`, `runPreservedReanalysis`, `reading_materials` + `metadata.book`, 뷰어 책 내비·출처 줄·원문 잠금, `save_vocabulary_context` kind `reading`, 산책 › 함께 읽는 글의 책 카드, 서재 담기 |
| ⑶ 새 이음새 | **없음**. 단어 저장 출처는 기존 `reading`(materialId)이고 `studies` 출처 종류 신설은 하지 않는다(README S2 보류 유지). 새로 생기는 것은 **공급자 어댑터**(빌드 입력 형식·권리 판정)뿐이다 |

---

## 1. 현재 정본 문학책 경로 실측 (AOZORA-P0-1/2/3)

### 1.1 원문 → 장 (빌드, 리포 안)

| 단계 | 위치 | 하는 일 |
|---|---|---|
| 작품 폴더 | `src/content/literature/aozora/<workKey>/{source.txt, entry.json}` | 원문(UTF-8)과 카탈로그·권리 기록. 절차 정본은 `src/content/literature/aozora/README.md` |
| CLI | `scripts/build-literature.mjs:16-26` | `buildLiterature({check})` 호출, `--check`는 쓰지 않고 차이만 실패 |
| 빌드 본체 | `scripts/lib/literature-build.mjs:8` | 루트가 **`src/content/literature/aozora`로 고정** |
| | `literature-build.mjs:84-85` | 폴더 이름 = 작품 키, `source.txt` SHA-256 = `entry.textSha256`(원문 수정 차단) |
| | `literature-build.mjs:92` | `createAozoraCatalog` — 형식·중복 검사, 깨지면 아무것도 쓰지 않음 |
| | `literature-build.mjs:101-106` | `createAozoraMaterialDraft(entry, parseAozoraText(source))`, 문단 찢김·루비 유실 0만 통과 |
| | `literature-build.mjs:123-134` | 한 편이라도 실패하면 목록을 안 바꾸고, `index.generated.js`(서버 게시용·원문 포함)와 `manifest.generated.json`(뷰어 대조용·장 SHA-256+크레딧)을 생성 |
| 장 초안 | `src/lib/aozoraMaterial.js:178-198` | 공개 불가·제목/저자 불일치·**底本/入力/校正 판권 누락**·미해결 외자·파서 경고면 실패 |
| | `aozoraMaterial.js:203-225` | 장 = `{order, title, materialTitle, rawText, metadata:{language:'Japanese', level, book:{key,title,author,order,total}, literature:{…, rubyLocks}}}` |
| | `aozoraMaterial.js:148` | `metadata.literature.provider: 'aozora'` |
| 배포 게이트 | `package.json:12` | `prebuild`에 `node scripts/build-literature.mjs --check` |

### 1.2 관리자 게시 (준비 → 자동 분석 → 루비 확인 → 공개)

| 단계 | 위치 | 하는 일 |
|---|---|---|
| 책 목록 | `src/app/api/admin/literature/route.js:18` | `LITERATURE_BOOKS`를 **aozora index에서만** 정적 import. 원문은 요청이 아니라 빌드 산출물에서만 온다(13행) |
| 권리 재확인 | `route.js:69` → `src/lib/literaturePublish.js:22-26` | `literatureBookPublishable` — **`provider === 'aozora'`** + `aozoraRightsPublishable` |
| ① 준비 | `route.js:94-104` → `literaturePublish.js:49-62` | 없는 장만 **비공개** `reading_materials` 행으로 삽입(`status:'pending'`, 소유자 = 게시한 관리자), book key + 장 순서 멱등, 원문이 다르면 409 |
| ② 분석 | `src/components/LiteraturePublishPanel.jsx:76-91` | 화면이 장마다 `runPreservedReanalysis(…, {fullReset:true})` — 뷰어 「이 챕터 분석하기」와 같은 경로. 끝에서 `applyMaterialRubyLocks`(`src/lib/analyzeText.js:462`) |
| ③ 루비 확인 | `route.js:46-50` → `literaturePublish.js:125-131` | `countAppliedRubyLocks`로 장별 적용률 |
| ④ 공개 | `route.js:79-91` → `literaturePublish.js:69-75` | 모든 장이 있고 모두 `completed`일 때만 `visibility:'public'`. 아니면 409 |

인증은 `requireAdmin()` + 사용자 세션(RLS 소유자 쓰기가 최종 방어), service_role 미사용(`route.js:14-15`).

### 1.3 사용자가 읽는 곳 · 단어 저장 출처

- **발견**: 발견 › 「외국어 읽을거리」 → `/discover?view=reading`(`src/app/(app)/discover/page.jsx:11`) → `MaterialsPage libraryView="public"`.
  공개 자료를 모두 불러(`src/views/MaterialsPage.jsx:86-87`) `groupByBook`(`MaterialsPage.jsx:670`, `src/lib/bookMeta.js:35-51`)으로 묶어 📖 책 카드(`MaterialsPage.jsx:682`) — 장 목록·읽음 수·「아는 단어 N%」(`bookFit`).
  `/materials?tab=public`도 여기로 돌린다(`src/components/web/LibraryPage.jsx:12`).
- **읽기**: `/viewer/[id]`(`src/views/ViewerPage.jsx`).
  - 형제 장 내비: 같은 book key **+ 같은 소유자**(`ViewerPage.jsx:508-524`), 「이전 편/다음 편」(560행).
  - 정본 출처 줄: `useCanonicalLiterature`(330행) → `verifiedCanonicalLiterature`(`src/lib/literatureCanonical.js:39-47`, 원문 SHA-256이 manifest와 같을 때만) → `literatureAttributionParts`(`src/lib/videoAttribution.js:130-145`, **`provider !== 'aozora'`면 null**) → 3732-3744행.
  - 원문 수정 차단: `isCanonicalLiteratureMaterial`(`literatureCanonical.js:16-18`, **`=== 'aozora'`**) → `ViewerPage.jsx:331, 694, 3779-3783`, `src/lib/reanalysisPreservation.js:236`.
  - 다 읽은 뒤: 「✓ 읽기 완료」·「이 글로 연습」(`study_source_*` 핸드오프, `ViewerPage.jsx:4175-4184`) — 일일 세션 순환과의 기존 연결점.
- **단어 저장**: 뷰어가 `{kind:'reading', materialId, tokenId}`를 만든다(`ViewerPage.jsx:2259-2261`) → `POST /api/learning/vocabulary`(`src/app/api/learning/vocabulary/route.js:60-67`) → `resolveSave`가 **공개 자료도 허용**(`src/lib/server/learningContext.js:40` — `kind==='reading' && visibility==='public'`) → RPC `save_vocabulary_context`.
  DB 계약은 `kind in ('textbook','reading','pdf')`(`supabase/migrations/20260905065205_textbook_material_contexts.sql:46, 100`).
  **정본 문학책 장은 `reading`을 쓴다.** 귀환 링크는 `sourceHref` → `/viewer/<material_id>?sourceContext=…`(`src/lib/learningSources.js:25-33`) — 본문 귀환까지 닫혀 있다.
- **서재**: 남의 공개 자료는 「서재에 담기」(`src/components/library/LibrarySaveButton.jsx:12-13`)로 내 서재에 북마크된다.

→ 매거진 장이 **같은 모양의 공개 `reading_materials` 행**이 되면 발견·읽기·저장·복습·귀환·서재가 **코드 변경 없이** 그대로 돈다. 바꿀 곳은 「provider가 aozora인가」를 묻는 다섯 지점뿐이다(§3.2).

---

## 2. 권리 검사 — 자체 저작물을 넣으면 어디서 막히나

### 2.1 막는 지점 (실측)

| 지점 | 위치 | 『となり』 입력이면 |
|---|---|---|
| basis 열거 | `src/lib/aozoraRights.js:21-25` | `public-domain`·`permission`·`unknown`뿐 → `own-work`는 형식 오류 |
| 공개 판정 | `aozoraRights.js:100-110` | `basis === 'public-domain'` 필수 + D5 선정 기준(`88-93`: 1931년 이전 출판 또는 1945년 이전 사망) → **2026년 저작은 항상 false** |
| 관할 | `aozoraRights.js:28, 81-82` | JP·KR·US 보호기간 검토 필수 — 자체 저작에는 질문 자체가 맞지 않음 |
| 카탈로그 | `src/lib/aozoraCatalog.js:21-22, 40-42, 63-67` | `personId` 6자리·`cardUrl`/`sourceFileUrl`은 `www.aozora.gr.jp`만·zip SHA-256 |
| 장 초안 | `aozoraMaterial.js:186-190` | 底本·入力·校正 판권이 없으면 실패 |
| 게시 API | `literaturePublish.js:24` | `provider === 'aozora'` |

**결론: aozora 경로에 값을 꾸며 넣어 통과시키는 방법은 쓰지 않는다**(가짜 personId·가짜 도서 카드·가짜 PD 기록이 되고, 뷰어가 「원작 퍼블릭 도메인」을 그리게 된다 — 허위 표기). 별도 공급자 `tonari`로 권리 판정을 분리한다.
AGENTS.md 「같은 필드 이름이 서로 다른 학습 대상을 뜻하게 하지 않는다」 원칙에 따라 `AOZORA_RIGHTS_BASIS`에 `own-work`를 끼우지 않고, `tonariRights.js`가 따로 판정한다.

### 2.2 『となり』 권리 기록 (제안 `issue.json` → `rights`)

```json
"rights": {
  "status": "approved",
  "basis": "own-work",
  "publisher": "manabi 編集部",
  "reviewedBy": "owner",
  "reviewedAt": "2026-10-20",
  "thirdParty": {
    "quotations": [
      { "id": "q1", "work": "夕焼け小焼け", "creator": "中村雨紅", "scope": "曲名のみ", "basis": "title-mention" }
    ],
    "data": [
      { "id": "d1", "publisher": "総務省統計局", "license": "政府標準利用規約(第2.0版)", "url": "https://www.stat.go.jp/…" }
    ],
    "images": []
  },
  "factCheck": { "sourcesFile": "sources.json", "checkedAt": "2026-10-20" }
}
```

판정(`tonariRightsPublishable`, fail-closed):
1. `status === 'approved'`, `basis === 'own-work'`, `reviewedBy`·`reviewedAt`(KST 날짜) 필수.
2. **제3자 저작물 목록이 명시적**이어야 한다(빈 배열도 키는 있어야 함 — aozora의 `translator: null` 규칙과 같은 「빠뜨림 = 미검토」).
   인용은 브랜드 정책 금지⑵ 범위 안 — 가사 1줄 + 곡명·아티스트(`docs/policy-brand-content.md` §2 표), 소설·기사 원문 0.
3. **이미지는 뷰어 장에 들어가지 않는다**(`images: []` 강제). PD 이미지(Met CC0·ColBase·NDL 만료분)는 호 목차 페이지(§4)에만, MAG-IP-001 캡션 규약으로.
4. `factCheck` — 숫자·연도 문장 ↔ `sources[]` 대응은 MAG-FACT-001이 검사(§6).

### 2.3 `ipPolicy.test.js` · 빌드 검사가 막는가

- `src/lib/__tests__/ipPolicy.test.js:65-84`는 정책 문서 §2.1(퍼블릭 도메인 예외) 문구와 `aozoraRightsPublishable` 숫자 일치만 본다. 자체 저작은 「본문 복제」가 아니므로 **예외가 필요 없고, 이 테스트는 막지 않는다.**
  다만 오독 방지를 위해 정책 문서에 「자체 저작물(『となり』) — 금지⑵ 대상 아님, 단 기사 안의 인용은 금지⑵ 그대로」 한 단락과 강제 지점 포인터를 두고 MAG-IP-001로 묶는다.
  (§2.1 슬라이스는 `### 2.1` ~ `## 3.`이라 그 사이에 `### 2.2`를 넣어도 기존 단언은 유지된다.)
- `src/lib/__tests__/buildLiterature.test.js:33`은 **aozora 루트 5편**이 `--check`를 통과하는지 본다. `tonari`를 aozora 폴더에 넣으면 폴더 이름 검사(`literature-build.mjs:84`)와 카탈로그가 깨진다 → **루트를 분리**(`src/content/literature/tonari/`)하면 기존 테스트는 그대로 green.
- `prebuild`(`package.json:12`) — 같은 CLI가 두 루트를 모두 `--check`하게 하면 문자열 단언(`buildLiterature.test.js:38-41`)도 그대로다.
- `editorialStandard.test.js`는 한국어 표본(`style-samples/*.md`)만 읽는다 — 일본어 원문은 범위 밖이고, 일본어용 `EDIT-STD-JA`는 README대로 후속.

---

## 3. 대안 비교

### 3.1 세 안

- **(A) 정본 책 + 공급자 `tonari`** — 리포에 원문 정본(`src/content/literature/tonari/<issueKey>/`), 같은 빌드 → 같은 관리자 게시(준비·분석·공개) → 공개 `reading_materials` → 기존 뷰어.
- **(B) 관리자가 기존 자료 추가로 공개 자료 등록** — `/materials/add`에서 붙여 넣고 공개로(`src/views/MaterialAddPage.jsx:89, 260, 762`), 책 등록(`?book=`)으로 꼭지를 장으로.
- **(C) /studies 정적 페이지 + 「뷰어로 읽기」 넘기기** — 본문을 /studies에 서버 렌더, 버튼이 뷰어 자료를 만들어(또는 찾아) 넘긴다.

| 기준 | (A) 정본 책 + `tonari` | (B) 공개 자료 수동 등록 | (C) /studies 정적 + 넘기기 |
|---|---|---|---|
| 재사용 | 게시 API·패널·분석·공개 계획·manifest 대조·뷰어·저장·발견·서재 **전부** | 뷰어·저장·발견은 같음. 게시는 일반 사용자 경로 | /studies 렌더만. 읽기 보조는 넘긴 뒤에만 |
| 새 이음새 | **0** — 저장 `reading`, 분석 1회 공유 | 0(형식상). 다만 리포 원고 ↔ DB 본문이 **수동 복사로 갈라짐** | **생김** — 넘기기가 ⑴ 사용자마다 사본을 만들면 분석 N회·공유 해제, ⑵ 공개 자료를 찾으면 결국 (A)/(B)가 필요. /studies 본문의 단어는 저장 불가(README S2 `studies` 출처 신설이 필요해짐) |
| 권리 처리 | `tonariRights.js` fail-closed + manifest 해시 대조 → 출처 줄 「『となり』 · manabi 編集部」를 **위조 불가**로 표기 | 기록 없음. 출처 줄 없음. 원문을 소유자가 고칠 수 있음(정본 잠금 없음) | 리포 안 기록은 가능하나 뷰어 쪽 사본엔 연결 안 됨 |
| 작업량 | 중 — 공급자 어댑터 · 권리 모듈 · provider 판정 5곳 일반화 · 출처 줄 분기 · 호 목차 페이지 1개 (+계약) | 소 — 코드 0, 대신 호마다 수작업(꼭지 9~12장 붙여 넣기·분석·공개) | 중~대 — 정적 렌더 + 넘기기 경로 + (사본이면) 분석 비용 / (공유면) A·B 재구현 |
| 위험 | 공급자 일반화 중 aozora 회귀 → 기존 5편 `--check`·계약 테스트가 지킨다 | 오탈자 수정 = DB 수동 편집, 리포와 표류, 재현 불가, 공개 자료 위조 구분 불가 | 이중 구현(/studies 본문 vs 뷰어 본문), 「PDF 뷰어 = 자료 뷰어 이중 구현」(§1.1 부채)과 같은 형태의 부채 신설 |
| 판정 | **채택** | 배제(일회성 시범 전용으로만 허용 가능) | 본문으로는 배제 — **목차·시각 판만** 부분 채택(§4) |

### 3.2 (A)에서 바꿀 곳 — 「aozora인가」를 「정본 공급자인가」로

| # | 위치 | 지금 | 제안 |
|---|---|---|---|
| 1 | `scripts/lib/literature-build.mjs:8, 61-66` | 루트·파서·초안 함수 고정 | 공급자 어댑터 `{root, entryFile, sourceFiles, catalog(), draft()}` 목록. aozora 어댑터는 현 코드 그대로 감싸기만 |
| 2 | `src/app/api/admin/literature/route.js:18` | aozora index만 import | `[...AOZORA_BOOKS, ...TONARI_BOOKS]` |
| 3 | `src/lib/literaturePublish.js:22-26` | `provider === 'aozora'` | `CANONICAL_PROVIDERS[provider].publishable(…)` 디스패치 |
| 4 | `src/lib/literatureCanonical.js:11, 16-18, 21-28` | aozora manifest·`=== 'aozora'` | 두 manifest 병합, `isCanonicalLiteratureMaterial`은 공급자 집합 판정(원문 잠금이 매거진에도 걸림 — `reanalysisPreservation.js:236` 자동 적용) |
| 5 | `src/lib/videoAttribution.js:130-145` · `ViewerPage.jsx:3732-3744` | aozora 출처 줄만 | `tonari` 분기: 「출처: 『となり』 1号 · manabi 編集部 · 출처·검증 노트 보기」 |
| 6 | `src/components/LiteraturePublishPanel.jsx` | 권리 칸이 초출·몰년·관할 | 공급자별 권리 요약(`literatureBookSummary`, `literaturePublish.js:87-108`)만 분기. 흐름·버튼·문구는 그대로 |

루비 잠금(`src/lib/aozoraRuby.js`)은 공급자 무관(`applyMaterialRubyLocks`는 `rubyLocks` 유무만 봄, 107-110행)이지만 토큰 표식이 `reading_source: 'aozora'`(10, 83행)라 **S0에서는 매거진에 rubyLocks를 싣지 않는다**(분석기 + 사용자 교정으로 충분). 인명·지명 독음 고정이 필요해지면 S1에서 표식 값을 `author`로 일반화(기존 `aozora` 값 하위 호환)한 뒤 켠다.

### 3.3 『となり』 원문 정본 형식 (제안)

```
src/content/literature/tonari/
  tonari-01/                 ← 호 키 = book key (2자리 0 채움)
    issue.json               ← 호 메타·꼭지 순서·레벨·권리(§2.2)·sources 포인터
    sections/
      00-editor.ja.md        ← 편집長の手紙(です・ます調)
      01-first-scene.ja.md   ← 特集 본문(だ・である調)
      …
    sources.json             ← MAG-FACT-001이 읽는 출처 목록(url·checkedAt KST)
    chapters.json            ← 빌드 산출물(손으로 고치지 않음)
  index.generated.js · manifest.generated.json
```

- **꼭지 = 장.** 장 제목은 꼭지명(「01 午後五時の歌」), `materialTitle`은 `『となり』1号 — 01 午後五時の歌`.
  ⚠ 공개 목록은 제목이 `[…#…]` 패턴인 자료를 숨긴다(`MaterialsPage.jsx:85`) — 제목을 `[`로 시작하지 않는다.
- `metadata.book = {key:'tonari-01', title:'『となり』1号 土地と町', author:'manabi 編集部', order, total}` — 기존 책 카드·뷰어 내비가 그대로 쓴다.
- `metadata.level`은 `JP_LEVELS` 값(`src/lib/constants.js:91`) — 원문 수준상 기본 「N2 상급」, 편집장 편지 등 짧은 꼭지도 같은 호 라벨(책 단위 라벨, D6 선례). 개인 체감은 기존 「아는 단어 N%」가 말한다.
- 본문 평문 규칙은 aozora 장과 같다: 문단 사이 빈 줄, 마크다운 표·이미지·각주 기호 제거. 도표·지도는 장에 넣지 않고 목차 페이지로.
- 장 길이 1,500–4,000자(aozora D5와 같은 10–15분). 넘으면 꼭지를 「前編/後編」으로 나눈다(문단 경계만 — 기존 `splitTextIntoChapters` 재사용).

---

## 4. 어디서 보이나 (발견 동선)

| 자리 | 지금 | 『となり』 | 코드 |
|---|---|---|---|
| 발견 › 함께 읽는 글(`/discover?view=reading`) | 공개 책 카드 📖 | 호마다 책 카드 1장 — **자동**(groupByBook) | 0 |
| 발견 홈(`/discover`) | 일본학 특집 1편 + 지역 + N5 문화 읽기(`discover/page.jsx:17-19`) | 「일본어로 읽는 매거진」 한 줄 섹션(최신 호 1 + 지난 호 링크) | 소 — 서버 컴포넌트 1섹션 |
| 지역학 일본(`/studies/japan`) | 한국어 레퍼런스 문서 | 「『となり』」 칸 → 호 목차 페이지 | 소 |
| 호 목차 페이지(신규 1개, `/studies/japan/tonari/[issue]`) | — | 세로 표지 한 단어 · 편집자의 말 요약(한국어 한 줄) · 꼭지 목록(→ 뷰어) · 02 숫자 도표 · 05 지도 · 이 호의 일본어 칩 · 출처·검증 노트. **서버 렌더, JS 0 유지** | 중 |
| 내 서재(`/materials`) | 담은 공개 자료 | 꼭지 「서재에 담기」(기존 버튼) | 0 |
| 나의 책장(`/lessons`, `/books`) | N5 교재 판(edition) 전용(`src/components/books/Bookshelf.jsx`) | **넣지 않는다** — 교재 출판 경로(`publish_textbook_book`, 출처 `textbook`)는 과정·과 단위 계약이라 매거진과 의미가 다르다 | 0 |
| 홈(`/home`) | 불가침(헌법 1.7) | 넣지 않는다 | 0 |

호 목차 페이지의 「읽기」 링크는 서버에서 `processed_json->metadata->book->>key = 'tonari-01'`인 공개 행을 찾되, **manifest 해시와 일치하는 행만** 쓴다(`verifiedCanonicalLiterature` 재사용). 아래 §8 위험 1 때문이다.
아직 공개 전(행 없음)이면 꼭지 줄은 링크 없이 「준비 중」으로 둔다.

---

## 5. 텍스트 목업 (UI 변경은 목업 우선 — 합의 후 구현)

문구는 `docs/design/copy-standard.md`(해요체, 「…」 한 글자, 「…지 못했어요」). 학습 본문(일본어 원문)은 표준 대상이 아니다.

### 5.1 발견 홈 — 새 섹션 (기존 「일본어 N5 · 문화 읽기」 위)

```
발견                                                    외국어 읽을거리
─────────────────────────────────────────────────────────────────
[일본학 · 한국어로 읽기  文化 …]          지역  01 일본 …
─────────────────────────────────────────────────────────────────
일본어로 읽는 매거진 『となり』                         지난 호 보기
┌───────────────────────────────────────────────────────────────┐
│  土      1号 · 土地と町                                        │
│  地      땅과 동네 — 같은 질문, 다른 조건                      │
│          꼭지 10 · 일본어 원문 · N2 상급 · 아는 단어 62%       │
│                                                [목차 보기]    │
└───────────────────────────────────────────────────────────────┘
```
- 「아는 단어 N%」는 로그인 + 분석 완료 + 표본 충족 때만(기존 `bookFit`·`FIT_MIN_TYPES` 규칙). 아니면 줄을 비운다.
- 공개된 호가 없으면 섹션 자체를 그리지 않는다(빈 껍데기 카드 금지 — /studies 인덱스 선례).

### 5.2 호 목차 페이지 `/studies/japan/tonari/01`

```
← 지역학 · 일본

                       土
                       地            (세로 표지 — aria-hidden)
『となり』1号  土地と町  (가로 h1)
땅과 동네 — 일본 사람들은 어떤 조건에서 동네를 꾸려 왔을까요.
일본어 원문 · 꼭지 10 · 약 40분 · N2 상급

목차                                              [첫 꼭지부터 읽기]
  00  編集長の手紙                    3분   읽기 →
  01  午後五時の歌         재구성 장면  6분   읽기 →
  02  数字で見る町                    4분   읽기 →
  03  短い話 三つ                     8분   읽기 →
  04  モノ・コト・ヒト                 5분   읽기 →
  05  地図で歩く                      (이 페이지 아래 지도)
  06  住むなら                        5분   읽기 →
  07  韓国と並べて                    4분   읽기 →
  08  やってみる                      3분   읽기 →
      この号の日本語                  (이 페이지 아래 칩)

읽는 법
  꼭지를 누르면 읽기 화면에서 열려요. 모르는 단어를 누르면 뜻과 읽기가 보이고,
  저장한 단어는 복습에 들어가요.

02 숫자로 보기 (도표)  ·  05 지도 (기존 지도 핀)  ·  이 호의 일본어
  [丁目] [町内会] [ごみ出し] [防災無線] …   ← 칩: 단어 상세 열기만(저장은 읽기 화면에서)

출처·검증 노트 (접힘)
```
- 「읽기 →」는 `/viewer/<id>`. 공개 전 꼭지: 「준비 중」(링크 없음).
- 「05 地図で歩く」처럼 본문이 짧고 지도가 주인 꼭지는 장으로 싣지 않는 것을 기본으로 한다(뷰어는 지도를 못 그림). 본문이 1,000자 이상이면 장으로도 싣는다.
- 칩은 MAG-ANATOMY-001대로 **기존 경로 링크만**(새 저장 엔드포인트 0). 저장은 뷰어에서.

### 5.3 읽기 화면 `/viewer/<id>` — 바뀌는 것은 출처 줄 한 줄

```
일본어 · N2 상급 · 공개 읽기
『となり』1号 — 01 午後五時の歌
출처: 『となり』 1号 · manabi 編集部 · 출처·검증 노트 보기 · 재구성 장면

  午後四時五十八分、東京のある住宅街。電柱に小さな表示板が貼られている。…
  (기존 그대로: 루비 · 단어 누르면 단어 카드 · [단어장에 저장] · due 하이라이트 · '내 단어' 칩)

다 읽었다면   [✓ 읽기 완료]  [이 글로 연습]
다음 편 → 02 数字で見る町
```
- 「출처·검증 노트 보기」 → 호 목차 페이지의 `#sources`.
- 「재구성 장면」은 `issue.json`의 꼭지 `reconstructed: true`일 때만(MAG-PEOPLE-001 화면 라벨 요건을 이 줄로 충족).
- 원문 수정 메뉴 자리: 「정본 책이라 원문은 고칠 수 없어요 · 단어 뜻·발음 교정과 다시 분석은 그대로 쓸 수 있어요」(기존 문구 재사용, `ViewerPage.jsx:3783`).
- 단어 저장 토스트·충돌 문구·복습 연결은 기존 그대로 — 새 문구 0.

### 5.4 관리자 › 📚 정본 문학책 — 공급자 칸만 늘어남

```
『となり』1号 土地と町 · manabi 編集部 · N2 상급
권리: 자체 저작 · 검토 owner 2026-10-20 · 인용 1건(곡명만) · 통계 1건(政府標準利用規約) · 이미지 0
미게시 · 10장                                                         [게시]
```
이후 「준비 중 · 분석 3/10」 → 「분석 10/10 · 산책에 아직 안 보여요」 → [공개] → 「공개됨 · 산책 › 함께 읽는 글」 — 기존 단계 문구(`LiteraturePublishPanel.jsx:45-48`) 그대로.

### 5.5 판면 층 — 텍스트가 아니라 잡지로 읽히게 (오너 결정 2026-10-15 KST, 「ㄱㄱ」)

문제: §5.2–5.3대로면 시각물은 호 목차 페이지 한 장에만 있고, 기사는 뷰어에서 일반 텍스트 책의 한 장처럼 읽힌다. 학습 기능은 살지만 잡지 경험이 표지에서 끝난다.
원칙: 잡지다움은 종이 복제(PDF)가 아니라 **편집된 순서 · 판면의 리듬 · 글과 시각물의 교차**에서 나온다. PDF 복제는 오너 보류 범위이고, 휴대전화에서 글자가 작아지며, 뷰어의 분석·저장과 연결되지 않으므로 배제한다. 학습 순환(뷰어·단어 저장·FSRS)은 그대로 두고 그 위에 판면 층을 얹는다.

| 층 | 내용 | 이음새 영향 | 순서 |
|---|---|---|---|
| ① 호 목차 페이지 | A4 표지(`cover-spec.md`) → 펼침면 같은 차례(꼭지마다 세로 단어·부제·색) → 지도·숫자 도표가 꼭지 사이에 끼는 순서 | 없음(§5.2 확장) | 1순위 |
| ② 뷰어 장 머리 「扉」 | 기사 첫 화면: 호 띠(색) · 세로 표지 단어 · 부제. 그 아래부터 기존 뷰어 본문 | 장 `metadata.literature`에 표시용 필드(`coverWord`·`subtitle`·`accent`) 추가 + 뷰어 머리 표시 분기. 단어 저장·출처 줄 경로 불변 | 1순위 |
| ③ 꼭지 사이 「간지」 | 「다음 편」으로 넘어갈 때 지도나 숫자 한 장 카드(본문 지도 재사용) | 기존 책 내비 위에 카드만 | 2순위 |
| ④ 본문 조판 | 명조체 본문, 소제목·행간 | 표시만 | 2순위 |
| ⑤ 호의 끝 | 「이 호의 일본어」 칩 → 저장 단어 복습(기존 FSRS) | 기존 경로 | 2순위 |

- 세로쓰기(縦書き) 본문은 뷰어의 단어 탭·루비·분석 화면과 충돌 위험이 커서 후순위(별도 조사 후).
- ② 扉 목업(합의됨):

```
┌─────────────────────────────┐
│ ▍『となり』一つの町 01   (색 띠)  │
│                         富    │
│  今の金鳥居は、もとの       士    │  ← 세로 표지 단어(aria-hidden, 가로 h1 별도)
│  場所より30メートル山に近い。 み   │  ← 부제
│                         ち    │
│  ─────────────────────────  │
│  門の奥の水                    │  ← 첫 소제목부터 기존 뷰어 본문
│  金鳥居から上宿の交差点まで…  │     (단어 탭·저장 그대로)
└─────────────────────────────┘
```
- 시범 호: 「一つの町 01 富士吉田」. 정적 시안 `prototype/tonari-machi01.html`(표지·호 목차·扉·간지)로 먼저 보이고, 구현은 §7 S0 다음.

---

## 6. 나중에 심을 계약

| ID | 파일(제안) | 내용 |
|---|---|---|
| TONARI-RIGHTS-001 | `src/lib/__tests__/tonariRights.test.js` | `basis:'own-work'` + 제3자 목록 키 필수 + `images:[]` + KST 날짜. 하나라도 빠지면 publishable false. **aozora 판정과 교차 불가**(tonari 기록을 `aozoraRightsPublishable`에 넣으면 false, 반대도 false) |
| TONARI-BUILD-001 | `buildLiterature.test.js` 확장(기존 단언 수정 없이 새 describe) | 두 루트 결정성(2회 같은 바이트) · `--check` 낡음 검출 · 한 공급자 실패 시 두 index 모두 미갱신 · aozora 5편 결과 바이트 불변 |
| MAG-ANATOMY-001 | `src/lib/__tests__/magazineAnatomy.test.js` | `issue.json` 꼭지 순서(표지 → 편집자의 말 → 01…08 → 이 호의 일본어 → 더 읽고 보기 → 출처·검증 노트) · `coreReader` · 장 제목 `[` 시작 금지 · 장당 1,500–4,000자 · 칩은 기존 경로 링크만 |
| MAG-PROVENANCE-001 | 같은 계열 | 장 `metadata.literature`(공급자 tonari)에 `provider·issueKey·sectionId·publisher·rights·sourcesRef·reconstructed·edits` 필수, 출처 줄은 manifest 해시 일치 때만(`literatureCanonical.test.js` 패턴 재사용) |
| MAG-FACT-001 | `src/content/…/__tests__/magazineFacts.test.js`(README 예정) | 숫자·연도 문장 ↔ `sources.json` id, `url`·`checkedAt`(KST, 'Z' 금지). 일본어 원문용 숫자 정규식(算用数字·和暦 병기) |
| MAG-IP-001 | `ipPolicy.test.js` 확장 | 정책 문서 「자체 저작물」 단락 존재 + 강제 지점 포인터 · 인용 가사 1줄 상한 · PD 이미지는 목차 페이지에만 |
| CANON-PROVIDER-001 | `literatureCanonical.test.js` 확장 | 원문 잠금·출처 줄·게시 가능 판정이 **같은 공급자 등록부 하나**에서 나온다(이중 진실 방지 — aozora만 고치고 tonari를 빠뜨리는 회귀 차단) |

---

## 7. 단계 (작은 PR 순)

1. **S0-a 공급자 일반화(무행동 변화)** — 빌드 어댑터·provider 등록부·판정 5곳. aozora 5편 산출물 바이트 불변이 증거.
2. **S0-b tonari 공급자 + 권리 모듈 + 계약** — 테스트용 가짜 호(fixture)로만. 실제 콘텐츠 0.
3. **S0-c 출처 줄 tonari 분기 + 관리자 권리 요약 분기** — 목업 §5.3·§5.4 합의 후.
4. **콘텐츠** — 1호 일본어 원문 정본 커밋(편집 공정 `/magazine-edit` 산출) → 빌드 → 관리자 게시·분석·루비/분석 육안 검수 → 공개. 운영 DB 쓰기는 기존 관리자 화면 경로(RLS 소유자 쓰기)뿐 — 스키마·환경 변수 변경 없음.
5. **S1 호 목차 페이지 + 발견 섹션** — 목업 §5.1·§5.2 합의 후. MAG-TYPE-001(세로 표지)과 함께.
6. 보류: `studies` 출처 종류(README S2) · rubyLocks 표식 일반화 · 음성. 사용 실측 뒤 재검토.

---

## 8. 위험과 열린 질문

1. **공개 책 카드 위조(기존 부채, 매거진이 표면을 키움)** — 공개 목록은 소유자 구분 없이 book key로만 묶는다(`MaterialsPage.jsx:86-87, 670`, `bookMeta.js:35-51`). 누구든 공개 자료에 `metadata.book.key = 'tonari-01'`(또는 결정적인 `aozora-…`)을 넣으면 그 장이 공식 책 카드 안에 끼어 보인다. 뷰어 내비는 소유자로 거르므로(`ViewerPage.jsx:516`) 안전하고, 출처 줄은 해시 대조로 위조되지 않는다.
   → 매거진 공개 전에 **공개 목록 묶음 키를 `key + owner_id`로** 하거나, 정본 공급자 키는 manifest 해시가 맞는 행만 묶도록 고친다(별도 작업으로 분리).
2. **AI 협업 저작 표기** — 원문 집필에 AI가 참여한다. 출처 줄의 저작 표기(「manabi 編集部」만인지, 협업 표기를 둘지)는 **제품 결정**이라 오너 확인 대상이다. 이 설계는 「manabi 編集部」를 기본값으로 두고 결정을 기다린다.
3. **레벨 라벨** — 원문 수준을 호 단위 「N2 상급」 하나로 둘지, 꼭지별로 둘지. 책 단위 라벨(D6 선례)을 권고하고, 체감은 「아는 단어 N%」에 맡긴다.
4. **분석 품질** — 매거진 문체(だ・である, 고유명사 밀도)는 아오조라보다 고유명사 오분석이 많을 수 있다. 공개 전 육안 검수(관리자 단계 ③)에서 고유명사 교정은 기존 단어 교정으로 하고, 반복되면 S1 rubyLocks를 켠다.
5. **1차 원문 대조** — README 「공통 한계」대로 수치 출처 원문 대조(네트워크 허용 필요)가 끝나기 전에는 공개(단계 ④)하지 않는다. MAG-FACT-001 green이 공개 조건.

---

## 9. 선례·오픈소스 조사 (채택/부분 채택/배제 + 근거)

조사 환경 프록시 제약으로 일부는 검색 요약·2차 리뷰 기반이다 — **미확인** 표시는 채택 전 원문 재확인 대상.

| 선례 / OSS | 확인한 것 | 판정 | 근거 · 우리에게 적용 |
|---|---|---|---|
| **Satori Reader** ([공식](https://www.satorireader.com/features), [Tofugu 리뷰](https://www.tofugu.com/reviews/satori-reader/)) | 자체 제작 원문 시리즈를 **에피소드 단위**로 싣고, 탭 단어 조회·문맥 스냅샷을 담은 SRS 카드·후리가나 표시 방식 선택. 시리즈 수는 출처마다 다름(미확인) | **부분 채택** | 「자체 원문 = 연재 단위 → 같은 뷰어에서 조회·저장·SRS」 구조가 (A)안과 같다 — 우리 「호 = 책, 꼭지 = 장」의 선례. 문맥 스냅샷 저장은 이미 `vocabulary_contexts.quote`로 있음. 사람이 문맥 뜻을 고르는 편집 사전은 배제(우리는 분석 1회 공유 + 사용자 교정) |
| **LingQ** ([가져오기 안내](https://www.lingq.com/blog/complete-guide-importing-lingq/), [라이브러리](https://lingq-support.groovehq.com/help/step-2-learn-the-essential-functions-of-lingq)) | 사용자 가져오기 → 레슨, 레슨을 코스로 묶음, 공유 라이브러리 게시. 리뷰에 공유 라이브러리 품질·표절 문제 지적 | **부분 채택 / 위험 근거** | 「코스(책) ⊃ 레슨(장)」 묶음은 기존 `metadata.book`과 같다. 반면 사용자 공유 라이브러리의 표절·위조 문제는 §8 위험 1(공개 책 카드 위조)의 실례 — (B)안 배제와 소유자/해시 기반 묶음의 근거 |
| **NHK NEWS WEB EASY** ([Tofugu](https://www.tofugu.com/japanese-learning-resources-database/nhk-news-web-easy/), [2016 논문](https://www.anlp.jp/proceedings/annual_meeting/2016/workshop1/pdf/ws4.pdf)) | 원 기사를 쉬운 일본어로 **다시 쓴** 판 + 루비 + 일본어 팝업 사전 | **배제(본문 방식)** | 오너 방향은 「쉬운 말 치환 금지, 원문 그대로」. 루비·팝업 사전 기능은 이미 뷰어에 있음. 최근 개편 내용은 미확인 |
| **にほんご多読ブックス / Web Tadoku Books** (NPO多言語多読, [목록](https://tadoku.org/japanese/en/graded-readers-en)) | 레벨별 그레이디드 리더, 웹판 PDF 무료 공개. 텍스트 라이선스(CC 여부)는 확인 못 함(미확인) | **배제(콘텐츠 수입)** · 레벨 라벨 발상만 참고 | 재배포 조건 미확인 → 금지⑵ 위험. 학습자용 단계 조정 원고는 우리 방향(원문)과 다름. 「한 권 = 한 레벨 라벨」은 D6과 같은 방식이라 참고만 |
| **Hiragana Times** ([Wikipedia](https://en.wikipedia.org/wiki/Hiragana_Times), [공식](https://hiraganatimes.com/magazine)) | 1986년 창간 월간 일영 매거진, 루비 + 영어 대역, 앱에 지난 호 아카이브 | **부분 채택** | 「호 단위 발행 + 지난 호 아카이브」(§5.1 「지난 호 보기」)는 채택. 본문 대역·전면 루비는 배제 — 대역은 뷰어 번역, 루비는 뷰어 표시 설정 몫 |
| **WATANOC** ([리뷰](https://cotoacademy.com/japanese-learning-resources-2022-february/)) | 무료 웹 매거진, 쉬운 일본어(N5–N4), 꼭지마다 JLPT 표시, 번역 제공(2022 리뷰 기준) | **부분 채택** | 꼭지별 수준·소요 시간 표시(§5.2 「6분」)는 채택. 쉬운 일본어 원고는 배제(방향 전환) |
| **ttu ebook-reader** ([저장소 소개](https://gittrend.io/repo/ttu-ttu/ebook-reader)) | Yomichan 연동 웹 EPUB 리더(Svelte). 라이선스 확인 못 함(미확인) | **배제** | 우리 뷰어가 조판·분석·저장·복습을 이미 갖고 있음. 별도 리더를 들이면 「뷰어 이중 구현」 부채(§1.1)를 새로 만든다 |
| **Yomitan** (팝업 사전 확장, [포크 README](https://github.com/afishhh/yomitan)) | 브라우저 확장, EDRDG 데이터 고지 필요. 프로젝트 라이선스는 이번 검색으로 확인 못 함(미확인) | **배제** | 사용자 쪽 확장 — 우리 저장/FSRS와 이어지지 않는 바깥 경로. 단어 카드는 이미 있음 |
| **青空文庫 정본 경로(내부 선례)** `src/content/literature/aozora/README.md` | 리포 정본 → 결정적 빌드 → 관리자 준비·분석·공개 → 해시 대조 출처 줄 | **채택(골격 전체)** | (A)안의 뼈대. 권리 판정·입력 형식만 공급자별로 분리 |
| **N5 교재 출판 경로(내부)** `publish_textbook_book`, 출처 `textbook` | 판(edition)·과 단위, 교재 주석·연결 | **배제** | 과정·과 계약이라 의미가 다르다 — 같은 필드에 다른 학습 대상(매거진 꼭지)을 넣게 된다 |

---

## 부록 — 인용한 코드 위치 요약

- 빌드: `scripts/build-literature.mjs:16-26` · `scripts/lib/literature-build.mjs:8, 61-136` · `src/lib/aozoraMaterial.js:148, 178-225` · `package.json:12`
- 권리: `src/lib/aozoraRights.js:21-28, 88-110` · `src/lib/aozoraCatalog.js:21-22, 40-67, 86-90`
- 게시: `src/app/api/admin/literature/route.js:14-18, 46-50, 69, 79-104` · `src/lib/literaturePublish.js:22-26, 49-62, 69-75, 87-131` · `src/components/LiteraturePublishPanel.jsx:45-48, 76-91`
- 뷰어: `src/views/ViewerPage.jsx:330-331, 508-524, 560, 2259-2261, 3732-3744, 3779-3783, 4175-4184` · `src/lib/literatureCanonical.js:11-47` · `src/lib/useCanonicalLiterature.js` · `src/lib/videoAttribution.js:130-145` · `src/lib/aozoraRuby.js:10, 83, 107-131` · `src/lib/reanalysisPreservation.js:236`
- 저장: `src/app/api/learning/vocabulary/route.js:60-67` · `src/lib/server/learningContext.js:33-40, 53-94` · `src/lib/learningSources.js:21-33` · `supabase/migrations/20260905065205_textbook_material_contexts.sql:46, 56-58, 100`
- 발견·서재: `src/app/(app)/discover/page.jsx:11, 17-19` · `src/views/MaterialsPage.jsx:85-87, 670, 682` · `src/lib/bookMeta.js:35-51` · `src/components/web/LibraryPage.jsx:12` · `src/components/library/LibrarySaveButton.jsx:12-13` · `src/app/(app)/lessons/page.jsx`
- 테스트: `src/lib/__tests__/ipPolicy.test.js:65-84` · `src/lib/__tests__/buildLiterature.test.js:33-41` · `src/lib/__tests__/editorialStandard.test.js:18`
