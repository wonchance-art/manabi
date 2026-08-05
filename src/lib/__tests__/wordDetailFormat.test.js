import { describe, it, expect } from 'vitest';
import { formatDetail } from '../wordDetailFormat';

describe('formatDetail — 저장형 XSS 차단', () => {
  it('스크립트 인젝션 페이로드를 이스케이프한다', () => {
    const html = formatDetail('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).not.toMatch(/<img[^>]*onerror/); // 실행 가능한 img 태그(꺾쇠 raw)로 남지 않는다
  });

  it('script 태그를 실행 불가능하게 이스케이프한다', () => {
    const html = formatDetail('hello <script>steal()</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('따옴표·앰퍼샌드를 엔티티로 치환한다', () => {
    const html = formatDetail(`a & b "c" 'd'`);
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
  });

  it('정상 마크다운 포맷은 그대로 작동한다', () => {
    const html = formatDetail('**뜻**\n사과');
    expect(html).toContain('<strong class="pdf-detail-heading">뜻</strong>');
    expect(html).toContain('사과');
  });

  it('일반 bold는 strong으로 유지한다', () => {
    const html = formatDetail('이것은 **중요**합니다');
    expect(html).toContain('<strong>중요</strong>');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(formatDetail('')).toBe('');
    expect(formatDetail(null)).toBe('');
  });
});
