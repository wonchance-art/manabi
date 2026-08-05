#!/usr/bin/env node
// P11 저작 자동 게이트 (챕터 제작 원칙 v1 §5):
//  (a) 레벨 내 order 유일·연속  (b) prerequisites 실존·비순환
//  (c) 선행 순서 — prerequisites 챕터가 레벨·order상 실제로 앞에 있는지(fr A1~A2 fail).
//      ※ '사용 문형의 의미적 커버'까지는 자동화하지 않는다(감사 몫) — 여기서는 순서 위반만 기계 검출.
//  (d) 레벨 어휘 대조 — 챕터 fr 문장 토큰을 레벨 누적 vocab 팩과 대조(report-only 통계.
//      굴절형·표제어 차이로 오탐이 있어 게이트로 쓰지 않는다. 기능어 스톱리스트 + 조야한 어간 매칭)
// 적용 수위: fr A1~A2 = (a)(b)(c) 오류(exit 1), (f) 드릴 비중복 = 4트랙 모두 오류,
//             (d)와 그 외 트랙·레벨 = report-only 경고.
// lint-content.mjs와 같은 텍스트 파싱 방식(콘텐츠 모듈은 확장자 없는 import라 plain node로 로드 불가).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const TRACK_NAMES = ['chinese', 'english', 'french', 'japanese'];
const ENFORCED = { french: new Set(['A1', 'A2']) };

// 앵커에 '{'를 포함하는 이유: 예문·샘플은 전부 `{ zh: "…", ko: "…" }` 형태라 첫 필드가
// 여는 중괄호 뒤에 온다. `(?:^|,)`만 쓰면 그 첫 필드가 통째로 누락돼 (f)의 '챕터 예문과 동일'
// 검사가 조용히 죽는다(실측: h2-01 세그먼트 예문 12건 → 0건). 아래 회귀 테스트가 이를 고정한다.
function stringPropertyPattern(key, flags = '') {
  return new RegExp(`(?:^|[,{])\\s*["']?${key}["']?\\s*:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`, flags);
}

function decodeQuoted(raw = '') {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\(["'\\])/g, '$1');
}

function readStringProperty(source, key) {
  const match = stringPropertyPattern(key, 'm').exec(source);
  return match ? decodeQuoted(match[1] ?? match[2]) : undefined;
}

function readAllStringProperties(source, keys) {
  const keyPattern = keys.join('|');
  const re = new RegExp(`(?:^|[,{])\\s*["']?(?:${keyPattern})["']?\\s*:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`, 'gm');
  return [...source.matchAll(re)].map((match) => decodeQuoted(match[1] ?? match[2]));
}

function findBalancedEnd(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`닫히지 않은 ${open}${close} 블록 (offset ${start})`);
}

function findArrayProperty(source, key) {
  const property = new RegExp(`["']?${key}["']?\\s*:`).exec(source);
  if (!property) return null;
  const start = source.indexOf('[', property.index + property[0].length);
  if (start < 0) throw new Error(`${key} 배열 시작 '[' 누락`);
  const end = findBalancedEnd(source, start, '[', ']');
  return source.slice(start + 1, end);
}

function topLevelObjects(arraySource) {
  const objects = [];
  let i = 0;
  while (i < arraySource.length) {
    if (arraySource[i] !== '{') { i += 1; continue; }
    const end = findBalancedEnd(arraySource, i, '{', '}');
    objects.push(arraySource.slice(i + 1, end));
    i = end + 1;
  }
  return objects;
}

function chapterMarks(source) {
  const slugLine = /^\s*["']?slug["']?\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,?/gm;
  return [...source.matchAll(slugLine)].map((match) => ({
    slug: decodeQuoted(match[1] ?? match[2]),
    at: match.index,
  }));
}

export function parseChapters(source, fname) {
  const chapters = [];
  const marks = chapterMarks(source);
  for (let i = 0; i < marks.length; i += 1) {
    const seg = source.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : source.length);
    const level = readStringProperty(seg, 'level');
    const orderRaw = /(?:^|,)\s*["']?order["']?\s*:\s*(\d(?:_?\d)*)/m.exec(seg)?.[1];
    const prereqRaw = findArrayProperty(seg, 'prerequisites') ?? '';
    const prerequisites = [...prereqRaw.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)]
      .map((match) => decodeQuoted(match[1] ?? match[2]));
    chapters.push({
      slug: marks[i].slug,
      level,
      order: orderRaw === undefined ? undefined : Number(orderRaw.replaceAll('_', '')),
      prerequisites,
      file: fname,
    });
  }
  return chapters;
}

export function parseDrillItems(source) {
  const drills = findArrayProperty(source, 'drills');
  if (drills === null) return [];
  return topLevelObjects(drills).flatMap((body) => {
    const id = readStringProperty(body, 'id') ?? '?';
    const type = readStringProperty(body, 'type') ?? '?';
    let sentence;
    if (type === 'order' || type === 'dictation') sentence = readStringProperty(body, 'sentence');
    else if (type === 'fill') {
      const prompt = readStringProperty(body, 'prompt');
      const answer = readStringProperty(body, 'answer');
      if (prompt && answer) sentence = prompt.replace('___', answer);
    } else if (type === 'choice') sentence = readStringProperty(body, 'answer');
    return sentence ? [{ id, sentence }] : [];
  });
}

export async function scanDrillDuplicates({ repoRoot = REPO_ROOT, trackNames = TRACK_NAMES } = {}) {
  const errors = [];
  const normSent = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const track of trackNames) {
    try {
      const gdir = path.join(repoRoot, `src/content/${track}/grammar`);
      const gfiles = (await fs.readdir(gdir)).filter((file) => file.endsWith('.js')).sort();
      const globalSeen = new Map();
      for (const file of gfiles) {
        const source = await fs.readFile(path.join(gdir, file), 'utf8');
        const marks = chapterMarks(source);
        for (let i = 0; i < marks.length; i += 1) {
          const segment = source.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : source.length);
          const chapterSentences = new Set(readAllStringProperties(segment, ['fr', 'zh', 'en', 'ja']).map(normSent));
          const local = new Set();
          for (const item of parseDrillItems(segment)) {
            const sentence = normSent(item.sentence);
            const label = `${marks[i].slug}:${item.id}`;
            if (chapterSentences.has(sentence)) errors.push(`${track} 드릴 중복(챕터 예문과 동일): ${label} — "${sentence}"`);
            if (local.has(sentence)) errors.push(`${track} 드릴 중복(챕터 내): ${label} — "${sentence}"`);
            local.add(sentence);
            if (globalSeen.has(sentence)) errors.push(`${track} 드릴 중복(챕터 간): ${label} ↔ ${globalSeen.get(sentence)}`);
            else globalSeen.set(sentence, label);
          }
        }
      }
    } catch (error) {
      errors.push(`드릴 비중복 게이트 실패 [${track}]: ${error.message}`);
    }
  }
  return errors;
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
    // (c) 선행 순서 — prerequisite가 레벨·order상 앞서는지 (fr 강제)
    const LEVEL_RANK = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, N5: 1, N4: 2, N3: 3, N2: 4, N1: 5, H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };
    const orderOf = new Map(all.map((c) => [c.slug, c.order]));
    for (const ch of all) {
      for (const target of edges.get(ch.slug) ?? []) {
        const chRank = LEVEL_RANK[ch.level];
        const tRank = LEVEL_RANK[levelOf.get(target)];
        if (chRank === undefined || tRank === undefined) continue;
        if (tRank > chRank) {
          report(ch.level, `${ch.slug} → 선행(${target})이 상위 레벨`);
        } else if (tRank === chRank) {
          const co = orderOf.get(ch.slug);
          const to = orderOf.get(target);
          if (co !== undefined && to !== undefined && to >= co) {
            report(ch.level, `${ch.slug}(order ${co}) → 선행(${target}, order ${to})이 뒤에 배치됨`);
          }
        }
      }
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

  // (f) 드릴 비중복 게이트 (RFC learning-path §2 — 4트랙 모두 hard fail)
  //  드릴 문장(sentence·choice 정답·fill 완성문)은 ① 같은 챕터의 학습 언어 문자열
  //  ② 같은 챕터 다른 드릴 ③ 다른 챕터의 드릴과 문장 단위로 겹치지 않아야 한다.
  //  트랙 하나가 I/O·파싱에 실패해도 뒤 트랙 검사는 계속하되, scanner 실패 자체는 errors로 승격한다.
  errors.push(...await scanDrillDuplicates());

  // (e′) bunkei 레벨 간 중복 키 감시 (report-only — 정리 라운드 재발 탐지)
  // 기준선(2026-07-30 정리 완료 시점 실측): ja 31(정당 재도입 keeper — 경어·ながら 등)·zh 1·en 2·fr 0.
  // 수치가 기준선을 넘어 늘면 신규 중복 유입 신호다. 팩-챕터 레벨 일치 검사는 도입하지 않는다
  // — ch 교차 링크는 설계상 일반적(전 트랙 35~40%)임이 실측됨.
  try {
    const norm = (s) => s.replace(/[\s〜~…·]|[（(][^）)]*[)）]/g, '');
    for (const track of TRACK_NAMES) {
      const bdir = path.join(REPO_ROOT, `src/content/${track}/bunkei`);
      let files;
      try {
        files = (await fs.readdir(bdir)).filter((f) => f.endsWith('.js'));
      } catch { continue; }
      const seen = new Map();
      for (const f of files.sort()) {
        const src = await fs.readFile(path.join(bdir, f), 'utf8');
        for (const m of src.matchAll(/pattern: "([^"]+)"/g)) {
          const k = norm(m[1]);
          if (!seen.has(k)) seen.set(k, new Set());
          seen.get(k).add(f);
        }
      }
      const dup = [...seen.values()].filter((s) => s.size > 1).length;
      warnings.push(`${track}/bunkei: 레벨 간 중복 키 ${dup}건 (기준선 초과 시 신규 유입 의심)`);
    }
  } catch (e) {
    warnings.push(`bunkei 중복 감시 실패: ${e}`);
  }

  // (d) fr 레벨 어휘 대조 (report-only)
  try {
    const vocabDir = path.join(REPO_ROOT, 'src/content/french/vocab');
    const headwords = async (files) => {
      const set = new Set();
      for (const f of files) {
        const src = await fs.readFile(path.join(vocabDir, f), 'utf8');
        for (const m of src.matchAll(/"?fr"?: "([^"]+)"/g)) {
          for (const w of m[1].toLowerCase().split(/[^a-zà-ÿœç'-]+/)) {
            const ww = w.replace(/^(l|d|j|n|s|c|qu|m|t)'/, '');
            if (ww.length > 2) set.add(ww);
          }
        }
      }
      return set;
    };
    const STOP = new Set(('le la les un une des de du au aux et ou où à en sur dans pour par avec sans est sont suis es êtes sommes était étais ai as avons avez ont ne pas plus que qui quoi mais donc car se me te nous vous ils elles il elle je tu on ce cette ces cet mon ma mes ton ta tes son sa ses notre votre leur leurs y si très bien oui non plaît tout toute tous toutes celui celle ceux celles kim minji junho emma léo thomas camille léa théo paul marie mina quel quelle quels quelles comme aussi alors voici voilà').split(' '));
    const grammarDir = path.join(REPO_ROOT, 'src/content/french/grammar');
    const levelFiles = {
      A1: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js'], grammar: ['a1.js', 'a1_expansion.js', 'a1_pronunciation.js', 'a1_sandwich_pilot.js', 'scene_travel.js', 'scene_emergency.js'] },
      A2: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js', 'a2.js', 'a2_flelex.js'], grammar: ['a2.js', 'a2_scenes.js'] },
      B1: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js', 'a2.js', 'a2_flelex.js', 'b1.js', 'b1_flelex.js', 'b1_flelex2.js'], grammar: ['b1.js'] },
      B2: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js', 'a2.js', 'a2_flelex.js', 'b1.js', 'b1_flelex.js', 'b1_flelex2.js', 'b2.js', 'b2_flelex.js', 'b2_flelex2.js'], grammar: ['b2.js'] },
      C1: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js', 'a2.js', 'a2_flelex.js', 'b1.js', 'b1_flelex.js', 'b1_flelex2.js', 'b2.js', 'b2_flelex.js', 'b2_flelex2.js', 'c1.js', 'c1_flelex.js'], grammar: ['c1.js'] },
      C2: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js', 'a2.js', 'a2_flelex.js', 'b1.js', 'b1_flelex.js', 'b1_flelex2.js', 'b2.js', 'b2_flelex.js', 'b2_flelex2.js', 'c1.js', 'c1_flelex.js', 'c2.js', 'c2_flelex.js'], grammar: ['c2.js'] },
    };
    const grammarIntroFiles = { A1: ['a1_sandwich_pilot.js', 'scene_travel.js', 'scene_emergency.js'], A2: ['a1_sandwich_pilot.js', 'scene_travel.js', 'scene_emergency.js', 'a2_scenes.js'] };
    for (const [level, cfg] of Object.entries(levelFiles)) {
      const inventory = await headwords(cfg.vocab);
      // 챕터 vocabPreview로 도입된 단어도 레벨 자산으로 인정(누적)
      for (const f of grammarIntroFiles[level] ?? []) {
        const src = await fs.readFile(path.join(grammarDir, f), 'utf8');
        for (const m of src.matchAll(/word: "([^"]+)"/g)) {
          for (const w of m[1].toLowerCase().split(/[^a-zà-ÿœç'-]+/)) {
            const ww = w.replace(/^(l|d|j|n|s|c|qu|m|t)'/, '');
            if (ww.length > 2) inventory.add(ww);
          }
        }
      }
      const counts = new Map();
      for (const f of cfg.grammar) {
        const src = await fs.readFile(path.join(grammarDir, f), 'utf8');
        for (const m of src.matchAll(/fr: "((?:[^"\\]|\\.)*)"/g)) {
          for (const raw of m[1].toLowerCase().split(/[^a-zà-ÿœç'-]+/)) {
            const w = raw.replace(/^(l|d|j|n|s|c|qu|m|t)'/, '').replace(/-.*$/, '');
            if (w.length <= 2 || STOP.has(w)) continue;
            counts.set(w, (counts.get(w) ?? 0) + 1);
          }
        }
      }
      // 불규칙 어간 활용형(futur simple·과거분사 등)은 어간이 달라 stem 매칭이 못 잇는다.
      // 해당 문형 챕터(A2 futur·passé composé)가 직접 가르치는 형태이므로, 원형이 등재된
      // 경우에 한해 문법 챕터 자산으로 간주해 커버로 센다.
      const GRAMMAR_FORM_LEMMA = {
        sera: 'être', serai: 'être', fera: 'faire', ferai: 'faire',
        ira: 'aller', irai: 'aller', irons: 'aller', iront: 'aller',
        allé: 'aller', allée: 'aller', allés: 'aller', allées: 'aller',
        ayez: 'avoir', vus: 'voir', vue: 'voir',
        veut: 'vouloir', venons: 'venir', devez: 'devoir', doit: 'devoir',
        levons: 'lever',
        // 접속법·조건법·단순과거 등 — 해당 문법 챕터가 직접 가르치는 활용형
        fasse: 'faire', fasses: 'faire', sois: 'être', soient: 'être', soyez: 'être',
        ait: 'avoir', aies: 'avoir', ayons: 'avoir', eût: 'avoir', fût: 'être', fusse: 'être',
        étions: 'être', irais: 'aller', iront: 'aller', dira: 'dire', mit: 'mettre',
        leva: 'lever', naquit: 'naître', buvais: 'boire', jouais: 'jouer', veulent: 'vouloir',
        auriez: 'avoir', pleuve: 'pleuvoir', vienne: 'venir', vînt: 'venir', partît: 'partir',
      };
      const stemHit = (w) => {
        if (inventory.has(w)) return true;
        const lemma = GRAMMAR_FORM_LEMMA[w];
        if (lemma && inventory.has(lemma)) return true;
        const stem = w.slice(0, Math.max(4, w.length - 3));
        for (const h of inventory) {
          if (h.startsWith(stem) || w.startsWith(h.slice(0, Math.max(4, h.length - 3)))) return true;
        }
        return false;
      };
      let hit = 0;
      let miss = 0;
      const misses = [];
      for (const [w, n] of counts) {
        if (stemHit(w)) hit += n;
        else { miss += n; misses.push([w, n]); }
      }
      const pct = hit + miss > 0 ? Math.round((hit / (hit + miss)) * 100) : 100;
      misses.sort((x, y2) => y2[1] - x[1]);
      warnings.push(`french/${level}: 어휘 커버 ${pct}% (토큰 ${hit + miss}) — 미등재 상위: ${misses.slice(0, 8).map(([w, n]) => `${w}(${n})`).join(' ')}`);
    }
  } catch (e) {
    warnings.push(`french 어휘 대조 실패: ${e}`);
  }

  // (g) 레벨 간 동일 예문 감시 (fr) — 프리뷰→본편 재노출은 참조 표기가 정석(P13).
  // 무표기 재사용 신규 유입을 잡기 위한 report-only 기준선 감시. 기준선 = 2026-07-30 수리 후 실측.
  {
    const XLEVEL = {
      A0: ['a0.js'],
      A1: ['a1.js', 'a1_expansion.js', 'a1_pronunciation.js', 'a1_sandwich_pilot.js', 'scene_travel.js', 'scene_emergency.js'],
      A2: ['a2.js', 'a2_scenes.js'],
    };
    const XBASE = { 'A0↔A1': 5, 'A0↔A2': 0, 'A1↔A2': 0 };
    const grammarDir = path.join(REPO_ROOT, 'src/content/french/grammar');
    const norm = (x) => x.trim().replace(/[?!.…]+$/u, '').toLowerCase();
    const sets = {};
    for (const [lv, files] of Object.entries(XLEVEL)) {
      const set = new Set();
      for (const f of files) {
        const src = await fs.readFile(path.join(grammarDir, f), 'utf8');
        for (const m of src.matchAll(/fr: "((?:[^"\\]|\\.)*)"/g)) {
          const k = norm(m[1]);
          if (k.length > 3) set.add(k);
        }
      }
      sets[lv] = set;
    }
    for (const pair of [['A0', 'A1'], ['A0', 'A2'], ['A1', 'A2']]) {
      const key = `${pair[0]}↔${pair[1]}`;
      const inter = [...sets[pair[0]]].filter((k) => sets[pair[1]].has(k));
      if (inter.length > (XBASE[key] ?? 0)) {
        warnings.push(`french/${key}: 레벨 간 동일 예문 ${inter.length}건 (기준선 ${XBASE[key]}) — 신규 유입 의심: ${inter.slice(0, 5).join(' | ')}`);
      }
    }
  }

  // (h) zh 병음 정합 게이트 — zh·pinyin 쌍 전수: 허용 문자 + 한자 수↔음절 수(모음 그룹 산식, 儿화 보정).
  // 모음 시작 음절 앞 아포스트로피(정서법 표기)를 분리자로 신뢰한다 — 누락하면 음절 수가 어긋나 적발된다.
  // zh에 라틴 문자가 섞인 메타 표기(A比B 등)는 판정 불가라 건너뛴다.
  try {
    const zdir = path.join(REPO_ROOT, 'src/content/chinese');
    const zfiles = [];
    for (const sub of ['grammar', 'bunkei', 'vocab']) {
      const d = path.join(zdir, sub);
      let names = [];
      try {
        names = await fs.readdir(d);
      } catch {
        continue;
      }
      for (const f of names) if (f.endsWith('.js')) zfiles.push(path.join(d, f));
    }
    const VOW = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
    const vowRun = new RegExp(`[${VOW}]+`, 'g');
    const okChars = new RegExp(`^[a-z${VOW}]*$`);
    for (const file of zfiles) {
      const src = await fs.readFile(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      const re = /zh: "((?:[^"\\]|\\.)*)",\s*pinyin: "((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const zh = m[1];
        const py = m[2];
        if (/[A-Za-z]/.test(zh)) continue;
        if (py.includes('→')) continue; // 성조 변조 대조 표기(nǐ hǎo → ní hǎo)는 판정 대상이 아니다
        const hanzi = (zh.match(/[㐀-鿿]/g) || []).length;
        if (hanzi === 0) continue;
        const er = (zh.match(/儿/g) || []).length;
        const clean = py.toLowerCase().replace(/\\"/g, ' ')
          .replace(/[\s,，、.。？?!！:：;；·…—‘’“”「」『』«»'"()-]+/g, ' ').trim();
        let charBad = false;
        for (const tok of clean.split(' ')) {
          if (tok && !okChars.test(tok)) {
            errors.push(`zh 병음 문자 오류: ${rel} — "${py}" 토큰 "${tok}"`);
            charBad = true;
            break;
          }
        }
        if (charBad) continue;
        const syll = (clean.match(vowRun) || []).length;
        if (!(syll === hanzi || (er > 0 && syll >= hanzi - er && syll < hanzi))) {
          errors.push(`zh 병음 음절 불일치: ${rel} — "${zh}"(${hanzi}자) ↔ "${py}"(${syll}음절)`);
        }
      }
    }
  } catch (e) {
    errors.push(`zh 병음 게이트 실패: ${e.message}`);
  }

  // (d-zh) 글자 커버 (report-only) — 레벨 챕터 파일의 CJK 글자가 해당 레벨까지의 누적 vocab 글자에
  // 포함되는지. 단어 분절 없이 글자 단위로 근사한다(공백 없는 중문의 실용 커버 지표).
  try {
    const gmap = {
      h1: ['ot.js', 'h1.js', 'h1_pronunciation.js', 'scene_travel.js', 'scene_emergency.js'],
      h2: ['h2.js'], h3: ['h3.js'], h4: ['h4.js'], h5: ['h5.js'], h6: ['h6.js'],
    };
    const vdir = path.join(REPO_ROOT, 'src/content/chinese/vocab');
    const gdir = path.join(REPO_ROOT, 'src/content/chinese/grammar');
    const vfiles = (await fs.readdir(vdir)).filter((f) => f.endsWith('.js'));
    const cum = new Set();
    for (const lv of Object.keys(gmap)) {
      for (const vf of vfiles.filter((x) => x.startsWith(lv))) {
        const src = await fs.readFile(path.join(vdir, vf), 'utf8');
        const re = /zh: "((?:[^"\\]|\\.)*)"/g;
        let m;
        while ((m = re.exec(src)) !== null) {
          for (const ch of m[1]) if (/[㐀-鿿]/.test(ch)) cum.add(ch);
        }
      }
      const freq = new Map();
      let hit = 0;
      let miss = 0;
      const tally = (text) => {
        for (const ch of text) {
          if (!/[㐀-鿿]/.test(ch)) continue;
          if (cum.has(ch)) hit += 1;
          else {
            miss += 1;
            freq.set(ch, (freq.get(ch) ?? 0) + 1);
          }
        }
      };
      for (const gf of gmap[lv]) {
        let gsrc = '';
        try {
          gsrc = await fs.readFile(path.join(gdir, gf), 'utf8');
        } catch {
          continue;
        }
        // 학습 노출 필드만 집계 — trad(번체 대조)·hanja(한국 정자체 해설)·note 등 설명 필드는
        // 정자체가 설계상 정당하므로 커버 대상에서 뺀다.
        const sre = /(?:zh|sentence|listen|speak|prompt|answer|q)\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let sm;
        while ((sm = sre.exec(gsrc)) !== null) tally(sm[1]);
        const are = /(?:tiles|choices)\s*:\s*\[([^\]]*)\]/g;
        let am;
        while ((am = are.exec(gsrc)) !== null) {
          const inner = am[1].match(/"((?:[^"\\]|\\.)*)"/g) ?? [];
          for (const q of inner) tally(q.slice(1, -1));
        }
      }
      const total = hit + miss;
      if (total > 0) {
        const pct = Math.round((hit / total) * 100);
        if (pct < 100) {
          const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([c, n]) => `${c}(${n})`).join(' ');
          warnings.push(`chinese/${lv.toUpperCase()}: 글자 커버 ${pct}% (한자 ${total}) — 미등재 상위: ${top}`);
        }
      }
    }
  } catch (e) {
    errors.push(`zh 글자 커버 게이트 실패: ${e.message}`);
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
