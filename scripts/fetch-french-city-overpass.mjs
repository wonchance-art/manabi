import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassQueries } from './build-overpass-partition-queries.mjs';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function readArg(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

function completedResponse(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(value.elements) ? value.elements.length : null;
  } catch {
    return null;
  }
}

async function fetchJob(job, endpoint) {
  const existingElements = completedResponse(job.output);
  if (existingElements != null) {
    console.log(JSON.stringify({ status: 'skip', id: job.id, layer: job.layer, elements: existingElements }));
    return;
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const body = new URLSearchParams({ data: job.query });
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'manabi-city-map-builder/1.0',
        },
        body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.elements)) throw new Error('Overpass response has no elements array');
      fs.writeFileSync(job.output, text.endsWith('\n') ? text : `${text}\n`);
      console.log(JSON.stringify({
        status: 'fetched', id: job.id, layer: job.layer, attempt,
        elements: parsed.elements.length, bytes: Buffer.byteLength(text),
      }));
      return;
    } catch (error) {
      console.log(JSON.stringify({ status: 'retry', id: job.id, layer: job.layer, attempt, error: error.message }));
      if (attempt === 5) throw error;
      await sleep(Math.min(30_000, attempt * 5_000));
    }
  }
}

export async function fetchFrenchCityOverpass(manifestPath, outputDir, concurrency = 2) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(outputDir, { recursive: true });
  const jobs = manifest.partitions.flatMap(({ id, bbox }) => Object.entries(overpassQueries(bbox)).map(([layer, query]) => ({
    id,
    layer,
    query,
    output: path.join(outputDir, `${id}-${layer}.json`),
  })));
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      await fetchJob(job, manifest.endpoint);
    }
  });
  await Promise.all(workers);
  return { endpoint: manifest.endpoint, jobs: jobs.length, outputDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const manifestPath = readArg(argv, '--manifest');
  const outputDir = readArg(argv, '--output');
  const concurrency = Number(readArg(argv, '--concurrency', '2'));
  if (!manifestPath || !outputDir || !Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Usage: node scripts/fetch-french-city-overpass.mjs --manifest <partitions.json> --output <dir> [--concurrency 2]');
  }
  console.log(JSON.stringify(await fetchFrenchCityOverpass(manifestPath, outputDir, concurrency)));
}
