# 설명판 A/B/C 구현 검수 · 2026-09-17 KST

오너 승인 설계: `../manabi-classroom-refinements-20260917.md`. 기준 #1319 `bcce8f12f973df95906c3d963ee736d1c8746b92`. 최종 실행 코드 `3a640c7099eece33c24e03e39b1b51e5f1d5c442` (Safari 날짜 컨트롤 flex-end 호환 보완 포함). 기존 작업 디렉터리 대신 독립 worktree/`codex/classroom-refinements-20260917` 사용.

## 적용

- A: 30개+명시적 더 보기, 전체/이번 달/지난달/직접 지정, KST 월 경계, 양끝 포함 날짜 검사. 기존 100개 상한 제거. 소유자·팀·기간별 날짜 keyset, 31번째 존재 검사, 최소 메타데이터 응답. 단건 day 계약·교사 권한/RLS 유지.
- 날짜 행은 현재 수업을 유지하는 원본 미리보기. ‘그날 수업 열기’만 기존 저장 보호 후 과거 수업 이동. 필터/누적 페이지/스크롤/초점 보존, 추가 조회 실패·재시도·응답 역전·닫힘 취소·권한 상실 시 목록 제거. TanStack Query 재사용.
- B: 기존 Excalidraw와 저장/CAS를 유지하고 읽기만 최대 2개 병렬 처리. manifest 순서·바이트/hash·ID·문서 전체 검증 후에만 반환. 취소·손상 시 불완전한 판 반환 금지. 썸네일은 기존 지연 생성/URL 해제 재사용.
- C: 뷰어/설명판 공통 splitRuby에서 대응 불확실한 독음은 전체 표기에 한 번만 표시. 보충 한자 코드포인트 지원. T恤+xù처럼 한 글자만 대응하는 기존 훈음 표시는 보존. 기존 저장 판의 좌표·요소·뜻을 열기만으로 재생성하지 않음.
- 새 DB/Storage/환경 변수/엔진/의존성/학생 공개/SRS 변경 없음. 운영 merge·승격 없음.

## 로컬 검증

- 전체 Vitest **414파일, 4,440개 통과**, 선택 실행용 성능 측정 1개는 일반 실행에서 skip. 별도 `QA_BOARD_BENCH` 실행으로 해당 측정도 통과.
- 관련 JSX/JS ESLint 오류/경고 0. `git diff --check` 통과.
- Next production build 통과(480페이지). 기존 다른 파일의 `import/no-anonymous-default-export` 경고 2개 유지.
- Chrome·WebKit 터치 **각 41흐름, 런타임 오류 0**. 합성 로그인·로컬 PGlite/RLS·파일 업로드 fixture이며 실제 교사/학생 검수로 세지 않음.
- API 0/1/29/30/31/99/100/101/365행, 월말·윤일·연말, 범위/팀 커서 변경, 다른 소유자/학생/비로그인, 필기 본문 비노출 확인.
- 브라우저 365날짜 전량·중복 없음, 30/60/90 이후 복귀, 현재 날짜 유지, 추가 조회 실패 재시도, 입력 완료 전 쿼리 없음, 역전 범위 차단, 기간 변경 중 늦은 응답 무시 확인.
- 390/768/1024/1440px, 데스크톱 200% 확대, 키보드 Enter/Space/Escape·복귀 초점·닫기/확정 접근 검수. 실물 소프트 키보드 검수는 아님.
- 원본/목적지 필기·출처·숨김·중복 안내·단일 undo/redo·20페이지 한도·계정 저장/재접속·충돌/오프라인/성공 응답 유실·느린 복원 중 새 필기·기존 로컬 판 이전 통과.
- 원본 미리보기 20회 열기/닫기에서 생성 Blob URL 전부 해제, 계정 쓰기 증가 0, 현재 수업 manifest 불변.
- 추가 회귀: 기존 뷰어 타이포그래피·상단 UI 34개, 개인 노트 WebKit 11흐름 통과. Chrome 권한 철회 추가 검수에서 원본 미리보기와 캐시 목록 즉시 제거 확인(의도한 해당 403 한 건만 분류, 그 외 오류 허용 없음).
- 언어 표시: 구성한 60입력(일24/중24/영·불12) 모델 계약. 고위험10×8토글×글자만/카드, 실제 TeachingWord/발표/ViewerPreview 컴포넌트를 Chrome·WebKit에서 비교, 390/768/1024px 가로 넘침/런타임 오류 0. 네이티브 캔버스 요소와 주변 필기 불변은 모델 및 기존 실제 판 E2E로 확인.

## 성능 측정과 판단

Apple M1 8 논리 CPU, macOS, 공식 Node24.20.0. 사용자 자료/외부 계측 서비스 없이 합성 자료. 브라우저 측정은 driver 왕복 비용을 포함하며 물리 iPad 성능으로 일반화하지 않는다.

| 측정 | 중앙값 | p95 | 조건 |
|---|---:|---:|---|
| 기존 20페이지 순차 읽기 | 267.37ms | 270.24ms | 8회, 페이지마다 합성 지연10ms |
| 개선 20페이지 읽기 | 140.10ms | 145.54ms | 같은 프로세스·자료·지연, 8회, 최대2개 |
| 보통 판 내용 비교 | 3.57ms | 4.04ms | 5페이지·표현20개+필기,12회 |
| 큰 판 내용 비교 | 23.72ms | 24.62ms | 20페이지·필기4000요소,12회 |
| 5000요소 한 페이지 내용 비교 | 29.44ms | 30.63ms | 12회 |
| 6MiB 근접 문서 내용 비교 | 28.03ms | 31.27ms | 12회 |
| Chrome 날짜→미리보기 첫 페인트 | 81.98ms | 110.28ms | 합성20회, driver비용 포함 |
| WebKit 날짜→미리보기 첫 페인트 | 87.44ms | 105.52ms | 합성20회, driver비용 포함 |

순차 읽기 대비 중앙값 약48% 감소. 카메라 내용 비교는 비용이 존재하지만 이 조건에서 수십 ms이며 저장 판정 교체에 앞서 읽기 병목을 좁게 수정했다. debounce/검증 강도·원본 해시를 약화하지 않았다. 캐시된 페이지 재표시500ms, 실제 iPad/Pencil 지연, 최대 판의 모든 상호작용 p95는 측정 완료로 주장하지 않는다. 가상 목록·엔진 교체는 필요 근거 없어 미도입.

## 언어 자료의 범위

60개 입력은 **표시 회귀 검수용 구성 자료**다. 일부러 틀리거나 빠진 독음도 포함하며 수업 콘텐츠로 배포하지 않는다. `meaning`도 고정된 합성 문구로 배치/직접 입력 보존을 검사한다. 이를 사전 번역 정확도60건 검수로 표현하지 않는다.

독음 묶음/글자 대응 구분의 설계 근거: [W3C JLReq](https://www.w3.org/TR/jlreq/). 조회로 확인한 어휘 예시는 교육부 사전의 [學習](https://dict.revised.moe.edu.tw/dictView.jsp?ID=111748&la=1&powerMode=0), [東道主](https://dict.concised.moe.edu.tw/dictView.jsp?ID=9764&la=0&powerMode=0). 한국어 뜻은 해당 원문을 복제해 데이터셋에 넣지 않았다. 사전 전체 의미 정답, 문맥/품사별 일본어 번역의 전문가 확인은 별도 콘텐츠 검수로 남는다. 이번 변경은 다른 뜻/POS의 일본어 대응을 대신 사용하지 않는 계약을 검증한다.

## 재현

공식 Node24에서 `npm test`, `npm run build`(로컬은 공개 더미 Supabase 설정 및 기존 Google font fixture).

- `QA_BOARD_BENCH=/private/tmp/board-performance.json npx vitest run src/lib/__tests__/teachingBoardPerformance.test.js`
- `QA_BASE=http://127.0.0.1:3121 QA_OUT=/private/tmp/board-qa QA_PGLITE_MODULE=<pglite module> QA_BOARD_CLOUD=1 QA_BOARD_REUSE=1 QA_BOARD_FRAGMENTS=1 QA_BOARD_HISTORY=1 node e2e/teaching-word-canvas.e2e.mjs`
- WebKit은 `QA_BROWSER=webkit QA_TOUCH=1 PLAYWRIGHT_BROWSERS_PATH=<runtime>` 추가.
- `QA_OUT=/private/tmp/word-quality node e2e/teaching-word-quality.e2e.mjs` (로컬3122 포트, 실제 컴포넌트 격리 하니스). WebKit은 같은 `QA_BROWSER`/runtime 지정.

## 남은 실제 환경 검수

사용자는 외출 중이므로 로그인 요청 없이 진행했다. 최종 Preview 실제 교사 전체/부분 복사→계정 저장→재접속, 별도 학생 계정, 개인 노트 누적 정리, 물리 iPad/Pencil/손바닥/회전/소프트 키보드는 귀가 후 확인한다. 운영 데이터 실행계획도 이번 합성 DB 검수에 포함하지 않는다. 병합·운영 승격은 별도 승인 범위.

## 원격 배포 및 인계

- Draft PR [#1320](https://github.com/wonchance-art/manabi/pull/1320), base는 #1319 브랜치. 운영 main 병합/승격 없음.
- 최종 실행 `3a640c7099eece33c24e03e39b1b51e5f1d5c442`, [CI 35131141103](https://github.com/wonchance-art/manabi/actions/runs/35131141103) 필수 두 job SUCCESS.
- [Preview](https://manabi-ajunlm9lm-wonchance-arts-projects.vercel.app/class/culcom2): `dpl_4o5HhaRmxAkv9gaq5prfngLWna1i` READY. 공개 `/api/version` commit/preview 환경 일치, 비로그인 boards API 401. source 빌드 사용, 로컬 QA 설정/환경 파일 업로드 없음.
- 원격 빌드 성공. 신규 flex 정렬 경고 제거. 기존 lessonAdapters/lessonModel 경고 2개는 변경 범위 밖이며 유지.
- 최종 배포본 Chrome·WebKit 터치 **각 42흐름, 런타임 오류 0**. 합성 로그인/로컬 DB fixture 사용. 365날짜·기간/복귀·실패/취소·원본 권한 철회·복사/undo·저장/재접속/충돌·기존 뷰어 이동 통과. 배포 WebKit 390/1024px 날짜 목록 및 부분 선택 캡처 직접 확인.
- 최종 문서/보드 head·필수 CI·완료 신호는 PR/#150에 기록. 이후 문서/보드 커밋과 실행 커밋의 런타임 소스 차이가 없음을 확인한다.
