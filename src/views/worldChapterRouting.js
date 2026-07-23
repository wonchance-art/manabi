import { resolveCultureChapterHref } from '../components/world/cultureDoors';

// WorldPage의 문화 도어 URL 전환 경계. null이면 router를 호출하지 않는 fail-closed 계약이다.
export function pushWorldCultureChapter(router, chapter, track) {
  const href = resolveCultureChapterHref(track, chapter);
  if (!href) return false;
  router.push(href);
  return true;
}
