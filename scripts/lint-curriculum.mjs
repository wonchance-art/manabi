#!/usr/bin/env node
// P11 저작 자동 게이트 (챕터 제작 원칙 v1 §5): (a) 레벨 내 order 유일·연속 (b) prerequisites 실존·비순환.
// 적용 수위: fr A1~A2 = 오류(exit 1), 그 외 트랙·레벨 = report-only 경고.
// lint-content.mjs와 같은 텍스트 파싱 방식(콘텐츠 모듈은 확장자 없는 import라 plain node로 로드 불가).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const TRACK_NAMES = ['chinese', 'english', 'french', 'japanese'];
const ENFORCED = { french: new Set(['A1', 'A2']) };

function parseChapters(source, fname) {
  const chapters = [];
  const slugRe = /^\s+slug: "([^"]+)",\s*$/gm;
  const marks = [];
  let m;
  while ((m = slugRe.exec(source)) !== null) marks.push({ slug: m[1], at: m.index });
  for (let i = 0; i < marks.length; i += 1) {
    const seg = source.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : source.length);
    const level = seg.match(/level: "([^"]+)"/)?.[1];
    const orderRaw = seg.match(/order: (\d+)/)?.[1];
    const prereqRaw = seg.match(/prerequisites: \[([^\]]*)\]/)?.[1] ?? '';
    const prerequisites = [...prereqRaw.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    chapters.push({
      slug: marks[i].slug,
      level,
      order: orderRaw === undefined ? undefined : Number(orderRaw),
      prerequisites,
      file: fname,
    });
  }
  return chapters;
}

async function parseSlugAliases() {
  try {
    const src = await fs.readFile(path.join(REPO_ROOT, 'src/lib/world/storageSchema.js'), 'utf8');
    const block = src.match(/slugAliases\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const map = {};
    for (const pair of block.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) map[pair[1]] = pair[2];
    return map;
  } catch {
    return {};
  }
}

export async function runCurriculumLint() {
  const errors = [];
  const warnings = [];
  const aliases = await parseSlugAliases();

  for (const track of TRACK_NAMES) {
    const dir = path.join(REPO_ROOT, `src/content/${track}/grammar`);
    let files;
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.js'));
    } catch {
      warnings.push(`${track}: grammar 디렉터리 없음 — 생략`);
      continue;
    }
    const all = [];
    for (const f of files.sort()) {
      all.push(...parseChapters(await fs.readFile(path.join(dir, f), 'utf8'), f));
    }
    const enforcedLevels = ENFORCED[track] ?? new Set();
    const report = (level, msg) => {
      (enforcedLevels.has(level) ? errors : warnings).push(`${track}/${level ?? '?'}: ${msg}`);
    };

    const byLevel = new Map();
    for (const ch of all) {
      if (!byLevel.has(ch.level)) byLevel.set(ch.level, []);
      byLevel.get(ch.level).push(ch);
    }

    // (a) order 유일·연속(1..n)
    for (const [level, chapters] of byLevel) {
      const orders = chapters.filter((c) => c.order !== undefined).map((c) => c.order);
      if (orders.length === 0) continue;
      if (enforcedLevels.has(level) && orders.length !== chapters.length) {
        const missing = chapters.filter((c) => c.order === undefined).map((c) => c.slug);
        report(level, `order 누락: ${missing.join(', ')}`);
      }
      const seen = new Set();
      for (const c of chapters) {
        if (c.order === undefined) continue;
        if (seen.has(c.order)) report(level, `order 중복 ${c.order}: ${c.slug}`);
        seen.add(c.order);
      }
      if (enforcedLevels.has(level)) {
        const max = Math.max(...orders);
        for (let i = 1; i <= max; i += 1) {
          if (!seen.has(i)) report(level, `order 결번 ${i} (1..${max} 연속 요구)`);
        }
      }
    }

    // (b) prerequisites 실존·비순환
    const slugSet = new Set(all.map((c) => c.slug));
    const levelOf = new Map(all.map((c) => [c.slug, c.level]));
    const edges = new Map();
    for (const ch of all) {
      const resolved = [];
      for (const raw of ch.prerequisites) {
        const target = slugSet.has(raw) ? raw : aliases[raw];
        if (!target || !slugSet.has(target)) {
          report(ch.level, `${ch.slug} → prerequisites 미해결 slug: ${raw}`);
        } else {
          resolved.push(target);
        }
      }
      edges.set(ch.slug, resolved);
    }
    const state = new Map();
    const stack = [];
    const dfs = (slug) => {
      state.set(slug, 1);
      stack.push(slug);
      for (const next of edges.get(slug) ?? []) {
        const s = state.get(next) ?? 0;
        if (s === 1) {
          report(levelOf.get(slug), `prerequisites 순환: ${[...stack.slice(stack.indexOf(next)), next].join(' → ')}`);
        } else if (s === 0) {
          dfs(next);
        }
      }
      stack.pop();
      state.set(slug, 2);
    };
    for (const slug of edges.keys()) if ((state.get(slug) ?? 0) === 0) dfs(slug);
  }

  return { errors, warnings };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { errors, warnings } = await runCurriculumLint();
  for (const w of warnings) console.warn(`warn: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(`curriculum lint: ${TRACK_NAMES.length} tracks, ${errors.length} errors, ${warnings.length} warnings`);
  if (errors.length > 0) process.exit(1);
}
