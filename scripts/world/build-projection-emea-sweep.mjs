import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEmeaProjectionSweep,
  normalizeProjectionSweepManifest,
} from '../../src/lib/world/overworldProjectionSweep.js';

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function canonicalJson(value) {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function fixed(value, digits = 8) {
  return Number(value.toFixed(digits));
}

function fixedSummary(summary) {
  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Object.freeze({
    p50: fixed(value.p50),
    p95: fixed(value.p95),
    max: fixed(value.max),
  })]));
}

function resultRow(candidate) {
  return Object.freeze({
    standardLat: candidate.standardLat,
    uniformFixtureScore: fixed(candidate.uniformFixtureScore),
    maxFixtureScore: fixed(candidate.maxFixtureScore),
    region: Object.freeze({
      score: fixed(candidate.region.score),
      widthTiles: candidate.region.widthTiles,
      heightTiles: candidate.region.heightTiles,
      metrics: Object.freeze(fixedSummary(candidate.region.metrics)),
    }),
    fixtures: Object.freeze(candidate.fixtures.map((fixture) => Object.freeze({
      id: fixture.id,
      label: fixture.label,
      weight: fixture.weight,
      score: fixed(fixture.score),
      metrics: Object.freeze(fixedSummary(fixture.metrics)),
    }))),
    axisModes: candidate.axisModes,
  });
}

function metricsCsv(candidates) {
  const lines = [[
    'standardLat', 'scope', 'score', 'eastScaleErrorPct.p50', 'eastScaleErrorPct.p95',
    'eastScaleErrorPct.max', 'shapeDistortionPct.p50', 'shapeDistortionPct.p95',
    'shapeDistortionPct.max', 'screenNorthErrorDeg.p95', 'geoAxisHorizontalShare.p95',
    'widthTiles', 'heightTiles',
  ].join(',')];
  for (const candidate of candidates) {
    const scopes = [{ id: 'emea', ...candidate.region }, ...candidate.fixtures];
    for (const scope of scopes) {
      const east = scope.metrics.eastScaleErrorPct;
      const shape = scope.metrics.shapeDistortionPct;
      lines.push([
        candidate.standardLat,
        scope.id,
        fixed(scope.score),
        fixed(east.p50), fixed(east.p95), fixed(east.max),
        fixed(shape.p50), fixed(shape.p95), fixed(shape.max),
        fixed(scope.metrics.screenNorthErrorDeg.p95),
        fixed(scope.metrics.geoAxisHorizontalShare.p95),
        scope.widthTiles ?? '', scope.heightTiles ?? '',
      ].join(','));
    }
  }
  return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

function sweepSvg(candidates, recommendation) {
  const width = 1100;
  const height = 650;
  const left = 80;
  const right = 30;
  const top = 55;
  const bottom = 75;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const minLat = Math.min(...candidates.map(({ standardLat }) => standardLat));
  const maxLat = Math.max(...candidates.map(({ standardLat }) => standardLat));
  const maxScore = Math.ceil(Math.max(...candidates.flatMap((candidate) => [
    candidate.uniformFixtureScore,
    candidate.maxFixtureScore,
    candidate.region.score,
  ])) / 5) * 5;
  const x = (standardLat) => left + (standardLat - minLat) / (maxLat - minLat) * plotWidth;
  const y = (score) => top + plotHeight - score / maxScore * plotHeight;
  const pathFor = (key) => candidates.map((candidate, index) => (
    `${index === 0 ? 'M' : 'L'}${x(candidate.standardLat).toFixed(2)},${y(candidate[key]).toFixed(2)}`
  )).join('');
  const regionPath = candidates.map((candidate, index) => (
    `${index === 0 ? 'M' : 'L'}${x(candidate.standardLat).toFixed(2)},${y(candidate.region.score).toFixed(2)}`
  )).join('');
  const yGrid = Array.from({ length: maxScore / 5 + 1 }, (_, index) => {
    const value = index * 5;
    const lineY = y(value);
    return `<path d="M${left},${lineY.toFixed(2)}H${width - right}" stroke="#d7dfe1"/>`
      + `<text x="${left - 12}" y="${(lineY + 4).toFixed(2)}" text-anchor="end">${value}</text>`;
  }).join('');
  const xGrid = candidates.filter(({ standardLat }) => Number.isInteger(standardLat)).map(({ standardLat }) => (
    `<path d="M${x(standardLat).toFixed(2)},${top}V${top + plotHeight}" stroke="#edf0f1"/>`
      + `<text x="${x(standardLat).toFixed(2)}" y="${height - 42}" text-anchor="middle">${standardLat}°</text>`
  )).join('');
  const recommendX = x(recommendation.standardLat);
  return new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="EMEA equirectangular standard latitude score sweep">
<rect width="${width}" height="${height}" fill="#fff"/>
<g font-family="system-ui,sans-serif" font-size="13" fill="#3b4749">${yGrid}${xGrid}</g>
<path d="M${recommendX.toFixed(2)},${top}V${top + plotHeight}" stroke="#be4d77" stroke-width="2" stroke-dasharray="6 5"/>
<path d="${pathFor('uniformFixtureScore')}" fill="none" stroke="#246b72" stroke-width="3"/>
<path d="${pathFor('maxFixtureScore')}" fill="none" stroke="#b66b32" stroke-width="3"/>
<path d="${regionPath}" fill="none" stroke="#5c5c8d" stroke-width="3"/>
<circle cx="${recommendX.toFixed(2)}" cy="${y(recommendation.uniformFixtureScore).toFixed(2)}" r="6" fill="#be4d77"/>
<g font-family="system-ui,sans-serif" fill="#243033">
<text x="${left}" y="30" font-size="20" font-weight="700">EMEA standard-latitude sweep · lower is better</text>
<text x="${left}" y="${height - 15}" font-size="13">Equirectangular + screen-axis · standard latitude</text>
<text x="${recommendX + 9}" y="${top + 20}" font-size="13" font-weight="700" fill="#9f315d">recommend ${recommendation.standardLat}°N</text>
<text x="${width - 330}" y="28" font-size="13" fill="#246b72">━ uniform 7-fixture</text>
<text x="${width - 205}" y="28" font-size="13" fill="#b66b32">━ worst fixture</text>
<text x="${width - 90}" y="28" font-size="13" fill="#5c5c8d">━ full bbox</text>
</g>
</svg>\n`);
}

function reportMarkdown(manifest, sweep) {
  const recommendation = sweep.recommendation;
  const baseline = sweep.candidates.find(({ standardLat }) => (
    standardLat === manifest.priorBaseline.equirectangularStandardLat
  ));
  const candidates = manifest.standardLatitudeSweep.reportCandidates.map((standardLat) => (
    sweep.candidates.find((candidate) => candidate.standardLat === standardLat)
  ));
  const table = candidates.map((candidate) => (
    `| ${candidate.standardLat}°N | ${fixed(candidate.uniformFixtureScore, 2)} | ${fixed(candidate.maxFixtureScore, 2)} | ${fixed(candidate.region.metrics.eastScaleErrorPct.p95, 1)}% | ${fixed(candidate.region.metrics.shapeDistortionPct.p95, 1)}% | ${candidate.region.widthTiles}×${candidate.region.heightTiles} |`
  )).join('\n');
  const improvement = (1 - recommendation.region.score / baseline.region.score) * 100;
  return new TextEncoder().encode(`# 지역 ② 등장방형 표준위도 재평가

> 상태: **Codex 권고 — Claude 합의 전 release HOLD**  
> 범위: 지역 ② bbox와 7개 검증 권역의 등장방형 표준위도 45–55°N, 0.25° 간격. 본 지형 생성·노드·DB 변경 없음.

## 권고

- **등장방형 + screen-axis + 표준위도 ${recommendation.standardLat}°N**.
- 7개 권역 균등 점수 ${fixed(recommendation.uniformFixtureScore, 2)}, 최악 권역 점수 ${fixed(recommendation.maxFixtureScore, 2)}다.
- 기존 45°N 대비 전체 bbox 점수가 ${fixed(improvement, 1)}% 낮아진다.
- screen-axis 북쪽 이탈과 geo-axis 수평 스텝은 전 후보 모두 0이므로 두 입력 모드 모두 방향 게이트를 통과한다.
- 이전 3후보 스파이크의 Sinusoidal·LAEA는 screen-axis 방향 게이트를 실패했다. 그 결과를 바꾸지 않고,
  화면 위=북을 지키는 등장방형 안에서만 표준위도를 재조정한다.

## 대표 후보

| 표준위도 | 7권역 균등↓ | 최악 권역↓ | 전체 동서축척 P95 | 전체 형상왜곡 P95 | 격자 |
|---:|---:|---:|---:|---:|---:|
${table}

검증 권역은 이베리아, 영국 제도, 스칸디나비아, 중부 유럽, 지중해, 중동, 서부 러시아다. 콘텐츠가 아직
KR/JP로 제한되어 있으므로 임의의 미래 콘텐츠 가중치를 만들지 않고 모두 같은 가중치로 평가했다.

## 해석

표준위도는 등장방형의 전역 x축 배율만 바꾸므로 viewport별 정규화 그림은 후보 사이에서 동일하다.
따라서 이 재평가는 원시 투영 미터의 축척·형상 수치와 실제 4.5km 타일 격자 크기로 판정한다.
${recommendation.standardLat}°N은 지중해·중동의 압축과 스칸디나비아·러시아의 팽창 사이 평균 비용이 가장 낮다.
정밀 최솟값을 미관상 반올림한 값이 아니라 manifest의 0.25° 전수 탐색에서 직접 1위를 차지했다.

## 결정성

- 21×21 셀 중심 표본과 선형 보간 P50/P95/최대를 사용한다.
- 후보 순위는 \`균등 권역 점수 → 최악 권역 점수 → 표준위도\` 순으로 고정한다.
- 생성 시각·호스트·로케일을 기록하지 않으며 두 TZ/locale 출력은 byte-identical해야 한다.
- 이전 기준선은 commit \`${manifest.priorBaseline.sourceCommit}\`의
  \`${manifest.priorBaseline.reportPath}\`다.

## 다음 게이트

Claude가 ${recommendation.standardLat}°N 권고에 동의하면 지역 ② projection manifest를 고정하고, 국경·지명 없이
\`releaseEligible=false\` surface preview부터 생성한다. 불일치하면 오너 판정 전에는 본 지형을 생성하지 않는다.
`);
}

export function buildProjectionSweepArtifacts({ manifestBytes, manifest: manifestInput }) {
  const manifest = normalizeProjectionSweepManifest(manifestInput);
  const sweep = buildEmeaProjectionSweep(manifest);
  const candidates = sweep.candidates.map(resultRow);
  const ranking = sweep.ranking.map((candidate) => Object.freeze({
    standardLat: candidate.standardLat,
    uniformFixtureScore: fixed(candidate.uniformFixtureScore),
    maxFixtureScore: fixed(candidate.maxFixtureScore),
    regionScore: fixed(candidate.region.score),
  }));
  const resultsBytes = canonicalJson(Object.freeze({
    schemaVersion: manifest.schemaVersion,
    releaseEligible: false,
    regionId: manifest.regionId,
    inputManifestSha256: sha256(manifestBytes),
    recommendation: Object.freeze({
      standardLat: sweep.recommendation.standardLat,
      axisMode: 'screen-axis',
      projection: 'equirectangular',
      uniformFixtureScore: fixed(sweep.recommendation.uniformFixtureScore),
      maxFixtureScore: fixed(sweep.recommendation.maxFixtureScore),
    }),
    ranking: Object.freeze(ranking),
    candidates: Object.freeze(candidates),
  }));
  const csvBytes = metricsCsv(candidates);
  const svgBytes = sweepSvg(sweep.candidates, sweep.recommendation);
  const reportBytes = reportMarkdown(manifest, sweep);
  const payloads = [
    { path: 'metrics.csv', bytes: csvBytes, role: 'projection-sweep-metrics' },
    { path: 'report.md', bytes: reportBytes, role: 'projection-sweep-report' },
    { path: 'results.json', bytes: resultsBytes, role: 'projection-sweep-results' },
    { path: 'sweep.svg', bytes: svgBytes, role: 'projection-sweep-chart' },
  ];
  const contentManifest = Object.freeze({
    formatVersion: 1,
    schemaVersion: manifest.schemaVersion,
    releaseEligible: false,
    regionId: manifest.regionId,
    inputManifestSha256: sha256(manifestBytes),
    priorBaseline: manifest.priorBaseline,
    recommendation: Object.freeze({
      projection: 'equirectangular',
      axisMode: 'screen-axis',
      standardLat: sweep.recommendation.standardLat,
    }),
    files: Object.freeze(payloads.map((artifact) => Object.freeze({
      path: artifact.path,
      bytes: artifact.bytes.byteLength,
      sha256: sha256(artifact.bytes),
      role: artifact.role,
    }))),
  });
  return Object.freeze([
    ...payloads,
    { path: 'content-manifest.json', bytes: canonicalJson(contentManifest), role: 'content-manifest' },
  ]);
}

async function listOutputPaths(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map(({ name }) => name).sort();
  } catch {
    return [];
  }
}

export async function runProjectionSweep({ manifestPath, outputDir, check = false }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const artifacts = buildProjectionSweepArtifacts({ manifestBytes, manifest });
  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) throw new Error(`stale sweep artifact: ${artifact.path}`);
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort();
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('sweep artifact file list drifted');
    return artifacts;
  }
  await mkdir(outputDir, { recursive: true });
  await Promise.all(artifacts.map((artifact) => writeFile(path.join(outputDir, artifact.path), artifact.bytes)));
  return artifacts;
}

function parseArgs(argv) {
  const parsed = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') parsed.check = true;
    else if (value === '--manifest') parsed.manifestPath = argv[++index];
    else if (value === '--output-dir') parsed.outputDir = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  if (!parsed.manifestPath || !parsed.outputDir) throw new Error('manifestPath and outputDir are required');
  return parsed;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await runProjectionSweep(parseArgs(process.argv.slice(2)));
