# 언어교육 플랫폼 통합 — 아이디어 아카이브 (의도·목적·기능)

> **성격**: 구현 지시서가 아니라 **아이디어 보존 문서**. 영어(en) 부분 구현은 별도 챗에서 진행됨 — 이 문서는 그 전에 설계한 의도·목적·기능 아이디어를 잃지 않게 정리한 것.
> 출처: IELTS 학습 시스템(Obsidian `IELTS/`) → 플랫폼 설계(`IELTS/App/DESIGN.md`·`SLICE-1.md`) → Anatomy 통합 설계(이 문서 전신) 논의 전체.
> 최종 갱신: 2026-06-10

---

## 1. 의도 · 목적 (왜 만드는가)

- **개인 온/오프라인 수업의 동반 시스템.** 교사(채연)가 직접 진행하는 수업(시작 5명 이내 → 한 명씩 확대)을 중심에 두고:
  1. 구축해둔 **notes를 Day 단위 커리큘럼**으로 배분해 진도를 운영하고
  2. 학습자가 **수업 외 시간에 혼자 예습/복습**할 수 있게 하고
  3. 전후 수업 내용을 충분히 익혔는지 **스스로 확인(self-check)**하게 하고
  4. 그 데이터를 **교사가 개인 학습 설계·교육에 쓰기 좋게 가공**해 수준·부족한 점을 파악하고
  5. 학습자끼리 **진행 상황을 공유하고 응원하는 작은 커뮤니티**로 기능하게 한다.
- **기존 자산 보존.** Anatomy Studio(일본어 몰입 읽기)는 개조하지 않고, **모드 추가**로 공존시킨다. 양쪽 모두 챙긴다.

## 2. 핵심 아키텍처 결정

| 결정 | 내용 |
|---|---|
| **베이스** | Anatomy Studio(teset, Next15+React19+Supabase+ts-fsrs+Gemini)를 베이스로. 새 앱 만들지 않음 — 학생 측 엔진(SRS·게임화·단어·읽기·레슨·포럼·PWA)이 이미 완성돼 있어서 |
| **모드 = 학습 언어** | en/jp/(ko 향후). "IELTS"는 별도 모드가 아니라 **en 모드의 현재 콘텐츠**. 시작 시 언어 선택 → 마지막 선택 기억 |
| **데이터 격리** | 콘텐츠·단어·진도·**게임화(XP·streak)까지 전부 언어별 격리** — 예외 없는 한 규칙 |
| **공용 코어 + 모드 어댑터** | 코어(auth·SRS·게임화·forum·PWA)는 공유, 분석기·콘텐츠·학습 흐름·표시만 모드별 |
| **이동 경로 극단 단순** | 모드 전환은 헤더 스위처 1곳. 모드 안에서는 그 모드 세계만 노출(메뉴 안 섞음) |
| **교사 LMS = 전 언어** | 반(cohort)이 `lang`을 보유 → 영어 반·일본어 반 각각 운영. 반 미등록자는 그 언어를 개인 학습으로(기존 Anatomy 경험 보존) |

## 3. 교사 LMS 기능 아이디어 (미구현 — 핵심 가치)

### 3.1 팀(반) 운영
- 교사가 반을 **N개 생성/제거**(이름·언어), 반별 학생·커리큘럼·진도 독립. 교사 홈에서 반 카드 전환.
- 데이터: `cohorts(name·lang·teacher_id)`·`enrollments`. 교사 1명이 여러 반(언어 무관) 운영.

### 3.2 Day 커리큘럼 (notes가 진도의 뼈대)
- `days`: day_no·제목·요약·**note_refs[]**(예습 노트)·**question_ids[]**(복습 문제)·mastery_criteria.
- 학습 흐름: **예습(노트) → 수업(교사 진행) → 복습(문제·자동채점) → self-check → SRS 정착**.
- **Mastery gating**(Khan 숙달학습): 기준(예: 정답률≥70% AND 이해도≥3) 충족해야 다음 Day 개방 + 미충족 시 해당 trap 노트 재배정.

### 3.3 Self-check (학습자 → 교사로 흐르는 데이터)
- Day 종료 시: **이해도(1~5) + 미니 퀴즈(자동채점) + 한 줄 회고** → 즉시 교사 대시보드 반영.

### 3.4 교사 대시보드 ⭐ (이 시스템의 심장)
- 학습자별: Day 진도·정답률 추이·**약점(trap) 분포**·self-check 이력·SRS 상태·학습시간 → **밴드 추정 + 부족 유형 + 추천**.
- 클래스 집계: 공통 약점 Top(=다음 수업 보강 포인트)·출석률.
- **Actionable 추천**(Learning Analytics 연구 핵심 — "보여주기"가 아니라 행동 제안): "○○님 NG-vs-False 55% → Day3 독해③ 재배정 권장", "3일 미접속 → 응원 메시지". 교사 시간 절약이 채택의 관건.
- 1:1 피드백 코멘트(`feedback`).

### 3.5 스케줄 · 출석 (전체 일정 시각화)
- `sessions`(cohort·day·일시·duration·온/오프·장소/링크·**수업 후 summary**) + `attendance`(present/late/absent).
- **캘린더 뷰**: 월/주 뷰·**반별 색상**·오늘 하이라이트·다가오는 일정 D-day 리스트.
- 교사 = 운영하는 모든 반 통합 캘린더 / 학생 = 본인 반 일정.
- 수업 후 요약 → 결석자 보충·복습 자료. 출석률 → 대시보드 지표.

### 3.6 커뮤니티 (작은 그룹, 경쟁보다 연결)
- 진도 피드("Day 5 완료!")·질문·응원 리액션(👍🔥). 부드러운 리더보드(streak, 선택). Anatomy forum 재사용.

## 4. 학습과학 근거 (왜 이 구조인가)
| 설계 요소 | 근거 |
|---|---|
| 예습→수업→복습 | **Flipped Classroom** (메타분석: 전통 강의 대비 성취·참여↑) |
| Self-check | **Formative Assessment** (flipped와 결합 시 효과 배가) |
| 숙달 후 진행 | **Mastery Learning** (Bloom·Khan Academy) |
| SRS 복습 | **Spaced Repetition + Retrieval** (FSRS — Anatomy에 이미 구현) |
| 교사 대시보드 | **Learning Analytics** (단, actionable해야 실효) |
| 커뮤니티 | **Social Learning** |
| 콘텐츠 우선 | Methodology-first EdTech |

## 5. IELTS 콘텐츠 자산 (이식 대기 — 위치 명시)
| 자산 | 내용 | 위치 |
|---|---|---|
| **노트 38개** | 8트랙(문법6·문법전체16·독해3·연어3·작문3·말하기3·듣기2·어휘2)·383항목·==강조 통일 | `Language/IELTS/` (md) + `IELTS/App/notes.js` |
| **기출 128문항** | 12세트(cam17·18), 5유형(TFNG·YNNG·MCQ·matching·completion)·한국어 해설 | `IELTS/App/data.js` |
| **TRAPS 9종** | 함정 진단 + **함정→노트 챕터 직링크 ref** | `IELTS/App/data.js` |
| **채점 엔진(TS)** | 5유형 채점·정규화·복수정답 | `~/Projects/ielts-platform/src/lib/content/grade.ts`(+md.ts·traps.ts·types.ts) |
| **md 렌더러** | Obsidian 콜아웃·표·==하이라이트 (의존성 0) | 위 md.ts 또는 `IELTS/App/app.js` |
| seed 스크립트 | notes/data.js → SQL insert 자동 변환 | `~/Projects/ielts-platform/scripts/export-seed.mjs` |

## 6. 구현 현황 (2026-06-10 기준)
- **이 챗에서 완료(미커밋, working tree)**: 모드 인프라 ① — `supabase/migrations/20260609_active_lang_mode.sql`(profiles.active_lang)·`20260609b_lang_scope.sql`(vocab_decks·reading_progress·uploaded_pdfs에 lang+인덱스) / `AuthContext`(activeLang·setLang·isTeacher) / `LanguageGate.jsx`(언어 선택 게이트) / `(app)/layout.jsx` 래핑 / `Layout.jsx` 헤더 스위처 / index.css. next build 통과. **migration 2개는 Supabase에 적용됨.**
- **영어(en) 부분은 별도 챗에서 대체 처리됨** → 위 미커밋 변경과 별도 챗 구현이 겹칠 수 있으니 **커밋 전 정합 확인 필요**.
- 폐기: SvelteKit 슬라이스1(`~/Projects/ielts-platform`)의 UI — 단 lib(grade.ts 등)는 §5 자산으로 유효.

## 7. 남은 아이디어 백로그 (우선순위순)
1. **lang 스코프 쿼리 적용** — 수십 쿼리에 `.eq('lang', activeLang)` + insert에 lang (큰 리팩토링, 통째로)
2. **교사 레이어** — cohorts·enrollments·days·sessions·attendance 스키마 + RLS(교사=반 학생 read) + 교사 대시보드 + 캘린더
3. **IELTS 콘텐츠 seed** — §5 자산 이식
4. **Self-check + mastery gating**
5. **Actionable 추천 엔진** (규칙 기반 → 후에 AI)
6. AI 채점(Writing/Speaking, Claude API)·PWA 복습 알림

## 8. 제약 · 리스크 메모
- **저작권**: Cambridge 기출은 폐쇄형(수강생 로그인 한정)·교육 보조로만. 외부 공개·홍보 사용 금지. 공개 전환 시 자체 문항 필수.
- **모드 경계**: 코어↔어댑터 인터페이스를 흐리면 스파게티. 모든 콘텐츠/단어 쿼리에 lang 필터 일관 적용(누수 금지).
- **dev 환경**: production build 잔재(`.next`)가 dev와 충돌해 CSS 깨짐 사례 있음 → dev 전 `rm -rf .next`.
