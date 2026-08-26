import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  splitLinesIntoChapters, splitTextIntoChapters, looksLikeSentenceList, sentenceListStats,
  mergeWithPrevious, LINES_PER_REQUEST_CAP, DEFAULT_LINES_PER_CHAPTER,
} from '../bookSplit';
import { autoSplitParagraphs } from '../splitParagraphs';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const countLines = (t) => t.split('\n').filter((l) => l.trim()).length;

// 오너 HSK5 교재 — 320문장 · 16문장/과 · 20과
const ZH_SENTENCES = Array.from({ length: 320 }, (_, i) => `我们应该保护环境第${i + 1}句。`);
const ZH_LIST = ZH_SENTENCES.join('\n');

/**
 * 문장 목록 반입 계약 — **왜 새 분할이 필요했는지**를 함께 못 박는다.
 *
 * 기존 글자 수 분할(splitTextIntoChapters)로도 되지 않느냐는 오독이 조용히 들어오면
 * 자료가 영구 부분 실패로 굳는다(101번째 줄부터 'failed' 플레이스홀더, 재시도해도 동일).
 * 그래서 아래 §전제 블록이 "기존 경로로는 안 된다"를 실측으로 고정한다.
 */
describe('문장 목록 반입 — 전제(기존 경로로는 안 되는 이유)', () => {
  it('글자 수 분할은 320문장을 한 챕터·320줄로 뭉친다 — 100줄 캡에 잘릴 모양', () => {
    const chapters = splitTextIntoChapters(ZH_LIST);
    expect(chapters).toHaveLength(1);
    expect(countLines(chapters[0].text)).toBe(320);
    expect(countLines(chapters[0].text)).toBeGreaterThan(LINES_PER_REQUEST_CAP);
  });

  it('문단 자동 감지는 중국어 문장 목록에 개입하지 않는다 — 빈 줄이 안 생긴다', () => {
    // 종결부호 뒤 새 문단 조건이 히라가나·대문자 시작이라 한자 시작 줄은 걸리지 않는다.
    // 즉 autoSplitParagraphs에 기댈 수 없다(그래서 등록부는 문장 목록에서 이걸 건너뛴다).
    expect(autoSplitParagraphs(ZH_LIST)).toBe(ZH_LIST);
  });
});

describe('splitLinesIntoChapters — 줄 수 기준 분할', () => {
  it('16문장씩 320문장 → 20챕터, 각 16문장', () => {
    const chapters = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: 16 });
    expect(chapters).toHaveLength(20);
    for (const ch of chapters) expect(countLines(ch.text)).toBe(16);
  });

  it('문장을 하나도 잃지 않고 순서를 지킨다', () => {
    const chapters = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: 16 });
    const rejoined = chapters.flatMap((c) => c.text.split('\n'));
    expect(rejoined).toEqual(ZH_SENTENCES);
  });

  it('마지막 챕터는 나머지만 담는다(균등 분할이 아니어도 손실 없음)', () => {
    const chapters = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: 30 });
    expect(chapters).toHaveLength(11);            // 30×10 + 20
    expect(countLines(chapters[10].text)).toBe(20);
  });

  it('요청이 캡을 넘어도 챕터는 100줄을 넘지 않는다 — 잘리는 자료를 만들지 않는다', () => {
    for (const per of [101, 200, 999, 100000]) {
      const chapters = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: per });
      for (const ch of chapters) expect(countLines(ch.text)).toBeLessThanOrEqual(LINES_PER_REQUEST_CAP);
    }
  });

  it('잘못된 과 크기(0·음수·NaN)는 기본값으로 되돌아간다', () => {
    for (const per of [0, -5, NaN, undefined, 'abc']) {
      const chapters = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: per });
      expect(countLines(chapters[0].text)).toBe(DEFAULT_LINES_PER_CHAPTER);
    }
  });

  it('빈 입력은 빈 배열 — 챕터 0개짜리 책을 만들지 않는다', () => {
    expect(splitLinesIntoChapters('')).toEqual([]);
    expect(splitLinesIntoChapters('   \n\n  \n')).toEqual([]);
  });

  it('반환형이 글자 수 분할과 같다 — 등록·미리보기·합치기 UI 전부 재사용', () => {
    const a = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: 16 })[0];
    const b = splitTextIntoChapters('제 1 장\n본문입니다.\n\n제 2 장\n또 본문.')[0];
    expect(Object.keys(a).sort()).toEqual(['text', 'title']);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    // 경계 병합도 그대로 먹는다(미리보기 [합치기])
    const merged = mergeWithPrevious(splitLinesIntoChapters(ZH_LIST, { linesPerChapter: 16 }), 1);
    expect(merged).toHaveLength(19);
    expect(Object.keys(merged[0]).sort()).toEqual(['text', 'title']);
  });

  it('챕터 제목은 과 번호 — 1과부터', () => {
    const chapters = splitLinesIntoChapters(ZH_LIST, { linesPerChapter: 16 });
    expect(chapters[0].title).toBe('1과');
    expect(chapters[19].title).toBe('20과');
  });
});

describe('LINES_PER_REQUEST_CAP ↔ 서버 MAX_LINES 미러', () => {
  it('클라 캡이 /api/analyze 상수와 같다 — 어긋나면 잘리는 챕터가 생긴다', () => {
    const route = read('src/app/api/analyze/route.js');
    const serverMax = Number(route.match(/const MAX_LINES = (\d+);/)?.[1]);
    expect(serverMax).toBeGreaterThan(0);
    expect(LINES_PER_REQUEST_CAP).toBe(serverMax);
  });
});

describe('looksLikeSentenceList — 감지', () => {
  it('중국어 문장 목록을 잡는다', () => {
    expect(looksLikeSentenceList(ZH_LIST)).toBe(true);
    expect(sentenceListStats(ZH_LIST).lines).toBe(320);
  });

  it('줄이 적으면 배너를 띄우지 않는다(50줄 미만)', () => {
    expect(looksLikeSentenceList(ZH_SENTENCES.slice(0, 30).join('\n'))).toBe(false);
  });

  it('빈 줄로 문단이 나뉜 산문은 아니다', () => {
    const prose = Array.from({ length: 60 }, (_, i) => `${i}번째 문단입니다.\n\n`).join('');
    expect(looksLikeSentenceList(prose)).toBe(false);
  });

  it('줄이 길면(평균 40자 초과) 아니다 — 줄바꿈 있는 본문', () => {
    const longLines = Array.from({ length: 60 }, () => '가'.repeat(80)).join('\n');
    expect(looksLikeSentenceList(longLines)).toBe(false);
  });
});

describe('반입 화면 배선 계약', () => {
  const page = read('src/views/MaterialAddPage.jsx');
  const section = read('src/components/MaterialAddSentenceSection.jsx');

  it('문장 목록은 PDF·EPUB와 같은 층의 독립 입구다', () => {
    // 본문 폼에 붙여넣은 뒤 반응하는 배너가 아니라, 처음부터 과 단위를 정하는 문(오너 지시).
    expect(page).toContain("import MaterialAddSentenceSection from '../components/MaterialAddSentenceSection'");
    const epub = page.indexOf('<MaterialAddEpubSection');
    const sentence = page.indexOf('<MaterialAddSentenceSection');
    const textarea = page.indexOf('className="form-textarea"');
    expect(sentence).toBeGreaterThan(epub);
    expect(sentence).toBeLessThan(textarea);
  });

  it('입구가 제목·언어·난이도·과 크기를 모두 자기 안에서 정한다', () => {
    for (const field of ['교재 이름', '학습 언어', '권장 학습 난이도', '한 과에 넣을 문장 수']) {
      expect(section, `입구에 '${field}'가 없다`).toContain(field);
    }
    expect(section).toContain('splitLinesIntoChapters(text, { linesPerChapter: per })');
  });

  it('초안이 자기 언어·난이도를 들고 온다 — 본문 폼 상태에 의존하지 않는다', () => {
    // 입구가 setLanguage를 부르고 곧바로 등록하면 React 상태 갱신이 비동기라 옛 값이 박힌다.
    expect(page).toMatch(/handleSentenceBookReady[\s\S]{0,400}?language: lang, level: lvl/);
    expect(page).toContain('language: bookDraft.language || language');
    expect(page).toContain('level: bookDraft.level || level');
  });

  it('문장 목록 초안은 비공개 고정 — 개인 소장 자료를 공개로 등록할 길이 없다', () => {
    expect(page).toMatch(/handleSentenceBookReady[\s\S]{0,400}?privateOnly: true/);
    expect(page).toContain("visibility: bookDraft.privateOnly ? 'private' : visibility");
    expect(page).toMatch(/handleEpubBookReady[\s\S]{0,900}?privateOnly: true/);
  });

  it('문장 목록은 문단 자동 감지를 건너뛴다 — 요청 수를 챕터당 1건으로 유지', () => {
    expect(page).toContain("bookDraft.origin === 'sentences' ? ch.text : autoSplitParagraphs(ch.text)");
  });

  it('본문 폼에 붙여넣은 문장 목록은 여기서 처리하지 않고 입구로 넘긴다 — 문은 하나', () => {
    // 같은 일을 하는 문이 둘이면 한쪽만 고쳐지는 어긋남이 생긴다. 안내는 넘기기만 한다.
    expect(page).toContain('looksLikeSentenceList(rawText)');
    expect(page).toContain('setSentenceSeed(rawText)');
    expect(page).not.toContain('splitLinesIntoChapters');   // 분할은 입구만 한다
    expect(section).toContain('seedText');
  });
});

/**
 * 미리보기 위치 계약(오너 지적 2026-08-25).
 *
 * 초안 패널이 페이지 맨 위 한 자리에만 그려지던 때, 텍스트 칸에서 [챕터로 나누기]를 눌러도
 * 결과가 화면 밖 위쪽에 생겨 **아무 일도 안 일어난 것처럼** 보였다. 정의는 하나로 두되
 * 그리는 자리는 그것을 만든 문을 따른다.
 */
describe('책 초안 미리보기 — 만든 문 옆에 나타난다', () => {
  const page = read('src/views/MaterialAddPage.jsx');

  it('패널 정의는 하나이고 두 자리에서 쓰인다', () => {
    expect(page).toContain("import BookDraftPanel from '../components/BookDraftPanel'");
    expect(page.match(/<BookDraftPanel/g)).toHaveLength(2);
    expect(page).not.toContain('앞 챕터와 합치기');   // 본체 재인라인 금지
  });

  it('위쪽 입구(EPUB·문장 목록) 결과는 그 입구 옆·텍스트 칸 앞', () => {
    const sectionRender = page.indexOf('<MaterialAddSentenceSection');
    const upperPanel = page.indexOf("bookDraft?.origin === 'epub' || bookDraft?.origin === 'sentences'");
    const textarea = page.indexOf('className="form-textarea"');
    expect(upperPanel).toBeGreaterThan(sectionRender);
    expect(upperPanel).toBeLessThan(textarea);
  });

  it('본문 폼 분할 결과는 텍스트 칸 뒤', () => {
    const textarea = page.indexOf('className="form-textarea"');
    const lowerPanel = page.indexOf("bookDraft?.origin === 'text'");
    expect(lowerPanel).toBeGreaterThan(textarea);
  });
});
