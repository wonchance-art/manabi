import CourseMapPage from '@/views/CourseMapPage';
import { buildCourseMap } from '@/lib/learn/courseMapData';

export const metadata = {
  title: '코스 지도 | Anatomy Studio',
  description: '일본어·프랑스어·영어·중국어 코스의 유닛과 레슨 진도',
};

export default async function Page({ searchParams }) {
  const query = await searchParams;
  const map = buildCourseMap(query?.track, query?.level);

  return <CourseMapPage {...map} />;
}
