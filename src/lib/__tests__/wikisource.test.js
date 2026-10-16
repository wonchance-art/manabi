import { describe, expect, it } from 'vitest';
import {
  WS_LICENSE, createWikisourceDraft, parseWikisourceFragment, splitBlocks, wikisourceRightsPublishable, wikisourceRightsVerdict, charCount, wordCount,
} from '../wikisource.js';

// Wikisource 정본 책(LIT-SRC-WS-1, 오너 「같이해. 위 3편+3편+1편(레미제라블 추가). 간체와 번체 옵션 같이」 2026-10-17 KST) —
// 본문 조각 파서(fail-closed) · 고유명사 밑줄 · 장 나눔 · 간체/번체 대조 · 권리 판정(원산국 만료 — 중국 50 · 프랑스 70(+전쟁 30) · 한국은 상호주의 · 미국 기준 없음).

const wrap = (inner) => `<div class="prp-pages-output" lang="fr">\n${inner}\n</div>\n`;
const pagenum = '<span><span class="pagenum ws-pagenum" id="2" title="Page:x.djvu/14"></span></span>';
const underline = (text) => `<span style="text-decoration: underline;-moz-text-decoration-style: solid;text-decoration-style: solid;text-underline-offset:0.25em;">${text}</span>`;

describe('parseWikisourceFragment — 본문만, 모르는 구조는 실패', () => {
  it('머리·꼬리 틀 · 쪽 번호 · 삽화 · 각주 · 장식 첫 글자를 빼고 문단만 — 제목은 headings로', () => {
    const fragment = wrap([
      '<div itemscope=""><div id="headertemplate" class="ws-noexport"><div class="headertemplate">Alphonse Daudet <a>La Dernière classe</a></div></div><div id="ws-data" class="ws-noexport" style="display:none"><span class="ws-year">1880</span></div></div>',
      '<style>.x{}</style><link rel="mw-deduplicated-inline-style" href="x">',
      `<p>${pagenum}\n</p><p><br>\n</p>`,
      '<h3 id="X" class="tmp mw-html-heading"><span id="Y"></span> <i>LA DERNIÈRE CLASSE</i></h3>',
      '<div style="padding-bottom: 1em;"> </div>',
      '<div style="text-align:center;clear:both;">(<span class="sc">récit d’un petit alsacien</span>)</div>',
      '<p><span style="font-size:0; line-height:0; display:block" class="lettrine"><br></span><span style="display:block;float:left;"><span class="lettrine-lettre" style="display:block">C</span></span><span class="sc">e</span> matin-là, <abbr class="abbr" title="Monsieur">M.</abbr>&nbsp;Hamel nous avait dit<sup id="c1" class="reference"><a href="#n1">1</a></sup>&nbsp;: '
        + `${pagenum}\n</p>`,
      '<div class="skin-invert"><figure class="mw-halign-center"><span><img alt="Séparateur" src="x.png"></span><figcaption></figcaption></figure></div>',
      '<ol class="references"><li id="n1">Une note.</li></ol>',
    ].join('\n'));
    const { headings, blocks } = parseWikisourceFragment(fragment);
    expect(headings).toEqual(['LA DERNIÈRE CLASSE']);
    expect(blocks.map((block) => block.text)).toEqual(['(récit d’un petit alsacien)', 'Ce matin-là, M. Hamel nous avait dit :']);
  });

  it('표(계산서)는 제목 줄 + 행마다 한 줄의 문단', () => {
    const { blocks } = parseWikisourceFragment(wrap('<table><caption><div style="text-align:center">Note du n<sup>o</sup> 1</div></caption><tbody><tr><td><div class="ws-pds-dots"><span>Souper</span></div></td><td>fr. <span>&nbsp;&nbsp;</span>3</td></tr><tr><td>Chambre</td><td>fr. 10</td></tr></tbody></table>'));
    expect(blocks.map((block) => block.text)).toEqual(['Note du no 1\nSouper fr. 3\nChambre fr. 10']);
  });

  it('중국어 고유명사 밑줄(专名线) → 블록 좌표의 이름 자리', () => {
    const { blocks } = parseWikisourceFragment(wrap(`<p>${underline('鲁镇')}的酒店的格局……我从十二岁起，便在镇口的${underline('咸亨酒店')}里当伙计。\n</p><div class="wst-right">（一九一九年三月。）</div>`));
    expect(blocks[0].text).toBe('鲁镇的酒店的格局……我从十二岁起，便在镇口的咸亨酒店里当伙计。');
    expect(blocks[0].names.map(({ start, end }) => blocks[0].text.slice(start, end))).toEqual(['鲁镇', '咸亨酒店']);
    expect(blocks[1].text).toBe('（一九一九年三月。）');
  });

  it('블록 사이 맨 글자(쪽이 이어지는 자리)는 그 자리의 문단 — 버리지 않는다 · 목록 항목 · <center>도 문단', () => {
    const { blocks } = parseWikisourceFragment(wrap('<p>Puis le silence.\n</p>\nLes soldats commencèrent la fouille. <span>suite</span>\n<p>Fin.</p><dl><dd><dl><dd>Unité. Blanchard.</dd>\n<dd>Barra.</dd></dl></dd></dl><center><b>III</b><br><br><b>APPARITION</b></center>'));
    expect(blocks.map((block) => block.text)).toEqual(['Puis le silence.', 'Les soldats commencèrent la fouille. suite', 'Fin.', 'Unité. Blanchard.', 'Barra.', 'III\nAPPARITION']);
  });

  it('모르는 태그(블록 안 · 블록 사이) · 빈 본문 · 모르는 문자 참조는 throw', () => {
    expect(() => parseWikisourceFragment(wrap('<p>texte <video src="x"></video></p>'))).toThrow(/모르는 태그/u);
    expect(() => parseWikisourceFragment(wrap('<p>a</p> texte <video src="x"></video> perdu'))).toThrow(/모르는 태그/u);
    expect(() => parseWikisourceFragment(wrap('<p>&bogus;</p>'))).toThrow(/문자 참조/u);
    expect(() => parseWikisourceFragment(wrap(`<p>${pagenum}</p>`))).toThrow(/문단이 없다/u);
    expect(() => parseWikisourceFragment('<p>x</p>')).toThrow(/본문 조각이 아니다/u);
  });
});

describe('splitBlocks — 블록 경계로 고르게', () => {
  it('분량(글자 · 단어) 목표로 n개, 빈 묶음 없음', () => {
    const blocks = Array.from({ length: 10 }, (_, index) => `${'字'.repeat(500)}${index}`);
    expect(splitBlocks(blocks, 2500, charCount).map((group) => group.length)).toEqual([5, 5]);
    expect(splitBlocks(['un deux trois'], 2200, wordCount)).toEqual([['un deux trois']]);
  });
});

describe('권리 — 원산국 만료(한국은 상호주의), 기준 연도는 검토일', () => {
  const base = { publishedYear: 1921, authorDeathYear: 1936, countryOfOrigin: 'CN', rights: { reviewedAt: '2026-10-17' } };
  it('중국(사후 50년) · 프랑스(사후 70년, 전쟁 연장 +30) — 본국에서 끝나면 한국도 끝(상호주의) · 미국 기준 없음', () => {
    expect(wikisourceRightsVerdict(base).ok).toBe(true);
    expect(wikisourceRightsVerdict({ ...base, authorDeathYear: 1966 }).ok).toBe(true); // 중국 사후 50년 만료 → 한국 상호주의(老舍 1966)
    expect(wikisourceRightsVerdict({ ...base, authorDeathYear: 1976 }).reasons.join()).toMatch(/원산국/u);
    expect(wikisourceRightsVerdict({ ...base, publishedYear: 1940 }).ok).toBe(true); // 출판 연도로 막지 않는다(미국 선 없음)
    const fr = { publishedYear: 1884, authorDeathYear: 1893, countryOfOrigin: 'FR', mortPourLaFrance: false, rights: { reviewedAt: '2026-10-17' } };
    expect(wikisourceRightsVerdict(fr).ok).toBe(true);
    expect(wikisourceRightsVerdict({ ...fr, authorDeathYear: 1990, mortPourLaFrance: null }).reasons.join()).toMatch(/mortPourLaFrance/u);
    // 생텍쥐페리형 — 프랑스에선 전쟁 연장으로 보호 중이지만 한국은 1962년 이전 사망이라 만료(2013 연장 전 끝남)
    expect(wikisourceRightsVerdict({ ...fr, authorDeathYear: 1944, publishedYear: 1943, mortPourLaFrance: true })).toMatchObject({ ok: true, basis: 'korea-term' });
    expect(wikisourceRightsVerdict({ ...fr, authorDeathYear: 1990, countryOfOrigin: 'DE' }).reasons.join()).toMatch(/판정 규칙이 없다/u);
    expect(wikisourceRightsVerdict({ ...fr, translator: 'X' }).reasons.join()).toMatch(/번역본/u);
  });
  it('게시 가능 = 승인 · 퍼블릭 도메인 · 원산국/한국 검토 · 위키문헌 라이선스 · 판정 통과', () => {
    const literature = { ...base, provider: 'wikisource', license: WS_LICENSE, rights: { status: 'approved', basis: 'public-domain', reviewedJurisdictions: ['CN', 'KR'], reviewedAt: '2026-10-17' } };
    expect(wikisourceRightsPublishable(literature)).toBe(true);
    expect(wikisourceRightsPublishable({ ...literature, rights: { ...literature.rights, reviewedJurisdictions: ['CN'] } })).toBe(false);
    expect(wikisourceRightsPublishable({ ...literature, license: 'CC0-1.0' })).toBe(false);
    expect(wikisourceRightsPublishable({ ...literature, provider: 'aozora' })).toBe(false);
  });
});

describe('createWikisourceDraft — 장 모양 · 간체/번체 · 이름 자리', () => {
  const zhEntry = (files) => ({
    schemaVersion: 1, provider: 'wikisource', wiki: 'zh', key: 'ws-zh-lu-xun_kong-yi-ji', main: '孔乙己', url: 'https://zh.wikisource.org/wiki/%E5%AD%94%E4%B9%99%E5%B7%B1',
    title: '孔乙己', author: '鲁迅', level: 'H5 고급', publishedYear: 1919, authorDeathYear: 1936, countryOfOrigin: 'CN', fetchedAt: '2026-10-17',
    rights: { status: 'approved', basis: 'public-domain', reviewedJurisdictions: ['CN', 'KR'], reviewer: 'claude', reviewedAt: '2026-10-17' },
    display: { titleKo: '쿵이지', authorKo: '루쉰' },
    files,
  });
  const files = [{ page: '孔乙己', revid: 1, timestamp: 't', variants: [{ variant: 'zh-hans', path: '001.zh-hans.html', extract: 'prp', sha256: 'a'.repeat(64) }, { variant: 'zh-hant', path: '001.zh-hant.html', extract: 'prp', sha256: 'b'.repeat(64) }] }];
  const hans = wrap(`<p>${underline('鲁镇')}的酒店。\n</p><p>我从十二岁起。\n</p>`);
  const hant = wrap(`<p>${underline('魯鎭')}的酒店。\n</p><p>我從十二歲起。\n</p>`);

  it('간체가 정본(rawText) · 같은 길이의 번체는 metadata.scriptVariants · 고유명사 밑줄은 nameMarks(장 좌표)', () => {
    const draft = createWikisourceDraft(zhEntry(files), [{ path: '001.zh-hans.html', text: hans }, { path: '001.zh-hant.html', text: hant }]);
    const [chapter] = draft.chapters;
    expect(chapter.rawText).toBe('鲁镇的酒店。\n\n我从十二岁起。');
    expect(chapter.metadata.scriptVariants['zh-hant']).toBe('魯鎭的酒店。\n\n我從十二歲起。');
    expect(chapter.metadata.scriptVariants['zh-hant']).toHaveLength(chapter.rawText.length);
    expect(chapter.metadata.literature.nameMarks).toEqual([{ start: 0, end: 2, base: '鲁镇' }]);
    expect(chapter.metadata.literature).toMatchObject({ provider: 'wikisource', wiki: 'zh', license: WS_LICENSE, script: 'zh-hans', scriptVariants: ['zh-hant'] });
    expect(chapter.metadata.literature.edits).toContain('script-variant-by-wikisource');
    expect(chapter.metadata.book).toEqual({ key: 'ws-zh-lu-xun_kong-yi-ji', title: '孔乙己', author: '鲁迅', order: 1, total: 1 });
    expect(chapter.materialTitle).toBe('孔乙己 — 孔乙己');
  });

  it('간체·번체 문단 수나 길이가 다르면 그 작품은 실패(글자판을 맞춰 보여 줄 수 없다)', () => {
    const shorter = wrap('<p>魯鎭的酒店。\n</p>');
    expect(() => createWikisourceDraft(zhEntry(files), [{ path: '001.zh-hans.html', text: hans }, { path: '001.zh-hant.html', text: shorter }])).toThrow(/문단 수/u);
    const longer = wrap('<p>魯鎭的大酒店。\n</p><p>我從十二歲起。\n</p>');
    expect(() => createWikisourceDraft(zhEntry(files), [{ path: '001.zh-hans.html', text: hans }, { path: '001.zh-hant.html', text: longer }])).toThrow(/길이/u);
  });

  it('권리 판정 불가 · 글자판 목록 불일치 · 키 형식은 throw', () => {
    const texts = [{ path: '001.zh-hans.html', text: hans }, { path: '001.zh-hant.html', text: hant }];
    expect(() => createWikisourceDraft({ ...zhEntry(files), authorDeathYear: 1990 }, texts)).toThrow(/권리 판정/u);
    expect(() => createWikisourceDraft(zhEntry([{ ...files[0], variants: [files[0].variants[0]] }]), texts.slice(0, 1))).toThrow(/variants/u);
    expect(() => createWikisourceDraft({ ...zhEntry(files), key: 'zh-lu-xun' }, texts)).toThrow(/key/u);
  });
});

describe('한국 근대 문학(오너 「한국 근대 문학도 추가」 → 「베스트 5만」 2026-10-17 KST) — ko.wikisource', () => {
  const koFragment = (inner) => `<div class="mw-content-ltr mw-parser-output" lang="ko" dir="ltr">\n${inner}\n</div>\n`;
  it('장식 줄(🙝🙟 · ⁂)은 「⁂」 한 글자 문단 — 쪽 맨 앞·맨 뒤는 뺀다 · 위키백과 상자(noprint)·라이선스 틀은 본문이 아니다', () => {
    const { blocks } = parseWikisourceFragment(koFragment([
      '<center>🙝🙟</center>',
      '<p>새침하게 흐린 품이 눈이 올 듯하더니\n</p>',
      '<center>🙝🙟</center>',
      '<p>“설렁탕을 사다놓았는데 왜 먹지를 못하니”\n</p>',
      '<center>⁂</center>',
      '<div class="noprint" style="float: right;"><div><b>위키백과</b>에 이 글과 관련된<br>자료가 있습니다.</div></div>',
      '<div class="licenseContainer licenseBanner"><div><p>이 저작물은 퍼블릭 도메인입니다.</p></div></div>',
      '<div class="licensetpl"><p><span class="licensetpl_short">Public domain</span></p></div>',
    ].join('\n')));
    expect(blocks.map((block) => block.text)).toEqual(['새침하게 흐린 품이 눈이 올 듯하더니', '⁂', '“설렁탕을 사다놓았는데 왜 먹지를 못하니”']);
  });
  it('한국 원산 = 한국 보호기간(1962년 이전 사망 또는 사후 70년) · 검토 관할 KR 하나', () => {
    const ko = { publishedYear: 1936, authorDeathYear: 1937, countryOfOrigin: 'KR', rights: { reviewedAt: '2026-10-17' } };
    expect(wikisourceRightsVerdict(ko).ok).toBe(true); // 이상 「날개」 — 1936 발표도 막지 않는다(미국 선 없음)
    expect(wikisourceRightsVerdict({ ...ko, authorDeathYear: 1962 }).ok).toBe(true); // 2013 연장 전에 끝났다
    expect(wikisourceRightsVerdict({ ...ko, authorDeathYear: 1963 }).reasons.join()).toMatch(/한국 보호기간/u); // 이양하 「신록예찬」형
    expect(wikisourceRightsVerdict({ ...ko, authorDeathYear: 2000 }).ok).toBe(false); // 황순원 「소나기」형
    expect(wikisourceRightsPublishable({ ...ko, provider: 'wikisource', license: WS_LICENSE, rights: { status: 'approved', basis: 'public-domain', reviewedJurisdictions: ['KR'], reviewedAt: '2026-10-17' } })).toBe(true);
  });
  it('리포 7편(소설 5 · 시집 2) — 원문 고정 · 권리 통과 · 장은 글자 수(공백 뺌) 3,000자 안팎 · 초판 장정 표지', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const root = 'src/content/literature/wikisource';
    const keys = readdirSync(root).filter((name) => name.startsWith('ws-ko-')).sort();
    expect(keys).toEqual(['ws-ko-hyeon-jin-geon_unsu-joeun-nal', 'ws-ko-kim-dong-in_gamja', 'ws-ko-kim-so-wol_jindallaekkot', 'ws-ko-kim-yu-jeong_dongbaekkkot', 'ws-ko-yi-hyo-seok_memilkkot-pil-muryeop', 'ws-ko-yi-sang_nalgae', 'ws-ko-yun-dong-ju_haneulgwa-baramgwa-byeolgwa-si']);
    const manifest = JSON.parse(readFileSync(`${root}/manifest.generated.json`, 'utf8'));
    for (const key of keys) {
      const entry = JSON.parse(readFileSync(`${root}/${key}/entry.json`, 'utf8'));
      const files = entry.files.flatMap((file) => file.variants).map((item) => ({ path: item.path, text: readFileSync(`${root}/${key}/source/${item.path}`, 'utf8') }));
      const draft = createWikisourceDraft(entry, files);
      expect(draft.chapters[0].metadata.language).toBe('Korean');
      expect(draft.diagnostics.unit).toBe('chars');
      expect(draft.chapters[0].rawText.startsWith('⁂')).toBe(false);
      expect(draft.chapters.every((chapter) => charCount(chapter.rawText) > 2000 && charCount(chapter.rawText) < 3600)).toBe(true);
      expect(draft.chapters.some((chapter) => /라이선스|퍼블릭 도메인|위키백과|현대어|원문|옛한글/u.test(chapter.rawText))).toBe(false);
      expect(draft.chapters.some((chapter) => /[\u1100-\u11FF]/u.test(chapter.rawText))).toBe(false); // 옛한글 자모 없음(진달래꽃은 현대어 칸)
      expect(typeof entry.display.binding).toBe('string'); // 초판 장정(오너 「원본 책 재구성 … 표지 만들기까지 완성」)
      expect(manifest.works[key].display.binding).toBe(entry.display.binding);
    }
  });
});
