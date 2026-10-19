/**
 * HSK 단어 페이지 찾기 색인(전 레벨 사전) — 화면이 처음 찾기를 열 때만 받는 정적 응답.
 * 줄 모양 · 찾기 규칙은 src/lib/levelWordIndex.js, 조립은 levelListData.chineseLevelIndex(목록과 같은 사전 · 급수 표).
 */
import { chineseLevelIndex } from '@/lib/levelListData';

export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ version: 1, rows: await chineseLevelIndex() }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
