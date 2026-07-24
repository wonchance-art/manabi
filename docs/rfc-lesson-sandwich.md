# RFC: 레슨 스키마 v2 ("실전 샌드위치") + 실자료 소스 전략

**상태**: draft | **제출**: 2026-07-24 | **오너 승인**: 확정(구조 그대로 정본화, 재설계 금지)

## 1. 개요

현재 레슨 스키마(v1)는 문법 패턴만 명시적으로 다루고, 실제 언어 사용의 맥락(실자료 노출)을 레슨 밖의 독립적 학습으로 처리한다. 이 RFC는 다음을 제안한다:

1. **확장된 스키마(v2)**: 실전 샌드위치 구조(5단) — 레슨 안에 실자료 기반 학습을 정규화
2. **실자료 소스 전략(G2)**: 라이선스 안전 오픈 소스 매핑 및 큐레이션 기준
3. **자료 저장 모델**: 오디오·전사·메타데이터 배치 결정사항
4. **파일럿 계획**: 프랑스어 A1 장면 레슨 2개 전환 스펙
5. **결정 필요 항목 목록**

---

## 2. 레슨 스키마 v2: 실전 샌드위치 구조

### 2.1 기본 구조 (5단)

```
챕터 = 1개 실자료 정복 사이클

① 실전 선노출 (authenticity intro)
   ├─ 30초~1분 실자료(원음)
   ├─ "못 알아들어도 정상" 프레임
   └─ 정답 요구 없음

② 어휘 프리뷰 (vocab preview)
   ├─ 핵심 5~7개 단어만 소개
   ├─ 소유권은 SRS 카드로 자동 등록
   └─ 맥락·예시 포함

③ 문법 패턴 1개 (focus-on-form)
   ├─ 기존 레슨 SECTION 로직 그대로
   └─ pattern + patternKo + 예시

④ 재노출 2단 (replay + transfer)
   ├─ 동일 자료(성취감) + variant 자료 1개(전이 확인)
   ├─ 같은 패턴, 다른 어휘/상황
   └─ 자가 체크: 다 들림 / 부분 / 아직
      → 진도·FSRS 신호로 활용

⑤ 연습·SRS 등록 (practice + registration)
   └─ 기존 연습 섹션(writing·quiz) + 단어장 자동 추가
```

### 2.2 SECTION_KEYS 확장 (v2 필드)

**기존 필드** (v1 호환):
- `title` `description` `example`
- `pattern` `patternKo` (문법)
- `sentences` (연습 제시)

**신규 필드** (v2 — 단계별 선택):

```typescript
// ① 실전 선노출
{
  type: "authenticIntro",
  audio: {
    url: string,              // 외부 CDN 또는 s3://manabi-public/...
    sourceId: string,         // 예: "tatoeba-ja-2184521"
    license: string,          // "CC-BY-2.0"
    attribution: string,      // 예: "Tatoeba (CC BY 2.0) — Masao Yamaguchi"
  },
  captions: {
    original: string,         // 원문(일본어)
    romanized?: string,       // 로마자(한국어면 선택, 일본어 필수)
    translation: string,      // 번역(한국어)
  },
  presentationFraming: string, // "못 알아들어도 정상! 전체 자료를 몇 번 들어 보세요."
}

// ② 어휘 프리뷰
{
  type: "vocabPreview",
  vocabs: Array<{
    word: string,             // 원문
    reading?: string,         // 발음(일본어: 히라가나)
    meanings: string[],       // ["뜻1", "뜻2"]
    exampleSentence?: string, // 같은 자료 내 예시 또는 새로 작성
  }>,
}

// ③ 문법 패턴 (기존)
{
  type: "patternExplanation",
  pattern: string,
  patternKo: string,
  explanation: string,
  examples: string[],
  // ...rest of existing fields
}

// ④ 재노출 (동일 자료 + 변형 자료)
{
  type: "authenticReplay",
  original: {
    audio: {
      url: string,
      sourceId: string,
      license: string,
      attribution: string,
    },
    captions: { original, romanized?, translation },
  },
  variant: {
    audio: { url, sourceId, license, attribution },
    captions: { original, romanized?, translation },
    transitionNote: string,  // "같은 표현 '...', 다른 상황에서"
  },
  selfCheckOptions: [
    { label: "다 들었어요", value: "full", fsrsSignal: 1 },
    { label: "부분만 들었어요", value: "partial", fsrsSignal: 0.5 },
    { label: "아직이에요", value: "notready", fsrsSignal: -1 },
  ],
}

// ⑤ 연습 (기존 + SRS 등록)
{
  type: "practiceAndRegistration",
  writingPrompts: string[],  // "이 표현을 써서 문장 2개 만들어 보세요"
  quizItems: Array<{...}>,   // 기존 quiz 스키마
  autoRegisterVocabs: boolean, // = true (②에서 등록한 어휘 자동화)
}
```

### 2.3 검증 규칙 (F3 가드)

1. **필수 필드 검증**
   - `authenticIntro` + `vocabPreview` + `patternExplanation` + `authenticReplay` 모두 필수(v2 레슨)
   - v1 레슨(이 필드들 없음) 은 그대로 유효 (마이그레이션은 점진적)

2. **오디오 재원 검증**
   - `sourceId` 형식: `${source}-${lang}-${id}` (예: `tatoeba-ja-2184521`)
   - `license` ∈ {CC0, CC-BY, CC-BY-SA, PublicDomain, OpenGovernment, ...}
   - `url` 유효성(404 확인은 선택, 수집 파이프라인에서)

3. **vocab 중복 검증**
   - `vocabPreview`의 단어가 `authenticReplay.variant` 예시와 충돌 없음
   - (또는 명시적으로 "복습" 단어 표시)

4. **자료 매칭 검증**
   - `original` 자료와 `variant` 자료가 같은 패턴 패밀리에 속하는지 명시
   - 예: `patternFamily: "be-going-to-future"` (둘 다 동일해야 함)

5. **마이그레이션 가드**
   - v1 레슨 import 시 warning 발행 (콘솔)
   - v2 필드 없음 = 기존 동작 유지
   - v2 필드 있음 = v2 렌더 경로 사용

---

## 3. 실자료 소스 전략 (G2)

### 3.1 라이선스 안전 소스 매핑

| 소스 | 라이선스 | 오디오 | 텍스트 | 주요 트랙 | 접근 방식 | 언어 커버 |
|------|---------|--------|--------|----------|---------|---------|
| **Tatoeba** | CC-BY 2.0 | ✅ native speaker | ✅ 원문+번역 | 일상회화·격식체 | API/다운로드 | 100+ |
| **Mozilla Common Voice** | CC0 | ✅ crowdsourced | ❌ (음성만) | 일상 구어체 | 다운로드/스트리밍 | 100+ |
| **LibriVox** | Public Domain | ✅ 낭독 | ✅ (도서 기반) | 문학·공식 텍스트 | 다운로드 | 주요 언어만 |
| **Forvo** | CC-BY 또는 user license | ✅ 단어/구 | ✅ (사용자 입력) | 발음 참고용 | API(유료) | 100+ |
| **Wikimedia Commons Audio** | 다양(CC-BY, CC0, PD) | ✅ 낭독·자연음 | 메타만 | 교과서·공식 | 다운로드 | 주요 언어 |
| **각국 공영방송 오픈 자료** | CC-BY 또는 CC0 | ✅ 뉴스·교육 | ✅ 자막 | 뉴스·다큐 | API/다운로드 | 1개국 특화 |
| **YouTube (CC-BY 동영상)** | Creator's choice | ⚠️ (확인 필요) | 자막 | 일상 유튜브 | 다운로드 | 한정 |

### 3.2 트랙별 1순위 추천

| 트랙 | 1순위 | 대안 | 이유 |
|------|--------|------|------|
| **일본어** | Tatoeba + NHK Easy Japanese(오픈) | Mozilla Common Voice | 후리가나·한자 병렬 기록 |
| **프랑스어** | Tatoeba (native FR 스피커 2K+) | Mozilla Common Voice | 문장+원어민 오디오 풍부 |
| **영어** | Tatoeba + LibriVox(퍼블릭 도메인 낭독) | Mozilla Common Voice | 소스 최다·억양 다양 |
| **중국어(Mandarin)** | Tatoeba | Mozilla Common Voice | 성조 기록 필수(전사 검수) |

### 3.3 큐레이션 기준

**선택 조건** (모두 만족):
1. 패턴 2회 이상 출현 (같은 문법 구조 다른 문맥)
2. 길이: A0/A1 = 15~30초, A2/B1 = 45초~2분, B2+ = 2~5분
3. 전사 정확성: 95% 이상(자동 음성인식 또는 인간 검증)
4. 원음 명확성: 배경음 < -20dB, 음량 정규화(-14dBFS LUFS)
5. 문화적 표현 다양성: 단일 성별/연령/액센트에 편중 금지

**제외 기준**:
- 방언/특수 표현 과다(학습자 진입 장벽)
- 저작권 미확정(명시적 CC 표시 없음)
- 오디오 품질 < 16kHz, mono acceptable only

---

## 4. 자료 저장 모델 (결정 필요)

### 4.1 선택지

**Option A: 리포 저장(git-lfs 또는 바이너리)**
```
repo/
  src/content/french/lessons/
    a1_sandwich_phone.js          // 레슨 메타
  public/audio/french/
    tatoeba-fr-0234821.mp3        // 오디오(git-lfs)
    tatoeba-fr-0234822.mp3
  docs/sources/french/
    tatoeba-fr-0234821.md         // 전사·라이선스 메타
```
- ✅ 버전 관리, CI/CD 간단
- ❌ git-lfs quota 비용, 클론 무겁음
- ⚠️ 초기 세팅 복잡

**Option B: 리포 메타 + 외부 CDN(S3 등)**
```
repo/
  src/content/french/lessons/
    a1_sandwich_phone.js          // url: "https://manabi-public.s3.amazonaws.com/audio/..."
  docs/sources/french/
    tatoeba-fr-0234821.md         // 전사·라이선스·s3 경로
```
- ✅ 리포 가볍음, CDN 캐싱 빠름
- ⚠️ 외부 서비스 의존, 비용(소규모면 무료)
- ❌ 대역폭 모니터링 필요

**Option C: 하이브리드 (리포 + Supabase storage 또는 Vercel Blob)**
```
repo/
  src/content/french/lessons/
    a1_sandwich_phone.js          // url: "https://manabi.supabase.co/storage/v1/object/..."
```
- ✅ 기존 Supabase 인프라 재사용, 권한 통일
- ⚠️ 업로드 파이프라인 구성 필요
- ❌ 대역폭 한계(Supabase 무료: 1GB/월)

### 4.2 권고 (오너 결정 대기)
- **초기 파일럿** (프랑스어 A1 2개 레슨): **Option D — 로컬 public/ 정적 파일**(개인 사용 확정 #150 5066898872 — 외부 인프라 불요, `public/audio/lessons/{lang}/{sourceId}.mp3`)
  - 빠른 프로토타입, 라이선스 명확성, 스케일 가능
  - 배포 전환 시 재검토: 그 시점에 S3/CDN(Option B) 승격
  
- **본격 확장** (100+ 자료): Option C (Supabase) 또는 전용 CDN 재검토

---

## 5. 파일럿 계획: 프랑스어 A1 장면 레슨 2개

### 5.1 대상 레슨
1. **"Café 주문하기"** (Tatoeba sourced)
   - 패턴: `Je voudrais + 명사` (조건문·공손 표현)
   - 자료: 카페 주문 실제 대화 (15초)

2. **"약국 약 받기"** (Tatoeba + NHW 프랑스어 소재)
   - 패턴: `Il faut + infinitive` (의무·조언)
   - 자료: 약국 상황 대화 (20초)

### 5.2 필요한 실자료 스펙

**각 레슨당**:
- [ ] 원본 자료 1개 (원음, 30초 이내)
- [ ] 변형 자료 1개 (같은 패턴, 다른 상황)
- [ ] 전사 (프랑스어 원문 + 한국어 번역)
- [ ] 오디오 메타 (sourceId, license, attribution, duration)
- [ ] 어휘 목록 (5~7개, 예시 포함)

**라이선스 체크리스트**:
- [ ] Tatoeba CC-BY 명시 확인
- [ ] 스피커 원명 기록
- [ ] 기타 소스 라이선스 문서화

### 5.3 구현 순서
1. RFC v2 스키마 추가 (SECTION_KEYS, 검증)
2. 자료 수집 (Tatoeba 큐레이션)
3. 오디오 업로드 (S3 또는 결정된 저장소)
4. 레슨 작성 (v2 필드 포함)
5. 렌더 컴포넌트 개발 (authenticIntro, vocabPreview, authenticReplay)
6. 테스트 + PR (draft)

---

## 6. 결정 필요 항목 (오너)

| # | 항목 | 선택지 | 현상태 |
|---|------|--------|--------|
| 1 | 오디오 저장소 | A. git-lfs \| B. S3/CDN \| C. Supabase | 결정 필요 |
| 2 | S3 버킷 이름 | `manabi-public` 또는 기타 | 선택 필요 |
| 3 | 파일럿 우선순위 | 프랑스어 A1만 / 멀티 언어 | 프랑스어 A1만 권고 |
| 4 | 자료 큐레이션 주체 | Claude(이 세션) / 별도 파이프라인 | 이 세션에서 수동 시작 |
| 5 | 어휘 SRS 자동등록 | 자동(v2 기본) / 선택 | 자동(기본) 권고 |
| 6 | 기존 레슨 마이그레이션 | 즉시 / 점진적(v1 호환유지) / 안 함 | 점진적(호환 유지) 권고 |

---

## 7. 구조 최종 승인 항목 (이 RFC 목적)

✅ **확정** — 재설계 금지:
- 챕터 = 실전 샌드위치 5단 구조 (authenticIntro ~ practiceAndRegistration)
- v2 필드 명시(type, audio, captions, 등)
- 검증 규칙(F3 가드)
- 트랙별 소스 우선순위(Tatoeba 중심)
- 큐레이션 기준(패턴 2회+, 길이, 음질)
- 파일럿 스펙(프랑스어 A1 2개, 자료 타입)

⏳ **결정 대기** — 별도 결정서:
- 저장소 선택지 (A/B/C)
- S3 버킷 구성
- 마이그레이션 전략 상세

---

## 8. 다음 단계

1. **이 RFC 승인 후**:
   - PR 생성 (draft, 병합 금지)
   - docs/rfc-lesson-sandwich.md 정본화
   
2. **오너 결정 후**:
   - 저장소 구성 (S3 또는 선택 옵션)
   - 파일럿 발주 (자료 수집 스펙)
   
3. **#150 핑퐁**:
   - 실자료 소스 검증 (라이선스, 음질)
   - 초안 레슨 2개 제출
   - 재검토 → 본격 확장 결정

---

**작성**: Claude (manabi session)  
**라이선스 참고**: CC-BY 소스들을 사용할 경우, 모든 자료에 출처 표기 필수  
**협의 기록**: #150 5066809350 (실자료 원칙), 5066898872 (개인 사용·라이선스)
