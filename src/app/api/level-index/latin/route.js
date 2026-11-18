/**
 * 영어 · 프랑스어 단어 → CEFR 순위 색인 — 인쇄 해석용 뜻풀이(PRINT-GLOSS-002)가 해석용을 열 때만 받는 정적 응답.
 * 줄 = [정규화 키, 순위 1–6]. 조립은 src/lib/latinLevelIndex.js(레퍼런스 어휘 정본 레지스트리).
 */
import { getVocab as getEnglishVocab } from '@/content/english';
import { getVocab as getFrenchVocab } from '@/content/french';
import { latinLevelRows } from '@/lib/latinLevelIndex';

export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ version: 1, en: latinLevelRows(getEnglishVocab, 'en'), fr: latinLevelRows(getFrenchVocab, 'fr') },
    { headers: { 'cache-control': 'public, max-age=3600' } });
}
