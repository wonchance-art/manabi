import { describe, it, expect } from 'vitest';

// ReadingTextView 는 readingProgress → supabase.js 를 끌어와 모듈 로드 시 env 를 요구한다.
// 스토리 모듈은 그 순수 채점 헬퍼(normalizeQuestion·gradeOrder·checkFill)를 재사용하므로
// 같은 스텁 규약으로 env 를 채운 뒤 동적 import 한다(readingQuestionTypes.test.js 관행).
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

const { normalizeQuestion, gradeOrder, checkFill, FILL_BLANK } = await import('../../views/ReadingTextView');
const n5 = (await import('../../content/japanese/grammar/n5.js')).default;

// n5-04-desu-da 챕터에 끼워 넣은 스토리 섹션(파일럿)을 찾는다.
const chapter = n5.find(c => c.slug === 'n5-04-desu-da');
const storySection = chapter?.sections.find(s => s.story);
const story = storySection?.story;

describe('n5-04-desu-da 스토리 모듈 — 콘텐츠 계약', () => {
  it('챕터 안에 story 섹션이 정확히 하나 있다', () => {
    expect(chapter).toBeTruthy();
    expect(chapter.sections.filter(s => s.story)).toHaveLength(1);
    expect(story).toBeTruthy();
  });

  it('body: 내레이션 2~3개 + 대사 6~10줄, 대사는 ja·yomi·ko 필수', () => {
    const narr = story.body.filter(b => b.ja == null);
    const speech = story.body.filter(b => b.ja != null);
    expect(narr.length).toBeGreaterThanOrEqual(2);
    expect(narr.length).toBeLessThanOrEqual(3);
    expect(speech.length).toBeGreaterThanOrEqual(6);
    expect(speech.length).toBeLessThanOrEqual(10);
    for (const s of speech) {
      expect(typeof s.yomi).toBe('string');
      expect(s.yomi.trim().length).toBeGreaterThan(0);
      expect(typeof s.ko).toBe('string');
      expect(s.ko.trim().length).toBeGreaterThan(0);
    }
  });

  it('문항: order 1 + fill 1 + produce 1, id 는 <slug>-sqN', () => {
    const byType = t => story.questions.filter(q => q.type === t);
    expect(byType('order')).toHaveLength(1);
    expect(byType('fill')).toHaveLength(1);
    expect(byType('produce')).toHaveLength(1);
    for (const q of story.questions) expect(q.id).toMatch(/^n5-04-desu-da-sq\d+$/);
    expect(new Set(story.questions.map(q => q.id)).size).toBe(story.questions.length);
  });

  it('normalizeQuestion: 어떤 문항도 스키마 오류(qtype:error)로 떨어지지 않는다', () => {
    for (const q of story.questions) {
      const n = normalizeQuestion(q, `${chapter.slug}-${q.id}`);
      expect(n.qtype).not.toBe('error');
      expect(n.qtype).toBe(q.type);
    }
  });

  it('order: answer 순서로 조립하면 정답, 뒤섞으면 오답', () => {
    const q = story.questions.find(q => q.type === 'order');
    expect(gradeOrder(q.answer, q.answer)).toBe(true);
    expect([...q.answer].sort()).toEqual([...q.tiles].sort()); // answer 는 tiles 의 순열
    const shuffled = [q.answer[1], q.answer[0], ...q.answer.slice(2)];
    expect(gradeOrder(shuffled, q.answer)).toBe(false);
  });

  it('fill: 빈칸 1개, answer/accept 로 채점 통과', () => {
    const q = story.questions.find(q => q.type === 'fill');
    expect(q.ja.split(FILL_BLANK).length - 1).toBe(1);
    expect(checkFill(q.answer, q.answer, q.accept)).toBe(true);
    expect(checkFill('ちがう', q.answer, q.accept)).toBe(false);
  });

  it('produce: 모범답(model) ≥1, 가이드 존재', () => {
    const q = story.questions.find(q => q.type === 'produce');
    expect(Array.isArray(q.model)).toBe(true);
    expect(q.model.length).toBeGreaterThanOrEqual(1);
    expect(typeof q.guide).toBe('string');
    expect(q.guide.trim().length).toBeGreaterThan(0);
  });
});
