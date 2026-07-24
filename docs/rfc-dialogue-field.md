# RFC — 대화 예시 구조화 (화자명 언어 필드 분리) v1

상태: 채택(2026-07-24). #583·R2가 지적한 "fr 필드 안의 한국어 화자명" 해소 설계.

## 1. 문제

대화 예시 example의 fr(원어) 필드에 `"여행자 : Je suis..."`처럼 **한국어 화자명이
원어 문자열에 인라인**돼 있다(프랑스어 scene 2파일 6블록 + 동종 패턴 ja·en·zh).
TTS·검색·언어별 처리 시 원어 필드가 오염되고, IPA 줄과 화자 대응도 암묵적이다.
※ story 블록은 이미 `{speaker, fr, ipa, ko}` 구조라 문제없음 — **example 대화만** 대상.

## 2. 설계

- examples 항목에 **`dialogue` 구조 필드** 신설(기존 flat 필드와 배타):
  `dialogue: [{ speaker, fr|ja|en|zh, ipa?, ko }, ...]`
- contentOverrides: SECTION_STRUCT_FIELDS의 examples 검증에 dialogue 분기 추가
  (각 줄은 story 라인과 동일 스키마 — 재사용).
- 렌더: ReferenceChapterPage의 story 라인 렌더러를 example dialogue에 재사용
  (화자 라벨 + 원어/IPA/번역 3단 — 기존 디자인 관례 유지).
- 이행: 트랙별 대화 예시 블록을 dialogue 구조로 변환(원문·IPA·번역 무손실 재배열).
  검증 = 변환 전후 원어 문장 집합 동일성 스크립트 + 전체 vitest.

## 3. 순서

R1 스키마·렌더(1커밋) → R2 프랑스어 6블록 이행 → R3 ja·en·zh 동종 소탕(전수 grep).
