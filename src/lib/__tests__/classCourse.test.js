import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  COURSES, courseInfo, buildCoursePayload, coursePool, buildTestSheet, levelQuota, passMark, siblingChapters,
  dayProgress, TEST_SIZE, PASS_MARK,
} from '../classCourse.js';
import { loadCourse } from '../server/classCourse.js';
import { alignFurigana } from '../../../scripts/check-furigana.mjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextbookOriginal, FixNote } from '../../components/classroom/ClassCourseUI.jsx';
import nihongo42Class from '../../content/community/nihongo42Class.js';
import { getTeam, buildTeamRootRow } from '../classBoard.js';
import { indexFromRows } from '../server/classIndex.js';
import { classSettingsPatch } from '../classWorkspace.js';

/**
 * 계약: 수업 코스 + 테스트 (오너 확정 2026-10-08).
 * - 섹션 이름은 오너가 정했다: 함께 읽고 연습 · 예문 연습(응용 문장 번역은 2026-10-08 오너 결정으로 삭제). 빈 칸은 「아직 입력되지 않았어요」
 * - 시험 = 코스 전체 예문에서 10문제 · 8문제 이상 합격 · 모두 다른 패턴 · Day당 1문제 · 비슷한 패턴 묶음당 1문제
 *   · 난이도 3/4/3 · 같은 시험지 번호 = 같은 시험지
 * - 교재 문장 파일은 서버 라우트만 읽는다(팀 암호 뒤) — 클라이언트 번들 import 금지
 */

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/** 42챕터 × 10문장 가짜 코스 — 문장 길이를 섞어 난이도 3분위가 고루 생기게. */
function fakeCourse({ days = 14, drills = 10, lv = null } = {}) {
  const base = { title: 'T', subtitle: 'S', days: [] };
  const practice = {};
  let n = 0;
  for (let d = 1; d <= days; d += 1) {
    const chapters = [];
    for (let k = 0; k < 3; k += 1) {
      n += 1;
      chapters.push({ n, title: `패턴${n}`, jp: [`~p${n}`], ko: ['k'] });
      practice[n] = {
        drills: Array.from({ length: drills }, (_, i) => ({ ja: 'あ'.repeat(5 + ((i * 7 + n) % 25)) + '。', ko: `문장 ${n}-${i}`, ...(lv ? { lv } : {}) })),
      };
    }
    base.days.push({ day: d, range: `Ch.${n - 2}~${n}`, chapters });
  }
  return buildCoursePayload(base, { key: 'fake', families: nihongo42Class.families, days: [], practice });
}

describe('코스 데이터 — nihongo42', () => {
  const course = loadCourse('nihongo42');

  it('등록된 코스만 열리고, 14일 × 3패턴 = 42챕터', () => {
    expect(courseInfo('nihongo42')).toBe(COURSES.nihongo42);
    expect(courseInfo('nope')).toBeNull();
    expect(loadCourse('nope')).toBeNull();
    expect(course.days).toHaveLength(14);
    expect(course.days.flatMap((d) => d.chapters.map((c) => c.n))).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
  });

  it('수업 회차마다 문화·여행 카드 한 장(제목·장소·한 줄 사실·일본어 한 문장)', () => {
    for (const d of course.days) {
      expect(d.culture?.title, d.range).toBeTruthy();
      expect(d.culture.place).toBeTruthy();
      expect(d.culture.facts.length).toBeGreaterThanOrEqual(3);
      expect(d.culture.phrase.ja).toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(d.culture.phrase.ko).toBeTruthy();
    }
  });

  it('입력된 교재 문장은 형식을 지킨다 — 예문은 일본어·한국어 둘 다, 챕터당 예문 ≤10, 응용 칸 없음', () => {
    for (const [n, p] of Object.entries(nihongo42Class.practice)) {
      expect(Number(n)).toBeGreaterThanOrEqual(1);
      expect(Number(n)).toBeLessThanOrEqual(42);
      expect(p.drills.length, `Ch.${n}`).toBeLessThanOrEqual(10);
      expect(p).not.toHaveProperty('apply');
      for (const d of p.drills) { expect(d.ja, `Ch.${n}`).toBeTruthy(); expect(d.ko, `Ch.${n}`).toBeTruthy(); if (d.lv != null) expect([1, 2, 3]).toContain(d.lv); }
    }
    for (const d of nihongo42Class.days) for (const l of d.dialogue) expect(l.ja, `Day ${d.day}`).toBeTruthy();
  });

  it('비슷한 패턴 묶음은 실제 챕터만, 묶음마다 두 챕터 이상', () => {
    for (const f of course.families) {
      expect(f.chapters.length).toBeGreaterThanOrEqual(2);
      for (const n of f.chapters) expect(n >= 1 && n <= 42).toBe(true);
    }
    expect(siblingChapters(16, course.families)).toEqual([17]);
    expect(siblingChapters(1, course.families)).toEqual([]);
  });

  it('입력 현황 — 비어 있으면 0/30', () => {
    const empty = { chapters: [{ drills: [] }, { drills: [] }, { drills: [] }], dialogue: [] };
    expect(dayProgress(empty)).toEqual({ drills: 0, drillsTotal: 30, dialogue: 0 });
  });
});

describe('시험지 — 42챕터가 다 찼을 때', () => {
  const course = fakeCourse();
  const pool = coursePool(course);
  const famOf = (n) => course.families.map((f, k) => (f.chapters.includes(n) ? k : -1)).filter((k) => k >= 0);

  it('합격선 8/10 · 난이도 배분 3/4/3', () => {
    expect(TEST_SIZE).toBe(10);
    expect(PASS_MARK).toBe(8);
    expect(passMark(10)).toBe(8);
    expect(levelQuota(10)).toEqual({ 1: 3, 2: 4, 3: 3 });
  });

  it('난이도 자동 추정은 3분위로 고르게, 지정한 lv는 그대로', () => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    pool.forEach((x) => { counts[x.lv] += 1; });
    expect(counts).toEqual({ 1: 140, 2: 140, 3: 140 });
    expect(coursePool(fakeCourse({ lv: 3 })).every((x) => x.lv === 3)).toBe(true);
  });

  it('300개 시험지 전부: 10문제 · 패턴 중복 0 · Day당 1문제 · 묶음당 1문제 · 3/4/3 · 첫 문제는 쉬움', () => {
    for (let seed = 1000; seed < 1300; seed += 1) {
      const sheet = buildTestSheet(pool, course.families, { seed });
      expect(sheet.items).toHaveLength(10);
      expect(sheet.note).toBeNull();
      expect(new Set(sheet.items.map((x) => x.n)).size).toBe(10);
      expect(new Set(sheet.items.map((x) => x.day)).size).toBe(10);
      const fams = sheet.items.flatMap((x) => famOf(x.n));
      expect(new Set(fams).size, `seed ${seed}`).toBe(fams.length);
      const lv = { 1: 0, 2: 0, 3: 0 };
      sheet.items.forEach((x) => { lv[x.lv] += 1; });
      expect(lv, `seed ${seed}`).toEqual({ 1: 3, 2: 4, 3: 3 });
      expect(sheet.items[0].lv).toBe(1);
    }
  });

  it('같은 시험지 번호 = 같은 시험지, 다른 번호는 다른 시험지', () => {
    const a = buildTestSheet(pool, course.families, { seed: 4821 }).items.map((x) => x.id);
    expect(buildTestSheet(pool, course.families, { seed: 4821 }).items.map((x) => x.id)).toEqual(a);
    expect(buildTestSheet(pool, course.families, { seed: 4822 }).items.map((x) => x.id)).not.toEqual(a);
  });

  it('새 시험지는 직전 시험지 문장을 다시 내지 않는다', () => {
    const first = buildTestSheet(pool, course.families, { seed: 1234 }).items.map((x) => x.id);
    const next = buildTestSheet(pool, course.families, { seed: 5678, exclude: first }).items.map((x) => x.id);
    expect(next.filter((id) => first.includes(id))).toEqual([]);
  });
});

describe('시험지 — 입력이 덜 됐을 때', () => {
  it('Day 1만(30문장) — 10문제를 내되 같은 패턴은 연속하지 않고 한 패턴에 몰리지 않는다 · 안내 문구', () => {
    const pool = coursePool(fakeCourse({ days: 1 }));
    for (let seed = 1; seed < 100; seed += 1) {
      const sheet = buildTestSheet(pool, nihongo42Class.families, { seed });
      expect(sheet.items).toHaveLength(10);
      expect(sheet.note).toBeTruthy();
      expect(new Set(sheet.items.map((x) => x.id)).size).toBe(10);
      sheet.items.forEach((x, k) => { if (k) expect(x.n, `seed ${seed}`).not.toBe(sheet.items[k - 1].n); });
      const per = {};
      sheet.items.forEach((x) => { per[x.n] = (per[x.n] || 0) + 1; });
      expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(4);
    }
  });

  it('예문이 10개보다 적으면 short — 화면은 시험 대신 입력 대기 안내', () => {
    const pool = coursePool(fakeCourse({ days: 1, drills: 3 })).slice(0, 7);
    const sheet = buildTestSheet(pool, [], { seed: 1 });
    expect(sheet.short).toBe(true);
    expect(sheet.items).toHaveLength(7);
  });

});

describe('교재 문장 — nihongo42 실데이터(오너 제공 2026-10-08)', () => {
  const course = loadCourse('nihongo42');
  const pool = coursePool(course);

  it('42챕터 × 예문 10 = 420 · Day마다 대화 스크립트 · 모든 문장에 한국어', () => {
    expect(pool).toHaveLength(420);
    for (const d of course.days) {
      expect(d.dialogue.length, `Day ${d.day}`).toBeGreaterThanOrEqual(4);
      for (const c of d.chapters) expect(c.drills, `Ch.${c.n}`).toHaveLength(10);
      for (const l of d.dialogue) expect(l.ko, `Day ${d.day}`).toBeTruthy();
    }
  });

  it('한자가 있는 문장은 모두 후리가나가 정렬된다(대화·예문·문화 카드)', () => {
    const lines = course.days.flatMap((d) => [...d.dialogue, ...d.chapters.flatMap((c) => c.drills), d.culture.phrase]);
    const bad = lines.filter((x) => /[一-鿿0-9]/.test(x.ja) && !alignFurigana(x.ja, x.yomi)).map((x) => x.ja);
    expect(bad).toEqual([]);
  });

  it('사람 검수로 고친 읽기가 유지된다(분석기 오독 회귀 방지)', () => {
    const yomi = new Map(pool.map((x) => [x.ja, x.yomi]));
    expect(yomi.get('他の人の意見を聞く方がいいです。')).toMatch(/^ほかの/);
    expect(yomi.get('ラーメンが辛いから、水を入れるのは仕方ないです。')).toContain('からいから');
    expect(yomi.get('毎日本を読んでください。／考えてみます。')).toMatch(/^まいにちほんを/);
    expect(yomi.get('明後日は遠足に行くことになっています。')).toMatch(/^あさって/);
    expect(yomi.get('いくらお腹が空いても、我慢します。')).toContain('すいても');
  });

  it('교재 원문 보존·교체(오너 결정) — Ch.41 원문은 취소선+피드백, 시험 모범답은 고친 문장 · Ch.24 7번 교체 · 중복 0', () => {
    const fixed = pool.find((x) => x.textbook === 'お金がないから買わないしかないです。');
    expect(fixed).toMatchObject({ n: 41, ja: 'お金がないから、買うのを諦めるしかないです。' });
    expect(fixed.note).toContain('しかない');
    expect(pool.filter((x) => x.textbook)).toHaveLength(1);
    expect(pool.find((x) => x.id === '24-7')).toMatchObject({ ja: 'すぐに本を返しに行かなければなりません。', ko: '바로 책을 돌려주러 가야 해요.' });
    expect(new Set(pool.map((x) => x.ja)).size).toBe(420);
    const html = renderToStaticMarkup(createElement(TextbookOriginal, { text: fixed.textbook }));
    expect(html).toContain('<del lang="ja">お金がないから買わないしかないです。</del>');
    expect(renderToStaticMarkup(createElement(FixNote, { note: fixed.note }))).toContain('피드백');
  });

  it('실데이터로도 시험지 불변식이 선다 — 패턴 중복 0 · Day당 1 · 3/4/3', () => {
    for (let seed = 1000; seed < 1100; seed += 1) {
      const sheet = buildTestSheet(pool, course.families, { seed });
      expect(sheet.note).toBeNull();
      expect(new Set(sheet.items.map((x) => x.n)).size).toBe(10);
      expect(new Set(sheet.items.map((x) => x.day)).size).toBe(10);
    }
  });
});

describe('팀 ↔ 코스 연결', () => {
  it('팀 루트 metadata.team.course — 형식이 맞을 때만 읽고, 목록 페이로드에 실린다', () => {
    const meta = (course) => ({ team: { key: 'culcom', root: true, name: 'A', course } });
    expect(getTeam(meta('nihongo42')).course).toBe('nihongo42');
    expect(getTeam(meta('Bad Key!')).course).toBeNull();
    expect(getTeam(meta(undefined)).course).toBeNull();
    const row = buildTeamRootRow({ key: 'culcom', name: 'A', lang: 'Japanese', course: 'nihongo42', pwHash: 'h', pwSalt: 's', ownerId: 'u' });
    expect(row.processed_json.metadata.team.course).toBe('nihongo42');
    const team = getTeam(row.processed_json.metadata);
    expect(indexFromRows({ team }).team.course).toBe('nihongo42');
  });

  it('설정 저장 — 등록된 코스만, 바뀌었을 때만 patch에 실린다', () => {
    const team = { name: '수업', lang: 'Japanese', bookKey: null, course: null };
    expect(classSettingsPatch(team, { ...team, course: 'nihongo42' }, [])).toMatchObject({ course: 'nihongo42' });
    expect(classSettingsPatch({ ...team, course: 'nihongo42' }, { ...team, course: '' }, [])).toMatchObject({ course: null });
    expect(classSettingsPatch(team, { ...team, course: '' }, [])).not.toHaveProperty('course');
    expect(() => classSettingsPatch(team, { ...team, course: 'nope' }, [])).toThrow();
  });
});

describe('공개 범위 — 교재 문장은 암호 뒤에서만', () => {
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });

  it('nihongo42Class를 import하는 곳은 서버 모듈 하나뿐', () => {
    const importers = walk('src').filter((f) => /(from\s*|import\s*\()['"][^'"]*nihongo42Class/.test(read(f)) && !f.endsWith('nihongo42Class.js'));
    expect(importers).toEqual(['src/lib/server/classCourse.js']);
    expect(read('src/lib/server/classCourse.js')).not.toMatch(/['"]use client['"]/);
  });

  it('코스 라우트 — 토큰은 목록과 같은 문, 토큰이 없으면 루트 소유자 로그인만, 코스 없으면 404, 캐시 금지', () => {
    const src = read('src/app/api/class/[team]/course/route.js');
    expect(src).toMatch(/authorizeTeamRequest\(request, key\)/);
    expect(src).toMatch(/requireUser\(request\)/);
    expect(src).toMatch(/loaded\.root\.owner_id !== auth\.user\.id/);
    expect(src).toMatch(/'no_course' }, 404/);
    expect(src).toMatch(/private, no-store/);
  });
});

describe('설명은 한 줄에 한 가지(오너 결정 2026-10-08 — 줄이 넘어가면 집중이 떨어진다)', () => {
  // 휴대폰(390px) 본문 폭 기준 글자 폭(em) — 한글·가나·한자 1, 공백 .28, ASCII .58, 가운뎃점 .35. 굵게(**)는 폭 0.
  const em = (s) => [...String(s).replace(/\*\*/g, '')].reduce((n, ch) => n + (ch === ' ' ? 0.28 : ch.codePointAt(0) < 0x80 ? 0.58 : ch === '·' ? 0.35 : 1), 0);
  const course = loadCourse('nihongo42');

  it('모든 챕터에 핵심 정리(만드는 법 + 한 줄 핵심 2~3개)', () => {
    for (const c of course.days.flatMap((d) => d.chapters)) {
      expect(c.brief?.form, `Ch.${c.n}`).toBeTruthy();
      expect(c.brief.points.length, `Ch.${c.n}`).toBeGreaterThanOrEqual(2);
      expect(c.brief.points.length, `Ch.${c.n}`).toBeLessThanOrEqual(3);
      expect(!!c.brief.ng, `Ch.${c.n} ✕/○ 짝`).toBe(!!c.brief.ok);
    }
  });

  it('핵심 줄 ≤ 18em(15px) · 만드는 법 ≤ 20em(14px) · 문화 사실 ≤ 19em(14.5px) — 휴대폰에서도 한 줄', () => {
    const over = [];
    for (const c of course.days.flatMap((d) => d.chapters)) {
      for (const p of c.brief.points) if (em(p) > 18) over.push(`Ch.${c.n} ${p}`);
      if (em(c.brief.form) > 20) over.push(`Ch.${c.n} form ${c.brief.form}`);
    }
    for (const d of course.days) {
      expect(d.culture.facts.length, d.range).toBeGreaterThanOrEqual(3);
      for (const f of d.culture.facts) if (em(f) > 19) over.push(`${d.range} ${f}`);
    }
    expect(over).toEqual([]);
  });

  it('수업 화면에는 긴 해설 문단·교재 밖 참고 예문을 싣지 않는다', () => {
    const c = course.days[0].chapters[0];
    expect(c).not.toHaveProperty('explain');
    expect(c).not.toHaveProperty('examples');
    expect(course.days[0].culture).not.toHaveProperty('body');
  });
});

describe('「Day」 표기 0 — 수업 회차는 챕터 범위로 부른다(오너 결정 2026-10-08)', () => {
  it('코스 화면·공개 /nihongo 화면의 사용자 문구에 Day가 없다', () => {
    const files = ['src/views/ClassCourseDayPage.jsx', 'src/views/ClassCourseTestPage.jsx', 'src/components/classroom/ClassCourseSchedule.jsx',
      'src/components/classroom/ClassCourseUI.jsx', 'src/lib/classCourse.js', 'src/lib/classSchedule.js', 'src/app/nihongo/page.jsx', 'src/app/nihongo/[day]/page.jsx'];
    const hits = files.flatMap((f) => read(f).split('\n').map((line, i) => [f, i + 1, line])
      .filter(([, , line]) => !/^\s*(\*|\/\/|\/\*)/.test(line) && /(^|[\s'"`>(])Day([\s{$]|이|별|마다)/.test(line)));
    expect(hits).toEqual([]);
  });
});

describe('화면 — 오너가 정한 섹션 이름', () => {
  it('챕터 페이지 섹션 · 빈 칸 문구 · 테스트 입구', () => {
    const day = read('src/views/ClassCourseDayPage.jsx');
    for (const name of ['함께 읽고 연습', '예문 연습']) expect(day).toContain(name);
    expect(day).not.toContain('응용 문장');
    expect(read('src/components/classroom/ClassCourseUI.jsx')).toContain("PENDING_TEXT = '아직 입력되지 않았어요'");
    expect(day).toContain('/test');
  });
});
