import { getReadingTrack, getBunkei } from '@/content/japanese';
import ReadingTrackPage from '@/views/ReadingTrackPage';

export const metadata = { title: '도쿄 도착 · 독해 트랙 | Anatomy Studio' };

/**
 * 독해 트랙 "도쿄 도착"(JA N5 파일럿) 진입 라우트.
 * 콘텐츠(트랙·문형 사전)는 서버에서만 열어 클라이언트 번들에 싣지 않는다
 * — 문형 칩→사전 카드에 필요한 explain·contrast·ex 만 글/드릴에 붙여 내려보낸다.
 *
 * admin 게이트 없음 — 일반 사용자 공개 라우트(파일럿 라벨만).
 */
export default function Page() {
  const track = getReadingTrack('n5-tokyo');
  if (!track) return <ReadingTrackPage track={null} />;

  // 문형 pattern → 사전 카드(bunkei explain 이관분). 신규 문형 칩 팝오버용.
  const bunkei = getBunkei('N5');
  const cardByPattern = new Map();
  for (const th of bunkei?.themes || []) {
    for (const it of th.items) {
      cardByPattern.set(it.pattern, {
        pattern: it.pattern,
        ko: it.ko || '',
        explain: it.explain || '',
        contrast: it.contrast || '',
        ex: it.ex || null,
      });
    }
  }
  const cardsFor = (patterns) => (patterns || []).map((p) => cardByPattern.get(p)).filter(Boolean);

  // 직렬화 가능한 경량 페이로드로 재구성(함수·미사용 필드 배제)
  const payload = {
    track: track.track,
    title: track.title,
    level: track.level,
    estWeeks: track.estWeeks,
    texts: (track.texts || []).map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      situation: t.situation,
      place: t.place,
      frame: t.frame,
      newPatterns: t.newPatterns || [],
      body: t.body || [],
      questions: t.questions || [],
      patternCards: cardsFor(t.newPatterns),
    })),
    drills: (track.drills || []).map((d) => ({
      afterOrder: d.afterOrder,
      title: d.title,
      style: d.style,
      patterns: d.patterns || [],
      items: d.items || [],
      patternCards: cardsFor(d.patterns),
    })),
  };

  return <ReadingTrackPage track={payload} />;
}
