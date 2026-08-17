import { describe, it, expect } from 'vitest';
import { formatDetail } from '../wordDetailFormat';
import { injectExamplePinyin } from '../wordDetail';

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

// 오너 확정: 상세 설명 예문도 예문/병음/뜻 3줄 — 병음은 표시 시점 합성(저장 원문 불변,
// 기존 캐시 소급 적용).
describe('injectExamplePinyin — 예문 병음 줄 합성', () => {
  const py = (s) => `PY(${s})`;

  it('굵은 한자 예문 줄 아래에 병음 마커 줄을 삽입한다(번역 줄 앞)', () => {
    const out = injectExamplePinyin('**예문**\n- **我去图书馆。**\n저는 도서관에 가요', py);
    expect(out.split('\n')).toEqual([
      '**예문**',
      '- **我去图书馆。**',
      '⟪py⟫PY(我去图书馆。)',
      '저는 도서관에 가요',
    ]);
  });

  it('이미 삽입돼 있으면 중복 삽입하지 않는다(멱등)', () => {
    const once = injectExamplePinyin('- **你好。**\n안녕', py);
    expect(injectExamplePinyin(once, py)).toBe(once);
  });

  it('한자 없는 굵은 줄(제목·강조)은 건드리지 않는다', () => {
    const out = injectExamplePinyin('**뜻**\n사과\n**중요**합니다', py);
    expect(out).not.toContain('⟪py⟫');
  });
});

describe('formatDetail — 병음 마커 렌더', () => {
  it('⟪py⟫ 줄을 흐린 병음 스팬으로 렌더한다', () => {
    const html = formatDetail('- **我去图书馆。**\n⟪py⟫wǒ qù túshūguǎn\n저는 도서관에 가요');
    expect(html).toContain('<span class="pdf-detail-pinyin">wǒ qù túshūguǎn</span>');
    expect(html).toContain('<strong>我去图书馆。</strong>');
    expect(html).toContain('저는 도서관에 가요');
  });
});
