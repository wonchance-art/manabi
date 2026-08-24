# 중국어 POS 문맥 판별 재호출·캐시 조사 R1

> 조사일: 2026-08-24  
> 범위: 현재 `main`의 `/api/analyze` → `disambiguateZhPos` 경로 정적 추적과 합성 입력 벤치. 구현·스키마·RFC 변경은 하지 않았다.

## 결론 요약

- 중국어 요청이라고 항상 모델을 부르는 것은 아니다. 인증·rate limit·입력 검증·토큰화·사전 조회 뒤 `collectZhPosMarks`가 만든 mark가 하나 이상이고 API key와 deadline 여유가 있을 때만 **요청당 최대 HTTP 1회** 호출한다.
- 서버에는 판별 결과 캐시가 없다. 같은 `lines`가 새 `/api/analyze` 요청으로 다시 들어오면 mark를 다시 만들고 다시 호출한다. 단, 한 요청 안의 같은 `(lineIdx, 표면형)`은 중복 제거된다.
- 이 조사 시점에는 이미 Viewer 드래그와 PDF Viewer가 **상류의 전체 분석 응답 캐시**로 동일 선택 재호출을 막는다. Quick, 자료 최초 분석/전체 재분석, 변경 문단 분석 등은 캐시하지 않는다. 따라서 새 캐시의 1순위는 판별 전용 DB가 아니라 호출자별 누락을 정리하거나, 필요할 경우 짧은 TTL의 서버 메모리 캐시를 두는 것이다.
- `user_verified`의 **DB 무변경 보호**는 현재도 유지된다. 그러나 판별 pick은 응답 조립에서 캐시 사전 POS보다 우선하므로, `user_verified` 행도 mark가 되면 화면의 문맥 POS/뜻 선택은 달라질 수 있다. 캐시가 이 결과를 오래 보존하면 DB를 덮지는 않아도 최신 검증값의 표시 반영을 늦출 수 있다. 캐시 키/무효화 계약에 사전 버전 또는 짧은 TTL이 필요하다.

## 1. 호출 코드 경로 전수

### 1.1 서버 내부의 단일 호출 지점

1. `src/app/api/analyze/route.js:42-85`: `POST` 진입 후 로그인 검증, 사용자별 분당 20회 제한, `lines`/`language` 검증, 100줄·줄당 200자 절단을 수행한다.
2. `src/app/api/analyze/route.js:87-125`: 중국어는 `tokenizeZhLine`으로 줄별 토큰화하고, 모든 `base_form`을 모아 `morpheme_dictionary`의 `meanings, pos, reading, source`를 읽어 `cache` Map을 만든다.
3. `src/app/api/analyze/route.js:141-151`: 중국어 레거시 사전 행 중 뜻별 POS 또는 일본어 대응 정보가 미판정인 행을 의미 재조회 목록에 추가한다. 이 의미 재조회는 POS 판별 호출과 별개다.
4. `src/app/api/analyze/route.js:171-179`: 중국어일 때 `collectZhPosMarks(tokenizedLines, cache)`를 호출한다. mark가 있으면 이 리포의 조사 대상인 `disambiguateZhPos(lines, zhMarks, { deadlineMs: startedAt + 35_000 })`를 정확히 한 번 예약하고, 없으면 빈 Map으로 끝낸다.
5. `src/app/api/analyze/route.js:187-214`: POS 판별 Promise와 의미 조회 Promise를 병렬로 기다린다. 따라서 미싱 뜻 조회가 더 느린 요청에서는 POS 판별의 별도 벽시계 증가가 가려질 수 있지만, 사전 hit만 있는 요청에서는 POS HTTP 시간이 그대로 응답 하한에 들어간다.
6. `src/lib/server/disambiguateZhPos.js:38-64`: 한자를 포함하며 캐시/jieba 라벨이 명·동·형 계열이거나 품사 미상인 토큰을 mark로 만든다. `(lineIdx, word)` 중복을 제거하고 최대 120개로 자른다. 같은 표면형이 **다른 줄**에 있으면 별도 mark다.
7. `src/lib/server/disambiguateZhPos.js:67-101`: mark가 있는 줄만 프롬프트에 넣고, 각 mark의 전체 POS 후보·문맥 POS 및 OOV 분리 판정을 JSON으로 요구한다.
8. `src/lib/server/disambiguateZhPos.js:112-161`: mark 없음, `GEMINI_API_KEY` 없음, deadline 경과면 호출하지 않는다. 그 외 `gemini-3.5-flash-lite:generateContent`에 temperature 0으로 HTTP 1회를 보내며 15초 timeout을 둔다. HTTP/파싱/길이/값 검증 실패는 빈 Map으로 수렴한다.
9. `src/app/api/analyze/route.js:232-291`: `posPicks`는 OOV 토큰 분리, 최종 POS/POS 후보, 품사별 뜻 선택에 쓰인다. 우선순위는 pick → 후보 첫 항목 → 사전 POS → jieba POS다.
10. `src/app/api/analyze/route.js:294-307`: 판별이 새 다중 후보를 찾으면 `buildZhPosWriteback` 결과를 `source='gemini'` 행에만 fire-and-forget으로 기록한다. 이것은 판별 결과 캐시가 아니라 다음 요청의 후보/뜻 백필을 돕는 사전 자가 치유다.

`disambiguateZhPos`의 직접 호출은 위 라우트 한 곳뿐이다. 나머지 재호출 원인은 모두 `/api/analyze`를 다시 호출하는 클라이언트 경로다.

### 1.2 `/api/analyze`로 진입하는 클라이언트 경로

| 진입점 | 파일:줄 | 중국어 동일 입력 재호출 억제 |
|---|---|---|
| 공용 자료 분석기(문단별 순차 요청) | `src/lib/analyzeText.js:22-29,35-59,81-130` | 성공 문단은 `failed_indices` 재시도에서 재사용하지만, 최초/전체 재분석은 새 요청 |
| 자료 추가 후 백그라운드 분석 | `src/views/MaterialAddPage.jsx:242-255` | 없음; `analyzeText` 문단 단위 동작을 따름 |
| 뷰어 전체·부분·실패/중단 재분석 | `src/lib/useReanalyze.js:69-137` | 부분/실패 재시도는 성공 문단 재사용, `fullReset`은 전량 재호출 |
| PDF 다음 범위 생성 후 분석 | `src/lib/useNextRangeMutation.js:40-87` | 없음; 새 자료를 `analyzeText`로 분석 |
| Viewer 드래그 문장 분석 | `src/views/ViewerPage.jsx:700-770` | 있음. `viewer_an:{language}:{앞 200자}` localStorage hit면 `/api/analyze` 전체 생략 |
| PDF Viewer 붙여넣기/선택 분석 | `src/views/PdfViewerPage.jsx:39-61,163-205` | 있음. `pdf_cache:tokens:{language}:{앞 120자}` hit면 `quickAnalyze` 생략 |
| `/quick` 즉석 분석 | `src/views/QuickPage.jsx:50-88` | 없음; 버튼 실행마다 직접 호출 |

## 2. 같은 입력 재호출 시나리오

1. **전체 재분석**: 뷰어에서 같은 자료에 `fullReset`을 반복하면 기존 성공 결과를 버리고 같은 문단을 다시 보낸다.
2. **최초 분석의 중복 시작**: 자료 추가 백그라운드 작업과 사용자의 뷰어 재분석, 또는 같은 액션의 중복 실행이 겹치면 서버에는 in-flight coalescing이 없어 동일 문단이 각각 판별된다.
3. **Quick 반복 실행**: `/quick`에서 텍스트·언어를 바꾸지 않고 분석 버튼을 다시 누를 때마다 호출한다. 결과를 저장하지 않는 화면의 의도와 맞지만 비용은 반복된다.
4. **서로 다른 화면/저장소 namespace**: 같은 문장을 Viewer, PDF Viewer, Quick에서 분석하면 캐시를 공유하지 않는다. Viewer와 PDF Viewer도 각각 `viewer_an`/`pdf_cache`라 교차 hit가 없다.
5. **브라우저·기기·프로필 변경**: 두 현행 캐시는 localStorage라 다른 브라우저/기기, 저장소 삭제, 시크릿 창에서는 같은 입력도 다시 호출한다.
6. **Viewer/PDF cache miss**: 첫 선택, 캐시 손상, localStorage 접근 불가/용량 실패, 또는 캐시 키의 언어·텍스트가 달라지면 새 호출한다.
7. **문단 경계 차이**: `analyzeText`는 빈 줄 기준 문단별로 요청한다. 원문이 같아도 자동 문단 분리, 줄 trim, 부분 재분석 범위가 달라지면 `lines` 배열과 mark의 line index 공간이 달라져 별도 판별이다.
8. **실패 재시도**: 모델 HTTP 오류·15초 timeout·응답 JSON/길이 검증 실패도 빈 결과일 뿐 실패 캐시가 없다. 이후 같은 분석은 다시 호출하는 것이 현재의 회복 계약이다.
9. **120 mark 초과**: 한 요청의 121번째 이후 후보는 판별되지 않는다. 입력을 다른 문단/요청으로 나누거나 재분석해 후보가 앞 120개 안으로 들어오면 호출·판별 구성이 달라질 수 있다.
10. **한 요청 안 다른 줄의 동일 단어**: 중복 키가 `(lineIdx, word)`이므로 같은 줄 반복은 1 mark지만 같은 단어가 여러 줄에 나오면 문맥별 mark가 생긴다. 이는 낭비가 아니라 문맥 차이를 보존하는 의도다.

## 3. 스키마 무변경 캐시 후보와 무효화 초안

### 후보 A — 현행처럼 완성된 `/api/analyze` 결과를 호출자에서 캐시 (우선 권고)

- **지점**: `/api/analyze`를 부르기 직전/성공 응답 직후. Viewer와 PDF Viewer에는 이미 구현되어 있으므로 Quick 또는 `analyzeText`에 확대할지 제품 의미별로 판단한다.
- **장점**: POS 판별만이 아니라 인증 이후 토큰화·사전 SELECT·의미 조회까지 생략한다. DB 스키마와 서버 공유 상태가 필요 없다.
- **키 초안**: `cache-format-version + language + normalize(lines)`의 충돌 저항 해시. 현재 앞 200/120자 단순 절단 키는 서로 다른 긴 입력 충돌 가능성이 있으므로 범용화할 때 그대로 복제하지 않는다.
- **무효화**: (a) 토큰 교정/사전 승격 성공 즉시 해당 언어 또는 전체 분석 prefix 삭제, (b) 토크나이저·프롬프트·응답 형식 변경 시 format version 증가, (c) 성공한 비어 있지 않은 결과만 저장, (d) 선택 기능은 짧은 TTL 또는 LRU 용량 상한, (e) 로그아웃 시 개인정보 성격을 검토해 사용자별 namespace 삭제.
- **주의**: 자료 `processed_json`은 이미 정본 결과 저장소다. 전체 재분석은 사용자가 최신 분석을 요구하는 동작이므로 오래된 클라이언트 캐시로 우회하지 않는 편이 맞다.

### 후보 B — 서버 프로세스 메모리의 판별 전용 TTL/LRU + in-flight coalescing

- **지점**: `collectZhPosMarks` 후, `disambiguateZhPos` HTTP 직전. 동일 key Promise를 공유하면 동시 중복도 1회로 합칠 수 있다.
- **키 초안**: `model + promptVersion + normalized used lines + ordered [{lineIdx, word, oov}]`. 단어만 키로 삼으면 문맥 판별의 목적을 훼손하며, mark 순서가 응답 배열 위치 계약이므로 반드시 포함한다.
- **값**: 검증을 통과한 `{pos, all, parts?}`만. 빈 Map/HTTP 오류/timeout/형식 오류는 캐시하지 않는다.
- **무효화**: 5~30분의 짧은 TTL, 최대 entry/byte LRU, 배포·cold start 자연 소멸, 모델/프롬프트/검증기 변경 시 version bump. 사전 교정 이벤트가 모든 서버 인스턴스에 전파되지 않으므로 장기 TTL은 피한다.
- **장단점**: 스키마·추가 서비스가 없고 burst 중복에 효과가 있으나 서버리스 인스턴스별 best-effort라 hit 보장은 없다. 판별 HTTP만 줄이고 나머지 `/api/analyze` 비용은 남는다.

### 후보 C — 기존 외부 KV가 있을 때만 공유 TTL 캐시

- **지점/키/값**: 후보 B와 동일하되 서버 인스턴스 간 공유한다.
- **무효화**: TTL + versioned key가 기본. 교정 API 성공 때 base form 역색인이 없으면 정밀 삭제가 어렵기 때문에 짧은 TTL을 유지하거나 언어 epoch를 key에 포함한다.
- **판단**: 현재 코드에서 이 목적의 공유 KV는 확인되지 않았다. 캐시만 위해 새 인프라를 도입하는 것은 1회 HTTP 절감 대비 과하다. DB 테이블 추가는 태스크 제약에도 어긋난다.

### 권고 순서

1. 이미 있는 Viewer/PDF 전체 결과 캐시의 hit/miss와 `/api/analyze`의 `zh marks/httpCalls`를 먼저 계측한다(현재 응답 stats에는 중국어 판별 수치가 없다).
2. 실제 반복이 Quick 또는 동시 요청에 집중되면 후보 A 또는 B를 작은 범위로 적용한다.
3. 여러 인스턴스에서 반복률이 충분히 확인될 때만 후보 C를 검토한다. **새 DB 스키마는 권고하지 않는다.**

## 4. `user_verified` 보호 계약 분석

### 현재 보장되는 것

- `needsZhMeaningPosRefresh`와 `needsZhJaBackfill`은 `source === 'user_verified'`를 재조회에서 제외한다 (`src/lib/server/disambiguateZhPos.js:223-251`).
- POS 자가 치유 writeback은 `buildZhPosWriteback`에서 `source === 'gemini'`인 단일 POS 행만 만들고, 실제 update도 `source='gemini'` 조건을 다시 건다 (`src/lib/server/disambiguateZhPos.js:254-276`, `src/app/api/analyze/route.js:294-305`). 따라서 판별 캐시가 생겨도 이 조건을 우회하지 않으면 `user_verified` DB 행은 덮이지 않는다.
- 현행 Viewer 전체 결과 캐시는 사전 테이블을 쓰지 않고, 교정 및 전역 승격 성공 때 분석 prefix를 삭제한다 (`src/lib/viewerAnalysisCache.js:11-12,43-54`, `src/views/ViewerPage.jsx:841-844,901-902`). DB 무손상 계약과 직접 충돌하지 않는다.

### 남는 표시 일관성 위험

- `collectZhPosMarks`는 `source`를 보지 않는다. `user_verified` POS가 명·동·형 계열이면 mark가 될 수 있다 (`src/lib/server/disambiguateZhPos.js:38-64`).
- 응답 조립은 문맥 pick을 `cachedPos`보다 우선하고, 그 POS에 맞는 뜻을 고른다 (`src/lib/server/disambiguateZhPos.js:192-220`, `src/app/api/analyze/route.js:264-279`). 즉 “보호”가 **DB 행을 덮지 않는다**는 뜻이라면 충돌이 없지만, “검증된 POS/뜻은 표시에서도 모델보다 절대 우선”까지 뜻한다면 현재 경로 자체가 이미 더 강한 계약을 만족하지 않는다.
- 장기 판별/완성 응답 캐시는 교정 후에도 과거 pick/뜻을 표시할 수 있다. 그러므로 캐시 도입 시 (1) 교정·승격 성공 무효화, (2) 짧은 TTL/version, (3) 가능하면 `user_verified` base form이 포함된 결과는 캐시하지 않거나 사전 epoch를 키에 포함하는 규칙이 필요하다. 멀티 인스턴스 서버 메모리 캐시는 즉시 전역 삭제가 불가능하므로 특히 짧은 TTL이 안전하다.

**결론**: 후보 A/B/C 모두 DB write 조건을 그대로 유지하면 기존의 DB 보호와 충돌하지 않는다. 다만 표시까지 정본 우선이어야 하는지는 구현 전에 오너가 계약 범위를 확정해야 한다.

## 5. 합성 입력 벤치: 판별 1회 비용 추정

### 방법

실제 API key나 네트워크를 사용하지 않고 `fetch`를 결정적 합성 응답으로 대체했다. 12 marks(2줄)와 상한 120 marks(20줄)를 각각 50회 워밍업 후 1,000회 실행해 프롬프트 생성, JSON 직렬화/파싱, 응답 검증, Map 조립의 로컬 비용과 payload 크기를 측정했다. Node 버전은 리포 환경의 `node`를 사용했다.

```bash
node --input-type=module <<'EOF'
# process.env.GEMINI_API_KEY에 합성 문자열을 두고 fetch를 mock한 뒤
# disambiguateZhPos를 12/120 marks 각각 1,000회 실행
EOF
```

| 합성 입력 | 요청 body | 합성 모델 text | 평균 로컬 처리 |
|---|---:|---:|---:|
| 12 marks / 2줄 | 1,847 B | 517 B | 0.070 ms/회 |
| 120 marks / 20줄(상한) | 6,368 B | 5,161 B | 0.163 ms/회 |

### 해석과 한계

- 애플리케이션 로컬 CPU/전송량은 매우 작다. 판별 1회의 실질 비용은 외부 모델의 입력·출력 토큰, 네트워크 왕복, 모델 지연이다.
- 실제 호출은 15초 timeout 상한이며, `/api/analyze`는 시작 후 35초 deadline을 넘으면 호출을 생략한다. 이 벤치는 외부 서비스 지연·과금·rate limit을 측정하지 않았으므로 운영 latency나 금액을 수치로 가장하지 않는다.
- 거친 UTF-8 byte/4 휴리스틱으로는 12-mark 왕복이 약 600 token, 상한이 약 2,900 token 규모지만 중국어·한국어 tokenizer에서 오차가 크다. 금액 산정은 배포 시점의 해당 모델 공식 가격표와 실제 usage metadata로 다시 계산해야 한다.
- 의미 조회와 병렬인 cache-miss 요청에서는 `max(T_pos, T_meaning)`가 벽시계가 되고, 의미 조회가 없는 사전-hit 요청에서는 대략 `T_pos`가 그대로 추가된다. 따라서 “항상 벽시계 0”이 아니라 **의미 조회가 더 느릴 때만 숨는다**가 정확하다.

## 미해결 질문

> **1번 확정 (오너, 2026-08-24): 보호 범위는 "DB 무손상까지"다.**
> 화면 표시에서 문맥 판별(pick)이 캐시 POS보다 앞서는 현재 동작은 **계약 위반이 아니라 의도된
> 동작**이다. 따라서 캐시를 도입할 때 지켜야 할 선은 "DB 행을 덮지 않는다" 하나이고, 표시
> 신선도는 무효화 규칙(짧은 TTL·교정 시 삭제)의 품질 문제로 다루면 된다.
> 이 확정은 `src/lib/server/__tests__/userVerifiedScope.test.js`에 **양쪽으로** 못 박았다 —
> 쓰기 금지(writeback 목록 제외 + 라우트의 `source='gemini'` 이중 조건)와, 표시 우선이
> 아니라는 사실(resolveZhTokenPos가 pick을 앞세움) 모두. 한쪽만 고정하면 "표시도 우선이어야
> 하는 것 아니냐"는 오독이 조용한 동작 변경으로 들어온다.
> **2~4번은 여전히 열려 있다.**

1. ~~`user_verified` 보호 범위가 DB 무손상인지, 화면의 문맥 POS/뜻보다도 절대 우선인지 확정이 필요하다.~~ → **확정: DB 무손상까지**(위 참조).
2. Quick의 반복 분석은 의도적으로 항상 최신 결과를 요구하는지, 세션 TTL 캐시를 허용하는지 제품 판단이 필요하다.
3. 실제 캐시 판단 전 `stats.zhPos = { marks, httpCalls, cacheHit }` 같은 관측치를 추가할 별도 구현 SPEC이 필요한가? 현재 리포만으로는 운영 중복률과 모델 latency를 알 수 없다.
4. 현행 Viewer/PDF 캐시의 서로 다른 key 절단 길이와 무효화 범위를 통합할지 별도 검토가 필요하다.
