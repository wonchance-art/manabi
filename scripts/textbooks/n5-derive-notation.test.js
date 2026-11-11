import { beforeAll, describe, expect, it } from 'vitest';
import { applyPatch, bareKanji, deriveNotation, isReadingRow, loadBase, stage1Eligibility } from './n5-derive-notation.mjs';
import { misreadWarnings } from './n5-notation-contract.mjs';

// N5-NOTATION-001 1단계(2026-11-11 KST) — 조각 치환 파생의 계약. 바탕 = 운영 공개 판본 8a8c.
const BASE = 'src/content/textbookEditions/8a8c1c1fd452773810abaf8c';
// 10과 표본(목업과 같은 낱말: 何時 · 午後2時 · 駅 · 1時半) — 실제 표기는 Data 표기 기준표로 정한다.
const U10 = {
  'lessons.9.dialog.1.ja': '{午後|ごご}2時からです。',
  'lessons.9.dialog.2.ja': 'わたしは 1時半ごろ {駅|えき}に います。',
  'lessons.9.dialog.3.ja': 'わたしも 1時半ごろ {駅|えき}に います。',
  'lessons.9.patterns.0.examples.1.ja': '{午後|ごご}2時半です。',
  'lessons.9.writing_sample.ja': 'あつまりは 2時から 4時までです。1時半ごろ {駅|えき}に います。',
  'lessons.9.words.1.ja': '何時',
  'lessons.9.words.3.ja': '{午後|ごご}',
};
let base;
beforeAll(async () => { base = await loadBase(BASE); });
const derive = patch => deriveNotation(base, applyPatch(base.bundle.manuscript, patch));

describe('조각 치환 파생 — 바탕 재현', () => {
  it('바뀐 것이 없으면 8a8c와 바이트 단위로 같다(판본 ID · index.html · app.js · sourceIndex 1,147개)', () => {
    const same = derive({});
    expect(same.editionId).toBe('8a8c1c1fd452773810abaf8c');
    expect(same.html).toBe(base.html);
    expect(same.app).toBe(base.app);
    expect(same.bundle.sourceIndex).toEqual(base.bundle.sourceIndex);
    expect(Object.keys(same.bundle.sourceIndex)).toHaveLength(1147);
    expect(same.bundle.contentHash).toBe(base.bundle.contentHash);
  });
  it('루비 없는 한자(lang="ja" 안, 루비 밖)는 바탕에 1,421자 — 1단계는 이 목록을 바꾸지 않는다', () => {
    expect(bareKanji(base.html)).toHaveLength(1421);
  });
});

describe('10과 표본', () => {
  it('7문자열 → 7조각 치환, sourceIndex 4곳만 바뀌고 루비 없는 한자 목록은 그대로', () => {
    const r = derive(U10);
    expect(r.report).toMatchObject({ changes: 7, renders: 7, replaced: 7, changedSources: 4, bareKanji: 1421 });
    expect(r.editionId).toMatch(/^[a-f0-9]{24}$/);
    expect(r.editionId).not.toBe('8a8c1c1fd452773810abaf8c');
    expect(r.html).toContain('<span class="phrase">わたしは</span> <span class="phrase"><ruby>1時<rt>いちじ</rt></ruby><ruby>半<rt>はん</rt></ruby>ごろ</span> <span class="phrase"><ruby>駅<rt>えき</rt></ruby>に</span>');
    expect(r.html).toContain('<span class="phrase"><ruby>午後<rt>ごご</rt></ruby><ruby>2時<rt>にじ</rt></ruby>からです。</span>');
    expect(r.html).not.toContain('8a8c1c1fd452773810abaf8c');
    expect(r.bundle.artifactManifest).toMatchObject({ baseEdition: '8a8c1c1fd452773810abaf8c', inheritedMedia: base.bundle.artifactManifest.inheritedMedia, pages: 502 });
    expect(r.bundle.assets['style.css']).toEqual(base.bundle.assets['style.css']);
  });
  it('찾아보기는 가나로 계속 찾아진다 — data-search 목록이 바탕과 같다(1단계는 lexicon을 바꾸지 않는다)', () => {
    const r = derive(U10);
    const search = html => (html.match(/data-search="[^"]*"/g) || []);
    expect(search(r.html)).toEqual(search(base.html));
    expect(search(r.html).filter(s => s.includes('ごご')).length).toBeGreaterThan(0);
    expect(search(r.html).filter(s => s.includes('えき')).length).toBeGreaterThan(0);
  });
  it('서버 검증 형태 — 바뀐 sourceIndex 글은 rt를 뺀 바탕 글자(駅 · 午後)를 담는다', () => {
    const r = derive(U10);
    const changed = Object.entries(r.bundle.sourceIndex).filter(([id, v]) => v.text !== base.bundle.sourceIndex[id].text);
    expect(changed.map(([id]) => id).sort()).toEqual(['u10-dialogue', 'u10-patterns', 'u10-practice', 'u10-start'].sort());
    // 인라인 표기 · rt가 새지 않는다. 같은 쪽의 인라인 틀(답 · 선택지)은 1단계에서 가나 그대로라 「えきに」가 남을 수 있다.
    for (const [, v] of changed) { expect(v.text).not.toMatch(/[{}|]|<rt>|えきえき|ごごごご/); }
    expect(changed.some(([, v]) => v.text.includes('駅に'))).toBe(true);
    expect(changed.some(([, v]) => v.text.includes('午後2時'))).toBe(true);
  });
});

describe('거절해야 하는 것', () => {
  it.each([
    ['그 과 지도에 있는 키를 인라인으로', { 'lessons.9.words.1.ja': '{何時|なんじ}' }, /지도에 있다/],
    ['읽기 없는 한자', { 'lessons.9.dialog.2.ja': 'わたしは 1時半ごろ 駅に います。' }, /표기 외 변경|루비 없는 한자/],
    ['지도 키와 합쳐 틀린 읽기(何 + 지도 時)', { 'lessons.9.words.1.ja': '{何|なに}時' }, /표기 외 변경/],
    ['낱말 바꾸기', { 'lessons.9.dialog.1.ja': '{午前|ごぜん}2時からです。' }, /표기 외 변경/],
  ])('%s', (_name, patch, message) => {
    expect(() => derive(patch)).toThrow(message);
  });
  it('1단계 범위 밖 — 표기만 같아도 선택지(인라인 틀)는 바꾸지 않는다', () => {
    const option = base.bundle.manuscript.lessons[9].checks[0].options[0], first = [...option][0];
    expect(() => derive({ 'lessons.9.checks.0.options.0': `{${first}|${first}}${option.slice(first.length)}` })).toThrow(/1단계 범위 밖/);
  });
  // 가나형이 같도록 첫 글자에 같은 글자를 인라인으로 단 「표기만 바뀐」 변경 — 표기 외 계약은 통과하고 자격 규칙만 시험한다.
  const sameKana = text => { const first = [...text][0]; return `{${first}|${first}}${text.slice(first.length)}`; };
  it.each([
    ['2단계 필드와 렌더 공유', 'shared-with-non-stage1'],
  ])('%s(1단계 제외)는 바꾸지 않는다', (_name, reason) => {
    const target = stage1Eligibility(base, { fromLesson: 10 }).excluded.find(e => e.reason === reason);
    expect(target).toBeTruthy();
    expect(() => derive({ [target.path]: sameKana(target.text) })).toThrow(new RegExp(`1단계 제외\\(${reason}\\)`));
  });
  it('같은 렌더 묶음은 함께 · 같은 새 표기로 — 하나만 바꾸면 거절', () => {
    const member = stage1Eligibility(base, { fromLesson: 10 }).eligible.find(e => e.group);
    expect(member).toBeTruthy();
    expect(() => derive({ [member.path]: sameKana(member.text) })).toThrow(/같은 렌더 묶음/);
    const all = Object.fromEntries(member.group.map(p => [p, sameKana(member.text)]));
    expect(() => derive(all)).not.toThrow();
  });
  it('1–9과는 가나 중심 유지 · 문항이 아닌 필드라도 row label(인라인 틀)은 1단계가 아니다', () => {
    expect(() => derive({ 'lessons.2.words.0.ja': sameKana(base.bundle.manuscript.lessons[2].words[0].ja) })).toThrow(/가나 중심 유지/);
    const li = base.bundle.manuscript.lessons.findIndex((l, i) => i >= 9 && l.study_pages?.some(sp => sp.rows?.some(r => /[\u3040-\u30ff]/.test(r.label))));
    const si = base.bundle.manuscript.lessons[li].study_pages.findIndex(sp => sp.rows?.some(r => /[\u3040-\u30ff]/.test(r.label)));
    const ri = base.bundle.manuscript.lessons[li].study_pages[si].rows.findIndex(r => /[\u3040-\u30ff]/.test(r.label));
    const label = base.bundle.manuscript.lessons[li].study_pages[si].rows[ri].label;
    expect(() => derive({ [`lessons.${li}.study_pages.${si}.rows.${ri}.label`]: sameKana(label) })).toThrow(/1단계 범위 밖/);
  });
});

describe('1단계 범위(10–42과, 오케스트레이터 확정 필드)', () => {
  it('대상 832개(가나만 528) · 읽기표 줄 121 · 제외 38개(1단계 밖과 렌더 공유 37 · 인라인 틀 1) — 과별로 나눌 수 있는 렌더는 과마다 따로', () => {
    const { eligible, excluded } = stage1Eligibility(base, { fromLesson: 10 });
    expect(eligible).toHaveLength(832);
    expect(eligible.filter(e => !/\p{Script=Han}/u.test(e.text))).toHaveLength(528);
    const by = reason => excluded.filter(e => e.reason === reason).length;
    expect({ total: excluded.length, shared: by('shared-with-non-stage1'), kana: by('shared-with-kana-lessons'), inline: by('inline-template'), mismatch: by('render-mismatch') }).toEqual({ total: 38, shared: 37, kana: 0, inline: 1, mismatch: 0 });
    const rows = [];
    base.bundle.manuscript.lessons.forEach((l, li) => { if (l.number >= 10) (l.study_pages || []).forEach((sp, si) => (sp.rows || []).forEach((r, ri) => { if (isReadingRow(base.bundle.manuscript, `lessons.${li}.study_pages.${si}.rows.${ri}.ja`)) rows.push(r); })); });
    expect(rows).toHaveLength(121);
  });
  it('읽기표 줄(label 何歳 → ja なんさい)은 바꾸지 않고, 같은 렌더의 단어도 함께 빠진다(11과 なんさい)', () => {
    expect(isReadingRow(base.bundle.manuscript, 'lessons.10.study_pages.5.rows.11.ja')).toBe(true);
    expect(() => derive({ 'lessons.10.study_pages.5.rows.11.ja': 'なん{歳|さい}' })).toThrow(/읽기표 줄/);
    expect(() => derive({ 'lessons.10.words.5.ja': 'なん{歳|さい}' })).toThrow(/1단계 제외\(shared-with-non-stage1\)/);
  });
  it('같은 가나라도 과마다 다른 낱말로 — はる(24과 貼る · 33과 春), 1–9과와 같은 가나여도 10과 이후만 바꾼다', () => {
    const at = path => path.split('.').reduce((o, k) => o[k], base.bundle.manuscript);
    expect([at('lessons.24.words.7.ja'), at('lessons.33.words.4.ja')]).toEqual(['はる', 'はる']);
    const r = derive({ 'lessons.24.words.7.ja': '{貼|は}る', 'lessons.33.words.4.ja': '春' }); // 34과는 지도에 春 — 맨글
    expect(r.html).toContain('<ruby>貼<rt>は</rt></ruby>る');
    expect(r.html).toContain('<span class="phrase"><ruby>春<rt>はる</rt></ruby></span>');
    // 1–9과에도 있는 가나(28과 がくせい)를 10과 이후에서만 바꿔도 1–9과의 가나는 그대로 남는다.
    expect(at('lessons.28.words.4.ja')).toBe('がくせい');
    const before = (base.html.match(/<span class="phrase">がくせい<\/span>/g) || []).length;
    const r2 = derive({ 'lessons.28.words.4.ja': '{学生|がくせい}' });
    expect((r2.html.match(/<span class="phrase">がくせい<\/span>/g) || []).length).toBe(before - 1);
  });
});

describe('오변환 안전망 · 섞인 표기 통일', () => {
  const at = path => path.split('.').reduce((o, k) => o[k], base.bundle.manuscript);
  it('「いけません」 → 「{池|いけ}ません」은 가나형이 같아 계약을 통과하지만, 명사 읽기 + 활용 어미 경고로 잡힌다(Data 판 4 실측 5곳)', () => {
    const p = 'lessons.26.patterns.1.examples.1.ja';
    expect(at(p)).toBe('ここで たべては いけません。');
    const wrong = applyPatch(base.bundle.manuscript, { [p]: 'ここで 食べては {池|いけ}ません。' });
    expect(misreadWarnings(base.bundle.manuscript, wrong)).toEqual([expect.objectContaining({ path: p, token: '池', reading: 'いけ', ending: 'ませ', lexicon: 'lex-606' })]);
    const right = applyPatch(base.bundle.manuscript, { [p]: 'ここで 食べては いけません。' });
    expect(misreadWarnings(base.bundle.manuscript, right)).toEqual([]);
    expect(misreadWarnings(base.bundle.manuscript, structuredClone(base.bundle.manuscript))).toEqual([]);
  });
  it('파생 보고에 경고가 실린다(거절은 하지 않는다 — 판정은 표 검수)', () => {
    expect(derive(U10).report.misread).toEqual([]);
  });
  it('「友だち」 → 「友達」: 友가 그 과 지도 키여도 {友達|ともだち} 통째 인라인(루비 하나) · 友{達|だち}(루비 둘) 모두 통과, 맨 「友達」은 거절', () => {
    const p = 'lessons.22.patterns.1.examples.0.ja';
    expect(at(p)).toBe('友だちが うちへ あそびに きます。');
    expect(base.bundle.manuscript.lessons[22].kanji['友']).toBe('とも');
    expect(derive({ [p]: '{友達|ともだち}が うちへ あそびに きます。' }).html).toContain('<ruby>友達<rt>ともだち</rt></ruby>が');
    expect(derive({ [p]: '友{達|だち}が うちへ あそびに きます。' }).html).toContain('<ruby>友<rt>とも</rt></ruby><ruby>達<rt>だち</rt></ruby>が');
    expect(() => derive({ [p]: '友達が うちへ あそびに きます。' })).toThrow(/표기 외 변경/);
    // 찾아보기: lexicon lex-035 spellings에 友達이 이미 있다(1단계는 lexicon을 바꾸지 않는다).
    expect(base.bundle.manuscript.lexicon.find(x => x.id === 'lex-035').spellings).toContain('友達');
  });
});
