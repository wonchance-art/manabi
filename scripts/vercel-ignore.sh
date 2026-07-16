#!/usr/bin/env bash
# Vercel Ignored Build Step — exit 0 = 빌드 스킵, exit 1 = 빌드 진행.
# main은 항상 빌드. 작업 브랜치는 커밋 메시지에 [preview] 태그가 있을 때만 프리뷰 빌드
# (무료 플랜 일일 배포 한도 보호 — 봇 푸시 폭주 대비).
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  exit 1
fi
case "$VERCEL_GIT_COMMIT_MESSAGE" in
  *"[preview]"*) exit 1 ;;
esac
exit 0
