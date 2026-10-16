import { useId } from 'react';
import { Libre_Caslon_Display } from 'next/font/google';
import { VICTORIAN_CLOTHS } from '../../lib/victorianCover';
import './victorian-cover.css';

// 영어 정본 책 표지 — 「빅토리아 천 장정」 시리즈(LIT-SRC-EN-1, 오너 「그럼 B로」 2026-10-16 KST). 규칙·고증 근거는 lib/victorianCover.js.
// 60×84(서재 표지 규격, 시리즈 A와 같다) · 그림 좌표 120×168. 천(결 무늬) · 테두리 · 금박(또는 먹 판 위 금박) 장식은 SVG, 제목은 금박 글자(HTML).
// 앞표지에는 제목만 둔다 — 빅토리아 천 장정은 작가 이름을 보통 책등에 찍었고, 60px 표지에서 작가 글자는 읽히지 않는다(옆 글자가 읽어 준다).
// 제목·그림은 장식이다(aria-hidden) — 카드의 제목 글자가 읽어 준다. 글꼴은 Caslon 계열(18–19세기 영국 본문·제목 활자)이고,
// 배포 빌드는 저장소 사본(vendor/google-fonts)에서만 읽는다.
const caslon = Libre_Caslon_Display({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-vic-caslon' });

const GILT = { hi: '#f2dc97', mid: '#d2ab52', lo: '#a07a2c' };
const INK = '#1c1a19';

function Border({ kind, deep, gilt }) {
  if (kind === 'triple-gilt') {
    return <g fill="none" stroke={gilt} strokeWidth=".9"><rect x="9" y="6" width="105" height="156" /><rect x="11.6" y="8.6" width="99.8" height="150.8" strokeWidth=".55" /><rect x="13.8" y="10.8" width="95.4" height="146.4" strokeWidth=".55" /></g>;
  }
  const stroke = kind === 'black' ? INK : deep;
  return <g fill="none" stroke={stroke} opacity=".9"><rect x="10" y="7" width="103" height="154" strokeWidth="1.7" /><rect x="13.2" y="10.2" width="96.6" height="147.6" strokeWidth=".7" /></g>;
}

function Motif({ kind, gilt, ink, deep }) {
  if (kind === 'pocket-watch') {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6; const long = i % 3 === 0;
      const r0 = 15.5; const r1 = long ? 19 : 17.6;
      return <line key={i} x1={60 + Math.sin(a) * r0} y1={104 - Math.cos(a) * r0} x2={60 + Math.sin(a) * r1} y2={104 - Math.cos(a) * r1} strokeWidth={long ? 1.7 : 0.9} />;
    });
    return (
      <g stroke={gilt} fill="none">
        <circle cx="60" cy="104" r="23" strokeWidth="3" /><circle cx="60" cy="104" r="20.4" strokeWidth=".8" />
        <rect x="56.5" y="75" width="7" height="6" rx="1.5" fill={gilt} stroke="none" /><circle cx="60" cy="71.5" r="4" strokeWidth="2" />
        <g>{ticks}</g>
        <line x1="60" y1="104" x2="60" y2="90" strokeWidth="2.1" strokeLinecap="round" /><line x1="60" y1="104" x2="69.5" y2="109" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="60" cy="104" r="2" fill={gilt} stroke="none" />
        <g transform="translate(86 133) rotate(-35)"><circle r="4.1" strokeWidth="2" /><path d="M3.6 0h16M14.6 0v4M18.6 0v3" strokeWidth="2.2" /></g>
        <path d="M30 137c-2.6-3.4-7.4-1.6-5.4 2.6 1 2.2 5.4 5.6 5.4 5.6s4.4-3.4 5.4-5.6c2-4.2-2.8-6-5.4-2.6z" fill={gilt} stroke="none" />
      </g>
    );
  }
  if (kind === 'magnifier') {
    return (
      <g>
        <g fill="none" stroke={ink} strokeLinecap="round">
          <path d="M16 133c10-4 18 3 28-1s16-5 26-1 20 3 36-1" strokeWidth="2.3" />
          <path d="M13 142c14-4 22 2 34-1s18-4 30 0 18 2 34-2" strokeWidth="1.8" opacity=".8" />
          <path d="M70 112l18 21" strokeWidth="5" /><path d="M85 129l7 8" strokeWidth="7.5" />
        </g>
        <circle cx="56" cy="97" r="20" fill={deep} fillOpacity=".25" />
        <circle cx="56" cy="97" r="20" fill="none" stroke={gilt} strokeWidth="4" /><circle cx="56" cy="97" r="15.6" fill="none" stroke={gilt} strokeWidth=".8" />
        <path d="M46 87a14 14 0 0 1 12-5" fill="none" stroke={gilt} strokeWidth="2" strokeLinecap="round" />
        <circle cx="95" cy="70" r="7" fill={gilt} fillOpacity=".22" /><circle cx="95" cy="70" r="2.6" fill={gilt} />
      </g>
    );
  }
  // holly-candle — 호랑가시나무 고리 안의 촛불
  const leaves = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const x = 60 + Math.cos(a) * 24; const y = 104 + Math.sin(a) * 24;
    return <path key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((a * 180) / Math.PI + 90).toFixed(0)})`} d="M-6 0c2-2 2-4 5-4 0 2 1 3 3 3-1 2 0 3 1 4-2 0-3 1-3 3-1-1-3-1-5 0 0-2 0-3-2-4z" fill={gilt} />;
  });
  const berries = [[60, 80.5], [83.5, 104], [60, 127.5], [36.5, 104]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={gilt} />);
  return (
    <g>
      {leaves}{berries}
      <rect x="54" y="98" width="12" height="20" rx="1.2" fill="none" stroke={gilt} strokeWidth="2" />
      <line x1="60" y1="94" x2="60" y2="98" stroke={gilt} strokeWidth="1.1" />
      <path d="M60 84c-3.6 5-4.4 8.6 0 12.6 4.4-4 3.6-7.6 0-12.6z" fill={gilt} />
      <circle cx="60" cy="91" r="9" fill={gilt} fillOpacity=".16" />
    </g>
  );
}

/** work: 대조표의 작품({display: {coverTitle, cloth, border, stamping, motif}}). 표기가 없으면 그리지 않는다. */
export default function VictorianCover({ work }) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const display = work?.display;
  const tone = display && VICTORIAN_CLOTHS[display.cloth];
  if (!tone) return null;
  // 무늬·금박 정의 id — React 트리가 둘 이상인 화면(정적 렌더·따로 그린 확인 창)에서도 겹치지 않게 천·문양을 붙인다.
  const id = `vic-${reactId}-${display.cloth}-${display.motif}`;
  const gilt = `url(#${id}-gilt)`;
  const blackPanel = display.stamping === 'gilt-black';
  const lines = String(display.coverTitle).split('\n');
  return (
    <span className={`vic-cover ${caslon.variable}`} style={{ '--vic-cloth': tone.cloth }} data-motif={display.motif} aria-hidden="true">
      <svg className="vic-cover__art" viewBox="0 0 120 168" focusable="false">
        <defs>
          <pattern id={`${id}-weave`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform={display.cloth === 'cinnamon' ? 'rotate(90)' : 'rotate(45)'}>
            <rect width="3" height="3" fill={tone.cloth} />
            <path d="M0 .5H3" stroke="#fff" strokeOpacity=".06" strokeWidth=".6" /><path d="M.5 0V3" stroke="#000" strokeOpacity=".08" strokeWidth=".6" />
          </pattern>
          <linearGradient id={`${id}-gilt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GILT.hi} /><stop offset=".55" stopColor={GILT.mid} /><stop offset="1" stopColor={GILT.lo} />
          </linearGradient>
        </defs>
        <rect width="120" height="168" fill={`url(#${id}-weave)`} />
        <rect width="6" height="168" fill="#000" opacity=".18" /><rect x="6" width="1.2" height="168" fill="#fff" opacity=".07" />
        <Border kind={display.border} deep={tone.deep} gilt={gilt} />
        {blackPanel && <g><rect x="20" y="17" width="83" height="37" fill={INK} /><rect x="22.4" y="19.4" width="78.2" height="32.2" fill="none" stroke={gilt} strokeWidth=".7" /></g>}
        {!blackPanel && <rect x="22" y="18" width="79" height="35" fill="none" stroke={gilt} strokeWidth=".9" />}
        <Motif kind={display.motif} gilt={gilt} ink={blackPanel ? INK : tone.deep} deep={tone.deep} />
      </svg>
      <span className="vic-cover__title" lang="en">
        {lines.map((line) => <span key={line} className="vic-cover__line">{line}</span>)}
      </span>
    </span>
  );
}
