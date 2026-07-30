#!/usr/bin/env node
// P11 저작 자동 게이트 (챕터 제작 원칙 v1 §5):
//  (a) 레벨 내 order 유일·연속  (b) prerequisites 실존·비순환
//  (c) 선행 순서 — prerequisites 챕터가 레벨·order상 실제로 앞에 있는지(fr A1~A2 fail).
//      ※ '사용 문형의 의미적 커버'까지는 자동화하지 않는다(감사 몫) — 여기서는 순서 위반만 기계 검출.
//  (d) 레벨 어휘 대조 — 챕터 fr 문장 토큰을 레벨 누적 vocab 팩과 대조(report-only 통계.
//      굴절형·표제어 차이로 오탐이 있어 게이트로 쓰지 않는다. 기능어 스톱리스트 + 조야한 어간 매칭)
// 적용 수위: fr A1~A2 = (a)(b)(c) 오류(exit 1) / (d)와 그 외 트랙·레벨 = report-only 경고.
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

  // (f) 드릴 비중복 게이트 (RFC learning-path §2 — fr fail)
  //  드릴 문장(sentence·choice 정답·fill 완성문)은 ① 같은 챕터의 fr 문자열 ② 같은 챕터 다른 드릴
  //  ③ 다른 챕터의 드릴과 문장 단위로 겹치지 않아야 한다.
  try {
    const gdir = path.join(REPO_ROOT, 'src/content/french/grammar');
    const gfiles = (await fs.readdir(gdir)).filter((f) => f.endsWith('.js'));
    const normSent = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const globalSeen = new Map(); // normSent → "slug:drillId"
    for (const f of gfiles.sort()) {
      const src = await fs.readFile(path.join(gdir, f), 'utf8');
      const marks = [...src.matchAll(/^\s+slug: "([^"]+)",\s*$/gm)].map((m) => ({ slug: m[1], at: m.index }));
      for (let i = 0; i < marks.length; i += 1) {
        const seg = src.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : src.length);
        const dm = seg.match(/drills: \[([\s\S]*?)\n    \]/);
        if (!dm) continue;
        const dseg = dm[1];
        const frSet = new Set([...seg.matchAll(/fr: "((?:[^"\\]|\\.)*)"/g)].map((m) => normSent(m[1])));
        const items = [];
        for (const m of dseg.matchAll(/\{([\s\S]*?)\}/g)) {
          const body = m[1];
          const g = (k) => body.match(new RegExp(k + ': "((?:[^"\\\\]|\\\\.)*)"'))?.[1];
          const id = g('id') ?? '?';
          const type = g('type') ?? '?';
          let sent = null;
          if (type === 'order' || type === 'dictation') sent = g('sentence');
          else if (type === 'fill' && g('prompt') && g('answer')) sent = g('prompt').replace('___', g('answer'));
          else if (type === 'choice') sent = g('answer');
          if (sent) items.push({ id, sent: normSent(sent) });
        }
        const local = new Set();
        for (const { id, sent } of items) {
          const label = `${marks[i].slug}:${id}`;
          if (frSet.has(sent)) errors.push(`french 드릴 중복(챕터 예문과 동일): ${label} — "${sent}"`);
          if (local.has(sent)) errors.push(`french 드릴 중복(챕터 내): ${label} — "${sent}"`);
          local.add(sent);
          if (globalSeen.has(sent)) errors.push(`french 드릴 중복(챕터 간): ${label} ↔ ${globalSeen.get(sent)}`);
          else globalSeen.set(sent, label);
        }
      }
    }
  } catch (e) {
    warnings.push(`드릴 비중복 게이트 실패: ${e}`);
  }

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
    const STOP = new Set(('le la les un une des de du au aux et ou où à en sur dans pour par avec sans est sont suis es êtes sommes était étais ai as avons avez ont ne pas plus que qui quoi mais donc car se me te nous vous ils elles il elle je tu on ce cette ces cet mon ma mes ton ta tes son sa ses notre votre leur leurs y si très bien oui non plaît tout toute tous toutes quel quelle quels quelles comme aussi alors voici voilà').split(' '));
    const grammarDir = path.join(REPO_ROOT, 'src/content/french/grammar');
    const levelFiles = {
      A1: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js'], grammar: ['a1.js', 'a1_expansion.js', 'a1_pronunciation.js', 'a1_sandwich_pilot.js', 'scene_travel.js', 'scene_emergency.js'] },
      A2: { vocab: ['a0.js', 'a1.js', 'a1_flelex.js', 'a2.js', 'a2_flelex.js'], grammar: ['a2.js', 'a2_scenes.js'] },
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
    const XBASE = { 'A0↔A1': 8, 'A0↔A2': 0, 'A1↔A2': 0 };
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
