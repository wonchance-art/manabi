import { useId } from 'react';
import { Libre_Caslon_Display } from 'next/font/google';
import { VICTORIAN_BINDINGS, VICTORIAN_CLOTHS } from '../../lib/victorianCover';
import './victorian-cover.css';

// 영어 정본 책 표지 — 「빅토리아 천 장정」 시리즈(LIT-SRC-EN-1, 오너 「그럼 B로」 → 「실물에 가깝게」 2026-10-16 KST). 규칙·근거는 lib/victorianCover.js.
// 60×84(서재 표지 규격, 시리즈 A와 같다) · 그림 좌표 120×168. 장정 구성(binding)마다 초판 앞표지의 자리를 따른다 — 글자도 실물에 있는
// 것만 그린다(Alice 앞표지는 글자 없음). 천·테두리·금박·먹·민압·글자 모두 SVG 한 장이고, 장식이다(aria-hidden — 카드의 제목 글자가 읽어 준다).
// 글꼴은 Caslon 계열(18–19세기 영국 활자)이고, 배포 빌드는 저장소 사본(vendor/google-fonts)에서만 읽는다.
const caslon = Libre_Caslon_Display({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-vic-caslon' });

const FONT = 'var(--font-vic-caslon), "Libre Caslon Display", "Big Caslon", Georgia, serif';
const GILT = { hi: '#f2dc97', mid: '#d2ab52', lo: '#a07a2c' };
const INK = '#1c1a19';

/** 금박 글자 — 아래에 짙은 자국(눌러 찍은 그림자), outline이 있으면 글자 테(밝은 천 위에서도 읽히게). */
function GiltText({ x, y, size, anchor = 'start', gilt, outline, children }) {
  const common = { x, y, fontSize: size, textAnchor: anchor, style: { fontFamily: FONT } };
  return (
    <g>
      <text {...common} y={y + size * 0.05} fill="#000" opacity=".45">{children}</text>
      <text {...common} fill={gilt} {...(outline ? { stroke: outline, strokeWidth: size * 0.09, paintOrder: 'stroke', strokeLinejoin: 'round' } : {})}>{children}</text>
    </g>
  );
}

// Macmillan 1866 — 금박 삼중 줄 테두리 + 가운데 작은 금박 원형 그림. 실물의 「앨리스와 돼지」에서 사람은 빼고 돼지만.
function Medallion({ gilt, cloth }) {
  return (
    <g>
      <g fill="none" stroke={gilt} strokeWidth=".9"><rect x="9" y="6" width="105" height="156" /><rect x="11.6" y="8.6" width="99.8" height="150.8" strokeWidth=".55" /><rect x="13.8" y="10.8" width="95.4" height="146.4" strokeWidth=".55" /></g>
      <circle cx="61.5" cy="84" r="16" fill="none" stroke={gilt} strokeWidth="1.5" /><circle cx="61.5" cy="84" r="13.6" fill="none" stroke={gilt} strokeWidth=".6" />
      <g fill={gilt}>
        <ellipse cx="64" cy="86" rx="8.2" ry="5.4" /><circle cx="54.6" cy="84" r="4.5" /><rect x="48.4" y="82.4" width="3.4" height="3.6" rx="1.2" />
        <path d="M53 80.2l1.2-3.8 2.8 3.2z" />
        <rect x="57.6" y="89.4" width="2" height="4.4" rx=".6" /><rect x="60.8" y="89.8" width="2" height="4.2" rx=".6" /><rect x="66" y="89.8" width="2" height="4.2" rx=".6" /><rect x="69" y="89.4" width="2" height="4.4" rx=".6" />
      </g>
      <path d="M72 84.6c2.4-1.6 3.8.8 2.2 1.9-1.4.9-1.8-1-.4-1.5" fill="none" stroke={gilt} strokeWidth=".9" strokeLinecap="round" />
      <circle cx="53.6" cy="83" r=".7" fill={cloth} /><circle cx="49.4" cy="84.2" r=".45" fill={cloth} />
    </g>
  );
}

// Newnes 1892 — 테두리 없음 · 경사진 판 · 위 금박 제목 · 오른쪽 아래 먹 테 거리 그림(위 간판의 총서 이름 「The Strand Library」는 출판사 표지라 비운다) · 아래 금박 작가.
function Pictorial({ display, gilt, tone }) {
  const [first, second] = String(display.coverTitle).toUpperCase().split('\n');
  return (
    <g>
      <rect x="1" y="1" width="118" height="166" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.4" />
      <rect x="2.6" y="2.6" width="114.8" height="162.8" fill="none" stroke="#000" strokeOpacity=".1" strokeWidth=".6" />
      <g lang="en">
        {display.coverKicker && <GiltText x={18} y={22} size={7} gilt={gilt} outline={tone.deep}>{display.coverKicker.toUpperCase()}</GiltText>}
        <GiltText x={16} y={38} size={15} gilt={gilt} outline={tone.deep}>{first}</GiltText>
        {second && <GiltText x={38} y={53} size={15} gilt={gilt} outline={tone.deep}>{second}</GiltText>}
        <GiltText x={30} y={143} size={5} gilt={gilt} outline={tone.deep}>BY</GiltText>
        <GiltText x={39} y={143} size={7.5} gilt={gilt} outline={tone.deep}>{display.coverAuthor.toUpperCase()}</GiltText>
      </g>
      <g stroke={INK} fill="none">
        <rect x="58" y="66" width="42" height="58" strokeWidth="1.4" /><rect x="60" y="68" width="38" height="54" strokeWidth=".5" />
        <rect x="63" y="72" width="32" height="9" fill={tone.cloth} strokeWidth="1" />
        <path d="M66 81v4M92 81v4" strokeWidth=".7" />
        <path d="M71 122l6-12M89 122l-8-12M60 118h38" strokeWidth=".55" />
        <path d="M84 122v-17" strokeWidth="1" />
        <path d="M64 92h30M66 95h27" strokeWidth=".35" strokeOpacity=".7" />
      </g>
      <g fill={INK}>
        <path d="M60.6 122V87h6v-3h5v38z" /><path d="M76 110V91l2-9 2 9v19z" /><path d="M85.6 122V101h4.6v-3h4.4v3h3V122z" />
        <rect x="82.4" y="101.6" width="3.2" height="3.6" rx=".6" />
      </g>
      <g fill={tone.cloth}>
        <rect x="62.4" y="91" width="1.8" height="2.6" /><rect x="62.4" y="98" width="1.8" height="2.6" /><rect x="62.4" y="105" width="1.8" height="2.6" />
        <rect x="67.6" y="93" width="1.8" height="2.6" /><rect x="67.6" y="100" width="1.8" height="2.6" /><rect x="88" y="105" width="1.6" height="2.4" /><rect x="92.6" y="105" width="1.6" height="2.4" />
      </g>
      <circle cx="75" cy="66" r="2.4" fill={tone.cloth} stroke={INK} strokeWidth="1.1" /><circle cx="96" cy="124" r="2.4" fill={tone.cloth} stroke={INK} strokeWidth="1.1" />
    </g>
  );
}

const IVY = 'M-2.4 0c.8-1.4 3.2-1.6 4.8 0-1.6 1.6-4 1.4-4.8 0z';
const HOLLY = 'M-4.6 0l1.4-1.9 1.3 1 1.3-2 1.3 1.2 1.5-1.7L4.6 0l-1.4 1.9-1.3-1-1.3 2-1.3-1.2-1.5 1.7z';

// 민압 테두리 — 두 줄 사이를 담쟁이·호랑가시 잎이 돈다(찍힌 자국 = 짙은 색 + 아래쪽 밝은 가장자리).
function BlindFoliage({ deep }) {
  const leaves = [];
  const along = (from, to, fixed, horizontal) => {
    for (let t = from, i = 0; t <= to; t += 8, i += 1) {
      const [x, y] = horizontal ? [t, fixed] : [fixed, t];
      leaves.push(<path key={`${horizontal}-${fixed}-${t}`} d={IVY} transform={`translate(${x} ${y}) rotate(${(horizontal ? 0 : 90) + (i % 2 ? 35 : -35)})`} />);
    }
  };
  along(18, 102, 8.6, true); along(18, 102, 159.4, true); along(16, 152, 10.6, false); along(16, 152, 109.4, false);
  const corners = [[10.6, 8.6], [109.4, 8.6], [10.6, 159.4], [109.4, 159.4]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" />);
  const frame = (
    <g>
      <rect x="7" y="5" width="106" height="158" fill="none" strokeWidth=".9" /><rect x="14" y="12" width="92" height="144" fill="none" strokeWidth=".5" />
      <g stroke="none">{leaves}{corners}</g>
    </g>
  );
  return (
    <g>
      <g transform="translate(.5 .6)" stroke="#fff" fill="#fff" opacity=".09">{frame}</g>
      <g stroke={deep} fill={deep} opacity=".72">{frame}</g>
    </g>
  );
}

// Chapman & Hall 1843 — 민압 테두리 + 가운데 금박 호랑가시 화환(아래 리본 매듭) 안에 제목·작가.
function Wreath({ display, gilt, tone }) {
  const [cx, cy, r] = [60, 82, 33];
  const leaves = [];
  for (let i = 0; i < 28; i += 1) {
    const deg = -90 + (i * 360) / 28;
    if (deg > 66 && deg < 114) continue; // 아래는 리본 자리
    const a = (deg * Math.PI) / 180; const rr = r + (i % 2 ? 2.6 : -2.6);
    leaves.push(<path key={deg} d={HOLLY} transform={`translate(${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}) rotate(${(deg + 90 + (i % 2 ? 30 : -30)).toFixed(0)})`} />);
  }
  const berries = [-90, -45, 0, 45, 135, 180, 225].flatMap((deg) => {
    const a = (deg * Math.PI) / 180; const [x, y] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    return [[0, 0], [2, 1.4], [-1.8, 1.6]].map(([dx, dy]) => <circle key={`${deg}-${dx}`} cx={(x + dx).toFixed(1)} cy={(y + dy).toFixed(1)} r="1.4" />);
  });
  const [first, second] = String(display.coverTitle).toUpperCase().split('\n');
  return (
    <g>
      <BlindFoliage deep={tone.deep} />
      <path d={`M${cx - 10} ${cy + 31.4}A${r} ${r} 0 1 1 ${cx + 10} ${cy + 31.4}`} fill="none" stroke={gilt} strokeWidth="1.1" />
      <g fill={gilt}>
        {leaves}{berries}
        <path d="M60 115c-4-5.4-11.4-5-10.2.2.8 3 6.4 2.6 10.2-.2zM60 115c4-5.4 11.4-5 10.2.2-.8 3-6.4 2.6-10.2-.2z" />
        <path d="M59 115.6l-5.4 9.6 2.4.6 4.2-9zM61 115.6l5.4 9.6-2.4.6-4.2-9z" /><circle cx="60" cy="115.4" r="1.9" />
      </g>
      <g lang="en">
        {display.coverKicker && <GiltText x={60} y={62} size={6.5} anchor="middle" gilt={gilt}>{display.coverKicker.toUpperCase()}</GiltText>}
        <GiltText x={60} y={73.5} size={7.6} anchor="middle" gilt={gilt}>{first}</GiltText>
        {second && <GiltText x={60} y={86} size={10.5} anchor="middle" gilt={gilt}>{second}</GiltText>}
        <GiltText x={60} y={92.6} size={4} anchor="middle" gilt={gilt}>BY</GiltText>
        <GiltText x={60} y={99} size={4} anchor="middle" gilt={gilt}>{display.coverAuthor.toUpperCase()}</GiltText>
      </g>
    </g>
  );
}

/** work: 대조표의 작품({display: {coverTitle, coverKicker?, coverAuthor?, cloth, binding}}). 표기가 없으면 그리지 않는다. */
export default function VictorianCover({ work }) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const display = work?.display;
  const tone = display && VICTORIAN_CLOTHS[display.cloth];
  if (!tone || !Object.hasOwn(VICTORIAN_BINDINGS, display.binding)) return null;
  // 무늬·금박 정의 id — React 트리가 둘 이상인 화면(정적 렌더·따로 그린 확인 창)에서도 겹치지 않게 천·장정을 붙인다.
  const id = `vic-${reactId}-${display.cloth}-${display.binding}`;
  const gilt = `url(#${id}-gilt)`;
  return (
    <span className={`vic-cover ${caslon.variable}`} style={{ '--vic-cloth': tone.cloth }} data-binding={display.binding} aria-hidden="true">
      <svg className="vic-cover__art" viewBox="0 0 120 168" focusable="false">
        <defs>
          {/* 천 결 — Carol은 세로 골(vertically-ribbed), 나머지는 고운 평직 */}
          <pattern id={`${id}-weave`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform={display.binding === 'wreath' ? 'rotate(90)' : 'rotate(45)'}>
            <rect width="3" height="3" fill={tone.cloth} />
            <path d="M0 .5H3" stroke="#fff" strokeOpacity=".06" strokeWidth=".6" /><path d="M.5 0V3" stroke="#000" strokeOpacity=".08" strokeWidth=".6" />
          </pattern>
          <linearGradient id={`${id}-gilt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GILT.hi} /><stop offset=".55" stopColor={GILT.mid} /><stop offset="1" stopColor={GILT.lo} />
          </linearGradient>
        </defs>
        <rect width="120" height="168" fill={`url(#${id}-weave)`} />
        <rect width="6" height="168" fill="#000" opacity=".18" /><rect x="6" width="1.2" height="168" fill="#fff" opacity=".07" />
        {display.binding === 'medallion' && <Medallion gilt={gilt} cloth={tone.cloth} />}
        {display.binding === 'pictorial' && <Pictorial display={display} gilt={gilt} tone={tone} />}
        {display.binding === 'wreath' && <Wreath display={display} gilt={gilt} tone={tone} />}
      </svg>
    </span>
  );
}
