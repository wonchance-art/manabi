import { describe, expect, it } from 'vitest';

// 샌드위치 배선 수술(#dialogue 렌더·SelfCheck·VocabCta) 후 JSX 구문·임포트 무결성 스모크.
// 렌더는 하지 않는다(서버 컴포넌트) — 모듈 평가가 곧 파서 게이트다.
describe('ReferenceChapterPage 배선 스모크', () => {
  it('페이지·클라이언트 컴포넌트 3종이 파싱·평가된다', async () => {
    const page = await import('../ReferenceChapterPage.jsx');
    const selfCheck = await import('../../components/SandwichSelfCheck.jsx');
    const cta = await import('../../components/VocabRegisterCta.jsx');
    expect(typeof page.default).toBe('function');
    expect(typeof selfCheck.default).toBe('function');
    expect(typeof cta.default).toBe('function');
  }, 60_000);
});
