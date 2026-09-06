# manabi 웹 v2 — 내 서재 분류와 발견 필터

## 적용

- `/materials`의 기본 화면을 ‘읽는 중’으로 변경. ‘내 자료 / 내 노트 / 공개 읽을거리’는 같은 서재에서 이동하며 기존 `?tab=public`·`?tab=private` 주소도 유지한다.
- 교재는 현재 발행 판본의 기존 `useReadingProgress`·`bookResume`을 사용한다. 계정별 브라우저 기록이며 서버 자료 진도와 합산하지 않는다. 교재 번들의 `/materials` 서버 추적도 추가했다.
- 자료는 본인의 `reading_progress`에서 미완독·읽던 위치가 있고 접근 가능한 글만 불러온다. 삭제/권한 변경으로 비어 있는 관계 행과 노트는 제외한다. 목록용 조회에는 원문·사전 대신 제목·언어·상태만 포함한다.
- PDF는 기존 `uploaded_pdfs.last_page_read` 위치로 연결한다. 이 필드는 PDF 범위 읽기에서도 갱신되므로 완독 판정으로 쓰지 않는다. 글/PDF 조회는 독립된 로딩·실패·재시도를 제공한다.
- ‘내 자료’에서 직접 공개한 자료도 찾을 수 있다. 노트는 별도 분류로 모으고 새 노트 링크는 기존 비공개 노트 양식을 연다. 개인 자료는 owner 필터와 기존 RLS를 유지한다.
- 서재 검색·언어·레벨·정렬·읽지 않음·오프라인 필터를 URL에 보존한다. 네 언어의 실제 레벨 목록으로 검증한다. 오프라인 받아두기는 글 북마크와 별개다.
- `/discover`에 공개 지역학 26편의 지역·주제·제목/소개 검색, 결과 수·초기화·더 보기 추가. 전체 본문은 서버에 남기고 목록 메타데이터만 전달한다. 본문의 기존 `/studies/...` 주소와 출처를 유지한다.
- 공개 원어 자료는 네 언어의 독립된 입구로 연결한다. 한국어 지역학에 외국어 학습 레벨을 붙이지 않는다. 발견 필터와 더 보기 범위를 URL에 남기고 해당 history entry의 화면 위치로 복귀한다.

## 보존 범위

기존 판본/본문, 표현 출처, FSRS·완독 의미, 자료/PDF 권한·복습 일정은 변경하지 않았다. DB·환경 설정·음성 제작·PDF 조판·월드·운영 승격은 포함하지 않는다. 개인 기록에 대한 실제 쓰기 검수는 하지 않으며, 회원 상태는 격리된 브라우저 fixture로 검증한다. 공개 문서와 교재는 실제 배포 콘텐츠를 확인한다.

## 검증

- 변경 범위 targeted 8파일/90개 통과.
- 명시 JSX lint 오류 0. MaterialAddPage 기존 effect dependency 경고 2건 유지.
- 브라우저 하니스 `e2e/library-discovery.e2e.mjs`: 실제 공개 콘텐츠와 격리한 회원 fixture. 320/390/768/1440px, 목록 분류, 긴 제목, 검색 복귀, 독립 오류·재시도, 키보드 접근을 검증한다.
- 직접 스크린샷 검수 중 모바일 교재 제목 폭 축소를 발견하여 2열 grid로 수정하고 제목 실폭/높이 검사를 추가했다.
- 최종 실행 코드 `f2ef48afa4e8fb5c600d37ff45f5b713f0f1945c`: 로컬 `npm test -- --maxWorkers=2` 344파일/3,748개 통과(251.85초), Vercel production build 통과.
- 최종 미리보기: https://manabi-4j99qd4z6-wonchance-arts-projects.vercel.app/materials 및 `/discover` — Ready.
- 최종 배포 브라우저 26조건 통과, pageerror 0. 실제 N5 3과의 판본/앵커 이어 읽기, 지역학 문서 왕복, 검색/분류/노트 입구, 독립 오류·빈 상태를 검증했다. 개인 기록에 대한 검사에는 실제 사용자 데이터 대신 격리 fixture를 사용했다.
- 발견 확장 목록의 복귀 스크롤: 5,649px → 5,649px. 과거 `#reading-index`가 Back에서 섹션 맨 위로 이동시키는 문제를 제거하고 해당 history entry에 화면 위치만 보존했다.
- 기존 전체 CI 회귀도 `1227334ad81ea95436aa23213e2d026184253425`에서 green: https://github.com/wonchance-art/manabi/actions/runs/34037548498 . 마지막 서재 상태 보완 후 로컬 전체 검사·최종 배포 검수도 재통과했다. 최종 PR head의 자동 CI는 https://github.com/wonchance-art/manabi/pull/1283/checks 에서 확인할 수 있다.
- 검토용 draft PR: https://github.com/wonchance-art/manabi/pull/1283 (base #1282). 이 문서와 보드 갱신은 실행 코드와 분리한다.
- 화면/로그: `manabi-library-discovery-qa` 시각화 폴더의 `library-desktop.png`, `library-mobile.png`, `owned-mobile.png`, `discover-desktop.png`, `discover-mobile.png`, `report.json`.
- 기존 Node 20 배포 폐기 예고 및 기존 lint 경고가 빌드에 남아 있다. 이번 빌드는 통과했으며 런타임 버전 전환은 별도 작업이다.

## 후속 범위

- 글 전체 ‘나중에 읽기’ 북마크는 현재 지속 저장 모델이 없다. 오프라인 핀이나 표현 저장을 재사용하지 않았으며, 별도의 참조·권한·삭제 정책을 가진 저장 모델로 후속 구현한다.
- 자료 가져오기와 긴 글/PDF 뷰어의 집중 읽기 디자인을 다음 차수로 확장한다. 현재 가져오기·뷰어 기능은 연결되어 있다.
- 교재 진도의 기기 간 동기화와 과거 판본의 통합 읽기 목록은 별도 데이터 설계 대상이다.
