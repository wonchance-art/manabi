import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

import { synthProcessedJson } from './synth.mjs';

// 앱 모듈은 번들러 관례의 확장자 없는 import를 쓴다. 소스를 손대지 않고 Vite의 SSR
// 로더로 동일 모듈을 읽어, 이 파일 자체는 평범한 `node` 명령으로 실행 가능하게 한다.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const [{ gradeDictation }, { pickDictationSentences }, { materialFit }, { pickOutputWords }] = await Promise.all([
  vite.ssrLoadModule('/src/lib/dictation.js'),
  vite.ssrLoadModule('/src/lib/dictationPick.js'),
  vite.ssrLoadModule('/src/lib/materialFit.js'),
  vite.ssrLoadModule('/src/lib/outputWords.js'),
]);

const ROOT = new URL('../../', import.meta.url);
const NOW = Date.parse('2026-08-24T03:00:00.000Z');

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function measure(name, operation, iterations = 25) {
  const times = [];
  const heaps = [];
  await operation();
  for (let index = 0; index < iterations; index += 1) {
    global.gc?.();
    const beforeHeap = process.memoryUsage().heapUsed;
    const started = performance.now();
    await operation();
    times.push(performance.now() - started);
    heaps.push(Math.max(0, process.memoryUsage().heapUsed - beforeHeap) / 1024);
  }
  times.sort((a, b) => a - b);
  heaps.sort((a, b) => a - b);
  return {
    name,
    medianMs: percentile(times, 0.5),
    p95Ms: percentile(times, 0.95),
    medianHeapKiB: percentile(heaps, 0.5),
    p95HeapKiB: percentile(heaps, 0.95),
  };
}

const fixtures = [5_000, 20_000].map((size) => [size, synthProcessedJson(size)]);
const saved = {
  surfaces: new Set(Object.values(fixtures[1][1].dictionary).slice(0, 2000).map((token) => token.text)),
  bases: new Set(Object.values(fixtures[1][1].dictionary).slice(0, 2000).map((token) => token.base_form)),
};
const vocabRows = Array.from({ length: 5000 }, (_, index) => ({
  id: index,
  word_text: `word-${index}`,
  meaning: `meaning-${index}`,
  language: 'Japanese',
  last_reviewed_at: new Date(NOW - (index % 1000)).toISOString(),
}));
const events = vocabRows.map((row, index) => ({
  event_type: 'review', correct: index % 4 !== 0, created_at: row.last_reviewed_at,
  detail: { word_id: row.id },
}));
const expected = '학습 문장을 반복하여 기억하는 과정입니다. '.repeat(25);
const typed = expected.replace(/과정/g, '과졍').replace(/반복/g, '복습');
const hanjaUrls = ['hanjaKo.json', 'hanjaHun.json', 'hanjaJa.json']
  .map((name) => new URL(`src/lib/data/${name}`, ROOT));

const cases = [];
for (const [size, fixture] of fixtures) {
  cases.push([`materialFit (${size.toLocaleString()} tokens)`, () => materialFit(fixture, saved)]);
}
cases.push(
  ['gradeDictation/diffChars (1K chars)', () => gradeDictation(expected, typed, 'Korean')],
  ['pickOutputWords (5K rows/events)', () => pickOutputWords({ vocabRows, events, language: 'Japanese', now: NOW })],
  ['pickDictationSentences (2K lines)', () => pickDictationSentences({ lines: fixtures[1][1].lines, savedSet: saved.surfaces })],
  ['hanja loader (3 JSON read+parse)', async () => Promise.all(hanjaUrls.map(async (url) => JSON.parse(await readFile(url, 'utf8'))))],
);

console.log(`manabi engine bench | ${process.version} | ${process.platform} ${process.arch} | gc=${global.gc ? 'exposed' : 'not exposed'}`);
console.log('case\tmedian ms\tp95 ms\tmedian heap KiB\tp95 heap KiB');
for (const [name, operation] of cases) {
  const row = await measure(name, operation);
  console.log(`${row.name}\t${row.medianMs.toFixed(3)}\t${row.p95Ms.toFixed(3)}\t${row.medianHeapKiB.toFixed(1)}\t${row.p95HeapKiB.toFixed(1)}`);
}
if (!global.gc) console.log('note: heap deltas are noisier; rerun with node --expose-gc scripts/bench/run.mjs');
await vite.close();
