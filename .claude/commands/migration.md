# /migration — Supabase 마이그레이션 생성

## 역할
이 프로젝트(Anatomy Studio)의 Supabase 마이그레이션 SQL을 생성한다.

## 프로젝트 컨텍스트
- DB: Supabase (PostgreSQL)
- 주요 테이블: `profiles`, `reading_materials`, `user_vocabulary`, `forum_posts`, `forum_comments`, `forum_post_likes`, `forum_comment_likes`, `notifications`
- RLS: 모든 테이블에 적용. `auth.uid()` 기반
- 컨벤션: snake_case, `id uuid DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`

## 요청
$ARGUMENTS

## 출력 형식

아래 순서로 출력한다:

### 1. 변경 요약
무엇을 왜 바꾸는지 1~3줄 설명.

### 2. Migration SQL (실행용)
```sql
-- ① 테이블/컬럼 변경
-- ② 인덱스
-- ③ RLS 정책 (필요 시)
-- ④ 트리거 (필요 시)
```

### 3. Rollback SQL
```sql
-- 롤백 시 실행할 SQL
```

### 4. 프론트엔드 영향
변경으로 인해 수정이 필요한 파일과 이유를 나열한다.

### 5. 주의사항
데이터 유실 위험, 배포 순서, 기타 체크리스트.
