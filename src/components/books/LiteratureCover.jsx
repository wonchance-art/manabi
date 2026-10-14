import './literature-cover.css';

// 정본 문학책 표지(AOZORA-P0-5) — 원서 표지·삽화를 쓰지 않는 타이포그래피 표지(IP 정책 §2.1 금지⑴).
// 같은 틀에 작품 색(display.cover)과 세로 제목만 바뀐다. 제목·작가는 옆 글자가 읽어 주므로 장식이다(aria-hidden).
const titleLines = (work) => String(work.display?.coverTitle || work.title).split('\n');

export default function LiteratureCover({ work }) {
  if (!work?.display) return null;
  const lines = titleLines(work);
  const longest = Math.max(...lines.map((line) => line.length));
  const size = longest === 1 ? 'xl' : longest === 2 ? 'l' : longest === 3 ? 'm' : 's';
  return (
    <span className={`lit-cover lit-cover--${work.display.cover}`} aria-hidden="true">
      <span lang="ja" className={`lit-cover__title lit-cover__title--${size}`}>{lines.join('\n')}</span>
      <i />
    </span>
  );
}
