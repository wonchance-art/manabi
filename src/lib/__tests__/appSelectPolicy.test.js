import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

/**
 * 계약: 앱 전역 무선택(네이티브 앱화) — 오너 정책(2026-08-15, 예외·복사 버튼 최소화).
 * body에서 브라우저 텍스트 선택·iOS 길게 누르기 말풍선을 전역 차단하고,
 * 타이핑 입력란만 예외로 남긴다. 규칙이 지워지면 앱 전체가 다시 '웹처럼' 끌리므로
 * 소스 계약으로 고정한다.
 */
describe('앱 전역 무선택 정책 (index.css)', () => {
  // body 블록 추출 — 첫 `body {` 부터 닫는 중괄호까지
  const bodyBlock = css.match(/^body \{[^}]*\}/m)?.[0] || '';

  it('body가 전역 user-select: none + iOS touch-callout 차단을 선언한다', () => {
    expect(bodyBlock).toContain('user-select: none');
    expect(bodyBlock).toContain('-webkit-user-select: none');
    expect(bodyBlock).toContain('-webkit-touch-callout: none');
  });

  it('타이핑 입력란(input·textarea·contenteditable)은 선택 가능 예외다', () => {
    const m = css.match(/^input, textarea, \[contenteditable\][^{]*\{[^}]*\}/m)?.[0] || '';
    expect(m).toContain('user-select: text');
    expect(m).toContain('-webkit-user-select: text');
  });

  it('이미지 드래그 고스트를 차단한다(webkit)', () => {
    expect(css).toMatch(/img \{[^}]*-webkit-user-drag: none/);
  });

  // 임시 예외(인앱 지정 개통 전 데스크톱 드래그 분석 공백 방지) — 인앱 지정 PR에서
  // 이 테스트를 "예외 없음" 검증으로 뒤집는다.
  it('[임시] 뷰어 본문은 브라우저 선택을 유지한다(인앱 지정 개통 전)', () => {
    const m = css.match(/^\.reader-area \{[^}]*\}/m)?.[0] || '';
    expect(m).toContain('user-select: text');
  });
});
