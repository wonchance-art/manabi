import { VICTORIAN_BINDINGS } from '../../lib/victorianCover';
import FirstEditionCover from './FirstEditionCover';
import VictorianCover from './VictorianCover';

// 영어 정본 표지 고르기 — 1차 세 권은 「빅토리아 천 장정」(LIT-SRC-EN-1), 그 뒤 책은 「초판 장정」(LIT-SRC-WS-1). 표기의 binding 키로 가른다
// (두 시리즈의 키는 겹치지 않는다 — firstEditionCover.test). 표기가 없으면 그리지 않는다.
export default function CanonicalCover({ work }) {
  const binding = work?.display?.binding;
  if (typeof binding !== 'string') return null;
  return Object.hasOwn(VICTORIAN_BINDINGS, binding) ? <VictorianCover work={work} /> : <FirstEditionCover work={work} />;
}
