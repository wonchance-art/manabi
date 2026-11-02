// 화면 벽 캡처(scripts/wall-capture.mjs)의 순수 부품 — 경로 찾기 · 장면 펼치기 · 빈칸 표 · 규약 검사 판정. 브라우저 · 서버 없음.
// 판정 규칙의 정본은 docs/design/wall-rules.md(§3 객관 검사 · §4 판정 표)다. 여기 값은 그 사본이고, 어긋나면 그 문서를 따른다.
// 장면 등록부의 정본은 docs/design/scenes.json(설계 세션 소유)이다.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const PERSONAS = Object.freeze(['guest', 'empty', 'filled']);
export const VIEWPORT_KEYS = Object.freeze(['mobile', 'desktop']);
const PAGE_FILE = /^page\.(jsx?|tsx?)$/;

/** `(app)/viewer/[id]/page.jsx` → `/viewer/[id]`. 라우트 묶음 `(…)`은 주소에 나오지 않는다. */
export function routeFromPageFile(rel) {
  const parts = rel.split(/[\\/]/);
  const segments = parts.slice(0, -1).filter(part => !/^\(.*\)$/.test(part));
  return `/${segments.join('/')}`;
}

/** src/app 아래 page 파일 전부의 경로 — 테스트 폴더(__tests__)는 뺀다. 정렬 · 중복 제거. */
export function discoverRoutes(appDir) {
  const out = new Set();
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'api') continue;
        walk(join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
      } else if (PAGE_FILE.test(entry.name)) {
        out.add(routeFromPageFile(rel ? `${rel}/${entry.name}` : entry.name));
      }
    }
  };
  walk(appDir, '');
  return [...out].sort();
}

export function loadRegistry(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** 등록부 모양 검사 — 오류 문장 배열(빈 배열이면 통과). 경로가 실제로 있는지는 여기서 보지 않는다(coverage가 「낡은 항목」으로 보인다). */
export function validateRegistry(reg) {
  const errors = [];
  const lanes = new Set(reg.lanes || []);
  const personas = new Set(Object.keys(reg.personas || {}));
  for (const key of personas) if (!PERSONAS.includes(key)) errors.push(`모르는 사람: ${key}`);
  const seenRoutes = new Set(), seenIds = new Set();
  for (const [i, entry] of (reg.routes || []).entries()) {
    const at = `routes[${i}] ${entry.route ?? '?'}`;
    if (typeof entry.route !== 'string' || !entry.route.startsWith('/')) { errors.push(`${at}: route는 /로 시작한다`); continue; }
    if (seenRoutes.has(entry.route)) errors.push(`${at}: 같은 경로가 두 번 나온다`);
    seenRoutes.add(entry.route);
    const kinds = ['scenes', 'via', 'exclude'].filter(k => entry[k] !== undefined);
    if (kinds.length !== 1) { errors.push(`${at}: scenes · via · exclude 중 정확히 하나`); continue; }
    if (entry.exclude !== undefined && !String(entry.exclude).trim()) errors.push(`${at}: 제외 사유가 비었다`);
    if (entry.via !== undefined && !String(entry.via).startsWith('/')) errors.push(`${at}: via는 장면이 있는 경로다`);
    if (!entry.scenes) continue;
    if (!Array.isArray(entry.scenes) || !entry.scenes.length) { errors.push(`${at}: scenes가 비었다`); continue; }
    for (const scene of entry.scenes) {
      const sat = `${at} · ${scene.id ?? '?'}`;
      if (!/^[a-z0-9][a-z0-9-]*$/.test(scene.id || '')) errors.push(`${sat}: id는 소문자 · 숫자 · -`);
      if (!lanes.has(scene.lane)) errors.push(`${sat}: 모르는 줄 ${scene.lane}`);
      if (typeof scene.title !== 'string' || !scene.title) errors.push(`${sat}: 제목이 없다`);
      if (typeof scene.path !== 'string' || !scene.path.startsWith('/')) errors.push(`${sat}: path는 /로 시작한다`);
      if (!Array.isArray(scene.personas) || !scene.personas.length) errors.push(`${sat}: personas가 비었다`);
      if (scene.storage !== undefined && (typeof scene.storage !== 'object' || Array.isArray(scene.storage) || !scene.storage)) errors.push(`${sat}: storage는 { 키: 값 } 객체다`);
      for (const p of scene.personas || []) if (!personas.has(p)) errors.push(`${sat}: 모르는 사람 ${p}`);
      for (const p of scene.personas || []) {
        const id = `${scene.id}.${p}`;
        if (seenIds.has(id)) errors.push(`${sat}: 장면 id ${id}가 겹친다`);
        seenIds.add(id);
      }
    }
  }
  for (const entry of reg.routes || []) {
    if (entry.via && !(reg.routes || []).some(other => other.route === entry.via && other.scenes)) errors.push(`${entry.route}: via ${entry.via}에 장면이 없다`);
  }
  return errors;
}

/** 장면 = 경로 × 사람. 화면 크기(390 · 1280)는 캡처가 곱한다. 등록부 순서를 그대로 지킨다(화면 벽의 줄 순서). */
export function expandScenes(reg) {
  const out = [];
  for (const entry of reg.routes || []) {
    for (const scene of entry.scenes || []) {
      for (const persona of scene.personas) {
        out.push({ id: `${scene.id}.${persona}`, route: entry.route, path: scene.path, title: scene.title, lane: scene.lane,
          persona, design: scene.design || null, note: scene.note || null, wait: scene.wait || null, storage: scene.storage || null });
      }
    }
  }
  return out;
}

/**
 * 빈칸 표 — 실제 경로마다 등록부가 무엇이라 하는지. status: scene(장면 있음) · via(다른 경로의 장면이 그려 줌) ·
 * excluded(사유 있는 제외) · unregistered(등록부에 없음 — 새 화면). stale = 등록부에 있는데 실제로 없는 경로.
 */
export function coverage(reg, discovered) {
  const byRoute = new Map((reg.routes || []).map(entry => [entry.route, entry]));
  const rows = discovered.map(route => {
    const entry = byRoute.get(route);
    if (!entry) return { route, status: 'unregistered', personas: [], note: null };
    if (entry.exclude) return { route, status: 'excluded', personas: [], note: entry.exclude };
    if (entry.via) return { route, status: 'via', personas: [], note: entry.note || null, via: entry.via };
    const personas = [...new Set(entry.scenes.flatMap(scene => scene.personas))];
    return { route, status: 'scene', personas, note: null, scenes: entry.scenes.map(scene => scene.id) };
  });
  const known = new Set(discovered);
  const stale = (reg.routes || []).map(entry => entry.route).filter(route => !known.has(route));
  return { rows, stale };
}

// ── §3 객관 검사 판정 ──
export const RAW_ERROR = /Server Components render|Application error|Unhandled Runtime Error|Internal Server Error|digest property|\b(?:TypeError|ReferenceError|SyntaxError|RangeError): /;
// 값 누락 노출 — 영문 낱말 경계로 잰다(「Annulled」 속 null은 세지 않고, 「NaN개」처럼 한국어가 바로 붙은 것은 센다).
export const MISSING_VALUE = /(?<![A-Za-z0-9_])(?:undefined|null|NaN|\[object Object\])(?![A-Za-z0-9_])|\{\{[^}]*\}\}|(?<![A-Za-z0-9])%s(?![A-Za-z0-9])/;
// 합성 데이터가 응답하지 않아 찍힌 화면의 흔한 문구 — 판정하지 않고 보완 요청으로 돌린다(§4 「판정 안 함」).
export const DATA_GAP = /불러오지 못했어요|찾을 수 없어요|문제가 발생했어요|길을 잃으셨군요/;
const AXE_RULES = Object.freeze({ 'color-contrast': '대비 AA', 'button-name': '이름 없는 버튼', 'link-name': '이름 없는 링크', 'image-alt': '대체 글 없는 이미지' });
export const AXE_RULE_IDS = Object.freeze(Object.keys(AXE_RULES));

export const hash = (value, length = 12) => createHash('sha256').update(String(value)).digest('hex').slice(0, length);

/** 화면 글자에서 값 누락 노출 줄 — 최대 3줄. */
export function missingValueLines(text) {
  return String(text || '').split('\n').map(line => line.trim()).filter(line => line && MISSING_VALUE.test(line)).slice(0, 3);
}

/**
 * 한 장면 · 한 화면 크기의 측정값 → 판정. verdict: fix(규약 위반 — 수정 요청) · skip(판정 안 함: 캡처 · 글꼴 실패) ·
 * data(판정 안 함: 합성 데이터 부족으로 보이는 화면) · ok(규약 위반 없음). 사람의 의도 · 취향 판단은 여기서 하지 않는다.
 */
export function judgeShot(m) {
  const reasons = [];
  if (!m || m.error) return { verdict: 'skip', reasons: [{ k: 'skip', t: `캡처 실패 — ${m?.error || '측정값 없음'}` }] };
  if (m.fontKR === false) return { verdict: 'skip', reasons: [{ k: 'skip', t: '원본 글꼴(Noto Sans KR)이 로드되지 않았다 — 대체 글꼴 화면은 판정하지 않는다.' }] };
  if (m.overflowX) reasons.push({ k: 'rule', t: `가로 넘침 — 문서 너비 ${m.scrollWidth}px > 창 ${m.innerWidth}px` });
  if (m.rawError) reasons.push({ k: 'rule', t: `오류 원문 노출 — 「${m.rawError}」` });
  for (const line of m.missing || []) reasons.push({ k: 'rule', t: `값 누락 노출 — 「${line.slice(0, 80)}」` });
  for (const v of m.axe || []) {
    const sample = (v.samples || []).slice(0, 2).map(s => s.summary || s.target).filter(Boolean).join(' · ');
    reasons.push({ k: 'rule', t: `${AXE_RULES[v.id] || v.id} ${v.n}곳${sample ? ` — ${sample}` : ''}` });
  }
  if (m.smallTargets?.length) reasons.push({ k: 'rule', t: `터치 타깃 44px 미만(글자 없는 버튼 · 링크) ${m.smallTargets.length}곳 — ${m.smallTargets.slice(0, 3).join(' · ')}` });
  if (m.brokenImages?.length) reasons.push({ k: 'rule', t: `깨진 이미지 ${m.brokenImages.length}개 — ${m.brokenImages.slice(0, 2).join(' · ')}` });
  if (reasons.length) return { verdict: 'fix', reasons };
  if (m.status >= 400) return { verdict: 'data', reasons: [{ k: 'data', t: `응답 ${m.status} — 장면 주소가 틀렸거나 합성 데이터에 그 대상이 없다(등록부 확인).` }] };
  if (m.dataGap) return { verdict: 'data', reasons: [{ k: 'data', t: `「${m.dataGap}」 — 합성 데이터가 이 화면을 채우지 못했을 수 있다. 실제 오류인지 함께 확인한다.` }] };
  return { verdict: 'ok', reasons: [{ k: 'ok', t: '규약 검사 통과(넘침 · 오류 원문 · 값 누락 · 대비 · 이름 · 터치 타깃 · 이미지).' }] };
}

/** 장면의 두 화면 크기 판정을 하나로 — 나쁜 쪽이 이긴다(fix > skip > data > ok). */
export function mergeVerdicts(byViewport) {
  const rank = { fix: 3, skip: 2, data: 1, ok: 0 };
  let verdict = 'ok';
  const reasons = [];
  for (const [viewport, judged] of Object.entries(byViewport)) {
    if (rank[judged.verdict] > rank[verdict]) verdict = judged.verdict;
    for (const r of judged.reasons) {
      const label = viewport === 'mobile' ? '390' : '1280';
      const same = reasons.find(x => x.k === r.k && x.t === r.t);
      if (same) same.at = [...new Set([...same.at, label])];
      else reasons.push({ ...r, at: [label] });
    }
  }
  return { verdict, reasons: verdict === 'ok' ? reasons.filter(r => r.k === 'ok').slice(0, 1) : reasons.filter(r => r.k !== 'ok') };
}

/** 측정값의 한 줄 요약(캡처 로그용). */
export function summaryLine(scene, viewport, judged) {
  return `${judged.verdict.padEnd(4)} ${scene.id} @${viewport === 'mobile' ? 390 : 1280} ${scene.path}`;
}

// ── 부품 대조 · 토큰 밖 색(2판 2단계) ──
export const PART_TYPES = Object.freeze({ h1: '제목 h1', h2: '제목 h2', h3: '제목 h3', 'button-filled': '채운 버튼', 'button-outline': '테두리 버튼', field: '입력칸', card: '카드' });

/** rgb(a) → #rrggbb(투명도가 있으면 #rrggbbaa). 모르는 모양은 그대로. */
export function rgbToHex(color) {
  // color-mix 결과는 color(srgb r g b / a) 꼴(0~1)로 나온다.
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(String(color).trim());
  if (srgb) return rgbToHex(`rgba(${[1, 2, 3].map(i => Math.round(Number(srgb[i]) * 255)).join(', ')}, ${srgb[4] ?? 1})`);
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(String(color).trim());
  if (!m) return String(color);
  const hex = [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('');
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return a >= 1 ? `#${hex}` : `#${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

/**
 * 장면들의 부품 → 화면 크기 · 종류별 「모양」 묶음. 같은 모양(sig)이 몇 장면에 나오는지 센다 — 변종 수가 일관성의 첫 신호다.
 * 결과: { desktop: { h1: [{ sig, style, scenes: [id…], label, cls }] … }, mobile: … } — 장면 수 많은 순.
 */
export function aggregateParts(scenes) {
  const out = {};
  for (const scene of scenes) {
    for (const [viewport, check] of Object.entries(scene.checks || {})) {
      for (const part of check.parts || []) {
        const byType = ((out[viewport] ??= {})[part.type] ??= new Map());
        const row = byType.get(part.sig) || { sig: part.sig, style: part.style, scenes: [], label: part.label, cls: part.cls };
        if (!row.scenes.includes(scene.id)) row.scenes.push(scene.id);
        byType.set(part.sig, row);
      }
    }
  }
  return Object.fromEntries(Object.entries(out).map(([vp, types]) => [vp, Object.fromEntries(Object.entries(types)
    .map(([type, rows]) => [type, [...rows.values()].sort((a, b) => b.scenes.length - a.scenes.length || a.sig.localeCompare(b.sig))]))]));
}

/**
 * 토큰 밖 색 — 화면에 쓰인 글자색 · 배경색 중 어느 CSS 변수 값과도 같지 않은 것. 사용 횟수 많은 순.
 * 흰색 · 검정 · 완전 투명은 뺀다(ui-conventions §1 예외 — 채색 배경 위 #fff 등).
 */
export function offTokenColors(scenes) {
  const palette = new Set();
  for (const scene of scenes) for (const check of Object.values(scene.checks || {})) for (const c of check.palette || []) palette.add(c);
  const tally = new Map();
  for (const scene of scenes) {
    for (const check of Object.values(scene.checks || {})) {
      for (const kind of ['text', 'bg']) {
        for (const [color, n] of Object.entries(check.colors?.[kind] || {})) {
          if (palette.has(color) || /^rgba?\((255, 255, 255|0, 0, 0)(, 1)?\)$/.test(color)) continue;
          const row = tally.get(color) || { color, hex: rgbToHex(color), text: 0, bg: 0, scenes: [] };
          row[kind] += n;
          if (!row.scenes.includes(scene.id)) row.scenes.push(scene.id);
          tally.set(color, row);
        }
      }
    }
  }
  return { paletteSize: palette.size, colors: [...tally.values()].sort((a, b) => (b.text + b.bg) - (a.text + a.bg)) };
}
