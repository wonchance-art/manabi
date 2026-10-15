import { Shippori_Mincho_B1 } from 'next/font/google';
import LiteratureCoverArt from './LiteratureCoverArt';
import './literature-cover.css';

// 정본 문학책 표지(AOZORA-P0-5 → 시리즈 A 「布装·型押し + 題簽」 2026-10-15 KST) — 원서 표지·삽화를 쓰지 않는 자작 표지(IP 정책 §2.1 금지⑴).
// 같은 틀에 작품 색의 천(display.cover)·그 위에 찍은 문양(display.motif — LiteratureCoverArt)·題簽의 세로 제목만 바뀐다. 제목·작가는 옆 글자가 읽어 주므로 장식이다(aria-hidden).
// 제목 글꼴은 웹폰트(명조)로 고정한다 — 시스템 명조는 한국어 Windows에 없는 경우가 많아 기기마다 표지가 달라진다
// (디자이너 검토). 사이트 전체 preload 없이 표지가 보일 때만 받는다(ChineseSerif·문법 레이아웃 선례).
// 글꼴은 しっぽり明朝 B1(쓰키지체 계열 활판 명조 · 잉크 고임 재현) 500 — 오너가 실제 글꼴 비교에서 골랐다(2026-10-14 KST,
// 「폰트가 안 어울린다」 → Noto Serif JP 400 · B1 400/500 · Zen Old Mincho 400/500 비교). 500은 60×84 실제 크기에서도 획이 옅어지지 않는다.
// 배포 빌드는 저장소 사본(vendor/google-fonts)에서만 글꼴을 읽으므로 이 호출을 바꾸면 사본도 함께 받는다.
const serif = Shippori_Mincho_B1({ weight: '500', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-lit-serif' });

const titleLines = (work) => String(work.display?.coverTitle || work.title).split('\n');

export default function LiteratureCover({ work }) {
  if (!work?.display) return null;
  // 시리즈 A(오너 선택 2026-10-15 KST) — 천 장정 위에 따로 붙인 題簽 하나: 제목은 오른쪽 위에서 한 줄로 내려오고(여섯 자를 넘으면
  // 둘째 줄을 한 글자 내려 붙인다), 작가는 그 왼쪽 아래. 題簽의 자리·규격·글자 크기는 모든 작품이 같다(「편차 없이 · 균형」).
  const lines = titleLines(work);
  return (
    <span className={`lit-cover lit-cover--${work.display.cover} ${serif.variable}`} data-motif={work.display.motif} aria-hidden="true">
      <LiteratureCoverArt motif={work.display.motif} />
      <span className="lit-cover__slip">
        <span lang="ja" className={lines.length > 1 ? 'lit-cover__title lit-cover__title--stepped' : 'lit-cover__title'}>
          {lines.map((line) => <span key={line} className="lit-cover__line">{line}</span>)}
        </span>
        <span lang="ja" className="lit-cover__author">{work.author}</span>
      </span>
    </span>
  );
}
