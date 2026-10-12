# 인증 메일 링크 — token_hash 방식 (AUTH-GUIDE-001 E, 2026-10-11)

## 왜
기본 메일 템플릿의 `{{ .ConfirmationURL }}`은 PKCE code를 `/auth/callback`으로 돌려준다. code 교환에는
**링크를 요청한 브라우저의 code_verifier 쿠키**가 필요해서, PC에서 가입하고 휴대폰 메일에서 링크를 누르면
「로그인을 완료하지 못했어요」로 실패한다(인증 자체는 끝났을 수 있음). `token_hash` 링크는 서버 라우트
`/auth/confirm`이 `verifyOtp`로 확인하므로 어느 기기에서 열어도 인증·재설정이 끝난다.

## 한국어 템플릿 (MAIL-KO-001, 2026-10-12 오너 「A안으로 진행, [manabi] 빼고 이름 넣어줘」)
본문 HTML 정본은 `supabase/templates/`다. 디자인은 운영 로그인 카드(A안)를 옮긴 것이고, 시안 비교는
[인증 메일 시안](https://claude.ai/artifact/SyPDLLk7LGGnvEbArZcqZT)에 있다. 아래 표의 링크(href)는 이 파일들에 이미 들어 있다.

| 템플릿 | 파일 | 제목(Subject) |
|---|---|---|
| Confirm signup | `supabase/templates/confirmation.html` | 이메일 주소를 확인해 주세요 |
| Invite user | `supabase/templates/invite.html` | manabi에 초대받았어요 |
| Magic Link | `supabase/templates/magic_link.html` | manabi 로그인 링크 |
| Change Email Address | `supabase/templates/email_change.html` | 새 이메일 주소를 확인해 주세요 |
| Reset Password | `supabase/templates/recovery.html` | 비밀번호 재설정 링크 |

- 제목에 `[manabi]`를 붙이지 않는다 — 보낸 사람 이름이 이미 manabi다.
- **「OO님,」은 재설정·이메일 변경 메일에만 넣는다.** 가입 인증·로그인 링크 메일은 아직 확인되지 않은 주소로 가고,
  `display_name`은 가입하는 쪽이 마음대로 적는 값이다. 남의 주소로 가입하면서 닉네임에 「계정이 정지됐습니다 ○○로 접속」 같은
  문장을 넣으면 manabi 도메인 메일에 실려 그 사람에게 간다(피싱). 재설정·변경 메일은 메일함 주인이 확인을 마친 계정에만 가므로
  이름을 넣어도 본인이 적은 값이다. 초대는 관리자만 보내 이름이 필요 없다. 계약 테스트가 이 경계를 지킨다.
- 이름은 auth의 `user_metadata.display_name`을 읽는다. 닉네임 정본은 `profiles.display_name`이라 온보딩·내 정보에서 닉네임을
  저장할 때 auth에도 같은 값을 옮긴다(`src/lib/authDisplayName.js`). 그 전에 가입한 계정은 다음 닉네임 저장 때부터 맞춰지고,
  값이 없으면 「OO님,」 없이 나간다.
- 「1시간 동안 쓸 수 있어요」는 Supabase 기본값(Authentication → Providers → Email → Email OTP Expiration 3600초) 기준이다.
  값이 다르면 템플릿 문구를 먼저 고친다.
- 대시보드에 「Reauthentication」이나 보안 알림(비밀번호 변경 알림 등) 템플릿이 켜져 있으면 그 메일은 영어로 남는다 — 켜져 있는지
  확인하고, 켜져 있으면 같은 틀로 추가한다(지금 앱은 둘 다 쓰지 않는다).

### 한국어 템플릿 적용 (M09 — Supabase 대시보드)
1. 이 파일들이 main에 병합된 뒤 진행한다(`/auth/confirm`은 이미 운영 배포됨).
2. Authentication → Emails → Templates에서 템플릿마다 **제목**을 위 표로, **본문**을 해당 파일 전체로 바꾼다.
3. 가입 인증·비밀번호 재설정 메일을 실제로 받아 본다: Gmail(웹·iOS·Android 다크 모드), 네이버 메일, Apple 메일.
   확인할 것 — 한국어 표시, 버튼 클릭 → `/auth/confirm` 도착, 다른 기기에서 열기, 「OO님,」 표시(재설정), 스팸함 여부.
4. 되돌리기: 템플릿 본문을 Supabase 기본값으로 되돌리면(Reset to default) 영어 기본 메일과 `/auth/callback` 경로로 돌아간다.

## 링크만 바꾸는 적용 순서 (기존 영어 본문 유지 — 한국어 템플릿을 쓰면 위 절차로 대체)
1. `/auth/confirm` 라우트가 **운영에 배포된 뒤** 진행한다(먼저 바꾸면 링크가 404).
2. Authentication → URL Configuration → **Site URL**이 운영 주소(`https://manabi.co.kr`)인지 확인.
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
