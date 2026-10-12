import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { MAX_BODY_CHARS } from '../materialComposer.js';
import {
  fitChaptersToCap, splitTextIntoChapters, BODY_CAP_LABEL, CHAPTER_MAX_CHARS,
} from '../bookSplit.js';

// 계약: 읽는 사람에게 보이는 글자 수 자르기·나누기 정리(쪽 넘김 리더 승인 2026-10-12, 설계 §5).
// 화면이 차면 다음 쪽으로 넘기므로 길이 때문에 장을 다시 나누거나 말없이 자를 이유가 없다.
// 남는 상한은 저장 상한 하나(작성기·DB 과 상한 20만 자)이고, 그 값의 정본은 materialComposer다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const PAGE = 'src/views/MaterialAddPage.jsx';
const EPUB = 'src/components/MaterialAddEpubSection.jsx';
const LINK = 'src/components/MaterialAddLinkSection.jsx';

const paras = (n, len, ch = '가') => Array.from({ length: n }, () => ch.repeat(len)).join('\n\n');

describe('(a) EPUB 반입은 원래 장 구분만 쓴다', () => {
  it('상한 아래 장은 길어도 다시 나누지 않는다 — 옛 4.5만 자 재분할 없음', () => {
    const long = paras(30, 4000);                   // 약 12만 자 — 옛 기준이면 여러 조각
    expect(long.length).toBeGreaterThan(CHAPTER_MAX_CHARS);
    expect(long.length).toBeLessThan(MAX_BODY_CHARS);
    const input = [{ title: '1장', text: long }, { title: '2장', text: '짧은 장' }];
    const { chapters, oversized } = fitChaptersToCap(input);
    expect(chapters).toEqual(input);
    expect(oversized).toEqual([]);
  });

  it('상한을 넘는 장 하나만 문단 경계에서 상한 바로 아래로 나누고, 나눈 장을 알린다', () => {
    const huge = paras(60, 5000, '나');              // 약 30만 자
    const { chapters, oversized } = fitChaptersToCap([
      { title: '서장', text: '머리말' }, { title: '긴 장', text: huge }, { title: '끝장', text: '맺음' },
    ]);
    expect(oversized).toEqual(['긴 장']);
    expect(chapters.map((c) => c.title)).toEqual(['서장', '긴 장 (1/2)', '긴 장 (2/2)', '끝장']);
    for (const c of chapters) expect(c.text.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    // 문단 경계로만 잘랐다 — 이어 붙이면 원문 그대로, 첫 조각은 상한 가까이 꽉 찬다
    expect(`${chapters[1].text}\n\n${chapters[2].text}`).toBe(huge);
    expect(chapters[1].text.length).toBeGreaterThan(MAX_BODY_CHARS - 5000 - 2);
  });

  it('상한 초과 장 안의 표제 같은 줄로는 쪼개지 않는다(문단 길이 분할만)', () => {
    const text = `제1장 가\n${paras(25, 5000)}\n\n제2장 나\n${paras(25, 5000)}`;
    const { chapters } = fitChaptersToCap([{ title: '합본', text }]);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('합본 (1/2)');
  });

  it('자료 추가 페이지가 EPUB 책을 재분할하지 않고 fitChaptersToCap으로 받는다', () => {
    const body = codeOf(sliceBetween(read(PAGE), 'const handleEpubBookReady', '\n  };'));
    expect(body).toContain('fitChaptersToCap(chapters)');
    expect(body, '옛 장 재분할').not.toContain('splitTextIntoChapters');
    expect(body, '나눴으면 화면에 알린다').toMatch(/oversized\.length > 0[\s\S]*BODY_CAP_LABEL[\s\S]*'warning'/);
    expect(read(PAGE)).not.toContain('CHAPTER_MAX_CHARS');
  });

  it('(2) 장 골라 가져오기의 5만 자 캡은 저장 상한으로 바뀌고, 넘으면 책으로 묶어 넘긴다', () => {
    const src = codeOf(read(EPUB));
    expect(src).not.toMatch(/50000|50_000/);
    expect(src).toContain('const over = totalChars > MAX_BODY_CHARS;');
    expect(src).toContain('importAsBook(picked)');
    expect(src).toContain('BODY_CAP_LABEL');
  });
});

describe('(b) YouTube 자막은 말없이 자르지 않는다', () => {
  const src = codeOf(read(LINK));

  it('옛 5만 자 절단이 없고, 상한은 저장 상한 정본이다', () => {
    expect(src).not.toMatch(/50000|50_000|MAX_CHARS\b/);
    expect(src).not.toMatch(/text\.slice\(0, MAX/);
    expect(src).toContain('text.length <= MAX_BODY_CHARS');
  });

  it('상한을 넘겨 잘랐으면 원래 길이를 들고 경고 알림으로 말한다', () => {
    const msg = sliceBetween(src, 'function deliveredMessage', '\n}');
    expect(msg).toContain('cutFrom > 0');
    expect(msg).toContain("'warning'");
    expect(msg).toContain('BODY_CAP_LABEL');
    // 자동 취득·붙여넣기 두 길 모두 같은 알림을 거친다
    expect((src.match(/toast\(\.\.\.deliveredMessage\(deliver\(/g) || []).length).toBe(2);
  });
});

describe('(c) 1만 자 「챕터로 나눠 책으로」 권유는 없고, 나누기 선택지는 남는다', () => {
  const page = codeOf(read(PAGE));

  it('본문 길이로 뜨는 권유·5만/3만 자 색 경고가 없다', () => {
    expect(page).not.toMatch(/rawText\.length > (10000|30000|50000)/);
    expect(page).not.toContain('챕터로 나눠 책으로 등록');
    expect(page).toContain("rawText.length > MAX_BODY_CHARS ? 'form-char-count--over'");
  });

  it('나누기는 본문 칸 머리(클립보드 붙여넣기 옆)의 중립 선택지로 남는다', () => {
    const head = sliceBetween(page, '>본문 텍스트</label>', '<textarea');
    expect(head).toContain('onClick={handleSplitToBook}');
    expect(head).toContain('챕터로 나누기');
    expect(head).toContain('variant="ghost"');
    expect(sliceBetween(page, 'const handleSplitToBook', '\n  };')).toContain('splitTextIntoChapters(rawText)');
  });
});

describe('(d) 20만 자 상한은 한 곳(materialComposer)에서 온다', () => {
  it('화면 세 곳이 정본을 가져다 쓴다 — 숫자를 다시 적지 않는다', () => {
    for (const f of [PAGE, EPUB, LINK, 'src/lib/bookSplit.js']) {
      const src = codeOf(read(f));
      expect(src, f).toMatch(/import \{[^}]*\bMAX_BODY_CHARS\b[^}]*\} from '\.\.?\/(lib\/)?materialComposer'/);
      expect(src, f).not.toMatch(/200000|200_000|2e5/);
    }
    expect(MAX_BODY_CHARS).toBe(200000);
    expect(BODY_CAP_LABEL).toBe('20만 자');
  });

  it('DB 과 상한과 과 편집 검사가 정본과 같은 값이다(SQL·과 편집은 미러)', () => {
    const sql = read('supabase/migrations/20260930154448_library_book_chapters.sql');
    expect(sql).toContain(`length(body)>${MAX_BODY_CHARS}`);
    expect(read('src/lib/libraryBookChapters.js')).toContain(`item.text.length > ${MAX_BODY_CHARS}`);
  });

  it('사용자가 고른 나누기 기본값은 그대로다(읽기 단위 제안, 상한 아님)', () => {
    const ch = splitTextIntoChapters(paras(20, 4000));
    expect(ch.length).toBeGreaterThan(1);
    for (const c of ch) expect(c.text.length).toBeLessThanOrEqual(CHAPTER_MAX_CHARS);
  });
});
