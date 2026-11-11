import { beforeAll, describe, expect, it } from 'vitest';
import { applyPatch, bareKanji, deriveNotation, loadBase, stage1Eligibility } from './n5-derive-notation.mjs';

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
    ['2단계 필드와 렌더 공유', 'shared-with-stage2'],
    ['1–9과와 렌더 공유', 'shared-with-kana-lessons'],
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
  it('대상 941개(가나만 637) · 제외 50개(2단계 공유 35 · 1–9과 공유 14 · 인라인 틀 1)', () => {
    const { eligible, excluded } = stage1Eligibility(base, { fromLesson: 10 });
    expect(eligible).toHaveLength(941);
    expect(eligible.filter(e => !/\p{Script=Han}/u.test(e.text))).toHaveLength(637);
    const by = reason => excluded.filter(e => e.reason === reason).length;
    expect({ total: excluded.length, stage2: by('shared-with-stage2'), kana: by('shared-with-kana-lessons'), inline: by('inline-template'), mismatch: by('render-mismatch') }).toEqual({ total: 50, stage2: 35, kana: 14, inline: 1, mismatch: 0 });
  });
});
