# RFC: 학습 경로 완성 — 드릴·딕테 층 v1 (fr A1~A2)

- **발효**: 2026-07-30 오너 지시 "ㅇㅇ 싹 갈아엎고 겹치는 내용 없이 채워줘 A1-A2까지" — "챕터 1→끝 순서 학습 = 충분" 달성이 목표.
- **재진단(실물 기준)**: 문형 3단 퀴즈(buildChapterQuiz→RefPatternCheck 80% 관문)와 문형 FSRS 루프(enqueue/fetchDue/grade)는 **이미 가동 중**. 진짜 갭 3: ① 신선한 전이 연습 부재(자동 퀴즈는 챕터 예문 재사용) ② 듣기(딕테) 부재 ③ 연습 엔진 5갈래 분산(F4-3 프로토 미배선).

## 1. 스키마 — 챕터 선택 필드 `drills`

```js
drills: [
  { id: "d1", type: "fill",      prompt: "Je ___ un thé, s'il vous plaît.", answer: "voudrais", hint?: "...", accepts?: [...] },
  { id: "d2", type: "choice",    prompt: "정중한 주문은?", choices: ["...", "..."], answer: "..." },
  { id: "d3", type: "order",     sentence: "Je voudrais une table pour deux.", prompt?: "..." },
  { id: "d4", type: "dictation", sentence: "Il faut boire de l'eau.", prompt?: "듣고 받아쓰세요." },
]
```

- 검증: contentOverrides `isValidDrills`(fail-closed — 타입별 필수 필드·미지 키 거부). IPA 불요(연습 문항 — P2 IPA 정책 범위 밖 명시).

## 2. 저작 규칙 (겹침 금지 — 오너 지시의 핵심)

1. **문장 비중복**: 드릴 문장(sentence·choice 정답)은 ⑴ 같은 챕터의 예문·대화 fr 문자열과 ⑵ 같은 챕터 다른 드릴과 ⑶ **다른 챕터의 드릴**과 문장 단위로 겹치지 않는다(기계 게이트 — lint-curriculum, fr fail).
2. **챕터 시점 준수**: 그 챕터 order 시점까지의 기학습 문형·어휘만 사용(P2·P4).
3. 분량: 챕터당 6~8문항(fill 2~3·choice 2·order 1·dictation 1~2). 딕테는 짧은 자연문.
4. 지시문은 해요체 ko, 문항 본문은 fr.
5. 드릴 id는 **파일 내 유일**(lint 전역 검사) — 챕터 약칭 접두를 쓴다(예: p32-d1, a2s15-d3).

## 3. 렌더·채점

- `ChapterDrills`(클라이언트, 슬림 렌더러): fill 입력·choice 버튼·order 토큰 조립·**dictation = RefSpeak TTS 재생 + 입력 대조**(구두점 관대·악상 엄격). 정규화는 F4-3 프로토의 `normalizeExerciseAnswer` 재사용.
- 위치: 챕터 끝, 패턴 체크(RefPatternCheck) **앞** — "새 문장으로 연습 → 관문 퀴즈" 순.
- SRS: 신규 시스템 없음 — 관문 통과 시 기존 enqueueGrammarReview가 계속 담당. 드릴 완료 신호의 SRS 반영은 v2(프로토 승격·5갈래 통합과 함께).

## 4. 배치 계획 (51챕터)

| 배치 | 대상 | 문항 수(예상) |
|---|---|---|
| 1(본 PR) | 파일럿 2 | 14 |
| 2 | a2 신규·확장 6 (13~18) | ~42 |
| 3 | a1 장면 8 (21~28) | ~56 |
| 4 | a1 코어 20 + 발음 3 | ~150 |
| 5 | a2 코어 12 | ~84 |

- 각 배치: 저작 → 비중복 lint → 전체 vitest → merge. 완료 후 "순서대로 = 충분" 재판정(오너).

## 5. 비목표

- 실음원(owner-gate 유지 — 딕테는 TTS로 시작), 말하기 발화 평가, 타 트랙 확산(오너 결정 후).
