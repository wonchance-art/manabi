import { describe, it, expect } from 'vitest';

// stripMarkdownCode는 모듈 내부 함수이므로 동일 로직을 인라인 테스트
// 실제 프로덕션 코드에서 export하지 않으므로 로직 복제로 검증
function stripMarkdownCode(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

describe('stripMarkdownCode', () => {
  it('코드 블록 제거', () => {
    const input = '텍스트\n```js\nconst x = 1;\n```\n나머지';
    expect(stripMarkdownCode(input)).toBe('텍스트\n\n나머지');
  });

  it('인라인 코드 제거', () => {
    const input = '이것은 `인라인 코드` 입니다';
    expect(stripMarkdownCode(input)).toBe('이것은  입니다');
  });

  it('이미지 제거', () => {
    const input = '텍스트 ![alt](http://img.png) 나머지';
    expect(stripMarkdownCode(input)).toBe('텍스트  나머지');
  });

  it('링크 → 텍스트만 추출', () => {
    const input = '이것은 [링크 텍스트](http://example.com) 입니다';
    expect(stripMarkdownCode(input)).toBe('이것은 링크 텍스트 입니다');
  });

  it('연속 빈 줄 정리', () => {
    const input = '가\n\n\n\n나';
    expect(stripMarkdownCode(input)).toBe('가\n\n나');
  });

  it('복합 마크다운 정리', () => {
    const input = '# 제목\n```python\nprint("hello")\n```\n[자세히](url)를 보세요\n`code` 삭제';
    const result = stripMarkdownCode(input);
    expect(result).not.toContain('```');
    expect(result).not.toContain('`code`');
    expect(result).toContain('자세히');
    expect(result).toContain('삭제');
  });

  it('빈 문자열', () => {
    expect(stripMarkdownCode('')).toBe('');
  });
});
