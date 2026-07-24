import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExerciseEnginePrototype, {
  gradeExerciseResponse,
  normalizeExerciseAnswer,
  normalizeExerciseQuestion,
} from '../ExerciseEnginePrototype';

describe('ExerciseEnginePrototype', () => {
  it('E3 short-answer를 fill 공통형으로 정규화한다', () => {
    expect(normalizeExerciseQuestion({
      id: 'fr-g-a1-01',
      type: 'short-answer',
      sourceRef: 'a1-01-pronouns-etre',
      promptKo: 'nous ____.',
      answer: 'sommes',
    })).toMatchObject({
      id: 'fr-g-a1-01',
      type: 'fill',
      qtype: 'cloze',
      prompt: 'nous ____.',
      answer: 'sommes',
      sourceRef: 'a1-01-pronouns-etre',
    });
  });

  it('choice/select의 index 정답과 distractor 형태를 모두 정규화한다', () => {
    const indexed = normalizeExerciseQuestion({
      id: 'indexed',
      type: 'select',
      q: '정답은?',
      choices: ['un', 'deux', 'trois'],
      answer: 1,
    });
    const distractors = normalizeExerciseQuestion({
      id: 'distractors',
      type: 'choice',
      prompt: '정답은?',
      correct: 'deux',
      distractors: ['un', 'trois'],
    });

    expect(indexed.answer).toBe('deux');
    expect(indexed.options).toEqual(expect.arrayContaining(['un', 'deux', 'trois']));
    expect(distractors.options).toEqual(expect.arrayContaining(['un', 'deux', 'trois']));
  });

  it('NFC·대소문자·공백은 통일하고 악상 기호는 보존한다', () => {
    const question = normalizeExerciseQuestion({
      type: 'fill',
      prompt: '쓰세요.',
      answer: 'École',
      accept: ['l’école'],
    });

    expect(normalizeExerciseAnswer('  E\u0301COLE  ')).toBe('école');
    expect(gradeExerciseResponse(question, 'école')).toBe(true);
    expect(gradeExerciseResponse(question, 'L’ÉCOLE')).toBe(true);
    expect(gradeExerciseResponse(question, 'ecole')).toBe(false);
  });

  it('불완전하거나 지원하지 않는 문항은 fail-closed 한다', () => {
    expect(normalizeExerciseQuestion({ type: 'essay', prompt: 'x', answer: 'y' })).toBeNull();
    expect(normalizeExerciseQuestion({ type: 'fill', prompt: 'x' })).toBeNull();
    expect(normalizeExerciseQuestion({ type: 'choice', prompt: 'x', answer: 'y' })).toBeNull();
  });

  it('choice의 accept는 복수 정답으로 확장하지 않는다', () => {
    const question = normalizeExerciseQuestion({
      type: 'choice',
      prompt: '정답은?',
      answer: 'oui',
      accept: ['si'],
      options: ['oui', 'si', 'non'],
    });

    expect(gradeExerciseResponse(question, 'oui')).toBe(true);
    expect(gradeExerciseResponse(question, 'si')).toBe(false);
  });

  it('기존 fr-* 디자인 관례로 fill과 choice를 서버 마크업에 렌더한다', () => {
    const html = renderToStaticMarkup(
      <ExerciseEnginePrototype
        title="프로토 연습"
        questions={[
          { id: 'fill', type: 'short-answer', promptKo: '빈칸', answer: 'oui' },
          { id: 'choice', type: 'choice', prompt: '선택', correct: 'oui', distractors: ['non', 'peut-être'] },
        ]}
      />,
    );

    expect(html).toContain('프로토 연습');
    expect(html).toContain('fr-quiz__item');
    expect(html).toContain('form-input');
    expect(html).toContain('fr-quiz__opt');
  });
});
