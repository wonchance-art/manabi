import { describe, expect, it } from 'vitest';
import { ART_IMAGE_LICENSE_LABEL, ART_IMAGE_SOURCES, ART_SOURCES, artSourceText } from '../artSource.js';

describe('artSourceText — 출처 응답 → 카탈로그 해설 text', () => {
  it('시카고 미술관 HTML: 문단은 빈 줄, 태그는 벗기고 속 글자는 남긴다', () => {
    const html = '<p>Katsushika Hokusai’s series, <em>Thirty-Six Views of Mount Fuji</em>, was begun in 1830.</p>\n<p>The <a href="/x">Great Wave</a> &amp; Fuji.</p>\n';
    expect(artSourceText(html)).toBe(
      'Katsushika Hokusai’s series, Thirty-Six Views of Mount Fuji, was begun in 1830.\n\nThe Great Wave & Fuji.',
    );
  });

  it('ColBase 평문: CRLF만 맞추고 전각 공백·문장부호는 그대로', () => {
    expect(artSourceText('　富士を望む。\r\n　波が高い。\r\n')).toBe('　富士を望む。\n　波が高い。');
  });

  it('엔티티(이름·10진·16진)를 글자로, 모르는 엔티티는 그대로', () => {
    expect(artSourceText('a&nbsp;b &#8212; &#x2014; &lt;i&gt; &unknown;')).toBe('a\u00a0b — — <i> &unknown;');
  });

  it('<br>은 줄바꿈, 빈 줄 여럿은 하나로', () => {
    expect(artSourceText('<p>一行目<br>二行目</p>\n\n\n<p>次の段落</p>')).toBe('一行目\n二行目\n\n次の段落');
  });

  it('경계 입력: 속성 붙은 <br>, HTML 주석, NUL·범위 밖 코드 포인트', () => {
    expect(artSourceText('一<br class="y">二')).toBe('一\n二');
    expect(artSourceText('前<!-- a > b -->後')).toBe('前後');
    expect(artSourceText('&#0;x&#99999999;')).toBe('&#0;x&#99999999;');
  });

  it('출처표: 출처마다 받을 수 있는 해설 언어', () => {
    expect(ART_SOURCES.colbase.languages).toEqual(['ja', 'en']);
    expect(ART_SOURCES.aic.languages).toEqual(['en']);
    expect(ART_SOURCES.colbase.rawText({ common: { description: '<p>日</p>', descriptionEn: 'en' } }, 'ja')).toBe('<p>日</p>');
    expect(ART_SOURCES.colbase.rawText({ common: { description: '日', descriptionEn: 'en' } }, 'en')).toBe('en');
    expect(ART_SOURCES.aic.rawText({ data: { description: '<p>x</p>' } })).toBe('<p>x</p>');
  });

  it('스냅샷(ART-AUTO-1): 응답에서 빌드가 쓰는 필드만, 원문 HTML은 받은 그대로', () => {
    const colbase = ART_SOURCES.colbase.snapshot({ id: 'cobas-1', rdfindex: {}, common: {
      linkUrl: 'https://colbase.nich.go.jp/collection_items/tnm/A-1', provider: 'tnm', title: '題', temporal: ['江戸時代'],
      contributor: ['東京国立博物館'], description: '<p>日<br /></p>', thumbnailUrl: ['x'] } }, 'cobas-1');
    expect(colbase).toEqual({ id: 'cobas-1', linkUrl: 'https://colbase.nich.go.jp/collection_items/tnm/A-1', provider: 'tnm', title: '題',
      temporal: ['江戸時代'], contributor: ['東京国立博物館'], description: '<p>日<br /></p>' });
    expect(ART_SOURCES.colbase.snapshotRaw(colbase, 'ja')).toBe('<p>日<br /></p>');
    expect(ART_SOURCES.colbase.snapshotUrl(colbase)).toBe('https://colbase.nich.go.jp/collection_items/tnm/A-1');
    expect(ART_SOURCES.colbase.snapshotUrl({ ...colbase, linkUrl: null })).toBe('https://jpsearch.go.jp/item/cobas-1');
    expect(ART_SOURCES.colbase.credit(colbase)).toBe('ColBase(국립문화재기구) · 도쿄 국립박물관 소장 · 재팬서치 경유 · 편집: 서식 기호만 지우고 글자는 그대로');
    expect(ART_SOURCES.colbase.credit({ ...colbase, provider: 'kyohaku-x' })).toBeNull();
    const aic = ART_SOURCES.aic.snapshot({ data: { id: 7, title: 'T', date_display: '1857', description: '<p>x</p>', image_id: 'i' } });
    expect(aic).toEqual({ id: 7, title: 'T', date_display: '1857', description: '<p>x</p>' });
    expect(ART_SOURCES.aic.snapshotUrl(aic)).toBe('https://www.artic.edu/artworks/7');
    expect(ART_SOURCES.aic.apiUrl('7')).toContain('date_display');
  });

  it('그림 출처표: 메트는 isPublicDomain일 때만 CC0, 캡션은 기록 그대로', () => {
    const record = ART_IMAGE_SOURCES.met.record({ artistDisplayName: 'A', title: 'T', objectDate: '1857', creditLine: 'Gift', isPublicDomain: true, primaryImage: 'x' });
    expect(record).toEqual({ artistDisplayName: 'A', title: 'T', objectDate: '1857', creditLine: 'Gift', isPublicDomain: true });
    expect(ART_IMAGE_SOURCES.met.license(record)).toBe('cc0');
    expect(ART_IMAGE_SOURCES.met.license({ ...record, isPublicDomain: false })).toBeNull();
    expect(ART_IMAGE_SOURCES.met.credit(record, ART_IMAGE_LICENSE_LABEL.cc0)).toBe('A. T, 1857. The Metropolitan Museum of Art, Gift. CC0');
    expect(ART_IMAGE_SOURCES.commons.credit({ artist: 'A', title: 'T', date: '1857', holder: 'Rijksmuseum, Amsterdam', accession: 'RP-1' }, 'CC0'))
      .toBe('A. T, 1857. Rijksmuseum, Amsterdam, RP-1. CC0 (via Wikimedia Commons)');
  });

  it('ColBase 그림(ART-GENRE-001): 항목 권리가 ccby이고 소장관을 알 때만 CC BY 4.0, 캡션이 소장관·ColBase·라이선스를 밝힌다', () => {
    const json = { common: { title: '読書', contributor: ['黒田清輝筆', 'By Kuroda Seiki'], provider: 'tnm', contentsRightsType: 'ccby',
      contentsUrl: ['https://colbase.nich.go.jp/media/tnm/A-1/image/slideshow_s/A-1.jpg'], linkUrl: 'https://colbase.nich.go.jp/collection_items/tnm/A-1' } };
    const record = ART_IMAGE_SOURCES.colbase.record(json);
    expect(record).toEqual({ title: '読書', contributor: '黒田清輝筆', provider: 'tnm', contentsRightsType: 'ccby',
      contentsUrl: 'https://colbase.nich.go.jp/media/tnm/A-1/image/slideshow_s/A-1.jpg' });
    expect(ART_IMAGE_SOURCES.colbase.sourceUrl(json)).toBe('https://colbase.nich.go.jp/collection_items/tnm/A-1');
    expect(ART_IMAGE_SOURCES.colbase.license(record)).toBe('cc-by-4.0');
    expect(ART_IMAGE_SOURCES.colbase.license({ ...record, contentsRightsType: 'incr' }), '권리 표기가 다르면 쓰지 않는다').toBeNull();
    expect(ART_IMAGE_SOURCES.colbase.license({ ...record, provider: 'unknown' }), '모르는 소장관').toBeNull();
    expect(ART_IMAGE_SOURCES.colbase.credit(record, ART_IMAGE_LICENSE_LABEL['cc-by-4.0']))
      .toBe('読書 · 黒田清輝筆 · 도쿄 국립박물관 소장 · ColBase(국립문화재기구) · CC BY 4.0');
    expect(ART_IMAGE_LICENSE_LABEL['public-domain']).toBe('Public domain');
  });

  it('문화유산 온라인 해설(ART-GENRE-001): CC BY 4.0, 문화청 자료(bunkazai)만 크레딧을 만든다', () => {
    const json = { id: 'bunka-1', common: { linkUrl: 'https://online.bunka.go.jp/db/heritages/detail/1', provider: 'bunkazai', title: '甲', temporal: ['1914'], description: '\u3000本文。\n', contentsUrl: ['x'] } };
    const snapshot = ART_SOURCES.bunka.snapshot(json, 'bunka-1');
    expect(snapshot).toEqual({ id: 'bunka-1', linkUrl: 'https://online.bunka.go.jp/db/heritages/detail/1', provider: 'bunkazai', title: '甲', temporal: ['1914'], description: '\u3000本文。\n' });
    expect(artSourceText(ART_SOURCES.bunka.snapshotRaw(snapshot)), '문단 머리 전각 공백은 그대로').toBe('\u3000本文。');
    expect(ART_SOURCES.bunka.snapshotUrl(snapshot)).toBe('https://online.bunka.go.jp/db/heritages/detail/1');
    expect(ART_SOURCES.bunka.license).toBe('cc-by-4.0');
    expect(ART_SOURCES.bunka.credit(snapshot)).toBe('문화유산 온라인(문화청) · 재팬서치 경유 · 편집: 서식 기호만 지우고 글자는 그대로');
    expect(ART_SOURCES.bunka.credit({ ...snapshot, provider: 'apmoa' }), '미술관이 올린 해설은 크레딧을 만들지 않는다').toBeNull();
  });

  it('문자열이 아니면 빈 문자열', () => {
    expect(artSourceText(null)).toBe('');
    expect(artSourceText(undefined)).toBe('');
  });
});
