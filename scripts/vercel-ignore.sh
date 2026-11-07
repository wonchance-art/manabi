#!/usr/bin/env bash
# Vercel Ignored Build Step — exit 0 = 빌드 스킵, exit 1 = 빌드 진행.
# main은 항상 빌드. 작업 브랜치는 커밋 메시지에 [preview] 태그가 있을 때만 프리뷰 빌드
# (무료 플랜 일일 배포 한도 보호 — 봇 푸시 폭주 대비).
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  exit 1
fi
# 프리뷰 전용 브랜치(claude/preview/**)는 커밋마다 빌드한다 — 그 밖의 claude/**는 vercel.json이 Git 배포 자체를 닫는다
# (건너뛴 배포도 일일 한도에 들어서, 기록을 만들고 빌드를 건너뛰는 것은 낭비다 — 2026-11-07 KST 146건 실측).
case "$VERCEL_GIT_COMMIT_REF" in
  claude/preview/*) exit 1 ;;
esac
case "$VERCEL_GIT_COMMIT_MESSAGE" in
  *"[preview]"*) exit 1 ;;
esac
exit 0
