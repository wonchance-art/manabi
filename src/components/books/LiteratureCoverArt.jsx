import { useId } from 'react';
import { LITERATURE_COVER_MOTIFS } from '../../lib/literatureDisplay';
import './literature-cover-art.css';

// 정본 문학책 표지 그림 — 작품이 처음 나온 시대의 장정 감각을 manabi가 새로 그린 재구성(오너 확정 2026-10-14 KST
// 「퍼블릭 도메인 표지는 예외 · 그때의 감각을 새롭게 재구현」). 원본 그림을 옮기거나 본뜨지 않는다 — 구조·문법만 빌린다.
// 같은 틀(책등·제목 11px 오른쪽 위·작가 6px 그 왼쪽 아래·아래 선)은 다섯 권 공통이고, 그림은 글자 칸 밖에만 둔다
// (오너 「글자가 그림과 겹치지 않게」 — 예외는 제목을 받치는 題簽 바탕 하나, data-ground).
// 좌표계 120×168(표지 60×84의 두 배). 색은 CSS만 정한다: lit-art__p1…p6 = 모티프별 판색(--p1…), __t = 바탕결(투명도 .1).
// 모티프 키 목록의 정본은 literatureDisplay(빌드가 entry.json display.motif를 검사한다) — 여기서는 다시 내보내기만.
export { LITERATURE_COVER_MOTIFS };

// 결정적 의사난수 — 종이결·눈송이 위치가 렌더마다 같도록.
const scatter = (n, seed, [x0, y0, x1, y1]) => Array.from({ length: n }, (_, i) => {
  const r = (k) => { const v = Math.sin(seed * 97.1 + i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  return [Math.round((x0 + r(1) * (x1 - x0)) * 2) / 2, Math.round((y0 + r(2) * (y1 - y0)) * 2) / 2];
});
const P = (n) => `lit-art__p${n}`;

// 手袋を買いに — 원 장정(1943)은 보호 중이라 쇼와 10년대 어린이책의 관례만 쓴다: 종이가 귀하던 2도 인쇄(쪽빛 + 따뜻한 노랑,
// 눈은 종이 바탕색), 단순한 童画 선그림 — 눈 내리는 밤의 모자 가게 등불과 작은 장갑·동전. 특정 화가 화풍을 흉내 내지 않는다.
function SnowNight() {
  const snow = scatter(14, 1, [8, 6, 56, 58]).concat(scatter(5, 2, [58, 8, 72, 90]), [[112, 30], [113, 80], [111, 130]]);
  return (
    <>
      <g className={P(1)} fill="currentColor">{snow.map(([x, y], i) => <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 3 ? 1.1 : 1.7} />)}</g>
      <path className={P(1)} d="M0 131C18 128 38 130 46 140C51 147 52 154 56 156.5C60 158 64 158.5 70 158.5H120V168H0Z" fill="currentColor" />
      <circle className={`${P(2)} lit-art__glow`} cx="16" cy="106" r="7.5" fill="currentColor" />
      <path className={P(1)} d="M21 97V132H51V97M21 101H15V103" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path className={P(1)} d="M15 99L36 70 56.5 99 51 100 36 79 21 100Z" fill="currentColor" />
      <path className={P(2)} d="M30 92C30 87 33 85 36 85S42 87 42 92H45.5V95H26.5V92Z" fill="currentColor" />
      <rect className={P(2)} x="31" y="108" width="10" height="24" fill="currentColor" />
      <path className={P(2)} d="M13 103H18L17 110H14Z" fill="currentColor" />
      <path className={P(2)} d="M14 150V141C14 135.5 23 135.5 23 141V150ZM14.5 146C11 146 10 140 12 139.5S14 142 14.5 143Z" fill="currentColor" />
      <path className={P(3)} d="M14 147.5H23" stroke="currentColor" strokeWidth="1.2" />
      <g className={P(2)} fill="currentColor"><circle cx="44" cy="144" r="2.4" /><circle cx="49.5" cy="146" r="2.4" /></g>
      <g className={P(3)} fill="currentColor"><circle cx="44" cy="144" r="0.9" /><circle cx="49.5" cy="146" r="0.9" /></g>
    </>
  );
}

// ごん狐 — 첫 게재 호(1932) 표지는 미국에서 2027년 말까지 보호 중이라, 퍼블릭 도메인인 1918–1930년 어린이 잡지의 문법만 쓴다:
// 위쪽 색띠 + 테 두른 그림 칸 + 수채처럼 맑은 평면 색(다색 석판 느낌). 잡지 제호·새 문장·특정 표지 구도는 쓰지 않는다.
const FLOWERS = [[18, 138, 1.4], [26, 132, 1.2], [47, 137, 1.4], [51, 126, 1.1], [44, 118, 0.9], [20, 120, 1], [31, 116, 0.8], [16, 109, 0.7], [52, 108, 0.7], [27, 106, 0.6], [40, 106, 0.6]];
function Higanbana() {
  return (
    <>
      <rect className={P(1)} x="0" y="0" width="120" height="9" fill="currentColor" />
      <g className={P(5)} fill="currentColor">{[10, 22, 34, 46, 58, 70, 82, 94, 106].map((x) => <path key={x} d={`M${x} 2.5L${x + 2} 4.5 ${x} 6.5 ${x - 2} 4.5Z`} />)}</g>
      <rect className={P(2)} x="13" y="17" width="42" height="126" fill="currentColor" />
      <circle className={P(1)} cx="41" cy="42" r="7" fill="currentColor" />
      <path className={P(3)} d="M13 88C22 80 32 86 40 81S52 78 55 82V143H13Z" fill="currentColor" />
      <path className={P(4)} d="M13 103C26 97 42 103 55 98V143H13Z" fill="currentColor" />
      <path className={P(2)} d="M27 143C29 130 38 121 36 112C35 107 40 104 44 102L45.5 103.5C42 106 40 109 41 114C43 125 36 133 36 143Z" fill="currentColor" />
      <g className={P(6)} fill="currentColor">
        <path d="M21 84.5C21 82.5 23 82 25.5 82S29 82.5 29.5 83.5L28.5 85.5H22Z" />
        <path d="M29 83.5L30 80.5 31 82 32 80.5 32.6 83.5 31 85Z" />
        <path d="M21.5 84C19 84 17 83 16 81C18 81.5 20 82 22 83Z" />
      </g>
      <g className={P(5)} fill="currentColor" stroke="currentColor" strokeLinecap="round">
        {FLOWERS.map(([x, y, s]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={1.5 * s} stroke="none" />
            <path d={`M${x} ${y}L${x - 2.6 * s} ${y - 3 * s}M${x} ${y}L${x} ${y - 3.8 * s}M${x} ${y}L${x + 2.6 * s} ${y - 3 * s}`} strokeWidth="1.2" fill="none" />
          </g>
        ))}
      </g>
      <rect className={P(1)} x="13" y="17" width="42" height="126" fill="none" stroke="currentColor" strokeWidth="2" />
      <g className={P(1)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M94 162C94 148 92 138 93 126" />
        <path d="M93 126Q86 124 83 116M93 126Q88 118 88 110M93 126Q93 116 95 108M93 126Q98 118 101 112M93 126Q101 124 104 118M93 126Q89 128 86 125M93 126Q97 129 100 126" />
      </g>
    </>
  );
}

// 注文の多い料理店 — 1924년 초판의 표지·삽화(菊池武雄, 2044년 말까지 보호)는 떠올리게 하지 않고, 다이쇼 말 지방 자비 출판
// 동화책의 관례만 쓴다: 굵은 목판 선 · 2–3도 활판(미색·황토·짙은 숲) · 활판 괘선 테. 그림은 하나 — 「문을 열면 또 문」.
// 황토와 짙은 숲이 번갈아 깊어지고, 가장 안쪽 어둠에 산고양이 눈. 간판·글자는 없다.
function ForestDoors() {
  const doors = [[31, 8, 40, 71], [37, 18, 28, 58], [42, 27, 18, 46.5], [46, 35, 10, 36.5]];
  return (
    <>
      <path className={P(1)} d="M8 4H116V164H8ZM10.6 6.6H113.4V161.4H10.6Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {doors.map(([x, y, w, ht], i) => (
        <g key={x}>
          <rect className={P(i % 2 ? 3 : 2)} x={x} y={y} width={w} height={ht} fill="currentColor" />
          <rect className={P(1)} x={x} y={y} width={w} height={ht} fill="none" stroke="currentColor" strokeWidth={i ? 1.8 : 2.8} />
          {i < 3 && <circle className={P(1)} cx={x + w - 3} cy={y + ht * 0.58} r="1.2" fill="currentColor" />}
        </g>
      ))}
      <g className={P(4)} fill="currentColor"><ellipse cx="49" cy="49" rx="1.5" ry="1.9" /><ellipse cx="53" cy="49" rx="1.5" ry="1.9" /></g>
      <g className={P(3)} fill="currentColor"><ellipse cx="49" cy="49" rx="0.5" ry="1.5" /><ellipse cx="53" cy="49" rx="0.5" ry="1.5" /></g>
      <path className={P(1)} d="M28 79.5H72" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </>
  );
}

// 鼻 — 芥川 자신이 장정한『羅生門』(阿蘭陀書房 1917, 퍼블릭 도메인)의 절제된 다이쇼 문예서 문법에서 착상한 재구성:
// 무지에 가까운 천 바탕(布目)과 제목을 받치는 직사각 題簽 하나. 題簽 글씨(菅虎雄)는 흉내 내지 않는다 — 글꼴은 시리즈 공통.
// 아래의 옅은 김 무늬는 空押し(색 없이 누른 자국) 느낌으로만.
function InkSteam() {
  const weave = Array.from({ length: 42 }, (_, i) => `M0 ${i * 4 + 1}H120`).join('') + Array.from({ length: 30 }, (_, i) => `M${i * 4 + 1} 0V168`).join('');
  return (
    <>
      <path className={`${P(4)} lit-art__t`} d={weave} stroke="currentColor" strokeWidth="1.2" />
      <g className={`${P(4)} lit-art__t`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="32" cy="122" r="16" />
        <path d="M26 132C22 124 30 120 26 112M33 132C29 122 37 118 33 108M40 132C36 124 44 120 40 112" />
      </g>
      <rect className={P(1)} x="70" y="7" width="40" height="56" fill="currentColor" data-ground="title" />
      <rect className={P(2)} x="72.6" y="9.6" width="35.4" height="50.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect className={P(3)} x="86.5" y="47" width="7" height="7" rx="0.6" fill="currentColor" />
    </>
  );
}

// 文鳥 — 橋口五葉 장정『四篇』(春陽堂 1910, 퍼블릭 도메인 JP·KR·US)의 띠 장식 구조에서 착상한 manabi 재구성:
// 메이지 아르누보의 가로 띠(frieze) + 채찍 덩굴 + 가는 이중 테, 판화처럼 평평한 세 판색(생성り 바탕·鉄紺·金茶).
// 원본의 토끼·꽃은 그리지 않고, 문조·조 이삭·빈 새장으로 바꿨다. 書名·출판사명은 쓰지 않는다.
function Bird({ x, y, flip }) {
  return (
    <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
      <path className={P(3)} d={`M${x - 5} ${y - 2}C${x - 4} ${y - 7} ${x + 2} ${y - 8} ${x + 4} ${y - 6}L${x + 5} ${y - 3}C${x + 3} ${y} ${x - 2} ${y} ${x - 5} ${y - 2}ZM${x - 5} ${y - 2}L${x - 10} ${y - 1} ${x - 9} ${y - 4}Z`} fill="currentColor" />
      <circle className={P(3)} cx={x + 4} cy={y - 7.5} r="2.6" fill="currentColor" />
      <path className={P(2)} d={`M${x + 6.2} ${y - 8.6}L${x + 8.8} ${y - 7.4} ${x + 6.2} ${y - 6.4}Z`} fill="currentColor" />
    </g>
  );
}
function Birdcage() {
  const vine = 'M14 83C22 77 30 89 38 83S54 77 62 83 78 89 86 83 102 77 110 83';
  const ear = (x, y, up) => [0, 1, 2, 3, 4].map((k) => [x + 0.8 * k + (k % 2 ? 1 : -1), y + (up ? -2.3 : 2.3) * k]);
  return (
    <>
      <g className={P(2)} fill="none" stroke="currentColor">
        <rect x="10" y="5" width="103" height="158" strokeWidth="1.4" />
        <rect x="13.4" y="8.4" width="96.2" height="151.2" strokeWidth="1.2" />
      </g>
      <g className={P(1)} fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M38 9V18M24 57V34Q24 22 38 22Q52 22 52 34V57M29 57V30M33.5 57V24M38 57V22M42.5 57V24M47 57V30M24 46H52" />
        <circle cx="38" cy="20" r="2" />
      </g>
      <rect className={P(1)} x="21" y="56" width="34" height="3.4" fill="currentColor" />
      <rect className={P(1)} x="13.4" y="65" width="96.2" height="28" fill="currentColor" />
      <g className={P(2)} fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M13.4 67.6H109.6M13.4 90.4H109.6" /></g>
      <path className={P(2)} d={vine} fill="none" stroke="currentColor" strokeWidth="1.4" />
      <g className={P(2)} fill="currentColor">
        {[31, 55, 79, 103].flatMap((x) => ear(x, 84, true)).map(([x, y]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.2" ry="0.9" />)}
      </g>
      {[19, 43, 67, 91].map((x, i) => <Bird key={x} x={x} y={80.5} flip={i % 2 === 1} />)}
      <path className={P(2)} d="M20 159C17 142 34 138 30 124S36 102 48 104" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <g className={P(2)} fill="currentColor">{ear(48, 106, false).map(([x, y]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.2" ry="0.9" />)}</g>
    </>
  );
}

// 옛 종이 — 다섯 권 공통 층(오너 「빈티지 효과 · 옛 종이 질감」). 그림 위·글자 아래에 깔린다(글자는 z-index:1).
// 고운 종이결(고주파 잡음) · 얼룩(저주파 잡음을 문턱으로 자른 황갈색 반점) · 잉크가 고르지 않게 빠진 밝은 결 · 가장자리 그을음.
// 그림 자체에는 활판 느낌(가장자리 미세 번짐 + 농도 얼룩)만 준다. 전부 코드로 만든 절차 질감이다(이미지·외부 주소 없음).
// 숫자 행렬은 잡음→투명도 변환일 뿐 색이 아니다 — 색은 CSS(flood-color·color)가 정한다.
function PaperFilters({ id }) {
  return (
    <defs>
      <filter id={`${id}-print`} x="0" y="0" width="120" height="168" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="2" result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale="1.3" xChannelSelector="R" yChannelSelector="G" result="moved" />
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="5" result="blot" />
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.9 0 0 0 0.5" result="inkMask" />
        <feComposite in="moved" in2="inkMask" operator="in" />
      </filter>
      <filter id={`${id}-paper`} x="0" y="0" width="120" height="168" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="fine" />
        <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.4 0 0 0 -1.2" result="grainA" />
        <feFlood className="lit-paper__grain" result="grainC" />
        <feComposite in="grainC" in2="grainA" operator="in" result="grain" />
        <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 0 0 0 1" result="flecksA" />
        <feFlood className="lit-paper__fleck" result="fleckC" />
        <feComposite in="fleckC" in2="flecksA" operator="in" result="fleck" />
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.045" numOctaves="3" seed="11" result="low" />
        <feColorMatrix in="low" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.6 0 0 0 -1.45" result="stainA" />
        <feFlood className="lit-paper__stain" result="stainC" />
        <feComposite in="stainC" in2="stainA" operator="in" result="stain" />
        <feColorMatrix in="low" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 0 0 0 1.05" result="fadeA" />
        <feFlood className="lit-paper__fade" result="fadeC" />
        <feComposite in="fadeC" in2="fadeA" operator="in" result="fade" />
        <feMerge><feMergeNode in="fade" /><feMergeNode in="stain" /><feMergeNode in="grain" /><feMergeNode in="fleck" /></feMerge>
      </filter>
      <radialGradient id={`${id}-edge`} cx="0.5" cy="0.5" r="0.72">
        <stop offset="0.6" className="lit-paper__edge" stopColor="currentColor" stopOpacity="0" />
        <stop offset="1" className="lit-paper__edge" stopColor="currentColor" stopOpacity="0.38" />
      </radialGradient>
    </defs>
  );
}

function PaperGrain({ id }) {
  return (
    <g className="lit-paper">
      <rect width="120" height="168" filter={`url(#${id}-paper)`} />
      <rect width="120" height="168" fill={`url(#${id}-edge)`} />
    </g>
  );
}

const ART = { 'snow-night': SnowNight, higanbana: Higanbana, 'forest-doors': ForestDoors, 'ink-steam': InkSteam, birdcage: Birdcage };

export default function LiteratureCoverArt({ motif }) {
  // 한 화면에 표지가 여럿 — 필터·그라디언트 id를 표지마다 따로 둔다(url(#…)은 같은 문서 안 조각 참조뿐).
  const id = `lp${useId().replace(/[^\w-]/g, '')}`;
  const Art = ART[motif];
  if (!Art) return null;
  return (
    <svg className={`lit-art lit-art--${motif}`} viewBox="0 0 120 168" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <PaperFilters id={id} />
      <g filter={`url(#${id}-print)`}><Art /></g>
      <PaperGrain id={id} />
    </svg>
  );
}
