# 인증 메일 링크 — token_hash 방식 (AUTH-GUIDE-001 E, 2026-10-11)

## 왜
기본 메일 템플릿의 `{{ .ConfirmationURL }}`은 PKCE code를 `/auth/callback`으로 돌려준다. code 교환에는
**링크를 요청한 브라우저의 code_verifier 쿠키**가 필요해서, PC에서 가입하고 휴대폰 메일에서 링크를 누르면
「로그인을 완료하지 못했어요」로 실패한다(인증 자체는 끝났을 수 있음). `token_hash` 링크는 서버 라우트
`/auth/confirm`이 `verifyOtp`로 확인하므로 어느 기기에서 열어도 인증·재설정이 끝난다.

## 적용 순서 (오너 — Supabase 대시보드)
1. `/auth/confirm` 라우트가 **운영에 배포된 뒤** 진행한다(먼저 바꾸면 링크가 404).
2. Authentication → URL Configuration → **Site URL**이 운영 주소(`https://teset-gilt.vercel.app`)인지 확인.
3. Authentication → Emails → Templates에서 각 템플릿 본문의 링크 `href`만 아래로 바꾼다. 나머지 문구는 그대로 둔다.

| 템플릿 | 바꿀 링크(href) |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Magic Link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
| Change Email Address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change` |
| Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

## 확인
- 별칭 주소(`…+manabi-qa@gmail.com`)로 가입 → 인증 메일 링크를 **다른 기기**에서 열어 서재(`/materials`)로 들어가는지.
- 비밀번호 찾기 → 재설정 메일 링크를 다른 기기에서 열어 「새 비밀번호 설정」 화면이 뜨는지.

## 주의
- 링크는 `{{ .SiteURL }}` 기준이라 Preview에서 보낸 메일도 운영으로 돌아온다(Preview 메일 흐름 검수는 운영 주소로 이어짐).
- 되돌리기: 템플릿 href를 `{{ .ConfirmationURL }}`로 되돌리면 기존 `/auth/callback` 경로가 그대로 동작한다(그 라우트는 유지).
