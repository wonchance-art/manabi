# RFC — slug 이행 정책 (draft 슬러그·번호 불일치) v1

상태: 채택(2026-07-24). EN-I12(-draft- 슬러그 7챕터)·FR 구조 지적(a0-06~08 번호
불일치)의 이행 설계.

## 1. 원칙

**slug는 진도 키다** — progressStore·레슨 ref·URL이 slug를 참조하므로 무단 rename은
학습 진도를 유실시킨다. 따라서:

1. **rename에는 별칭 이행이 선행**한다: storageSchema에 `slugAliases` 맵(구→신)을
   두고, progressStore 조회 시 별칭을 신 slug로 정규화(1회 마이그레이션 후 기록).
2. 별칭 인프라 전까지 **기존 slug는 동결**(보기 싫어도 안정성 우선).
3. 신규 콘텐츠 slug 규약(재확인): draft 문자열 금지·레벨 접두 일치·트랙 내 유일.

## 2. 대상 목록

| 대상 | 현상 | 처리 |
|---|---|---|
| en expansion 7챕터 `*-draft-*` | 공개 레지스트리에 draft 슬러그 | 콘텐츠는 정본 승인(품질 C — 추후 개선 라운드), slug는 별칭 인프라 후 rename |
| fr a1.js `a0-06/07/08` 슬러그 | 레벨 접두 불일치(실제 A1) | 동일 — 별칭 인프라 후 `a1-*`로 rename |

## 3. 순서

R1 slugAliases 스키마+정규화 유틸(+테스트) → R2 en 7건·fr 3건 rename+별칭 등록 →
R3 lint에 slug 규약 검사 추가(신규 위반 차단).

구현은 시스템 성격이라 **codex 발주 가능**(스키마·유틸·테스트), rename 데이터
커밋과 게이트는 Claude.
