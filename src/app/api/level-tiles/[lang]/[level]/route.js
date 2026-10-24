/**
 * 레벨 단어 페이지 글자 칸 묶음 — 화면이 붙은 뒤 받는 정적 응답(빌드 때 레벨마다 하나). 모양 · 되살리기는 src/lib/levelCharTiles.js(levelTilePack · levelPackTiles),
 * 조립은 levelListData.levelCharTilePack(목록과 같은 단어 · 같은 칸 계산). 묶음에 없는 단어만 화면이 표 네 벌을 받아 계산한다.
 */
import { LEVEL_LIST_LANGS } from '@/lib/levelList';
import { levelCharTilePack } from '@/lib/levelListData';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.entries(LEVEL_LIST_LANGS).flatMap(([lang, conf]) => conf.levels.map((key) => ({ lang, level: key.toLowerCase() })));
}

export async function GET(_request, { params }) {
  const { lang, level } = await params;
  const pack = LEVEL_LIST_LANGS[lang] ? await levelCharTilePack(lang, level) : null;
  if (!pack) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ version: 1, ...pack }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
