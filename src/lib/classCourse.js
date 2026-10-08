/**
 * 수업 코스 — 순수 부품(클라이언트·서버 공용). 교재 문장 자체는 여기 없다.
 *
 * 수업 팀 루트에 `metadata.team.course`(코스 키)를 달면 팀 페이지에 「코스」 탭이 열린다.
 * 문장은 `/api/class/[team]/course`가 팀 암호(또는 선생님 로그인) 뒤에서만 내준다.
 *
 * 시험지 계약(오너 확정 2026-10-08):
 *   ① 범위 = 코스 전체 예문(42챕터 × 10) 중 10문제 · 8문제 이상 합격
 *   ② 10문제는 모두 다른 패턴 · Day당 1문제 · 비슷한 패턴 묶음(families)에서 1문제
 *   ③ 난이도 쉬움 3 · 보통 4 · 어려움 3
 *   ④ 시험지 번호(seed)가 같으면 같은 시험지 — 다시 치기·인쇄용
 * 입력된 예문이 적어 ②를 못 지키면 단계적으로 풀고, 화면이 그 사실을 알린다(relaxed).
 */

export const COURSES = Object.freeze({
  nihongo42: Object.freeze({ key: 'nihongo42', title: '일본어 회화 표현 42', lang: 'Japanese' }),
});
export const COURSE_KEY_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const TEST_SIZE = 10;
export const PASS_MARK = 8;
export const DRILLS_PER_CHAPTER = 10;

export function courseInfo(key) {
  return typeof key === 'string' && Object.hasOwn(COURSES, key) ? COURSES[key] : null;
}
export const courseOptions = () => Object.values(COURSES);

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const level = (v) => ([1, 2, 3].includes(Number(v)) ? Number(v) : null);

export function normalizeDrill(d) {
  const ja = str(d?.ja), ko = str(d?.ko);
  if (!ja || !ko) return null;
  const textbook = str(d.textbook), note = str(d.note);
  return { ja, ko, yomi: str(d.yomi) || null, lv: level(d.lv), ...(textbook ? { textbook, note: note || null } : {}) };
}
export function normalizeLine(d) {
  const ja = str(d?.ja);
  if (!ja) return null;
  return { who: str(d.who) || null, ja, yomi: str(d.yomi) || null, ko: str(d.ko) || null };
}

/**
 * 공개 패턴 설명(nihongo42.js) + 수업 전용 문장(nihongo42Class.js) → 화면 페이로드.
 * 레퍼런스 링크는 싣지 않는다(옛 교재 챕터는 학습자에게 닫혀 있다).
 */
export function buildCoursePayload(base, cls) {
  const dayExtra = new Map((cls?.days || []).map((d) => [Number(d.day), d]));
  return {
    key: cls?.key || null,
    title: base.title,
    subtitle: base.subtitle,
    families: (cls?.families || []).map((f) => ({ label: str(f.label), chapters: (f.chapters || []).map(Number) })),
    days: base.days.map((d) => {
      const extra = dayExtra.get(Number(d.day)) || {};
      return {
        day: d.day,
        range: d.range,
        culture: extra.culture || null,
        dialogue: (extra.dialogue || []).map(normalizeLine).filter(Boolean),
        chapters: d.chapters.map((c) => {
          const p = cls?.practice?.[c.n] || {};
          return {
            n: c.n, title: c.title, titleHi: c.titleHi || null, jp: c.jp, jpYomi: c.jpYomi || null, ko: c.ko,
            explain: c.explain || null, pitfall: c.pitfall || null, alts: c.alts || [], examples: c.examples || [],
            drills: (p.drills || []).map(normalizeDrill).filter(Boolean).slice(0, DRILLS_PER_CHAPTER),
          };
        }),
      };
    }),
  };
}

/** Day 입력 현황 — 목록 배지·「아직 입력되지 않았어요」 판정. */
export function dayProgress(day) {
  const chapters = day?.chapters || [];
  return {
    dialogue: (day?.dialogue || []).length,
    drills: chapters.reduce((s, c) => s + (c.drills?.length || 0), 0),
    drillsTotal: chapters.length * DRILLS_PER_CHAPTER,
  };
}

const bareLength = (ja) => String(ja || '').replace(/[\s、。！？!?…「」『』（）()・,.~〜]/g, '').length;

/**
 * 시험 문제 풀 — 예문 연습 문장 전부. 난이도는 lv가 있으면 그대로, 없으면 lv 없는 문장끼리의
 * 길이 3분위(짧은 1/3 = 쉬움). 문장이 늘면 경계도 움직인다 — 확정은 lv로 박는다.
 */
export function coursePool(course) {
  const items = [];
  for (const d of course?.days || []) {
    for (const c of d.chapters || []) {
      (c.drills || []).forEach((dr, i) => {
        items.push({ id: `${c.n}-${i + 1}`, n: c.n, day: d.day, i: i + 1, ja: dr.ja, ko: dr.ko, yomi: dr.yomi, lv: dr.lv, textbook: dr.textbook || null, note: dr.note || null, pattern: c.jp?.[0] || '', title: c.title, auto: !dr.lv });
      });
    }
  }
  const unset = items.filter((x) => !x.lv).sort((a, b) => bareLength(a.ja) - bareLength(b.ja) || a.id.localeCompare(b.id));
  unset.forEach((x, k) => { x.lv = 1 + Math.min(2, Math.floor((k * 3) / unset.length)); });
  return items;
}

/** 결정적 난수(mulberry32) — 같은 시험지 번호 = 같은 시험지. */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export const newSheetNo = (rand = Math.random) => 1000 + Math.floor(rand() * 9000);

export function levelQuota(size) {
  const easy = Math.round(size * 0.3), hard = Math.round(size * 0.3);
  return { 1: easy, 2: size - easy - hard, 3: hard };
}

/** 제약 단계 — 앞에서부터 시도, 채워지는 가장 엄격한 단계를 쓴다. */
const STAGES = [
  { perDay: 1, families: true, uniqueChapter: true, note: null },
  { perDay: 2, families: true, uniqueChapter: true, note: '입력된 Day가 적어 같은 Day에서 2문제까지 냈어요.' },
  { perDay: Infinity, families: false, uniqueChapter: true, note: '입력된 범위가 좁아 Day·비슷한 패턴 제한을 풀었어요.' },
  { perDay: Infinity, families: false, uniqueChapter: false, note: '입력된 패턴이 10개보다 적어 같은 패턴이 두 번 이상 나왔어요.' },
];

function familyIndex(families) {
  const map = new Map();
  (families || []).forEach((f, k) => (f.chapters || []).forEach((n) => {
    if (!map.has(n)) map.set(n, new Set());
    map.get(n).add(k);
  }));
  return map;
}

function tryStage(candidates, size, stage, famOf, quota) {
  const picked = [], perDay = new Map(), chapters = new Map(), fams = new Set(), lvCount = { 1: 0, 2: 0, 3: 0 };
  // 같은 패턴 반복이 허용된 마지막 단계에서도 한 패턴에 몰리지 않게 — 패턴당 상한 = ⌈문제 수 / 패턴 수⌉.
  const cap = stage.uniqueChapter ? 1 : Math.ceil(size / new Set(candidates.map((x) => x.n)).size);
  const ok = (x) => {
    if (picked.includes(x)) return false;
    if ((perDay.get(x.day) || 0) >= stage.perDay) return false;
    if ((chapters.get(x.n) || 0) >= cap) return false;
    if (stage.families && [...(famOf.get(x.n) || [])].some((f) => fams.has(f))) return false;
    return true;
  };
  const take = (x) => {
    picked.push(x);
    perDay.set(x.day, (perDay.get(x.day) || 0) + 1);
    chapters.set(x.n, (chapters.get(x.n) || 0) + 1);
    (famOf.get(x.n) || []).forEach((f) => fams.add(f));
    lvCount[x.lv] += 1;
  };
  for (const x of candidates) if (picked.length < size && lvCount[x.lv] < quota[x.lv] && ok(x)) take(x);
  for (const x of candidates) if (picked.length < size && ok(x)) take(x);
  return picked;
}

/** 순서 — 같은 패턴 연속 금지(가능한 한), 첫 문제는 쉬운 것으로. */
function arrange(items, rand) {
  const rest = shuffled(items, rand);
  const out = [];
  const first = rest.findIndex((x) => x.lv === 1);
  if (first >= 0) out.push(...rest.splice(first, 1));
  while (rest.length) {
    const last = out[out.length - 1];
    // 남은 것 중 가장 많은 패턴을 먼저 풀어야 끝에서 연속이 안 생긴다.
    const left = new Map();
    rest.forEach((x) => left.set(x.n, (left.get(x.n) || 0) + 1));
    const ok = rest.filter((x) => !last || x.n !== last.n);
    const pool = ok.length ? ok : rest;
    const most = Math.max(...pool.map((x) => left.get(x.n)));
    const pick = pool.find((x) => left.get(x.n) === most);
    out.push(...rest.splice(rest.indexOf(pick), 1));
  }
  return out;
}

/**
 * 시험지 — { items, note, available, short }.
 * exclude: 직전 시험지 문장 id(새 시험지에서 다시 안 나오게). 남은 문장이 모자라면 무시한다.
 */
export function buildTestSheet(pool, families, { seed, size = TEST_SIZE, exclude = [] } = {}) {
  const rand = seededRandom(seed);
  const banned = new Set(exclude);
  const fresh = pool.filter((x) => !banned.has(x.id));
  const base = fresh.length >= size ? fresh : pool;
  const famOf = familyIndex(families);
  const quota = levelQuota(size);
  let best = { items: [], note: null };
  for (const stage of STAGES) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const picked = tryStage(shuffled(base, rand), size, stage, famOf, quota);
      if (picked.length > best.items.length) best = { items: picked, note: stage.note };
      if (picked.length >= size) break;
    }
    if (best.items.length >= size) break;
  }
  return { items: arrange(best.items, rand), note: best.note, available: pool.length, short: best.items.length < size };
}

export const passMark = (size) => (size === TEST_SIZE ? PASS_MARK : Math.ceil(size * 0.8));

/** 이 챕터와 같은 묶음의 다른 챕터 — 「비슷한 패턴으로 답해도 뜻이 맞으면 통과」 안내용. */
export function siblingChapters(n, families) {
  const out = new Set();
  for (const f of families || []) if ((f.chapters || []).includes(n)) f.chapters.forEach((m) => { if (m !== n) out.add(m); });
  return [...out].sort((a, b) => a - b);
}
