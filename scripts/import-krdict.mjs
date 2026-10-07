#!/usr/bin/env node
// 한국어기초사전(krdict) 판본 임포트 — 기본은 dry-run(읽기·검증·보고만). 라이선스 CC BY-SA 2.0 KR.
//
// 사용:
//   node scripts/import-krdict.mjs --xml <XML 디렉터리> [--release krdict-YYYYMMDD]
//   node scripts/import-krdict.mjs --jsonl <파일> --release krdict-YYYYMMDD
// 선택:
//   --source official|unofficial-copy  입력 출처(기본 unofficial-copy). official은 XML만.
//   --out <디렉터리>                   정규화 행 NDJSON·release.json·report.json 저장(DB 쓰기 아님)
//   --write                            DB 적재(service_role). official이 아니면 --allow-unofficial도 필요
//                                      (Preview 시험 전용). NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY
//                                      는 실행 셸의 기존 환경 변수에서만 읽는다(.env 파일을 열지 않는다).
//
// 보고서(stdout JSON)에는 입력 파일별 SHA-256, 이름과 무관한 입력 다이제스트, 판본, 제외 사유별
// 건수, 정규화 건수, 산출 해시(output_sha256)가 들어간다. 시각·절대 경로가 없어 같은 입력이면
// 보고서도 바이트 단위로 같다. 공식본 대조는 두 입력의 보고서(input_digest·output_sha256)를 비교한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildKrdictRows, buildReleaseRow, parseKrdictJsonl, parseKrdictXml,
  releaseFromCreationDate, sha256, writeKrdictRelease,
} from './lib/krdictImport.mjs';

const USAGE = '사용법: node scripts/import-krdict.mjs (--xml <dir> | --jsonl <file> --release krdict-YYYYMMDD) [--source official|unofficial-copy] [--out <dir>] [--write [--allow-unofficial]]';

export function parseArgs(argv) {
  const options = { source: 'unofficial-copy', write: false, allowUnofficial: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} 값이 없습니다\n${USAGE}`);
      return next;
    };
    if (arg === '--xml') options.xml = value();
    else if (arg === '--jsonl') options.jsonl = value();
    else if (arg === '--release') options.release = value();
    else if (arg === '--source') options.source = value();
    else if (arg === '--out') options.out = value();
    else if (arg === '--write') options.write = true;
    else if (arg === '--allow-unofficial') options.allowUnofficial = true;
    else throw new Error(`알 수 없는 인자: ${arg}\n${USAGE}`);
  }
  if (Boolean(options.xml) === Boolean(options.jsonl)) throw new Error(`--xml 또는 --jsonl 중 하나만 지정합니다\n${USAGE}`);
  if (options.jsonl && !options.release) throw new Error(`JSONL에는 판본 날짜가 없어 --release가 필요합니다\n${USAGE}`);
  if (options.write && options.source !== 'official' && !options.allowUnofficial) {
    throw new Error('공식본이 아닌 입력은 적재하지 않습니다(--source official 또는 Preview 시험용 --allow-unofficial)');
  }
  return options;
}

const decoder = new TextDecoder('utf-8', { fatal: true });

function readInput(file) {
  const bytes = fs.readFileSync(file);
  return { name: path.basename(file), sha256: sha256(bytes), bytes: bytes.length, text: decoder.decode(bytes) };
}

/** 입력을 읽어 { release, files, rows, report }를 만든다. 쓰기는 하지 않는다. */
export function planImport(options) {
  const stats = { controlCharsRemoved: 0, unescapedLtInAttribute: 0 };
  let files, entries, release = options.release;
  if (options.xml) {
    const names = fs.readdirSync(options.xml).filter(name => name.toLowerCase().endsWith('.xml')).sort();
    if (names.length === 0) throw new Error(`XML 파일이 없습니다: ${options.xml}`);
    files = [];
    entries = [];
    const releases = new Set();
    for (const name of names) {
      const input = readInput(path.join(options.xml, name));
      const parsed = parseKrdictXml(input.text, stats);
      releases.add(releaseFromCreationDate(parsed.creationDate));
      entries.push(...parsed.entries);
      files.push({ name: input.name, sha256: input.sha256, bytes: input.bytes });
    }
    if (releases.size !== 1) throw new Error(`파일마다 생성일이 다릅니다: ${[...releases].join(', ')}`);
    const derived = [...releases][0];
    if (release && release !== derived) throw new Error(`--release ${release}가 XML 생성일 판본 ${derived}과 다릅니다`);
    release = derived;
  } else {
    const input = readInput(options.jsonl);
    entries = parseKrdictJsonl(input.text);
    files = [{ name: input.name, sha256: input.sha256, bytes: input.bytes }];
  }
  const { rows, report } = buildKrdictRows(entries, { release });
  const releaseRow = buildReleaseRow({ release, sourceKind: options.source, inputFormat: options.xml ? 'xml' : 'jsonl', files, rows });
  return {
    releaseRow,
    rows,
    report: {
      importer: releaseRow.importer_version,
      release,
      source_kind: releaseRow.source_kind,
      input: { format: releaseRow.input_format, files: releaseRow.input_files, digest: releaseRow.input_digest },
      counts: report.counts,
      normalization: { ...report.normalization, ...stats },
      output_sha256: releaseRow.output_sha256,
    },
  };
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const plan = planImport(options);
  const report = { mode: options.write ? 'write' : 'dry-run', ...plan.report };
  if (options.out) {
    fs.mkdirSync(options.out, { recursive: true });
    fs.writeFileSync(path.join(options.out, `krdict_senses.${plan.releaseRow.id}.ndjson`), plan.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    fs.writeFileSync(path.join(options.out, `krdict_release.${plan.releaseRow.id}.json`), JSON.stringify(plan.releaseRow, null, 2) + '\n');
    fs.writeFileSync(path.join(options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (options.write) {
    const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('적재에는 NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다');
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });
    report.write = await writeKrdictRelease(client, plan);
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().then(report => {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
