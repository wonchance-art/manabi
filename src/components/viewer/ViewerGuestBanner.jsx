import Link from 'next/link';

// 게스트 뷰어 머리 안내(VIEWER-GUEST-BANNER-001, 2026-10-17 KST). 미분석 자료(isPending)는 단어 토큰이 없어
// 「단어를 클릭해 뜻을 확인할 수 있어요」가 거짓이 된다 — 원문만 읽는 상태를 그대로 말한다.
// 로그인 링크는 뷰어가 만든 signInHref(authEntryHref — 로그인 뒤 이 자료로 돌아온다)를 그대로 받는다.
export const GUEST_BANNER_TEXT = Object.freeze({
  analyzed: '단어를 클릭해 뜻을 확인할 수 있어요.',
  pending: '원문을 읽을 수 있어요. 분석이 끝나면 단어를 눌러 뜻을 볼 수 있어요.',
  signIn: '로그인하면 단어장에 저장하고 복습할 수 있어요 →',
});

export default function ViewerGuestBanner({ vt, signInHref, pending = false }) {
  return (
    <div className="viewer-guest-banner">
      <span>{vt(pending ? GUEST_BANNER_TEXT.pending : GUEST_BANNER_TEXT.analyzed)}</span>
      <Link href={signInHref} className="viewer-guest-banner__cta">{vt(GUEST_BANNER_TEXT.signIn)}</Link>
    </div>
  );
}
