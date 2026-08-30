/**
 * 배포 버전 조회 (v2-J 버전 배지, #1077 — 오너 발안·확정 2026-08-27).
 *
 * 이 라우트는 **요청 시점의 서버 env**를 읽는다 — next.config의 `env` 매핑(빌드 시점
 * 인라인)을 거치지 않으므로, 클라이언트 번들에 굳어 있는 NEXT_PUBLIC_BUILD_SHA와
 * 값이 갈릴 수 있다. 그 불일치가 곧 "브라우저·SW가 옛 번들을 서빙 중"(설계 Q2)이다.
 *
 * 정적 version.json이 아니라 라우트여야 하는 이유도 같다: 파일은 CDN·SW 캐시를 타서
 * 스테일 진단에 쓸 수 없다. no-store로 매 요청 실값을 준다(계약 3).
 * 커밋 메시지는 싣지 않는다 — SHA·브랜치·시각만(계약 1).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      sha: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev',
      ref: process.env.VERCEL_GIT_COMMIT_REF || 'local',
      at: process.env.VERCEL_DEPLOYMENT_AT || null,
    },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  );
}
