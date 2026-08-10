import { describe, expect, it } from 'vitest';
import { parseContainerXml, parseOpf, extractXhtmlText, guessChapterTitle, parseEpub } from '../epub.js';

describe('EPUB 파서', () => {
  it('container.xml에서 OPF 경로를 뽑는다', () => {
    const xml = '<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
    expect(parseContainerXml(xml)).toBe('OEBPS/content.opf');
    expect(() => parseContainerXml('<container/>')).toThrow();
  });

  it('OPF에서 제목·언어·spine 순서를 해석한다', () => {
    const opf = `<package xmlns:dc="d"><metadata><dc:title>吾輩は猫である</dc:title><dc:language>ja</dc:language></metadata>
      <manifest>
        <item id="c2" href="chap2.xhtml" media-type="application/xhtml+xml"/>
        <item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
        <item id="css" href="style.css" media-type="text/css"/>
      </manifest>
      <spine><itemref idref="c1"/><itemref idref="c2"/><itemref idref="missing"/></spine></package>`;
    const { title, language, spineHrefs } = parseOpf(opf);
    expect(title).toBe('吾輩は猫である');
    expect(language).toBe('ja');
    expect(spineHrefs).toEqual(['chap1.xhtml', 'chap2.xhtml']); // spine 순서·CSS 제외·깨진 idref 무시
  });

  it('XHTML에서 루비 독음을 벗기고 본문만 남긴다', () => {
    const x = '<p><ruby>吾輩<rp>(</rp><rt>わがはい</rt><rp>)</rp></ruby>は猫である。</p><p>名前はまだ無い。</p>';
    expect(extractXhtmlText(x)).toBe('吾輩は猫である。\n名前はまだ無い。');
  });

  it('블록 경계·엔티티·공백을 정리한다', () => {
    const x = '<div>a&amp;b&#65;&#x42;</div><h2>제목</h2><script>x</script><br/>  c  d ';
    expect(extractXhtmlText(x)).toBe('a&bAB\n제목\nc d');
  });

  it('챕터 제목은 첫 헤딩 우선, 없으면 첫 줄', () => {
    expect(guessChapterTitle('<h1>一</h1><p>본문</p>', '폴백')).toBe('一');
    expect(guessChapterTitle('<p>첫 줄입니다</p>', '폴백')).toBe('첫 줄입니다');
    expect(guessChapterTitle('', '폴백')).toBe('폴백');
  });

  it('통합: stored ZIP으로 만든 최소 EPUB을 끝까지 파싱한다', async () => {
    const enc = (s) => new TextEncoder().encode(s);
    function zipStored(files) {
      // method 0(무압축) ZIP 생성 — 로컬 헤더·중앙 디렉터리·EOCD 수제 조립
      const chunks = []; const central = []; let offset = 0;
      const u16 = (n) => [n & 255, (n >> 8) & 255];
      const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
      const crcTable = Array.from({ length: 256 }, (_, n) => {
        let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
      });
      const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
      for (const [name, content] of files) {
        const nameB = enc(name); const data = enc(content); const crc = crc32(data);
        const local = [0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
          ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0)];
        central.push({ nameB, crc, size: data.length, offset });
        chunks.push(new Uint8Array(local), nameB, data);
        offset += local.length + nameB.length + data.length;
      }
      const cdStart = offset; let cdLen = 0;
      for (const e of central) {
        const rec = [0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
          ...u32(e.crc), ...u32(e.size), ...u32(e.size), ...u16(e.nameB.length), ...u16(0), ...u16(0),
          ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset)];
        chunks.push(new Uint8Array(rec), e.nameB); cdLen += rec.length + e.nameB.length;
      }
      chunks.push(new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
        ...u32(cdLen), ...u32(cdStart), ...u16(0)]));
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total); let p = 0;
      for (const c of chunks) { out.set(c, p); p += c.length; }
      return out.buffer;
    }
    const buf = zipStored([
      ['META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'],
      ['OEBPS/content.opf', '<package xmlns:dc="d"><metadata><dc:title>테스트 책</dc:title><dc:language>ja</dc:language></metadata><manifest><item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'],
      ['OEBPS/text/one.xhtml', '<html><body><h1>서장</h1><p><ruby>猫<rt>ねこ</rt></ruby>がいる。</p></body></html>'],
    ]);
    const book = await parseEpub(buf);
    expect(book.title).toBe('테스트 책');
    expect(book.language).toBe('ja');
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0].title).toBe('서장');
    expect(book.chapters[0].text).toBe('서장\n猫がいる。');
  });

  it('ZIP이 아니면 명확한 오류를 던진다', async () => {
    await expect(parseEpub(new TextEncoder().encode('not a zip').buffer)).rejects.toThrow('ZIP');
  });
});
