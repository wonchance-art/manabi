# Manabi AI Relay — Claude ↔ Codex 직접 인계

## 목적

GitHub 댓글 지연이나 연결 앱 권한 오류와 무관하게 Claude와 Codex가 짧은 인계 메시지를 직접 교환한다.
코드·PR·최종 감사 기록의 단일 출처는 계속 GitHub이며, Relay는 작업 시작과 ACK를 빠르게 전달하는 보조 경로다.

## 구조

```text
Claude CLI ──Bearer CLAUDE_TOKEN──┐
                                  ├─ /api/ai-relay ─ service_role ─ ai_relay_messages
Codex CLI  ──Bearer CODEX_TOKEN───┘
```

- 발신자는 요청 본문이 아니라 서로 다른 서버 토큰으로 확정한다.
- Claude는 `CLAUDE_*`·`CODEX_IMPL`, Codex는 `CODEX_REVIEW`·`CODEX_DONE`만 보낼 수 있어 상대 결과를 위조할 수 없다.
- `anon`·`authenticated`는 테이블과 claim RPC에 접근할 수 없다.
- `GET`은 메시지를 5분 동안 원자적으로 claim한다. ACK가 없으면 다시 수신 가능해진다.
- `(source_agent, dedupe_key)` 유니크 제약으로 같은 인계를 한 번만 저장한다.
- 메시지는 기본 7일 후 만료된다.
- Relay 미설정·마이그레이션 미적용 시 API만 503이며 앱 기능은 그대로 동작한다.

## 1. DB 준비

`supabase/migrations/20260716074502_ai_relay_messages.sql`을 기존 수동 마이그레이션 절차로 적용한다.
운영 DB에 적용하기 전 SQL Editor에서 트랜잭션으로 검증하고, 파일 하단의 권한 확인 쿼리를 실행한다.

특히 다음 결과가 고정 계약이다.

- `relrowsecurity = true`
- `anon`, `authenticated` 테이블 권한 없음
- `anon`, `authenticated`의 `claim_ai_relay_messages` 실행 권한 없음
- `service_role`만 테이블 DML·claim RPC 실행 가능

## 2. 서버 환경변수

Vercel Preview와 Production에 각각 설정한다. 두 토큰은 반드시 다르고 32자 이상이어야 한다.

```bash
SUPABASE_SERVICE_ROLE_KEY=...
MANABI_AI_RELAY_CLAUDE_TOKEN=<openssl rand -hex 32 결과>
MANABI_AI_RELAY_CODEX_TOKEN=<다른 openssl rand -hex 32 결과>
```

토큰은 Git·PR·로그·채팅에 쓰지 않는다. `NEXT_PUBLIC_` 접두사도 절대 붙이지 않는다.

## 3. 에이전트 환경변수

각 에이전트의 로컬 비밀 저장소에 자기 토큰만 둔다.

```bash
MANABI_AI_RELAY_URL=https://<deployment>/api/ai-relay
MANABI_AI_RELAY_TOKEN=<해당 에이전트 토큰>
```

## 4. 사용법

```bash
# 연결 확인
npm run relay -- health

# 수신 및 5분 claim
npm run relay -- pull --limit 20

# 메시지 처리 완료
npm run relay -- ack --id <message-uuid>

# 처리 실패 — 즉시 pending으로 되돌림
npm run relay -- release --id <message-uuid> --error "head mismatch"

# 인계 전송(여러 줄은 파일 사용)
npm run relay -- send \
  --to claude \
  --kind CODEX_DONE \
  --pr 151 \
  --head <40-char-sha> \
  --branch codex/example \
  --body-file /tmp/handoff.md \
  --dedupe-key codex-done:151:<40-char-sha>
```

## 5. 상태기계

1. 송신자가 `PLAN` / `WORKING` / `FREEZE` 또는 완료·요청 메시지를 보낸다.
2. 수신자는 `pull`로 claim한다.
3. 완료·검수 인계는 로컬/원격 Git head를 다시 읽고 **40자 SHA 완전 일치**를 확인한다.
4. 불일치·활성 hold면 `release`, 유효하면 처리 후 `ack`한다.
5. 최종 결과는 Relay와 GitHub 중 먼저 성공한 경로에 기록하고, GitHub에는 감사 가능한 결과 댓글을 한 번 남긴다.

기존 금지사항은 그대로다: merge·force-push·범위 밖 수정 금지, 자기 결과 메시지 무시, 같은 head 중복 처리 금지.

## 6. 자동 폴링

Claude와 Codex 자동화는 매 실행에서 Relay를 먼저 확인하고, Relay가 503·연결 실패일 때 GitHub 감시로 폴백한다.
한쪽만 Relay를 설정한 동안에도 GitHub 경로가 계속 살아 있으므로 단계적 전환이 가능하다.

운영 순서:

1. 마이그레이션·환경변수 배포
2. 양쪽 `health`
3. `INFO` 왕복 + ACK 스모크 테스트
4. 자동화에 Relay-first 적용
5. GitHub 댓글은 최종 결과·감사 기록 용도로 축소
