import { describe, expect, it } from 'vitest';
import { artSourceText } from '../artSource.js';

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

  it('문자열이 아니면 빈 문자열', () => {
    expect(artSourceText(null)).toBe('');
    expect(artSourceText(undefined)).toBe('');
  });
});
