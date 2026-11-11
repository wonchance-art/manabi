# IPA 크론 「조용한 0」 · 얼화 사전 캐시 · Wikinews 원천 끄기 — 검증 기록 (2026-11-12 KST)

오케스트레이터 지시(2026-11-12 KST, 백엔드 자율 범위) — 패치 하나 · 배포 1회. 본문은 옮기지 않는다(낱말 · id만).

## 1. backfill-ipa — 실패를 삼키던 클라이언트 호출 (`src/app/api/cron/backfill-ipa/route.js`)

- **증상**(운영 `observe.cron_runs`, 읽기 전용): 이 잡의 기록 전체 3회(11/9 · 10 · 11 01:05 KST)가 `ok · processed 0`.
  - 1단계(단어장 빈 IPA): 3 → 3.
  - 2단계(공개 자료 사전 행): 대상 26, 채움 0.
- **원인**:
  - 라우트가 클라이언트용 `callGemini`(`src/lib/gemini.js` — 상대 경로 `fetch('/api/gemini')` + 브라우저 세션 토큰)를 썼다.
    서버 크론 안에서는 매번 예외였고, `fetchIpaBatch`의 `catch`가 빈 결과로 삼켰다.
  - 기존 계약은 `callGemini`를 흉내 내서 실제 서버 실패를 잡지 못했다.
- **수정**:
  - 서버 경로 `callLLM('light', …, { route: 'backfill-ipa', temperature: 0, timeoutMs: 15000 })`로 바꿨다.
  - 실패한 묶음 수(`failedBatches`) · 첫 오류(`firstError`, 앞 200자) · 쓴 묶음 수(`batchesUsed`)를 응답에 싣는다.
  - `summarizeBackfillIpa`는 실패가 있으면 `ok=false` · `failed = 실패 묶음 수`이고 detail에 첫 오류를 남긴다.
  - 하루 상한 3묶음(75낱말)은 그대로다.
- **제공자 허용 목록**:
  - `backfill-ipa`를 `GEMINI_FALLBACK_ROUTES`(단어 뜻 · 사전 경로)에 넣었다. 영어 **표제어 목록만** 보내 공유 사전 reading을 채우는 경로라
    `fetchMeanings`와 성질이 같다(사용자 글 · 문장이 실리지 않는다).
  - Claude 실패 시 Gemini · Groq 대체가 남는다.
- **계약**:
  - `backfillIpaPublicDict.test.js`: `callLLM`을 흉내 낸다. 묶음 실패 → `failedBatches` · `firstError` · 크론 한 줄 `ok=false` · `failed>0`.
    route · 티어 · 시간 상한도 확인한다.
  - `llmProviderPolicy.test.js`: 「서버 코드(`src/app/**/route.js` · `src/lib/server`)는 클라이언트용 `callGemini`를 가져오지 않는다」.
    표에 `backfill-ipa`가 있다.
  - `opsHealth.test.js`: 실패가 있으면 요약이 ok가 아니다.
  - **옛 라우트로 되돌리면 새 계약 5개가 실패**함을 확인했다.
- 운영 확인(병합 뒤 다음 01:05 KST 실행): 채움 수 · 실패 수를 읽기 전용으로 본다.

## 2. 공유 사전 캐시 얼화 9행 — `supabase/migrations/20261112010000_zh_erhua_dict_cache.sql`

- 대상: `morpheme_dictionary` 중국어 9행의 reading `… ér`(有点儿은 `er`) → `… r`. 실측 2026-11-12 KST.
  - id: 3127 一点儿 · 7088 哪儿 · 3524 大伙儿 · 4432 心眼儿 · 7069 早点儿 · 7084 有点儿 · 7285 画儿 · 7109 这儿 · 7107 那儿.
  - 실음절 女儿(4525 `nǚ ér`)은 대상 밖이다.
- reading만 바꾸고 다른 열은 그대로다.
- 행 단위로 건너뛰고 NOTICE를 낸다. 백업은 `backup_private.zh_erhua_dict_20261112`(옛 행 통째)에 둔다.
- 복원은 `docs/sql/zh-erhua-dict-20261112-rollback.sql`(행 단위).
- 사후 검사: reading 밖 열 = 백업 시점 · 다른 행 md5 · 지문 넷.
- 계약: `supabase/tests/zh-erhua-dict-cache.mjs`(PGlite 9).
- 메우는 불일치: 토큰 고치기 창의 옛 꼴 후보(고르면 손 보정으로 옛 꼴이 되살아남) · 교실 조회의 옛 꼴.

## 3. Wikinews 원천 끄기 — `supabase/migrations/20261112020000_wikinews_sources_off.sql`

- 근거(읽기 전용):
  - 11/9~11/12 KST 크론 4회 동안 영어 Wikinews 6행이 매일 0건이다.
  - 영어 새 글 목록이 빈 목록이고, Sports 분류 최근 글은 2026-03-16이다.
  - 11/8 수확분 제목에 「Wikimedia Foundation closes Wikinews after 21 years」가 있다.
  - 프랑스어 `wikinews_fr`는 수확 기록이 0행(전체 기간)이다.
- 영어: 활성 Wikinews 6행(id 고정)을 `is_active = false`로 바꾼다. 지우지 않는다.
- 프랑스어:
  - DB에 행이 없어 코드 기본값이 돌았다.
  - 기본값과 같은 설정의 5행을 넣고 `wikinews_fr` 3개만 끈다(영상 2원천은 그대로 돈다).
  - 프랑스어 행이 이미 있으면 넣지 않는다.
- 복원은 `docs/sql/wikinews-sources-off-20261112-rollback.sql`이다. 영어 6행을 다시 켜고 넣은 프랑스어 5행을 지워 기본값으로 되돌린다.
- 계약: `supabase/tests/wikinews-sources-off.mjs`(PGlite 6).
  - `resolveActiveSources`로 프랑스어 편성 = 기본값 − `wikinews_fr`임을 대조한다.
  - 복원 뒤 기본값 복귀도 확인한다.
- 영어 대체 원천은 VOA #1784 결정 뒤다.

## 4. 待会儿 `dāi huì r` (`src/lib/server/zhPinyinFix.js`)

- pinyin-pro가 줄 · 낱말 단독 모두 `dài`로 내서 검증 패스가 고치지 못했다(suspect).
- CC-CEDICT는 `dāi huì r`이다. 운영 토큰은 0건이라 새 분석만 바뀐다.
- 교재 정답 대조에서 얼화 「그 밖」이 3 → 2로 줄었다. 병음 상한 648 · 198은 그대로다.
