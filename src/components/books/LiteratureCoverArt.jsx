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

// ── 2차 묶음(2026-10-14 KST, 오너 「유명 작가·작품 위주로 확장 · 작품마다 새 문양」) ───────────────────────────────────
// 여덟 편 모두 원본 장정·삽화를 참조하지 않는다 — 그 작품이 처음 나온 시대의 장정 **관례**(평평한 판색·선의 굵기·구도)만 빌려
// 작품 속 한 장면을 새로 그린다. 글자 칸(오른쪽 위 제목 · 그 왼쪽 아래 작가)은 비우고, 그림은 왼쪽 반과 제목 아래에만 둔다.

// 羅生門(1915) — 다이쇼 초 문예서의 절제된 2–3도: 해 질 녘 비, 무너져 가는 큰 문의 그림자와 까마귀. 문은 왼쪽 아래에만.
function RainGate() {
  const rain = Array.from({ length: 30 }, (_, i) => `M${8 + ((i * 37) % 50)} ${6 + ((i * 53) % 82)}l-3 9`).join('');
  return (
    <>
      <path className={P(2)} d={rain} stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <path className={P(3)} d="M0 160Q30 154 60 160V168H0Z" fill="currentColor" />
      <g className={P(1)} fill="currentColor">
        <path d="M0 101Q8 99 12 95Q30 90 48 95Q52 99 60 101L57 104Q30 97 3 104Z" />
        <rect x="11" y="104" width="38" height="8" />
        <path d="M0 118Q8 116 11 112Q30 108 49 112Q52 116 60 118L57 121Q30 115 3 121Z" />
        <rect x="7" y="121" width="46" height="3" />
        <rect x="9" y="124" width="3.4" height="35" />
        <rect x="19.5" y="124" width="3.2" height="35" />
        <rect x="37.3" y="124" width="3.2" height="35" />
        <rect x="47.6" y="124" width="3.4" height="35" />
        <rect x="7" y="130" width="46" height="1.8" />
        <rect x="4" y="158" width="52" height="3" />
      </g>
      <g className={P(3)} fill="none" stroke="currentColor" strokeWidth="0.7"><path d="M13 108H47M15 105.5V111M21 105.5V111M27 105.5V111M33 105.5V111M39 105.5V111M45 105.5V111" /></g>
      <path className={P(1)} d="M30 46C27 44 23 44.5 20 46.5C24 46.5 26 47.5 27.5 49.5C26 51 25.5 53 26 54.5L29 51.5 33 53C33.5 50.5 33 48.5 31.5 47.2C35 45.5 39 45.6 42 47C39.5 44.6 34.5 43.7 30 46Z" fill="currentColor" />
    </>
  );
}

// 蜘蛛の糸(1918 「赤い鳥」) — 다이쇼 어린이 잡지의 맑은 평면 색: 위는 극락의 연못(연꽃·연잎), 그 아래로 한 가닥 은빛 실과
// 작은 거미, 바닥은 지옥의 붉은 불결. 실에 매달린 작은 사람 그림자 하나.
function LotusThread() {
  return (
    <>
      <path className={P(3)} d="M4 8H58V30Q44 26 31 30T4 28Z" fill="currentColor" />
      <g className={P(3)} fill="currentColor"><ellipse cx="13" cy="33" rx="8" ry="2.6" /><ellipse cx="50" cy="32" rx="7" ry="2.4" /></g>
      <g className={P(2)} fill="currentColor">
        <path d="M30 26C26 22 25 16 27 12C29 15 30 19 30 26ZM30 26C34 22 35 16 33 12C31 15 30 19 30 26Z" />
        <path d="M30 27C24 25 20 21 19 17C23 18 27 21 30 27ZM30 27C36 25 40 21 41 17C37 18 33 21 30 27Z" />
      </g>
      <path className={P(1)} d="M30 9C28.5 13 28.5 19 30 25C31.5 19 31.5 13 30 9Z" fill="currentColor" />
      <path className={P(1)} d="M30 30V128" stroke="currentColor" strokeWidth="0.6" />
      <g className={P(1)} fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round">
        <circle cx="30" cy="62" r="1.8" stroke="none" />
        <path d="M28.5 61L25 58.5M28.5 62.5L24.5 62.5M28.5 63.5L25 66.5M31.5 61L35 58.5M31.5 62.5L35.5 62.5M31.5 63.5L35 66.5" fill="none" />
      </g>
      <path className={P(1)} d="M30 118C28.5 118 28 119.5 28.5 121L27 126 28.8 126.5 29 131 30.6 131 31 126.5 33 126 31.5 121C32 119.5 31.5 118 30 118Z" fill="currentColor" />
      <path className={P(4)} d="M0 168V150C6 142 10 152 15 144S24 138 27 147 36 136 40 146 50 140 54 148 64 152 70 152 82 140 88 148 98 142 104 150 116 144 120 150V168Z" fill="currentColor" />
      <path className={P(5)} d="M0 168V160C10 154 18 162 28 156S46 154 56 160 76 156 86 160 106 154 120 160V168Z" fill="currentColor" />
    </>
  );
}

// 山月記(1942) — 쇼와 전기 문예서의 수묵·판화풍: 큰 달, 겹친 산줄기, 바위 위에서 달을 우러르는 범 한 마리.
function MoonTiger() {
  return (
    <>
      <circle className={`${P(1)} lit-art__glow`} cx="30" cy="38" r="20" fill="currentColor" />
      <circle className={P(1)} cx="30" cy="38" r="14" fill="currentColor" />
      <path className={P(5)} d="M2 120L14 100 22 108 34 90 46 104 58 96V168H2Z" fill="currentColor" />
      <path className={P(5)} d="M76 168V134L88 122 98 130 110 118 118 126V168Z" fill="currentColor" />
      <path className={P(2)} d="M0 168V138Q14 128 26 132T50 128 60 136V168Z" fill="currentColor" />
      <path className={P(2)} d="M58 168V150Q72 146 84 150T120 146V168Z" fill="currentColor" />
      <g className={P(3)} fill="currentColor">
        <path d="M10 132C10 125 15 121 23 121H36C38 116 41 112 45 111L46.5 107.5 48 110.6C51 111 53 113 53.5 116L50 117.5 47 119.5 46 124 44 132H40.5V126H18V132Z" />
        <path d="M10.5 127C6 126 4 121 6 116C7.5 120 9 122 12 123Z" />
      </g>
      <g className={P(4)} fill="currentColor">
        <path d="M19 121.5L20.5 126.5 22 121.5ZM25 121.2L26.5 126.5 28 121.2ZM31 121.2L32.4 126 33.8 121.4ZM38.5 117L40 121.5 41.2 116.8ZM6.8 118L9 119.2 7.4 120.6Z" />
        <circle cx="47.6" cy="113.2" r="0.7" />
        <path d="M53.3 116.4L50.5 117.6 51 115.6Z" />
      </g>
      <path className={P(2)} d="M8 168L10 152M14 168L17 150M44 168L41 151M50 168L53 152" stroke="currentColor" strokeWidth="1" />
    </>
  );
}

// 坊っちゃん(1906) — 메이지 후기 판화 삽화의 맑은 담채: 바다를 끼고 달리는 작은 증기 기관차와 객차, 피어오르는 연기,
// 아래는 물결 띠. 밝은 하늘색 바탕이라 글자는 짙은 남색(literature-cover.css).
function SteamSea() {
  // 연기 — 굴뚝에서 뒤(왼쪽 위)로 퍼지는 한 덩어리 구름. 아래쪽만 옅은 바다색 선으로 부피를 준다.
  const plume = 'M45 92C41 88 44 83 39 80C33 77 37 71 31 68C24 65 28 58 21 55C14 52 18 45 12 42C7 40 9 33 5 31C2 34 2 39 4 42C1 47 6 51 6 55C5 61 11 64 13 68C14 74 21 76 23 80C26 85 33 86 36 90C38 93 42 94 45 92Z';
  return (
    <>
      <path className={P(3)} d={plume} fill="currentColor" />
      <path className={P(4)} d="M4 42C1 47 6 51 6 55C5 61 11 64 13 68C14 74 21 76 23 80C26 85 33 86 36 90C38 93 42 94 45 92" fill="none" stroke="currentColor" strokeWidth="0.9" />
      <g className={P(1)} fill="currentColor">
        <rect x="34" y="102" width="20" height="14" />
        <rect x="45" y="92" width="4" height="10" />
        <rect x="30" y="96" width="7" height="20" />
        <path d="M54 108L58 113V116H54Z" />
        <rect x="6" y="104" width="22" height="12" />
        <rect x="4" y="116" width="54" height="2" />
      </g>
      <rect className={P(2)} x="44" y="91" width="6" height="2.4" fill="currentColor" />
      <rect className={P(2)} x="6" y="108" width="22" height="2" fill="currentColor" />
      <g className={P(3)} fill="currentColor"><rect x="9" y="105.5" width="4" height="2" /><rect x="16" y="105.5" width="4" height="2" /><rect x="23" y="105.5" width="3" height="2" /></g>
      <g className={P(1)} fill="currentColor"><circle cx="12" cy="120" r="2.6" /><circle cx="24" cy="120" r="2.6" /><circle cx="40" cy="120" r="3.2" /><circle cx="50" cy="120" r="3.2" /></g>
      <path className={P(1)} d="M2 124H58" stroke="currentColor" strokeWidth="1.2" />
      <path className={P(4)} d="M0 168V138Q8 132 16 138T32 138 48 138 58 137V152Q66 148 76 152T92 152 108 152 120 150V168Z" fill="currentColor" />
      <path className={P(3)} d="M0 146Q8 140 16 146T32 146 48 146 58 145M58 160Q66 155 76 160T92 160 108 160 120 158" fill="none" stroke="currentColor" strokeWidth="1" />
    </>
  );
}

// 檸檬(1925) — 쇼와 초 모더니즘 책의 기하 평면: 쌓은 화집 위에 놓인 레몬 하나(작품의 그 장면). 레몬만 밝게.
function LemonBooks() {
  return (
    <>
      <path className={`${P(5)} lit-art__glow`} d="M2 4H22L44 98 26 102Z" fill="currentColor" />
      <g fill="currentColor">
        <rect className={P(6)} x="8" y="140" width="48" height="12" />
        <rect className={P(4)} x="12" y="129" width="42" height="11" transform="rotate(-3 33 134)" />
        <rect className={P(5)} x="9" y="119" width="44" height="10" />
        <rect className={P(3)} x="14" y="110" width="38" height="9" transform="rotate(2 33 114)" />
      </g>
      <g className={P(3)} fill="none" stroke="currentColor" strokeWidth="0.8"><path d="M8 146H56M9 124H53" /></g>
      <path className={P(3)} d="M20 110Q32 112 46 109" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <g transform="rotate(-12 33 101)">
        <path className={P(1)} d="M21 101C21 95.5 26.5 92 33 92S45 95.5 45 101 39.5 110 33 110 21 106.5 21 101ZM21.5 99.6L16.6 101 21.5 102.6ZM44.5 99.6L49.4 101 44.5 102.6Z" fill="currentColor" />
        <path className={P(2)} d="M23.5 104C26 108 30 109.4 34.5 109.2C39 109 42.5 106.5 44 102.6C41 106.8 37.4 108 33 108C29 108 25.8 106.6 23.5 104Z" fill="currentColor" />
        <path className={P(5)} d="M27 96.5Q31 94.5 36 95" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </>
  );
}

// よだかの星(1934) — 밤하늘 판화: 흩어진 별, 왼쪽 위에서 파랗게 타는 별 하나, 그리로 날아오르는 쏙독새, 아래 산줄기.
function NightjarStar() {
  const stars = scatter(16, 3, [6, 50, 58, 120]).concat(scatter(4, 4, [78, 134, 114, 144]));
  return (
    <>
      <g className={P(1)} fill="currentColor">{stars.map(([x, y], i) => <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 4 ? 0.7 : 1.2} />)}</g>
      <circle className={`${P(2)} lit-art__glow`} cx="24" cy="28" r="14" fill="currentColor" />
      <circle className={P(2)} cx="24" cy="28" r="7" fill="currentColor" />
      <path className={P(5)} d="M24 14V42M10 28H38M14 18L34 38M34 18L14 38" stroke="currentColor" strokeWidth="0.8" />
      <circle className={P(5)} cx="24" cy="28" r="3.4" fill="currentColor" />
      <path className={P(6)} d="M40 66C36 64 31 64 26 66C31 66.5 34 68 36 71C33 73 31 76 30.5 79L34 76 38 78.5C39 75 39 72 38.2 70C43 67 49 66 54 67C50 64 45 63.5 40 66Z" fill="currentColor" />
      <path className={P(4)} d="M0 168V140L12 130 24 138 38 126 52 136 58 132V168ZM58 168V152L70 146 84 150 98 140 112 148 120 144V168Z" fill="currentColor" />
      <path className={P(3)} d="M0 168V154Q16 148 30 154T58 152 86 156 120 152V168Z" fill="currentColor" />
    </>
  );
}

// 高瀬舟(1916) — 다이쇼 문예서의 차분한 2–3도: 으스름달, 늘어진 버들가지, 강물 위 납작한 배와 마주 앉은 두 사람.
function NightBoat() {
  return (
    <>
      <circle className={`${P(1)} lit-art__glow`} cx="42" cy="34" r="15" fill="currentColor" />
      <circle className={P(1)} cx="42" cy="34" r="9.5" fill="currentColor" />
      <g className={P(3)} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M4 0C8 20 6 44 10 70M10 0C14 18 13 40 17 62M16 0C19 14 19 30 22 46M2 10C4 30 2 52 5 82" />
      </g>
      <g className={P(3)} fill="currentColor">{[[9, 30], [8, 46], [14, 38], [16, 52], [20, 34], [4, 60]].map(([x, y]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1" ry="2.4" transform={`rotate(-12 ${x} ${y})`} />)}</g>
      <g className={P(4)} fill="none" stroke="currentColor" strokeWidth="0.9">
        <path d="M4 132H56M10 140H52M4 150H40M14 158H56M78 112H112M84 122H114M78 134H106M86 144H116M64 156H112M70 164H118" />
      </g>
      <g className={P(2)} fill="currentColor">
        <path d="M6 124H58L54 129H11Z" />
        <path d="M20 124V117C20 115 22 114 23.5 114S27 115 27 117V124Z" /><circle cx="23.5" cy="111.5" r="2.3" />
        <path d="M38 124V118C38 116 40 115 41.5 115S45 116 45 118V124Z" /><circle cx="41.5" cy="112.5" r="2.3" />
        <path d="M54 124L58 104" stroke="currentColor" strokeWidth="1" />
      </g>
      <circle className={P(5)} cx="31" cy="120" r="1.6" fill="currentColor" />
    </>
  );
}

// セロ弾きのゴーシュ(1934) — 따뜻한 밤의 목판 동화책: 비스듬히 선 첼로, 흩어지는 음표, 창가의 뻐꾸기. 제목이 두 줄이라 그림은 왼쪽 위에.
function CelloNight() {
  return (
    <>
      <g transform="rotate(-22 30 52)">
        <path className={P(1)} d="M30 34C24 34 20 38 21 44C21.5 47 23.5 48.5 23.5 50.5S20 54 20 60C20 68 25 74 30 74S40 68 40 60C40 54 36.5 52.5 36.5 50.5S38.5 47 39 44C40 38 36 34 30 34Z" fill="currentColor" />
        <path className={P(4)} d="M30 74C25 74 20 68 20 60C20 66 24 71 30 72S40 66 40 60C40 68 35 74 30 74Z" fill="currentColor" />
        <rect className={P(2)} x="28.6" y="8" width="2.8" height="44" fill="currentColor" />
        <path className={P(2)} d="M28 8C27 5 28 2 30 2S33 4 32 6.5L31.4 8Z" fill="currentColor" />
        <path className={P(2)} d="M25.5 47.5C24 50 24.5 53 26 55M34.5 47.5C36 50 35.5 53 34 55" fill="none" stroke="currentColor" strokeWidth="0.9" />
        <rect className={P(2)} x="25.5" y="58" width="9" height="1.4" fill="currentColor" />
        <path className={P(3)} d="M29 8V66M30.4 8V66" stroke="currentColor" strokeWidth="0.3" />
        <path className={P(2)} d="M30 74V80" stroke="currentColor" strokeWidth="1.2" />
      </g>
      <g className={P(3)} fill="currentColor" stroke="currentColor" strokeWidth="0.8">
        <circle cx="46" cy="22" r="1.6" stroke="none" /><path d="M47.5 22V15" fill="none" />
        <circle cx="52" cy="34" r="1.6" stroke="none" /><path d="M53.5 34V27L58 26V31" fill="none" /><circle cx="56.5" cy="31" r="1.6" stroke="none" />
        <circle cx="10" cy="20" r="1.3" stroke="none" /><path d="M11.2 20V14.5" fill="none" />
      </g>
      <g className={P(3)} fill="currentColor">
        <path d="M12 108C9 106 6.5 107 6 110C9 110 11 111 12 113C14 113.5 17 113 18 111C16.5 109 14.5 108.5 12 108Z" />
        <path d="M18 111L22 109.5 18.5 112.8Z" />
      </g>
      <path className={P(4)} d="M4 114H24" stroke="currentColor" strokeWidth="1.4" />
    </>
  );
}

// 銀河鉄道の夜(1934) — 쇼와 초 동화책의 밤하늘 판화: 왼쪽 반을 비스듬히 가로지르는 은하수, 그 위를 달려 오르는 작은 기차(불 켜진 창),
// 위쪽의 남십자. 제목이 오른쪽 세로줄을 다 쓰므로 그림은 왼쪽 반에만.
function NightTrain() {
  const stars = scatter(22, 9, [6, 6, 56, 160]);
  const cars = [[10, 0], [22, 0], [34, 0]];
  return (
    <>
      <path className={`${P(2)} lit-art__glow`} d="M4 168L4 126 58 30V74L22 168Z" fill="currentColor" />
      <path className={P(2)} d="M8 158L56 54M14 164L57 72" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2.5" />
      <g className={P(1)} fill="currentColor">{stars.map(([x, y], i) => <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 5 ? 0.7 : 1.3} />)}</g>
      <g className={P(1)} fill="currentColor">
        <path d="M30 10L31 14.6 35.6 15.6 31 16.6 30 21.2 29 16.6 24.4 15.6 29 14.6Z" />
        <circle cx="30" cy="27" r="1.2" /><circle cx="22" cy="18" r="1" /><circle cx="38" cy="18" r="1" />
      </g>
      <g transform="rotate(-56 30 104)">
        <path className={P(5)} d="M-2 112H64" stroke="currentColor" strokeWidth="0.8" />
        <g className={P(3)} fill="currentColor">
          <path d="M46 102H58L60 105V111H46Z" />
          <rect x="49" y="98" width="3" height="4" />
          {cars.map(([x]) => <rect key={x} x={x - 8} y="103" width="10.6" height="8" rx="1" />)}
        </g>
        <g className={P(4)} fill="currentColor">
          {cars.flatMap(([x]) => [<rect key={`${x}a`} x={x - 6.4} y="105" width="2.6" height="2.4" />, <rect key={`${x}b`} x={x - 2.4} y="105" width="2.6" height="2.4" />])}
          <circle cx="59" cy="107" r="1" />
        </g>
      </g>
    </>
  );
}

// 옛 종이 — 다섯 권 공통 층(오너 「빈티지 효과 · 옛 종이 질감」). 그림 위·글자 아래에 깔린다(글자는 z-index:1).
// 「새 책처럼」(오너 2026-10-14 KST — 어두컴컴한 효과 없애기): 바랜 얼룩·가장자리 그을음은 두지 않고, 갓 찍은 옛 종이의
// 옅은 결(고주파 잡음 점)과 고르지 않은 밝은 결만 남긴다. 그림 자체에는 활판 느낌(아주 작은 번짐 + 옅은 농도 차)만 준다. 전부 코드로 만든 절차 질감이다(이미지·외부 주소 없음).
// 숫자 행렬은 잡음→투명도 변환일 뿐 색이 아니다 — 색은 CSS(flood-color·color)가 정한다.
function PaperFilters({ id }) {
  return (
    <defs>
      <filter id={`${id}-print`} x="0" y="0" width="120" height="168" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="2" result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale="0.6" xChannelSelector="R" yChannelSelector="G" result="moved" />
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="5" result="blot" />
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.3 0 0 0 0.82" result="inkMask" />
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
        <feColorMatrix in="low" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 0 0 0 1.05" result="fadeA" />
        <feFlood className="lit-paper__fade" result="fadeC" />
        <feComposite in="fadeC" in2="fadeA" operator="in" result="fade" />
        <feMerge><feMergeNode in="fade" /><feMergeNode in="grain" /><feMergeNode in="fleck" /></feMerge>
      </filter>
    </defs>
  );
}

function PaperGrain({ id }) {
  return (
    <g className="lit-paper">
      <rect width="120" height="168" filter={`url(#${id}-paper)`} />
    </g>
  );
}

const ART = {
  'snow-night': SnowNight, higanbana: Higanbana, 'forest-doors': ForestDoors, 'ink-steam': InkSteam, birdcage: Birdcage,
  'rain-gate': RainGate, 'lotus-thread': LotusThread, 'moon-tiger': MoonTiger, 'steam-sea': SteamSea,
  'lemon-books': LemonBooks, 'nightjar-star': NightjarStar, 'night-boat': NightBoat, 'cello-night': CelloNight,
  'night-train': NightTrain,
};

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
