/**
 * 목표 과정 목록 (LEARN-HOME-AK-001) — 배움 · 현황의 진행바와 목표 편집이 쓰는 정본 투영.
 *
 * 홈 페이지는 발행 교재의 작은 카탈로그만 받는다(performanceRepairs P4). 목표 진행바에 필요한
 * 레퍼런스 과정 목록(레벨 · 과 slug)은 목표가 있는 사람에게만 필요하므로, 페이지에 싣지 않고
 * 이 정적 응답을 필요할 때만 받는다.
 */
import { buildContinueManifest } from '@/content/refManifest';
import { goalCatalog } from '@/lib/goalCatalog';

export const dynamic = 'force-static';

export async function GET() {
  return Response.json(goalCatalog(buildContinueManifest()), { headers: { 'cache-control': 'public, max-age=3600' } });
}
