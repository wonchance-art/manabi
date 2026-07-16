import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const read = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  const manifest = read('--manifest');
  const queries = read('--queries');
  const output = read('--output');
  const concurrency = Number(read('--concurrency') || 3);
  if (!manifest || !queries || !output || !Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Usage: node scripts/fetch-overpass-partitions.mjs --manifest <json> --queries <dir> --output <dir> [--concurrency 3]');
  }
  return { manifest, queries, output, concurrency };
}

function validOutput(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 100) return false;
  try {
    return Array.isArray(JSON.parse(fs.readFileSync(file, 'utf8')).elements);
  } catch {
    return false;
  }
}

async function fetchQuery(endpoint, query, output) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'ManabiMapGenerator/1.0 (https://github.com/wonchance-art/manabi)',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 200);
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.elements)) throw new Error('missing elements array');
      fs.writeFileSync(output, text.endsWith('\n') ? text : `${text}\n`);
      return { output, bytes: Buffer.byteLength(text), elements: parsed.elements.length, attempt };
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Unable to fetch ${output}`);
}

export async function fetchPartitions({ manifest, queries, output, concurrency }) {
  const spec = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  fs.mkdirSync(output, { recursive: true });
  const jobs = spec.partitions.flatMap(({ id }) => ['areas', 'lines', 'structures'].map((layer) => ({
    id: `${id}-${layer}`,
    query: path.join(queries, `${id}-${layer}.query`),
    output: path.join(output, `${id}-${layer}.json`),
  })));
  const pending = jobs.filter((job) => !validOutput(job.output));
  let cursor = 0;
  const completed = [];
  const failed = [];
  const worker = async () => {
    while (cursor < pending.length) {
      const job = pending[cursor++];
      try {
        const result = await fetchQuery(spec.endpoint, fs.readFileSync(job.query, 'utf8'), job.output);
        completed.push({ id: job.id, ...result });
        console.log(`[overpass] ${job.id} ${result.elements} elements ${(result.bytes / 1_048_576).toFixed(1)} MiB attempt=${result.attempt}`);
      } catch (error) {
        failed.push({ id: job.id, error: error.message });
        console.error(`[overpass] HOLD ${job.id}: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
  return { total: jobs.length, skipped: jobs.length - pending.length, completed, failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await fetchPartitions(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    total: result.total,
    skipped: result.skipped,
    completed: result.completed.length,
    failed: result.failed,
  }));
  if (result.failed.length > 0) process.exitCode = 1;
}
