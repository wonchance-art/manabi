import { beforeAll, describe, expect, it } from 'vitest';
import { applyPatch, bareKanji, deriveNotation, loadBase } from './n5-derive-notation.mjs';

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
  it('다른 필드와 렌더를 공유하는 문자열은 바꾸지 않는다(HTML 출현 수 ≠ 원고 수)', () => {
    // 11과 이후에서 렌더 공유로 1단계에서 빠지는 낱말 하나를 찾아 바꿔 본다.
    const lessons = base.bundle.manuscript.lessons;
    let target = null;
    for (let li = 9; li < lessons.length && !target; li++) lessons[li].words.forEach((w, wi) => {
      if (target || /\p{Script=Han}/u.test(w.ja)) return;
      const render = `<span lang="ja"><span class="phrase">${w.ja}</span></span>`;
      if (base.html.split(render).length - 1 > 1) target = [`lessons.${li}.words.${wi}.ja`, w.ja];
    });
    expect(target).not.toBeNull();
    // 가나형이 같도록 첫 글자에 같은 읽기를 인라인으로 달아도(표기 외 동일) 렌더 공유라 거절된다.
    const [path, ja] = target, first = [...ja][0];
    expect(() => derive({ [path]: `{${first}|${first}}${ja.slice(first.length)}` })).toThrow(/렌더 공유|HTML 출현/);
  });
});
