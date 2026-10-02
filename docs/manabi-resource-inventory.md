# 학습 자료 현황 — M01-002

이 문서는 등록 자료의 수량과 교재 구성·검수·발행 상태를 분리하여 기록한다. 등록량은 완성 교재 수, 고유 어휘 수, 의미 검수 완료량 또는 시험 전범위 충족률을 뜻하지 않는다.

## 관찰 기준과 출처

| 항목 | 기준 |
|---|---|
| 관찰 기록일 | 2026-10-02, M01-INIT-001 최초 보고 기준. 원 집계의 별도 실행 시각은 보고서에 기록되지 않음 |
| 원 보고 게시 시각 | 2026-10-02 11:04:29 UTC |
| 원 보고 | [M01-INIT-001](https://github.com/wonchance-art/manabi/issues/1337#issuecomment-5950960359) |
| 실제 검토 HEAD | `9a8d2b331ec2e5232d5bf274a5c2d9b293037dec` |
| 대조 main | `c9ad8a51a0d14b2479b62037a8451be70e098ed1` |
| 두 SHA의 차이 | `docs/ai-tasks.md`만 다름. 조사한 콘텐츠·구현·AGENTS·테스트는 동일하며, 작업 현황은 대조 main 문서 기준 |
| 이번 문서화 | 기존 수치와 검증 기록을 재사용. 레지스트리 집계·전체 테스트·운영 DB 조회를 새로 실행한 결과가 아님 |

아래 경로와 고정 SHA 링크는 이 관찰 기준을 가리킨다. 후속 구현·발행 기록이 있더라도 당시 자료 수량이나 당시 확인 범위를 소급해서 바꾸지 않는다.

## 집계 단위

| 단위 | 집계 의미 | 해석 제한 |
|---|---|---|
| 문법 챕터 | 언어 레지스트리에 등록된 설명 챕터 | 새 교재의 과 수와 다름 |
| 어휘 항목 | 레지스트리가 제공하는 레벨별 어휘 항목 | 원본 파일의 행 수나 레벨 간 중복을 제거한 고유 단어 수가 아님 |
| 문형 항목 | 레벨별 문형 사전 등록 항목 | 챕터 수·교재 과 수·시험 출제 범위와 일대일 대응하지 않음 |
| 챕터 드릴 | 등록 챕터의 드릴 항목 | 모든 교재 문항이나 학습자의 풀이 완료 건수가 아님 |
| 교재 과 | 판본 원고의 레슨 | 기존 레지스트리 챕터와 별도로 기록 |
| 페이지 메타데이터 | 교재 판본의 페이지 수 메타데이터 | 웹 화면 섹션 수나 실제 PDF 대조 완료를 뜻하지 않음 |

원 집계는 원본 디렉터리의 파일 개수를 세지 않고 실제 레지스트리를 로드하여 수행했다. 레지스트리의 병합·필터링·급 내 중복 처리 결과를 존중하며, 이 표에 임의로 언어 간·레벨 간 중복 제거를 추가하지 않는다. 어휘 예문의 존재 여부는 의미·자연스러움 검수와 별개다.

## 언어별 등록량

| 언어 | 문법 챕터 | 어휘 항목 | 문형 항목 | 챕터 드릴 | 예문 없는 어휘 항목 |
|---|---:|---:|---:|---:|---:|
| 일본어 | 98 | 7299 | 852 | 588 | 0 |
| 영어 | 68 | 1382 | 566 | 408 | 46 |
| 프랑스어 | 87 | 4134 | 564 | 648 | 139 |
| 중국어 | 79 | 6985 | 484 | 504 | 0 |

영어 46개·프랑스어 139개의 예문 누락은 신규 교재 편입 시 보완 대상으로 기록한다. 기존 작성 지침은 과거 보강 풀의 예외를 허용하므로 이 수치만으로 기존 계약 오류를 단정하지 않는다. 일본어·중국어 누락 0도 예문의 정확성·자연스러움이 전수 확인되었다는 뜻은 아니다.

### 일본어

| 레벨 | 문법 챕터 | 어휘 항목 | 문형 항목 |
|---|---:|---:|---:|
| OT | 6 | 0 | 0 |
| N5 | 30 | 950 | 125 |
| N4 | 22 | 701 | 156 |
| N3 | 15 | 2108 | 165 |
| N2 | 13 | 1906 | 173 |
| N1 | 12 | 1634 | 233 |

### 영어

| 레벨 | 문법 챕터 | 어휘 항목 | 문형 항목 |
|---|---:|---:|---:|
| OT | 13 | 0 | 0 |
| A1 | 9 | 272 | 81 |
| A2 | 10 | 233 | 91 |
| B1 | 11 | 296 | 125 |
| B2 | 10 | 198 | 109 |
| C1 | 9 | 237 | 101 |
| C2 | 6 | 146 | 59 |

### 프랑스어

| 레벨 | 문법 챕터 | 어휘 항목 | 문형 항목 |
|---|---:|---:|---:|
| A0 | 5 | 100 | 0 |
| A1 | 33 | 427 | 94 |
| A2 | 18 | 640 | 88 |
| B1 | 9 | 871 | 118 |
| B2 | 11 | 1129 | 122 |
| C1 | 6 | 633 | 79 |
| C2 | 5 | 334 | 63 |

### 중국어

| 레벨 | 문법 챕터 | 어휘 항목 | 문형 항목 |
|---|---:|---:|---:|
| OT | 4 | 0 | 0 |
| H1 | 24 | 416 | 77 |
| H2 | 13 | 497 | 88 |
| H3 | 13 | 686 | 97 |
| H4 | 10 | 1030 | 85 |
| H5 | 8 | 2091 | 78 |
| H6 | 7 | 2130 | 59 |
| LIFE | 0 | 135 | 0 |

OT/A0는 입문 자료, LIFE는 생활 어휘 보충이다. JLPT·CEFR·HSK의 레벨 표기를 서로 동등한 단계로 취급하지 않는다. 레벨별 드릴 수는 원 보고에 없으므로 이 문서에서 추정하지 않는다.

## 교재 구성과 공개 상태

검토 기준 서재 구현은 일본어 N5 교재를 제공 대상으로 삼고, 영어·프랑스어·중국어 교재는 준비 중으로 표시한다. 일본어도 발행 교재 데이터를 불러온 경우에만 해당 책이 표시된다. 다른 언어의 등록 자료나 공개 읽을거리 존재를 완성 교재 발행으로 계산하지 않는다. 기존 자료 보관함에는 관리자 진입 경로가 있다.

일본어 N5의 기존 문법 **30챕터**와 `japanese-n5` 교재의 **42과**는 별도 체계다. 아래 세 판본을 세 권의 완성 교재로 합산하지 않는다.

| 교재 ID | 판본 ID | 저장소 목록의 위치 | 과 | 어휘 색인 | 문형 색인 | 한자 색인 | 페이지 메타데이터 |
|---|---|---|---:|---:|---:|---:|---:|
| `japanese-n5` | `7f572327dc67893e9453246c` | `index.current` 기본값 및 `reviewCandidates` | 42 | 625 | 125 | 103 | 489 |
| `japanese-n5` | `fdf070fa5123b18cc55f24c7` | `reviewCandidates` | 42 | 625 | 125 | 103 | 502 |
| `japanese-n5` | `8a8c1c1fd452773810abaf8c` | `reviewCandidates` | 42 | 625 | 125 | 103 | 502 |

`src/content/textbookEditions/index.json`의 `current`는 저장소 기본값이며 운영 공개 포인터와 별개다. 운영 판본은 DB의 `textbook_book_releases.edition_id`와 해당 판본 데이터로 결정된다. M01-INIT-001과 이번 문서화에서 운영 포인터를 직접 재조회하지 않았으므로 **현재 운영 발행 판본은 이 문서만으로 확정할 수 없다**. 기존 발행 기록을 취소하거나 미발행으로 재판정한 것은 아니다.

## 확인 수준과 남은 근거

| 구분 | 기존 보고에서 확인한 범위 | 남은 확인 |
|---|---|---|
| 등록 자료 | 네 언어 레지스트리 로드, 수량·어휘 예문 보유 집계 | 관찰 기준 이후 변경량 |
| 판본 구조·무결성 | 세 판본의 원고 해시와 등록 산출물 해시 검증: 기본판 165개, 후보판 각 3개 | 후보판 PDF·음성의 내용 일치 |
| 계약 테스트 | 아래 3파일·25테스트 통과 기록 | 이번 문서화에서는 재실행하지 않음; 현재 CI 결과로 대체 표기하지 않음 |
| 의미·자연스러움 | 전 항목 독립 감수 완료를 확인하지 않음 | 언어별·과별 설명, 예문, 정답, 허용 답안, 해설 감수 |
| 실제 학습 흐름 | M01에서 실제 계정 동선 확인하지 않음 | 로그인 계정의 읽기·연습·복습·원문 복귀 확인 |
| 운영 발행 | 저장소 기본값과 DB 공개 포인터의 분리 확인 | 현재 DB 포인터와 실제 공개 판본 대조 |
| 시험 범위 | 레벨별 등록량만 확인 | 명시된 시험 기준과 항목별 범위 대응 검수 |

기존 실행 명령:

```sh
./node_modules/.bin/vitest run src/content/__tests__/contentSchemaContract.test.js src/content/__tests__/refGrammarManifest.test.js src/lib/textbook/contract.test.js --maxWorkers=2
```

위 결과는 M01-INIT-001에 기록된 과거 실행 증거다. 당시 `/tmp` 집계 JSON과 테스트 로그는 저장소 공개 산출물이 아니며, 공개 근거는 최초 보고에 전재된 수치·결과다. 세션 기록의 테스트 통과를 CI 링크나 독립 의미 검수 완료로 바꾸어 표현하지 않는다. 특히 후보판 `qa.passed`는 해시·구조·산출물 검증 범위이며 언어 정확성·시험 범위의 승인 표시가 아니다.

작업 현황 문서가 참조한 다음 두 감사 문서는 검토 기준 main에 없었다. 이후 M00의 정확한 경로 복구 결과를 별도로 반영한다. 원 집계를 재실행하거나 과거 관찰 기준을 바꾼 결과가 아니다.

| 문서 | 복구 상태와 적용 범위 |
|---|---|
| `docs/verification/n5-edition-audit-20260924.md` | [PR #1321의 고정 HEAD에서 복구](https://github.com/wonchance-art/manabi/blob/0a08568d70362ab10711f8401f456e722ff1d828/docs/verification/n5-edition-audit-20260924.md). 2026-09-24 KST의 `7f572327dc67893e9453246c` 구조·범위 감사이며 main에 파일이 추가된 것은 아님 |
| `docs/verification/n5-learning-flow-audit-20260930.md` | 같은 고정 HEAD와 해당 브랜치 `codex/classroom-release-20260917`에서 모두 HTTP 404. 전문은 미복구이며, 다른 커밋이나 위치에도 없다고 단정하지 않음 |

복구된 첫 문서의 원고 bundle SHA-256은 `ac5f4355474f88012f896d17e6925715f10140ed682092236b4d1bc9ad79bc1e`, Git blob SHA는 `2759118335a9820303ade9a21da573c1f38e9ba7`이다. 문서는 42과·489페이지의 구조·범위 및 일부 구간 편집 판단을 기록하며, 전권 독립 언어 감수·PDF 시각 재검수·음성 일치 인증을 명시적으로 제외한다. 당시 개선 권고는 **7f에 대한 역사적 근거**다. 새 비교 없이 `8a8c1c1fd452773810abaf8c`의 현재 결함이나 검증 완료로 옮겨 쓰지 않는다. 문서에 언급된 감사 스크립트를 이번 복구·문서화에서 실행하지 않았다.

복구 원문은 `/workspace/cloud-services/agent-runtime/recovered-audits/n5-edition-audit-20260924.md`, 복구 범위 기록은 같은 디렉터리의 `recovery-status.md`에 보존되어 있다. 두 번째 문서는 M00이 알려진 대체 커밋·브랜치나 원 작성자의 출처를 확인해야 한다. main의 파일 부재나 특정 경로의 404만으로 과거 완료된 검토를 미수행으로 재등록하지 않는다. 이 현황표는 M02–M04/M06 등의 개별 과 독립 감수 결과를 대신하지 않는다.

## 후속 제작·검수 기준 작성안

아래는 M01-INIT-001의 **검토용 작성안**이다. 이 문서 추가만으로 기존 작성 지침·예외·출시 정책을 개정하지 않는다.

- 언어·레벨·SHA·판본·과 ID·문항 ID와 관찰 가능한 수행 목표·선수 지식을 기록한다. 자료 보유, 교재 구성, 의미 검수, 실행 검수, 발행 상태를 각각 남긴다.
- 목표·선수 지식 → 표현·어휘 → 설명·예문 → 문맥 속 사용 → 연습·회상 → 읽기 확인 → 자신의 문장 → 복습 연결을 검토한다. 미학습 표현은 이해용과 산출용을 구분한다.
- 선택형은 문맥상 정답의 유일성을, 서술형은 허용 답안 범위를 확인한다. 정답 근거·오답 이유를 본문에 연결하고 문항·답·해설 일치를 별도로 검토한다.
- 한국어 설명의 문체와 번역의 의미·격식을 확인한다. 일본어 읽기·활용·격식, 영어 관사·가산성·어순·강세, 프랑스어 성·수 일치·관사·활용·발음, 중국어 병음·성조·양사·어순을 각각 점검한다.
- 구조 검사 → 독립 의미 검수 → 실제 학습 흐름 → 발행 확인의 증거를 분리한다. 교정판 작업에서는 기존 ID·출처·저장 표현·복습 연결의 보존을 검토한다.

원 작성안의 수치 제안은 새 개념 2~3개 이내, 설명 챕터 약 10분, 어휘·연습을 포함한 레슨 15~20분, 25분 이상일 때 분할 검토, 문법 챕터 예문 원칙상 2개 이상, 신규 어휘 세트 8~10어 및 전 항목 예문이다. **확정된 공통 출시 조건이나 기존 자료의 일괄 합격·불합격 기준으로 적용하지 않는다.** 제품 정의의 4주 완주·80% 정답도 승인 대기 초안으로 남긴다.

## 원천 경로와 고정 근거

아래 링크는 대조 main `c9ad8a51a0d14b2479b62037a8451be70e098ed1`에 고정한다. 실제 검토 HEAD와의 차이는 앞의 관찰 기준에 기록했다.

| 용도 | 원천 경로·근거 |
|---|---|
| 일본어 등록 자료 | [`src/content/japanese/index.js`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/content/japanese/index.js) 및 이 파일이 등록하는 `grammar/`, `vocab/`, `bunkei/` 자료 |
| 영어 등록 자료 | [`src/content/english/index.js`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/content/english/index.js) 및 등록 하위 자료 |
| 프랑스어 등록 자료 | [`src/content/french/index.js`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/content/french/index.js) 및 등록 하위 자료 |
| 중국어 등록 자료 | [`src/content/chinese/index.js`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/content/chinese/index.js) 및 등록 하위 자료 |
| 판본 목록 | [`src/content/textbookEditions/index.json`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/content/textbookEditions/index.json) |
| 원고·산출물·QA 범위 | [`src/content/textbookEditions/<editionId>/bundle.json`](https://github.com/wonchance-art/manabi/tree/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/content/textbookEditions) |
| 서재 제공 상태 | [`src/components/books/Bookshelf.jsx`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/components/books/Bookshelf.jsx#L25-L30) |
| DB 발행 포인터·검증 구현 | [`src/lib/textbook/server.js`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/src/lib/textbook/server.js#L9-L35) |
| 기존 작성 지침·예외 | [`docs/guide-content-authoring.md`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/docs/guide-content-authoring.md#L35-L123) |
| 기존 학습 단위 원칙 | [`docs/curriculum-principles.md`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/docs/curriculum-principles.md) |
| 과거 영어 현황 | [`docs/curriculum-en-cefr.md`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/docs/curriculum-en-cefr.md#L17) |
| 과거 프랑스어 현황 | [`docs/curriculum-fr-a1a2.md`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/docs/curriculum-fr-a1a2.md#L4) |
| 누락 감사 문서의 참조 위치 | [`docs/ai-tasks.md`](https://github.com/wonchance-art/manabi/blob/c9ad8a51a0d14b2479b62037a8451be70e098ed1/docs/ai-tasks.md) |

과거 영어 문서의 드릴 0·어휘 2672와 이 관찰의 408·1382, 프랑스어 A2의 과거 14챕터와 이 관찰의 18챕터는 조사 시점과 집계 단위를 분리해 읽는다. 수량 차이만으로 자료 삭제나 제작 미완료를 단정하지 않는다. 이후 갱신할 때에는 관찰 날짜·실제 HEAD·대조 main·집계 경로·검사 범위·판본·발행 확인 여부를 함께 기록한다.
