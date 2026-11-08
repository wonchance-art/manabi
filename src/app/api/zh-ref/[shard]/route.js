/**
 * 중국어 참고 사전 조각(ZH-REFVOCAB-SHARD-001) — 빌드 때 조각마다 하나 굽는 정적 응답. 모양 · 주소 · 캐시는 src/lib/zhRefShards.js,
 * 색인은 화면과 같은 파일 목록 · 규칙(src/lib/zhRefVocabSets.js). 주소의 ?v=(배포 판)는 캐시 열쇠일 뿐 응답은 늘 이 배포의 조각이다.
 */
import { buildVocabIndex, loadZhRefVocabSets } from '@/lib/zhRefVocabSets';
import { ZH_REF_CACHE, ZH_REF_SHARDS, ZH_REF_VERSION, zhRefShardEntries } from '@/lib/zhRefShards';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: ZH_REF_SHARDS }, (_, i) => ({ shard: String(i) }));
}

let indexPromise = null;

export async function GET(_request, { params }) {
  const { shard } = await params;
  const n = Number(shard);
  if (!Number.isInteger(n) || n < 0 || n >= ZH_REF_SHARDS) return Response.json({ error: 'not found' }, { status: 404 });
  indexPromise ||= loadZhRefVocabSets().then(buildVocabIndex);
  const entries = zhRefShardEntries(await indexPromise, n);
  return Response.json({ version: ZH_REF_VERSION, shard: n, entries }, { headers: { 'cache-control': ZH_REF_CACHE } });
}
