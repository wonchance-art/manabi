import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import {
  aozoraCandidateIssues, aozoraIndexWorks, colophonFirstAppearanceYear, decodeAozoraText, firstYear, parseAozoraRanking,
  parseCsv, unzipEntries,
} from './aozora-index.mjs';

// 작품 추가 자동화(scripts/literature/candidates.mjs · add-work.mjs)의 순수 부품 — 공식 색인 CSV 실물 머리글·행 모양으로 고정한다.
const HEADER = '作品ID,作品名,作品名読み,ソート用読み,副題,副題読み,原題,初出,分類番号,文字遣い種別,作品著作権フラグ,公開日,最終更新日,図書カードURL,人物ID,姓,名,姓読み,名読み,姓読みソート用,名読みソート用,姓ローマ字,名ローマ字,役割フラグ,生年月日,没年月日,人物著作権フラグ,底本名1,底本出版社名1,底本初版発行年1,入力に使用した版1,校正に使用した版1,底本の親本名1,底本の親本出版社名1,底本の親本初版発行年1,底本名2,底本出版社名2,底本初版発行年2,入力に使用した版2,校正に使用した版2,底本の親本名2,底本の親本出版社名2,底本の親本初版発行年2,入力者,校正者,テキストファイルURL,テキストファイル最終更新日,テキストファイル符号化方式,テキストファイル文字集合,テキストファイル修正回数,XHTML/HTMLファイルURL,XHTML/HTMLファイル最終更新日,XHTML/HTMLファイル符号化方式,XHTML/HTMLファイル文字集合,XHTML/HTMLファイル修正回数';
const columns = HEADER.split(',');
const row = (values) => columns.map((name) => `"${String(values[name] ?? '').replaceAll('"', '""')}"`).join(',');
const rashomon = {
  作品ID: '000127', 作品名: '羅生門', 作品名読み: 'らしょうもん', 初出: '「帝国文学」1915（大正4）年11月', 文字遣い種別: '新字新仮名',
  作品著作権フラグ: 'なし', 図書カードURL: 'https://www.aozora.gr.jp/cards/000879/card127.html', 人物ID: '000879', 姓: '芥川', 名: '竜之介',
  役割フラグ: '著者', 没年月日: '1927-07-24', 人物著作権フラグ: 'なし',
  テキストファイルURL: 'https://www.aozora.gr.jp/cards/000879/files/127_ruby_150.zip', テキストファイル文字集合: 'JIS X 0208',
};
const csv = (...rows) => `﻿${HEADER}\r\n${rows.map(row).join('\r\n')}\r\n`;

describe('공식 색인 CSV → 작품', () => {
  it('BOM·따옴표 안 쉼표·이중 따옴표·CRLF를 푼다', () => {
    expect(parseCsv('﻿a,b\r\n"x,1","say ""hi"""\r\n')).toEqual([{ a: 'x,1', b: 'say "hi"' }]);
  });

  it('작품별로 묶고 저자·연도·주소를 정리한다', () => {
    const works = aozoraIndexWorks(parseCsv(csv(rashomon)));
    const work = works.get('127');
    expect(work).toMatchObject({ title: '羅生門', titleReading: 'らしょうもん', publishedYear: 1915, charset: '新字新仮名' });
    expect(work.author).toMatchObject({ personId: '000879', name: '芥川竜之介', deathYear: 1927 });
    expect(aozoraCandidateIssues(work)).toEqual([]);
  });

  it('선정 기준 밖이면 이유를 모두 적는다 — 번역자 행 · 旧仮名 · 저작권 존속 · JP 보호(1931년 이전 출판이어도 1968년 이후 사망)', () => {
    const translated = aozoraIndexWorks(parseCsv(csv(rashomon, { ...rashomon, 人物ID: '000001', 姓: '某', 名: '訳者', 役割フラグ: '翻訳者', 没年月日: '1990-01-01' }))).get('127');
    expect(aozoraCandidateIssues(translated)).toEqual(expect.arrayContaining(['저자 외 역할(翻訳者)']));
    const old = aozoraIndexWorks(parseCsv(csv({ ...rashomon, 文字遣い種別: '新字旧仮名' }))).get('127');
    expect(aozoraCandidateIssues(old)).toEqual(['文字遣い種別 新字旧仮名(新字新仮名만)']);
    const kawabata = aozoraIndexWorks(parseCsv(csv({ ...rashomon, 初出: '「文藝時代」1926（大正15）年', 没年月日: '1972-04-16' }))).get('127');
    expect(aozoraCandidateIssues(kawabata)).toEqual(['보호기간 JP·KR 미확인/보호']);
    const rampo = aozoraIndexWorks(parseCsv(csv({ ...rashomon, 初出: '「新青年」1925（大正14）年', 没年月日: '1965-07-28' }))).get('127');
    expect(aozoraCandidateIssues(rampo)).toEqual([]);
    // D5 개정(2026-10-15 「일본에서만 끝나면 그만」) — 미국 URAA 보호 중(1948 출판·1948 사망)이어도 후보
    const dazai = aozoraIndexWorks(parseCsv(csv({ ...rashomon, 初出: '「展望」1948（昭和23）年6月', 没年月日: '1948-06-13' }))).get('127');
    expect(aozoraCandidateIssues(dazai)).toEqual([]);
    const living = aozoraIndexWorks(parseCsv(csv({ ...rashomon, 作品著作権フラグ: 'あり' }))).get('127');
    expect(aozoraCandidateIssues(living)).toContain('저작권 존속 작품');
  });

  it('初出이 비면 판권 「初出：」 줄로 — 둘 다 없으면 연도 null(사람이 채운다)', () => {
    expect(firstYear('「新思潮」1916（大正5）年2月')).toBe(1916);
    expect(firstYear('')).toBe(null);
    expect(colophonFirstAppearanceYear('本文\n\n底本：「全集」\n初出：「文學界」1942（昭和17）年2月\n入力：某')).toBe(1942);
    expect(colophonFirstAppearanceYear('底本：「全集」\n入力：某')).toBe(null);
  });
});

describe('접속 순위 · zip · Shift_JIS', () => {
  it('순위 표 → 작품ID별 열람 수(여러 해 합산은 호출하는 쪽)', () => {
    const html = '<tr valign=top><td class=normal>1</td>\n<td class=normal><a href="https://www.aozora.gr.jp/cards/000879/card127.html">羅生門</a></td>\n<td class=normal>芥川</td>\n<td class=normal>622627</td>\n</tr>';
    expect([...parseAozoraRanking(html)]).toEqual([['127', 622627]]);
  });

  it('zip(deflate) 중앙 디렉터리로 항목을 푼다', () => {
    const body = Buffer.from('本文', 'utf8');
    const data = deflateRawSync(body);
    const name = Buffer.from('rashomon.txt');
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
    const localPart = Buffer.concat([local, name, data]);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(localPart.length, 16);
    const entries = unzipEntries(Buffer.concat([localPart, central, name, end]));
    expect(entries.map((entry) => [entry.name, entry.bytes.toString('utf8')])).toEqual([['rashomon.txt', '本文']]);
  });

  it('Shift_JIS는 JIS X 0208 표준 대응으로 — 예전 절차(glibc iconv)와 같은 글자(실측: 鼻·文鳥의 0x8160)', () => {
    // 0x8160 〜 · 0x8161 ‖ · 0x817C − · 0x8191 ¢ · 0x8192 £ · 0x81CA ¬ (WHATWG/Windows 대응은 ～ ∥ － ￠ ￡ ￢)
    const bytes = Buffer.from([0x81, 0x60, 0x81, 0x61, 0x81, 0x7c, 0x81, 0x91, 0x81, 0x92, 0x81, 0xca, 0x88, 0x9f]);
    expect(decodeAozoraText(bytes)).toBe('〜‖−¢£¬亜');
  });
});
