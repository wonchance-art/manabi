/**
 * 레벨 단어 화면 항목 묶음(LEVEL-LIST-RSC-001) — 빌드 때 레벨마다 하나 굽는 정적 응답. 화면 조각(RSC)에는 이 주소만 싣는다.
 * 모양 · 주소 · 캐시는 src/lib/levelWordsPayload.js, 조립은 levelListData(그 레벨 페이지와 같은 함수 · 같은 항목).
 * 영어 · 프랑스어 단어 페이지(/english|french/words)는 latinWordsData(2026-10-29 KST, 준비 검토 ②).
 * 주소의 ?h=(내용 지문)는 캐시 열쇠일 뿐 응답은 늘 이 배포의 묶음이다.
 */
import { LEVEL_LIST_LANGS, levelKinds } from '@/lib/levelList';
import { levelListData } from '@/lib/levelListData';
import { LEVEL_WORDS_CACHE, LEVEL_WORDS_VERSION } from '@/lib/levelWordsPayload';
import { latinWordParams, latinWordsData } from '@/lib/latinWordsData';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.entries(LEVEL_LIST_LANGS).flatMap(([lang, conf]) => conf.levels
    .filter((key) => levelKinds(lang, key).includes('vocab')).map((key) => ({ lang, level: key.toLowerCase() }))).concat(latinWordParams());
}

export async function GET(_request, { params }) {
  const { lang, level } = await params;
  const data = LEVEL_LIST_LANGS[lang] ? await levelListData(lang, 'vocab', level) : latinWordsData(lang, level);
  if (!data) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ version: LEVEL_WORDS_VERSION, groups: data.groups }, { headers: { 'cache-control': LEVEL_WORDS_CACHE } });
}
