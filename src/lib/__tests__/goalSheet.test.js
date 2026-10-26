// 목표 창(GOAL-SHEET-001 — 오너 승인 목업 2026-10-26 KST) — 단계 순서 · 접수 없음 · 날짜 합치기 · 이름 · 저장 값이 예전 창과 같음 · 지우기.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { failureMessage } from '../errorMessage.js';
import { EXAM_SCHEDULES, examGoalOf } from '../examSchedules.js';
import {
  CLEAR_GOAL_ARGS, CUSTOM_DATE, NO_EXAM, courseLevelChips, examKindOf, examLevelChips, goalDateCards, goalLanguages, goalNowView,
  goalSaveArgs, initialGoalState, isExamLabel, needsManualDate, resolveGoal,
} from '../goalSheet.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const KST = (s) => Date.parse(`${s}+09:00`);
const NOW = KST('2026-10-26T12:00:00');
const SHEET = read('src/components/goal/GoalSheet.jsx');
const CATALOG = {
  English: { levels: ['OT', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((key) => ({ key, short: key, chapters: [{ slug: `en-${key}` }] })) },
  French: { levels: [{ key: 'A0', short: 'OT', chapters: [{ slug: 'fr-0' }] }, { key: 'A1', short: 'A1', chapters: [{ slug: 'fr-1' }] }] },
  Japanese: { levels: ['OT', 'N5', 'N4', 'N3', 'N2', 'N1'].map((key) => ({ key, short: key, chapters: [{ slug: key }] })) },
  Chinese: { levels: [...['OT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map((key) => ({ key, short: key, chapters: [{ slug: key }] })), { key: 'LIFE', short: '생활', chapters: [] }] },
};
/** 실데이터 중 2026년 회차만 — 일정이 더 실려도 목업 장면은 그대로 잰다. */
const cards2026 = (exam, level) => goalDateCards(exam, level, NOW).filter((c) => c.date < '2027-01-01');

describe('단계 — 언어 → 시험(또는 목표 수준) → 날짜, 그다음 하루 목표', () => {
  it('화면 순서: 제목 · 지금 목표 · 시험 · 날짜 목표(1 언어 · 2 시험 · 3 날짜) · 하루 목표 · 취소/저장 · 시험 목표 지우기', () => {
    const order = ['<h2 id={titleId}>목표</h2>', '{now && (', '시험 · 날짜 목표</h3>', 'gs-step__n">1</span>언어</legend>',
      "gs-step__n\">2</span>{exam ? '시험' : '목표 수준'}</legend>", 'gs-step__n">3</span>날짜</legend>', '<legend className="gs-sec">하루 목표</legend>',
      '>취소</button>', "{busy ? '저장 중…' : '저장'}", '>시험 목표 지우기</button>'];
    const at = order.map((anchor) => SHEET.indexOf(anchor));
    expect(at.every((i) => i > 0), order.filter((_, i) => at[i] < 0).join(' / ')).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // 지우기는 날짜 목표가 있을 때만 · 예전 「삭제」와 같은 인자
    expect(SHEET).toContain('{dday && <button type="button" className="gs-clear" onClick={() => persist(...CLEAR_GOAL_ARGS)}');
    expect(CLEAR_GOAL_ARGS).toEqual(['', '', '', '']);
  });

  it('언어 칩은 목업 순서(일본어 · 중국어 · 영어 · 프랑스어) · 시험 칩은 EXAM_KINDS 급수 + 「시험 없이」 · 일정 없는 언어는 과정 레벨', () => {
    expect(goalLanguages(CATALOG)).toEqual(['Japanese', 'Chinese', 'English', 'French']);
    expect(goalLanguages(undefined)).toEqual(['Japanese', 'Chinese', 'English', 'French']);
    expect(examKindOf('Japanese')).toBe('JLPT');
    expect(examKindOf('Chinese')).toBe('HSK');
    expect(examKindOf('English')).toBeNull();
    expect(examKindOf('Japanese', EXAM_SCHEDULES.filter((r) => r.exam !== 'JLPT'))).toBeNull(); // 대조한 일정이 없으면 시험 단계가 아니다
    expect(examLevelChips('JLPT').map((c) => c.text)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
    expect(examLevelChips('HSK').map((c) => c.text)).toEqual(['1급', '2급', '3급', '4급', '5급', '6급', '7–9급']);
    expect(courseLevelChips(CATALOG, 'English').map((c) => c.text)).toEqual(['입문', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(courseLevelChips(CATALOG, 'French')).toEqual([{ key: 'A0', text: '입문' }, { key: 'A1', text: 'A1' }]);
    expect(courseLevelChips(CATALOG, 'Chinese').map((c) => c.key)).not.toContain('LIFE'); // 챕터 없는 레벨은 목표가 될 수 없다
    expect(SHEET).toContain('>시험 없이</button>');
    expect(SHEET).toContain('placeholder="이름 (선택) · 예: 여행 전까지"');
    expect(SHEET).toContain('maxLength={GOAL_LABEL_MAX}');
  });

  it('언어 · 급수를 바꾸면 시험이 지은 이름만 비운다(영어 목표에 「HSK 4급」이 남던 것 — 실화면 확인)', () => {
    for (const label of ['JLPT N3', 'HSK 4급', 'HSK 4급 IBT', 'HSK 7–9급 PBT']) expect(isExamLabel(label), label).toBe(true);
    for (const label of ['', '여행 전까지', 'JLPT N3 합격!', 'HSK 4']) expect(isExamLabel(label), label).toBe(false);
    expect(SHEET).toContain("const relabel = () => (isExamLabel(state.label) ? { label: '' } : {});");
    expect(SHEET).toContain("edit({ lang, pick: '', card: '', ...relabel() })");
  });

  it('직접 입력칸은 시험 없는 언어 · 「시험 없이」 · 일정 없는 급수 · 「다른 날짜」에서만', () => {
    expect(needsManualDate({ lang: 'English', pick: '' }, NOW)).toBe(true);
    expect(needsManualDate({ lang: 'Japanese', pick: NO_EXAM }, NOW)).toBe(true);
    expect(needsManualDate({ lang: 'Japanese', pick: '' }, NOW)).toBe(false);
    expect(needsManualDate({ lang: 'Japanese', pick: 'N3', card: '' }, NOW)).toBe(false);
    expect(needsManualDate({ lang: 'Japanese', pick: 'N3', card: CUSTOM_DATE }, NOW)).toBe(true);
    expect(needsManualDate({ lang: 'Japanese', pick: 'N3', card: '' }, KST('2027-06-01T12:00:00'))).toBe(EXAM_SCHEDULES.every((r) => r.exam !== 'JLPT' || r.date < '2027-06-01'));
  });
});

describe('날짜 카드 — 접수 없음 · 같은 날 합치기 · D 표기', () => {
  it('JLPT N3 — 「12월 6일 일요일 / JLPT 2026년 2회 / D-41」(목업 ①)', () => {
    const [card] = cards2026('JLPT', 'N3');
    expect([card.day, card.name, card.formats, card.dLabel]).toEqual(['12월 6일 일요일', 'JLPT 2026년 2회', [], 'D-41']);
  });

  it('HSK 4급 — 기존 HSK(2.0) 11월 7일 · HSK 12월 13일, 각각 IBT · PBT 한 장(목업 ②)', () => {
    expect(cards2026('HSK', 'H4').map((c) => [c.day, c.name, c.formats.join('·'), c.dLabel])).toEqual([
      ['11월 7일 토요일', '기존 HSK(2.0)', 'IBT·PBT', 'D-12'],
      ['12월 13일 일요일', 'HSK', 'IBT·PBT', 'D-48'],
    ]);
  });

  it('화면 · 계산 어디에도 접수 기간이 없다(오너 「접수 일정은 굳이 안 넣어도 될 듯」)', () => {
    expect(code(SHEET + read('src/lib/goalSheet.js'))).not.toMatch(/접수|register|examDateLine/);
    const shown = goalDateCards('HSK', 'H4', NOW).map(({ rows, ...c }) => c);
    expect(JSON.stringify(shown)).not.toMatch(/접수|register/);
    // 확인 안내는 한 줄 — 「공식 일정 · 10월 19일 확인 · 출처 ↗」
    expect(SHEET).toContain('{examCheckedLine(cards.flatMap(c => c.rows))}');
    expect(SHEET).toContain('rel="noopener noreferrer">출처 ↗</a>');
  });

  it('지금 목표 칸 — 이름 · 요일까지 쓴 날짜 · D 표기(이름이 없으면 「목표일」)', () => {
    expect(goalNowView({ date: '2026-12-06', label: 'JLPT N3' }, NOW)).toEqual({ name: 'JLPT N3', day: '12월 6일 일요일', dLabel: 'D-41' });
    expect(goalNowView({ date: '2026-12-06', label: '' }, NOW).name).toBe('목표일');
    expect(goalNowView(null, NOW)).toBeNull();
  });
});

describe('창을 열 때 — 저장된 목표를 그대로 비춘다', () => {
  const profile = (over = {}) => ({ learning_language: ['Chinese'], goal_lang: null, goal_level: null, ...over });

  it('JLPT N3 시험 날 목표 → 일본어 · N3 · 그 카드', () => {
    const s = initialGoalState({ profile: profile({ goal_lang: 'Japanese', goal_level: 'N3' }), dday: { date: '2026-12-06', label: 'JLPT N3' }, catalog: CATALOG, nowMs: NOW });
    expect(s).toMatchObject({ lang: 'Japanese', pick: 'N3', card: '2026-12-06|', touched: false });
  });

  it('목표가 없으면 첫 학습 언어 · 아무것도 고르지 않음', () => {
    expect(initialGoalState({ profile: profile(), dday: null, catalog: CATALOG, nowMs: NOW })).toMatchObject({ lang: 'Chinese', pick: '', card: '', date: '', label: '' });
  });

  it('과정 없는 7–9급 목표는 이름으로 급수를 찾는다 · 시험 날이 아닌 날짜는 「다른 날짜」 · 급수를 모르면 「시험 없이」', () => {
    expect(initialGoalState({ profile: profile(), dday: { date: '2026-11-22', label: 'HSK 7–9급 IBT' }, catalog: CATALOG, nowMs: NOW }))
      .toMatchObject({ lang: 'Chinese', pick: 'H7', card: '2026-11-22|' });
    expect(initialGoalState({ profile: profile({ goal_lang: 'Japanese', goal_level: 'N3' }), dday: { date: '2027-02-01', label: '' }, catalog: CATALOG, nowMs: NOW }))
      .toMatchObject({ lang: 'Japanese', pick: 'N3', card: CUSTOM_DATE, date: '2027-02-01' });
    expect(initialGoalState({ profile: profile(), dday: { date: '2027-03-01', label: '여행' }, catalog: CATALOG, nowMs: NOW }))
      .toMatchObject({ lang: 'Chinese', pick: NO_EXAM, date: '2027-03-01', label: '여행' });
  });

  it('시험 없는 언어 목표 → 그 언어 · 그 수준(과정 목록을 받기 전에도)', () => {
    expect(initialGoalState({ profile: profile({ goal_lang: 'English', goal_level: 'A2' }), dday: { date: '2027-03-01', label: '' }, catalog: undefined, nowMs: NOW }))
      .toMatchObject({ lang: 'English', pick: 'A2', date: '2027-03-01' });
  });
});

/* ── 저장 값이 예전 창과 같다 — 예전 현황 GoalEditor의 persist · persistDaily(main d61e532e6)를 그대로 돌려 새 창과 호출을 대조한다. ── */
const OLD_EDITOR = String.raw`
  async function persistDaily() {
    if (busy || !user?.id) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update(daily).eq('id', user.id);
    if (error) toast(failureMessage('하루 목표를 저장하지 못했어요.', error), 'error');
    else fetchProfile(user.id, user.user_metadata);
    setBusy(false);
    if (!error) setOpen(false);
  }

  async function persist(nextDate, nextLabel, nextLang, nextLevel) {
    if (busy) return;
    setBusy(true);
    try {
      if (nextDate) localStorage.setItem('as_dday', JSON.stringify({ date: nextDate, label: nextLabel }));
      else localStorage.removeItem('as_dday');
    } catch {}
    setLocal(nextDate ? { date: nextDate, label: nextLabel } : null);
    if (user?.id) {
      const base = { dday_date: nextDate || null, dday_label: nextLabel || null, ...daily };
      let { error } = await supabase.from('profiles')
        .update({ ...base, goal_lang: nextLang || null, goal_level: nextLevel || null })
        .eq('id', user.id);
      if (error && /column|schema/i.test(error.message || '')) {
        ({ error } = await supabase.from('profiles').update(base).eq('id', user.id));
        if (!error && (nextLang || nextLevel)) toast('날짜는 저장했어요 — 목표 과정은 아직 준비 중이에요', 'info');
      }
      if (error) toast('동기화하지 못했어요. 이 기기에는 저장됐어요.', 'error');
      else fetchProfile(user.id, user.user_metadata);
    }
    setBusy(false);
    setOpen(false);
  }`;
const NEW_EDITOR = sliceBetween(SHEET, '  async function persistDaily() {', '\n  // 날짜가 정해졌으면');

/** 함수 본문을 가짜 supabase · 저장소로 돌려 일어난 일을 순서대로 적는다. errors = update 응답 차례대로. */
async function run(src, call, errors = []) {
  const log = [];
  let n = 0;
  const supabase = { from: (table) => ({ update: (payload) => ({ eq: (col, val) => {
    log.push(['update', table, payload, col, val]);
    return Promise.resolve({ error: errors[n++] || null });
  } }) }) };
  const deps = {
    busy: false, user: { id: 'u1', user_metadata: {} }, daily: { goal_review: 12, goal_words: 7 }, supabase, failureMessage,
    setBusy: (v) => log.push(['busy', v]), toast: (msg, type) => log.push(['toast', msg, type]),
    fetchProfile: (id) => log.push(['fetchProfile', id]),
    localStorage: { setItem: (k, v) => log.push(['local.set', k, v]), removeItem: (k) => log.push(['local.remove', k]) },
    setLocal: (v) => log.push(['local', v]), onLocal: (v) => log.push(['local', v]),
    setOpen: () => log.push(['close']), onClose: () => log.push(['close']),
  };
  const fns = new Function(...Object.keys(deps), `${src}\nreturn { persist, persistDaily };`)(...Object.values(deps));
  await (call.kind === 'daily' ? fns.persistDaily() : fns.persist(...call.args));
  return log;
}
const COLUMN_MISSING = { message: 'column "goal_lang" of relation "profiles" does not exist' };
async function expectSameAsOld(oldCall, newCall) {
  for (const errors of [[], [COLUMN_MISSING], [COLUMN_MISSING, { message: 'network' }], [{ message: 'network' }]]) {
    expect(await run(NEW_EDITOR, newCall, errors), JSON.stringify(errors)).toEqual(await run(OLD_EDITOR, oldCall, errors));
  }
}

describe('저장 값 — 길마다 예전 창과 같은 열 · 같은 값(열 부재 재시도 · 이 기기 폴백 · 닫힘까지)', () => {
  const base = { touched: true, date: '', label: '' };
  const save = (state, extra = {}) => goalSaveArgs({ state: { ...base, ...state }, dday: null, profile: {}, nowMs: NOW, ...extra });

  it('시험 날 — JLPT N3(형식 없음) · HSK 7–9급(IBT 하나): 예전 examGoalOf 길과 같다', async () => {
    const jlpt = cards2026('JLPT', 'N3')[0];
    const plan = save({ lang: 'Japanese', pick: 'N3', card: jlpt.key });
    const old = examGoalOf(jlpt.rows[0], 'N3');
    expect(plan.args).toEqual(['2026-12-06', 'JLPT N3', 'Japanese', 'N3']);
    await expectSameAsOld({ kind: 'persist', args: [old.date, old.label, old.lang, old.level] }, plan);
    const h7 = cards2026('HSK', 'H7')[0];
    const plan7 = save({ lang: 'Chinese', pick: 'H7', card: h7.key });
    expect(plan7.args).toEqual(['2026-11-22', 'HSK 7–9급 IBT', '', '']);
    const old7 = examGoalOf(h7.rows[0], 'H7');
    await expectSameAsOld({ kind: 'persist', args: [old7.date, old7.label, old7.lang, old7.level] }, plan7);
  });

  it('IBT · PBT를 합친 날 — 이름만 형식을 뺀 「HSK 4급」, 나머지 열은 예전 IBT 고르기와 같다', async () => {
    const [, dec] = cards2026('HSK', 'H4');
    const plan = save({ lang: 'Chinese', pick: 'H4', card: dec.key });
    expect(plan.args).toEqual(['2026-12-13', 'HSK 4급', 'Chinese', 'H4']);
    const old = examGoalOf(dec.rows.find((r) => r.format === 'IBT'), 'H4');
    expect(old.label).toBe('HSK 4급 IBT');
    await expectSameAsOld({ kind: 'persist', args: [old.date, 'HSK 4급', old.lang, old.level] }, plan);
  });

  it('직접 입력 — 과정을 고른 날짜(영어 A2) · 과정 없는 날짜(시험 없이 · 수준 안 고름)', async () => {
    const en = save({ lang: 'English', pick: 'A2', date: '2027-03-01', label: ' 여행 전까지 ' });
    expect(en.args).toEqual(['2027-03-01', '여행 전까지', 'English', 'A2']);
    await expectSameAsOld({ kind: 'persist', args: ['2027-03-01', ' 여행 전까지 '.trim(), 'English', 'A2'] }, en);
    for (const state of [{ lang: 'Japanese', pick: NO_EXAM }, { lang: 'English', pick: '' }]) {
      const plan = save({ ...state, date: '2027-03-01', label: '여행' });
      expect(plan.args).toEqual(['2027-03-01', '여행', '', '']);
      await expectSameAsOld({ kind: 'persist', args: ['2027-03-01', '여행', '', ''] }, plan);
    }
  });

  it('일정 없는 급수 · 다른 날짜 — 그 급수의 과정을 지키고 이름을 비우면 급수 이름', () => {
    expect(save({ lang: 'Japanese', pick: 'N3', card: CUSTOM_DATE, date: '2027-07-04' }).args).toEqual(['2027-07-04', 'JLPT N3', 'Japanese', 'N3']);
    expect(save({ lang: 'Chinese', pick: 'H7', card: CUSTOM_DATE, date: '2027-05-01', label: '내 시험' }).args).toEqual(['2027-05-01', '내 시험', '', '']);
    expect(save({ lang: 'Japanese', pick: 'N3', card: '', date: '2027-07-04' })).toBeNull(); // 카드가 있는데 안 골랐다
  });

  it('날짜 목표를 건드리지 않고 저장 — 예전 창이 열 때 채운 값(dday · goal_lang · goal_level) 그대로', async () => {
    const dday = { date: '2026-12-06', label: ' 내 JLPT ' };
    for (const profile of [{ goal_lang: 'Japanese', goal_level: 'N3' }, { goal_lang: null, goal_level: 'N3' }, { goal_lang: 'Japanese', goal_level: null }]) {
      const state = initialGoalState({ profile, dday, catalog: CATALOG, nowMs: NOW });
      const plan = goalSaveArgs({ state, dday, profile, nowMs: NOW });
      // 예전 openModal → persist(date, label.trim(), goalLang, goalLang ? goalLevel : '')
      const goalLang = profile.goal_lang || '';
      const goalLevel = profile.goal_level || '';
      await expectSameAsOld({ kind: 'persist', args: [dday.date, dday.label.trim(), goalLang, goalLang ? goalLevel : ''] }, plan);
    }
  });

  it('날짜 없이 하루 목표만 — 날짜 목표는 그대로(바꾼 것이 없으면 단추를 끈다)', async () => {
    const state = initialGoalState({ profile: {}, dday: null, catalog: CATALOG, nowMs: NOW });
    expect(goalSaveArgs({ state, dday: null, profile: {}, dailyChanged: false, nowMs: NOW })).toBeNull();
    const plan = goalSaveArgs({ state, dday: null, profile: {}, dailyChanged: true, nowMs: NOW });
    expect(plan).toEqual({ kind: 'daily' });
    await expectSameAsOld({ kind: 'daily' }, plan); // 실패 응답도 같은 길(토스트 · 열린 채)
    // 고르다 만 상태(급수만 · 날짜 없음)도 하루 목표만
    expect(goalSaveArgs({ state: { ...state, lang: 'Japanese', pick: 'N3', card: '', touched: true }, dday: { date: '2026-12-06' }, profile: {}, dailyChanged: true, nowMs: NOW }))
      .toEqual({ kind: 'daily' });
  });

  it('시험 목표 지우기 — 예전 「삭제」 persist(\'\', \'\', \'\', \'\')와 같다', async () => {
    await expectSameAsOld({ kind: 'persist', args: ['', '', '', ''] }, { kind: 'persist', args: [...CLEAR_GOAL_ARGS] });
    const log = await run(NEW_EDITOR, { kind: 'persist', args: [...CLEAR_GOAL_ARGS] });
    expect(log).toContainEqual(['local.remove', 'as_dday']);
    expect(log).toContainEqual(['update', 'profiles', { dday_date: null, dday_label: null, goal_review: 12, goal_words: 7, goal_lang: null, goal_level: null }, 'id', 'u1']);
  });

  it('고른 값이 덜 정해지면 저장할 날짜 목표가 없다', () => {
    expect(resolveGoal({ lang: 'Japanese', pick: '', card: '', date: '2027-01-01', label: '' }, NOW)).toBeNull();
    expect(resolveGoal({ lang: 'English', pick: 'A2', card: '', date: '', label: '' }, NOW)).toBeNull();
    expect(resolveGoal({ lang: 'Japanese', pick: 'N9', card: '', date: '2027-01-01', label: '' }, NOW)).toBeNull();
  });
});

describe('창의 하한 — 키보드 · 터치 · 화면 배선', () => {
  const css = read('src/components/goal/goal-sheet.css');

  it('대화 상자 이름 · aria-modal · useDialogReturn(열면 안으로 · Esc · 닫으면 연 자리로) · 저장 중에는 닫지 않는다', () => {
    expect(SHEET).toContain('role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} tabIndex={-1}');
    expect(SHEET).toContain('const close = () => { if (!busy) onClose(); };\n  const dialogRef = useDialogReturn(close);');
    expect(SHEET).toContain('aria-label="닫기"');
    // 고르기 묶음마다 이름(legend) · 날짜는 진짜 라디오
    expect((SHEET.match(/<fieldset className="gs-step">/g) || []).length).toBe(3);
    expect(SHEET).toContain('<input type="radio" name={radioName}');
  });

  it('44px 터치 · 보이는 포커스 · 입력칸 16px · 아래 시트 ↔ 가운데 창은 컨테이너 쿼리(뷰포트 쿼리 0)', () => {
    for (const sel of ['.gs-sheet .gs-x{width:44px;height:44px', '.gs-sheet .gs-chip{min-height:44px', '.gs-sheet .gs-pill{flex:1;min-height:48px', '.gs-sheet .gs-clear{display:block;min-height:44px']) {
      expect(css, sel).toContain(sel);
    }
    expect(css).toMatch(/\.gs-sheet \.gs-input\{[^}]*font-size:16px/);
    expect(css).toContain('.scrim.gs-scrim{z-index:1100;align-items:flex-end;padding:0;container:gs/inline-size}');
    expect(css).toContain('@container gs (min-width:600px)');
    expect(css).not.toMatch(/@media[^{]*width/);
    expect((css.match(/:focus-visible/g) || []).length).toBeGreaterThanOrEqual(7);
    expect(SHEET).toContain('className="scrim gs-scrim"'); // 공용 어둠막 — 뒤 화면 세우기 · 이동 효과 예외 목록에 이미 있다
  });
});
