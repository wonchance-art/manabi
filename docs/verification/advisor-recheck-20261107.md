# Supabase 어드바이저 재점검 (ADVISOR-RECHECK-002 · 2026-11-07 KST)

오케스트레이터 순회(16:40 KST). 성능 · 보안 양쪽. 고칠 수 있는 것은 학습 계약 지문 범위 밖이고 비파괴인 것만 고친다. 지문 범위 항목은 목록만 둔다.

## 지문 범위 — 무엇이 지문에 드는가(운영 함수 정의로 확인)
| 지문 | 담는 것 | 그래서 못 건드리는 것 |
|---|---|---|
| capability(`learning_language_capabilities` 상수) | public 9표(user_vocabulary · vocabulary_exclusions · reading_materials · uploaded_pdfs · user_known_words · review_events …)의 **정책 · 인덱스** · 속성 | 이 표들에 인덱스를 더하거나 정책을 바꾸면 상수와 어긋난다. 학습이 「준비 안 됨」이 된다. |
| core(`contract_hash_live`) | `fsrs_private` + `public.fsrs_*` 표의 정책 · **인덱스** · 함수 | fsrs_operations · fsrs_new_receipts 인덱스 |
| activity(`activity_profile_hash_live`) | profiles 정책 · 인덱스 · 트리거 | profiles 중복 정책 |
| activity_preflight | notifications 등 참조 표의 FK 내부 트리거 수 | FK 추가 · 삭제(정책 · 인덱스는 무관) |

## 고친 것(20261107050000 — 지문 밖)
| 진단 | 대상 | 조치 | 접근 변화 |
|---|---|---|---|
| multiple_permissive_policies(WARN, 약 12건) | notifications SELECT · UPDATE 두 벌 | 옛 벌(`read_own_` · `update_own_notifications`)을 지운다. 남은 식이 같다(피연산자 순서만 다름). | 없음 |
| 같은 표 INSERT + **보안** | `insert_notifications`(uid IS NOT NULL)가 `Auth users insert notifications`(uid = actor_id)를 덮었다 | 넓은 쪽을 지운다 | 발신자 위조와 발신자 없는 삽입만 막힌다. 내가 보낸 알림은 그대로 넣는다. 앱 영향은 0이다(src에서 쓰지 않음 · 운영 14행 · 마지막 쓰기 5/14). |
| unindexed_foreign_keys(INFO) | daily_suggestions.material_id(1,056행) · reading_progress.material_id | 덮개 인덱스 2개 | 없음. reading_materials를 지울 때 순차 탐색이 사라진다. |

- 증명: `supabase/tests/advisor-notifications-fk-indexes.mjs`(CI)는 7개 검사다.
  - 접근 행렬(A · B · anon × 읽기 · 고치기 · 넣기 셋)에서 바뀐 칸은 정확히 4개다(A/B의 위조 · 발신자 없음, ok → 42501).
  - 재실행하면 사전 검사가 거절한다. 복원 SQL을 돌리면 원래 행렬로 돌아간다.
  - 운영 사슬 위에서 사후 검사가 통과한다. 지문 넷과 capability 정의는 그대로다.
- DB 안 쓰기 경로 전수(오케스트레이터 17:05 확인 요청 · 운영 카탈로그 17:10 KST): 본문에 notifications가 든 함수는 전 스키마에 `fsrs_private.activity_preflight` 하나다(SECURITY DEFINER, FK 트리거 수만 읽고 INSERT 없음). notifications의 사용자 트리거 · 규칙 · 뷰 · 발행(publication)은 0이다. 저장소의 src · scripts · supabase/functions도 쓰지 않는다(scripts/db-probes.sql은 표 존재 확인만). → SECURITY INVOKER로 사용자 권한에 기대는 쓰기 경로가 없어, 넓은 INSERT 정책을 지워도 깨지는 경로가 없다.
- 사전 상태(운영 pg_policies 16:50 KST): 정책 6개가 마이그레이션의 기대 식과 글자까지 같다.
- 되돌리기: `docs/sql/advisor-notifications-fk-indexes-20261107-rollback.sql`(오너 확인 뒤에만).

## 미룬 것 — 다음 지문 재게시 때 묶는다(목록)
| 진단 | 대상 | 이유 |
|---|---|---|
| multiple_permissive | reading_materials(SELECT 4벌 · UPDATE 2벌 · DELETE · INSERT), profiles(UPDATE 2벌 · SELECT) | capability · activity 지문 |
| unindexed_foreign_keys | user_vocabulary.material_id · source_material_id(1,725행), vocabulary_exclusions.vocabulary_id(242) | capability 지문(인덱스 포함) |
| unindexed_foreign_keys | fsrs_operations.card_id(955), fsrs_new_receipts(user_id, card_id) | core 지문 |

## 그대로 두는 것(근거)
- **multiple_permissive(나머지)**: content_reports · cohort_* · user_ref_progress · vocabulary_contexts. 「관리자 + 본인」처럼 뜻이 다른 두 벌이다. 합치면 식만 길어진다.
- **unindexed_foreign_keys(나머지 31건)**: 0~4행 표다(포럼 · 스터디 그룹 · 교재 편집 · 신고). 쓰임이 생기면 다시 본다.
- **unused_index 22개**: 합계 약 400 kB다. 다수가 FK 덮개(cohort_members_user_idx 등)이거나 새 기능(canonical_analysis_jobs · error_events)이다. 지우면 unindexed FK 경고가 다시 생긴다. 통계 초기화 이력도 없다.
- **보안 진단**: 오늘 새로 생긴 것은 INFO 하나다. `backup_private.reading_materials_orphans_20261107`에 RLS는 켰지만 정책이 없다. 의도된 상태다(anon · authenticated 권한 없음 · postgres 전용).
  - 기존 항목(public_profiles SECURITY DEFINER 뷰 · 로그인 사용자 SECURITY DEFINER 함수 · 유출 비밀번호 보호 꺼짐)은 이전 점검의 판정 그대로다.
  - 유출 비밀번호 보호는 Auth 설정이라 오너 결정이다.
- **auth_rls_initplan**: 0건이다(11/3 · 11/4 · 11/6 정리 이후 유지).
