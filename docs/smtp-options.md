# 인증 메일 SMTP 고르기 (SMTP-OPTIONS-001, 2026-11-08 KST)

> 조사 · 문서만이다. 계정을 만들거나 환경 변수 · Supabase 설정을 바꾸지 않았다. **비밀 값(API 키 · 비밀번호)은 이 문서와 저장소 어디에도 적지 않는다.**
> 숫자는 2026-11-08 KST에 각 회사 공식 요금 · 문서 페이지에서 읽은 값이다. 요금은 자주 바뀌므로 가입 직전에 한 번 더 확인한다.

## 왜 필요한가
- Supabase 내장 메일은 **조직 팀원 주소로만** 보낸다(「The built-in service … sends only to the email addresses of your organization's team members」 —
  [Supabase · Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). 자체 SMTP가 없으면 일반 가입자는 가입 확인 · 비밀번호 재설정 메일을 받지 못한다.
- 앱이 보내는 메일은 가입 확인 · 비밀번호 재설정 둘이다([`auth-email-links.md`](auth-email-links.md)). 하루 수십 통 규모의 **거래 메일**이라
  마케팅 기능은 필요 없다.
- 자체 SMTP를 켜면 Supabase가 먼저 시간당 30통으로 묶는다(「a low rate-limit of 30 messages per hour is imposed」, 같은 문서) —
  Authentication → Rate Limits에서 조정한다.

## 지금 도메인 상태(2026-11-08 KST, 공개 DNS 조회)
- 네임서버: `ns1.vercel-dns.com` · `ns2.vercel-dns.com` → **레코드는 Vercel 대시보드(Domains → manabi.co.kr → DNS Records)에서 더한다.**
- MX 없음 · SPF(TXT) 없음 · DMARC `_dmarc` TXT `v=DMARC1; p=none;` 있음.
- 받는 메일(MX)이 없어도 보내기는 된다. 발송 서비스의 반송 처리(Return-Path)는 서비스가 주는 하위 도메인 레코드로 따로 둔다.

## 후보 비교
| 서비스 | 무료 한도 | 다음 단계 가격 | SMTP | 도메인 인증 레코드 | 메모 | 판정 |
|---|---|---|---|---|---|---|
| **Resend** | 월 3,000 · **하루 100** · 도메인 3 | Pro 월 $20 — 월 50,000 · 하루 제한 없음 | 있음(`smtp.resend.com`) | DKIM TXT + 반송용 하위 도메인(`send.` 기본) MX · SPF TXT — 대시보드 Records 탭 값을 그대로 | Supabase 연동 공식 안내 있음 · 계정당 설정이 단순 | **채택(1안)** |
| **Brevo** | **하루 300**(월 약 9,000, 이월 없음) | Starter 월 $9부터(하루 제한 없음, 제3자 리뷰 기준) | 있음(SMTP relay) | Brevo code TXT(@) · DKIM CNAME `brevo1._domainkey` · `brevo2._domainkey` · DMARC | 무료 한도는 가장 넉넉. 마케팅 도구 중심이라 화면이 복잡 | **부분 채택(예비)** — 하루 100을 넘기 시작하면 무료로 버틸 때 |
| **Amazon SES** | 전용 무료 할당 없음 — 새 계정 무료 크레딧(최대 $200, 6개월 플랜) | 1,000통당 $0.10 | 있음 | DKIM CNAME 3개 · 선택적 MAIL FROM MX/TXT | **샌드박스**: 확인된 주소에만 · 하루 200 · 초당 1통, 운영 전환 심사 최대 96시간 · AWS 계정 운영 부담 | **부분 채택(규모 커지면)** — 월 수만 통부터 가장 쌈 |
| **Postmark** | 월 100(만료 없음) | Basic 월 $15 — 월 10,000 | 있음 | DKIM TXT · Return-Path CNAME | 거래 메일 도달성 평판이 좋다는 평이 많지만 무료 100은 출시용으로 부족 | **배제(무료 기준)** — 유료 전환 시 후보 |
| **SendGrid** | 영구 무료 폐지(2025-05-27) — 새 계정 60일 체험 · 하루 100 | Email API 월 $19.95부터 | 있음 | DKIM · SPF CNAME | 체험이 끝나면 발송 중단 | **배제** |
| **네이버클라우드 Cloud Outbound Mailer** | 공개 무료 수치 확인 못 함(포털 요금표) | 건당 과금 | API 중심(SMTP 여부 공식 가이드에서 확인 필요) | — | **개인 계정 불가 — 사업자 계정 필요** · 국내 수신 친화가 장점일 수 있음 | **배제(지금)** — 네이버 도달성 문제가 실측되면 다시 본다 |

### 한국 수신(네이버 · 다음 · Gmail) 도달성
- 서비스별로 네이버 · 다음 수신율을 비교한 공개 실측 자료는 찾지 못했다(국문 · 영문 검색). 그래서 평판 숫자 대신 **확인 가능한 조건**으로 판단한다:
  ⑴ SPF · DKIM이 통과하고 DMARC가 From 도메인(`manabi.co.kr`)과 정렬될 것 ⑵ 공유 IP라도 거래 메일 전용으로 보낼 것 ⑶ **실제 수신 시험**(아래 6단계).
- Gmail · Yahoo는 2024년부터 대량 발신자에게 SPF · DKIM · DMARC를 요구한다. 우리 규모(하루 수십 통)는 대량이 아니지만 셋 다 갖추면 스팸 분류 여지가 줄어든다.
- 네이버 스팸함으로 가면: ⑴ 레코드 통과 여부(메일 원문 헤더) ⑵ 제목 · 본문의 링크 도메인이 From과 같은지(우리 원고는 `www.manabi.co.kr` — 같음) 순으로 본다.

### 발신자 이름
- 「manabi」(영문)로 둔다 — 원고 · 사이트 표기와 같다. 한글 이름도 SMTP 표준(RFC 2047 인코딩)으로 보낼 수 있지만 지금은 필요 없다.

## 권장 1안 — Resend: 오너 작업 절차
> 계정 · 키 · 비밀번호는 오너가 만들고 직접 붙여 넣는다. 키는 채팅 · 문서 · 이슈 · 커밋 어디에도 적지 않는다.

1. **가입**: resend.com에 오너 계정으로 가입하고 2단계 인증을 켠다.
2. **도메인 추가**: Domains → Add Domain → `manabi.co.kr`. (지역을 고를 수 있으면 가까운 곳을 고른다.)
   화면의 Records 탭에 나오는 레코드(DKIM TXT, `send` 하위 도메인의 MX · SPF TXT 등)를 **값 그대로** 복사해 둔다.
3. **DNS 레코드 넣기(Vercel)**: Vercel → Domains → `manabi.co.kr` → DNS Records → Add.
   - Name은 접두만 적는다(예: `resend._domainkey`, `send`). MX는 우선순위 칸을 Resend 값대로.
   - 기존 `_dmarc`(`p=none`)는 그대로 둔다. 몇 주 수신 보고를 본 뒤 `p=quarantine`을 검토한다(이 문서 범위 밖).
   - 반영은 보통 몇 분, 길면 24시간. Resend 화면에서 Verify가 초록이 될 때까지 기다린다.
4. **API 키 만들기**: Resend → API Keys → Create. 권한은 **Sending access**, 도메인은 `manabi.co.kr`로 좁힌다. 키는 다음 단계에 바로 붙여 넣고 다른 곳에 남기지 않는다.
5. **Supabase SMTP 칸**(Authentication → Emails → SMTP Settings → Enable custom SMTP):

   | 칸 | 값 |
   |---|---|
   | Sender email | `noreply@manabi.co.kr` |
   | Sender name | `manabi` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | 4단계에서 만든 API 키(여기에만 붙여 넣는다) |

   ([Resend · Send emails with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)의 값과 같다.)
6. **시간당 한도**: Authentication → Rate Limits → 이메일 발송 한도. 자체 SMTP를 켜면 시간당 30으로 시작한다. Resend 무료는 **하루 100**이라
   처음에는 30 그대로 둔다. 하루 100을 넘기 시작하면 Resend Pro(월 $20, 하루 제한 없음)로 올리거나 Brevo(하루 300)로 옮긴 뒤 한도를 올린다.
7. **시험 발송**:
   - `/auth`에서 새 주소로 가입 → 가입 확인 메일, 「비밀번호 찾기」 → 재설정 메일을 **Gmail · 네이버 · 다음** 주소로 받는다.
   - 받은편지함에 왔는지(스팸함 아님), 보낸 사람이 「manabi <noreply@manabi.co.kr>」인지, 한국어 원고인지 본다.
   - Gmail 「원본 보기」에서 `SPF: PASS` · `DKIM: PASS` · `DMARC: PASS`를 확인한다(네이버는 메일 「원문 보기」의 Authentication-Results 줄).
   - 링크를 **다른 기기**에서 열어 `/auth/confirm`을 거쳐 서재 · 새 비밀번호 화면이 뜨는지 본다.
   - Resend 대시보드 Emails 목록에 Delivered로 남았는지, Supabase Logs(Auth)에 SMTP 오류가 없는지 본다.
8. **되돌리기**: Supabase SMTP Settings에서 custom SMTP를 끄면 내장 메일로 돌아간다(팀원 주소로만 발송). DNS 레코드는 남겨 두어도 해가 없다.

## 출처
- [Supabase · Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) — 내장 메일 팀원 한정 · 자체 SMTP 첫 한도 시간당 30
- [Resend · Pricing](https://resend.com/pricing) · [Resend · Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp) · [Resend · Add a domain](https://resend.com/docs/add-a-domain)
- [Brevo · Free SMTP server](https://www.brevo.com/free-smtp-server) · [Brevo · Authenticate your domain](https://help.brevo.com/hc/en-us/articles/12163873383186)
- [Amazon SES · Pricing](https://aws.amazon.com/ses/pricing/) · [Amazon SES · Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [Postmark · Pricing](https://postmarkapp.com/pricing)
- [Twilio · Changes coming to SendGrid's free plans](https://www.twilio.com/en-us/changelog/changes-coming-to-sendgrid-s-free-plans) · [SendGrid · Trial Account Plan](https://support.sendgrid.com/hc/en-us/articles/35270136965403)
- [네이버클라우드 · Cloud Outbound Mailer 스펙](https://guide.ncloud-docs.com/docs/cloudoutboundmailer-spec)
- [Vercel · Managing DNS Records](https://vercel.com/docs/domains/managing-dns-records)
