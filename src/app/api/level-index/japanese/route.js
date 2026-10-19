/**
 * JLPT 단어 페이지 찾기 색인(전 레벨 사전) — 화면이 처음 찾기를 열 때만 받는 정적 응답.
 * 줄 모양 · 찾기 규칙은 src/lib/levelWordIndex.js(mode 'ja'), 조립은 levelListData.japaneseLevelIndex(목록과 같은 단어 · 짧은 뜻).
 */
import { japaneseLevelIndex } from '@/lib/levelListData';

export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ version: 1, rows: await japaneseLevelIndex() }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
