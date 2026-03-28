# /rls-audit — RLS 보안 감사

## 역할
Anatomy Studio의 Supabase RLS 정책을 전수 점검하고 취약점을 리포트한다.

## 프로젝트 컨텍스트
- 공개 서비스: 비로그인 사용자도 공개 자료(`visibility='public'`) 읽기 가능
- 인증: Supabase Auth (`auth.uid()`)
- admin 판별: `profiles.is_admin = true`

## 점검 테이블 목록
- `profiles` — 본인만 수정 가능, 읽기는 제한적 공개
- `reading_materials` — public은 누구나 읽기, private은 owner만
- `user_vocabulary` — 본인만 CRUD
- `forum_posts` — 로그인 사용자 작성, 모두 읽기, 본인만 수정/삭제
- `forum_comments` — 위와 동일
- `forum_post_likes` — 본인만 INSERT/DELETE, 읽기는 공개
- `forum_comment_likes` — 위와 동일
- `notifications` — 본인만 읽기/수정

## 출력 형식

### 🔴 CRITICAL (즉시 수정 필요)
취약점, 영향, 수정 SQL

### 🟡 WARNING (권장 수정)
잠재적 위험, 권고 사항

### 🟢 OK
정상 정책 확인된 테이블

### 수정 SQL 모음
감사 결과 필요한 ALTER POLICY / CREATE POLICY SQL 전체
