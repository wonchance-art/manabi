import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { chapterSize, lintLiteratureChapters, summarizeLint } from '../literatureLint.js';

// 정본 책 장 글 점검(LIT-IMPORT-1) — 가져오기 · 빌드 계약이 같은 규칙. 3차 묶음에서 눈으로 잡던 찌꺼기를 규칙으로 심는다.

const book = { title: 'Capital, Volume I', total: 3 };
const one = (rawText, extra = {}) => lintLiteratureChapters({ chapters: [{ order: 1, title: 'Chapter I: Commodities', rawText, ...extra }], book, language: 'English' });
const codes = (findings) => findings.map((finding) => finding.code);

describe('규칙 — 실측 찌꺼기마다 하나', () => {
  it('각주 번호(글자에 붙은 [n]) · 장 끝 각주 목록 · 판 끝 표시 · 사이트 안내 · 이용 허락 · HTML · 쪽 번호 · 제어 글자', () => {
    expect(codes(one('in stocking making, 642,607[143]\nAll who'))).toEqual(['footnote-marker']);
    expect(codes(one('compare the work of Aikin [1795] already quoted'))).toEqual([]); // 4자리 연도 괄호는 본문
    expect(codes(one('the end of it.\n\n[1] Reported in the Washington Post, October 15 1945.'))).toEqual(['footnote-list']);
    expect(codes(one('… importance.\n\nTHE END'))).toEqual(['end-marker']);
    expect(codes(one('* A Distributed Proofreaders Canada Ebook *'))).toEqual(['site-boilerplate']);
    expect(codes(one('이 저작물은 퍼블릭 도메인입니다.'))).toEqual(['license-text']);
    expect(codes(one('Export <span class="x">a</span> &amp; b'))).toEqual(['markup-residue']);
    expect(codes(one('祝福 作者：鲁迅 1924年2月7日 弟兄 →\n\n本作品收录于《彷徨》\n\n旧历的年底'))).toEqual(['header-residue']);
    expect(codes(one('He went on → and on, past the gate.'))).toEqual([]); // 문장 속 화살표는 본문
    expect(codes(one('Export {{{1}}}„ 225,363'))).toEqual(['page-marker']);
    expect(codes(one('text​more'))).toEqual(['control-char']);
    expect(codes(one(' '))).toEqual(['empty-chapter']);
  });
  it('작은 대문자가 소문자로 남은 장 이름은 warn · 원문 쪽이 여럿인데 장 제목이 모두 책 제목이면 error · 한 쪽을 나눈 단편은 그대로', () => {
    expect(codes(one('text', { title: 'exchange.' }))).toEqual(['lowercase-title']);
    const parts = (sourcePage) => [1, 2, 3].map((order) => ({ order, title: `Capital, Volume I (${order}/3)`, rawText: 'text', metadata: { literature: { sourcePage: sourcePage(order) } } }));
    expect(codes(lintLiteratureChapters({ chapters: parts((order) => `p${order}`), book, language: 'English' }))).toEqual(['chapter-titles-missing']);
    expect(codes(lintLiteratureChapters({ chapters: parts(() => 'p1'), book, language: 'English' }))).toEqual([]);
  });
  it('분량은 정보만 — 언어별 단위(영·불 단어 · 일·중·한 공백 뺀 글자)', () => {
    expect(chapterSize('a b  c', 'English')).toBe(3);
    expect(chapterSize('가 나다 라', 'Korean')).toBe(4);
    const tiny = lintLiteratureChapters({ chapters: [{ order: 1, title: 'I', rawText: 'a b' }], book, language: 'English', target: 2200 });
    expect(tiny).toEqual([expect.objectContaining({ code: 'tiny-chapter', level: 'info' })]);
    expect(summarizeLint([...tiny, { code: 'x', level: 'error' }])).toMatchObject({ error: 1, info: 1, byCode: { 'tiny-chapter': 1, x: 1 } });
  });
});

describe('리포의 모든 정본 책 — 오류 0(싣기 전에 고친다)', () => {
  const root = 'src/content/literature';
  const works = ['aozora', 'standardebooks', 'wikisource', 'pdsite'].flatMap((provider) => readdirSync(`${root}/${provider}`)
    .filter((key) => existsSync(`${root}/${provider}/${key}/chapters.json`))
    .map((key) => [provider, key]));
  it('네 출처 모두 점검 대상이다', () => {
    expect(new Set(works.map(([provider]) => provider))).toEqual(new Set(['aozora', 'standardebooks', 'wikisource', 'pdsite']));
    expect(works.length).toBeGreaterThan(70);
  });
  it.each(works)('%s/%s', (provider, key) => {
    const { chapters, book } = JSON.parse(readFileSync(`${root}/${provider}/${key}/chapters.json`, 'utf8'));
    const errors = lintLiteratureChapters({ chapters, book, language: chapters[0].metadata.language }).filter((finding) => finding.level === 'error');
    expect(errors).toEqual([]);
  });
});
