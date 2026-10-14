import { Noto_Serif_JP } from 'next/font/google';
import './literature-cover.css';

// 정본 문학책 표지(AOZORA-P0-5) — 원서 표지·삽화를 쓰지 않는 타이포그래피 표지(IP 정책 §2.1 금지⑴).
// 같은 틀에 작품 색(display.cover)과 세로 제목만 바뀐다. 제목·작가는 옆 글자가 읽어 주므로 장식이다(aria-hidden).
// 제목 글꼴은 웹폰트(명조)로 고정한다 — 시스템 명조는 한국어 Windows에 없는 경우가 많아 기기마다 표지가 달라진다
// (디자이너 검토). 사이트 전체 preload 없이 표지가 보일 때만 받는다(ChineseSerif·문법 레이아웃 선례).
const serif = Noto_Serif_JP({ weight: ['600'], subsets: ['latin'], display: 'swap', preload: false, variable: '--font-lit-serif' });

const titleLines = (work) => String(work.display?.coverTitle || work.title).split('\n');

export default function LiteratureCover({ work }) {
  if (!work?.display) return null;
  const lines = titleLines(work);
  const longest = Math.max(...lines.map((line) => line.length));
  const size = longest === 1 ? 'xl' : longest === 2 ? 'l' : longest === 3 ? 'm' : 's';
  return (
    <span className={`lit-cover lit-cover--${work.display.cover}${lines.length > 1 ? ' lit-cover--multi' : ''} ${serif.variable}`} aria-hidden="true">
      <span lang="ja" className={`lit-cover__title lit-cover__title--${size}`}>{lines.join('\n')}</span>
      <i />
    </span>
  );
}
