#!/usr/bin/env node
/**
 * 「그림 한 장 읽기」 해설 원문 받기 · 출처 대조 (ART-P0-2). 네트워크가 필요하다 — CI·prebuild에는 걸지 않는다.
 *
 * 실행(리포 루트):
 *   node scripts/fetch-art-description.mjs aic <작품 id>       시카고 미술관 description → {text, textSha256, sourceUrl}
 *   node scripts/fetch-art-description.mjs colbase <JPS id>    ColBase 解説(재팬서치 경유) → 같은 모양
 *   node scripts/fetch-art-description.mjs --verify            카탈로그의 해설을 모두 다시 받아 text가 지금 출처와 같은지 대조
 *
 * 받은 응답 → text 변환은 src/lib/artSource.js의 artSourceText 하나뿐이다(태그 벗기기·줄바꿈 맞추기, 낱말은 그대로).
 * 출력 text를 그대로 works.json에 넣는다. 손으로 고치면 textSha256이 어긋나 artCatalog.test.js가 실패한다.
 */
import './eval/productImportHooks.mjs';

const { artSourceText, ART_SOURCES } = await import('../src/lib/artSource.js');
const { sha256Hex } = await import('../src/lib/literatureCanonical.js');

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'manabi-art-catalog/1 (educational)' } });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

async function fetchDescription(sourceKey, id) {
  const source = ART_SOURCES[sourceKey];
  if (!source) throw new Error(`모르는 출처 ${sourceKey} — ${Object.keys(ART_SOURCES).join('|')}`);
  const json = await fetchJson(source.apiUrl(id));
  const text = artSourceText(source.rawText(json));
  if (!text) throw new Error(`${sourceKey} ${id}: 해설이 비어 있다`);
  return { source: sourceKey, sourceId: String(id), sourceUrl: source.pageUrl(id, json), text, textSha256: await sha256Hex(text) };
}

if (process.argv.includes('--verify')) {
  const { ART_CATALOG } = await import('../src/content/art/index.js');
  let failed = 0;
  for (const work of ART_CATALOG.works) {
    for (const description of work.descriptions) {
      try {
        const fresh = await fetchDescription(description.source, description.sourceId);
        const same = fresh.textSha256 === description.textSha256;
        if (!same) failed += 1;
        console.log(`${same ? '✓' : '✗'} ${work.id} ${description.source}:${description.sourceId}${same ? '' : ' — 출처 해설이 바뀌었다(다시 받아 검토)'}`);
      } catch (error) {
        failed += 1;
        console.log(`✗ ${work.id} ${description.source}:${description.sourceId} — ${error.message}`);
      }
    }
  }
  process.exit(failed ? 1 : 0);
} else {
  const [sourceKey, id] = process.argv.slice(2);
  if (!sourceKey || !id) {
    console.error('사용법: node scripts/fetch-art-description.mjs <aic|colbase> <id>  |  --verify');
    process.exit(2);
  }
  console.log(JSON.stringify(await fetchDescription(sourceKey, id), null, 2));
}
