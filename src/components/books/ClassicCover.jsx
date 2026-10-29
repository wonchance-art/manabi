import CanonicalCover from './CanonicalCover';
import FirstEditionCover from './FirstEditionCover';
import LiteratureCover from './LiteratureCover';

// 정본 책 표지 고르기 — 출처마다 표지 시리즈가 다르다(서재 책 카드 MaterialsPage와 같은 짝): 青空文庫 = 천 장정 題簽(LiteratureCover),
// Standard Ebooks = 빅토리아 천 장정 · 초판 장정(CanonicalCover가 binding으로 가른다), 위키문헌 · 전자책 사이트 = 초판 장정.
// 모두 상태 없는 그림이라 서버 화면(고전 명작)에서 그대로 그린다 — 브라우저 번들에 싣지 않는다. 장식이다(aria-hidden — 옆 글자가 읽어 준다).
export default function ClassicCover({ provider, work }) {
  if (provider === 'aozora') return <LiteratureCover work={work} />;
  if (provider === 'standardebooks') return <CanonicalCover work={work} />;
  return <FirstEditionCover work={work} />;
}
