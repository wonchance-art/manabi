import { cookies } from 'next/headers';
import { ScFontLink } from './ScFontLink';
import { scHintFromJar } from '@/lib/scFontHint';

// 중국어 학습자 힌트 쿠키가 있으면 서버 렌더에서 간체 독립 스타일시트를 미리 건다(SC-LINK-001 2단계 C).
// 셸에서 걸린 <link precedence>는 React가 head로 올린다 — 잎(ZhSlot)이 같은 href를 다시 걸어도 하나로 합쳐지고 기다림이 없다.
// 이 부품을 쓰는 세그먼트는 이미 동적(force-dynamic)이어야 한다 — 쿠키를 읽어 정적 라우트를 동적으로 바꾸지 않는다(계약).
export default async function ScFontCookieHint() {
  return scHintFromJar(await cookies()) ? <ScFontLink /> : null;
}
