'use client';

/**
 * 저장된 사본 안내 (v2-N R1, #1077).
 * 네트워크 조회가 실패해 IndexedDB 캐시로 살아난 화면에만 뜬다. 전역 오프라인
 * 배너(Layout)와 겹치지 않는 정보를 준다 — 연결이 살아 있어도 서버가 죽으면
 * 캐시가 뜨는데, 그때 사용자가 옛 사본을 최신으로 오해하지 않게 하는 것이 목적이다.
 * 문구 정본을 한 곳에 둔다(뷰어·단어장 공용).
 */

/** 목적격 조사 — 받침 있으면 '을', 없으면 '를'('자료를'·'단어장을'). */
export function objectParticle(word) {
  const last = String(word || '').trim().slice(-1);
  const code = last.charCodeAt(0);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return '을';           // 한글 음절이 아니면 보수적으로 '을'
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

export default function OfflineNotice({ what = '내용' }) {
  return (
    <p className="offline-notice" role="status">
      저장해 둔 {what}{objectParticle(what)} 보여드리고 있어요 — 연결되면 최신 내용으로 바뀝니다.
    </p>
  );
}

/**
 * 미전송 복습 안내 (v2-N R2).
 *
 * 오프라인 채점은 **조용히** 큐에 담긴다(오너 선택 '안 A' — 카드마다 토스트가 뜨면
 * 복습 리듬이 끊기고, 전역 배너가 이미 오프라인임을 말하고 있어 중복이다).
 * 대신 여기 한 줄이 "잃지 않았다"를 말한다. 연결돼도 아직 안 올라간 경우가 있어
 * (동기화 실패·서버 장애) 오프라인 여부와 **독립적으로** 뜬다.
 */
export function PendingReviewsNotice({ count = 0 }) {
  if (!count) return null;
  return (
    <p className="offline-notice" role="status">
      복습 <strong>{count}개</strong>가 기기에 저장돼 있어요 — 연결되면 자동으로 올라갑니다.
    </p>
  );
}
