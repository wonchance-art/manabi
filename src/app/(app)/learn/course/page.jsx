import CourseMapPage from '@/views/CourseMapPage';
import { getGrammarChapters } from '@/content/english';
import { EnglishAdapter } from '@/lib/learn/lessonAdapters';

const ENGLISH_LEVELS = ['OT', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const metadata = {
  title: '영어 코스 지도 | Anatomy Studio',
  description: '영어 코스의 유닛과 레슨 진도',
};

function normalizeLevel(value) {
  const level = String(value || '').toUpperCase();
  return ENGLISH_LEVELS.includes(level) ? level : 'A1';
}

function buildEnglishCourseMap(level) {
  const grammarLevels = Object.fromEntries(
    ENGLISH_LEVELS.map((key) => [key.toLowerCase(), getGrammarChapters(key)]),
  );
  const adapter = new EnglishAdapter(grammarLevels);

  return {
    course: adapter.getCourse(level),
    ...adapter.getUnitsAndLessons(level),
  };
}

export default async function Page({ searchParams }) {
  const query = await searchParams;
  const level = normalizeLevel(query?.level);
  const map = buildEnglishCourseMap(level);

  return (
    <CourseMapPage
      {...map}
      levels={ENGLISH_LEVELS}
      selectedLevel={level}
    />
  );
}
