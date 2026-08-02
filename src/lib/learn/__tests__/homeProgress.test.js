import { describe, expect, it } from 'vitest';
import {
  preferredLearnLanguage,
  readLearnHomeProgress,
} from '../homeProgress.js';
import { buildLearnProgressCatalog } from '../homeProgressCatalog.js';

function memoryStorage(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  );
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
  };
}

const catalog = {
  English: {
    language: 'English',
    name: '영어',
    track: 'english',
    readKey: 'en_read_chapters',
    levels: [
      {
        key: 'A1',
        short: 'A1',
        label: 'A1 입문',
        intro: false,
        chapterSlugs: ['a1-01', 'a1-02', 'a1-03'],
      },
      {
        key: 'A2',
        short: 'A2',
        label: 'A2 초급',
        intro: false,
        chapterSlugs: ['a2-01', 'a2-02'],
      },
    ],
  },
  French: {
    language: 'French',
    name: '프랑스어',
    track: 'french',
    readKey: 'fr_read_chapters',
    levels: [
      {
        key: 'A0',
        short: 'A0',
        label: 'A0 오리엔테이션',
        intro: true,
        chapterSlugs: ['a0-01'],
      },
    ],
  },
};

describe('homeProgress', () => {
  it('서버 카탈로그는 4트랙 레벨·slug만 결정적 순서로 직렬화한다', () => {
    const first = buildLearnProgressCatalog();
    const second = buildLearnProgressCatalog();

    expect(Object.keys(first)).toEqual(['English', 'French', 'Japanese', 'Chinese']);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.English.levels[0]).toEqual(expect.objectContaining({
      key: expect.any(String),
      chapterSlugs: expect.any(Array),
    }));
    expect(first.English.levels[0].chapterSlugs.every(
      (slug) => typeof slug === 'string',
    )).toBe(true);
  });

  it('기존 읽음·체크·studied_lesson을 레벨별 방문/완료로 합친다', () => {
    const storage = memoryStorage({
      lessons_lang: 'English',
      en_read_chapters: ['a1-01', 'a2-02'],
      en_read_chapters_check: {
        'a1-01': { passed: true, total: 5, right: 5 },
        'a1-02': { total: 5, right: 4 },
        'a2-02': { passed: false, total: 5, right: 2 },
      },
      studied_lesson: ['a2-01'],
      ref_last_chapter: { lang: 'English', slug: 'a1-03' },
    });

    expect(readLearnHomeProgress(catalog, undefined, storage)).toMatchObject({
      language: 'English',
      name: '영어',
      track: 'english',
      hasProgress: true,
      levels: [
        { key: 'A1', totalCount: 3, visitedCount: 3, completedCount: 2 },
        { key: 'A2', totalCount: 2, visitedCount: 2, completedCount: 1 },
      ],
    });
  });

  it('관문 없는 intro 레벨은 읽음을 완료로 센다', () => {
    const storage = memoryStorage({
      fr_read_chapters: ['a0-01'],
    });

    expect(readLearnHomeProgress(catalog, 'French', storage).levels[0]).toMatchObject({
      visitedCount: 1,
      completedCount: 1,
    });
  });

  it('첫 방문·깨진 payload는 0 진도로 안전하게 닫힌다', () => {
    const storage = memoryStorage({
      lessons_lang: 'English',
      en_read_chapters: '{broken',
      en_read_chapters_check: [],
      studied_lesson: 'not-an-array',
    });

    const result = readLearnHomeProgress(catalog, undefined, storage);
    expect(result.hasProgress).toBe(false);
    expect(result.levels.every((level) => (
      level.visitedCount === 0 && level.completedCount === 0
    ))).toBe(true);
  });

  it('프로필 언어를 저장된 lessons_lang보다 우선한다', () => {
    const storage = memoryStorage({ lessons_lang: 'French' });
    expect(preferredLearnLanguage('English', catalog, storage)).toBe('English');
    expect(preferredLearnLanguage(undefined, catalog, storage)).toBe('French');
  });
});
