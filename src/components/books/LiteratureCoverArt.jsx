import { LITERATURE_COVER_MOTIFS } from '../../lib/literatureDisplay';
import './literature-cover-art.css';

// 정본 문학책 표지 그림(모티프) — 같은 틀(책등·제목·아래 선) 뒤에 작품 분위기만 깐다.
// 원서 표지·삽화·알려진 캐릭터를 옮기지 않은 자작 도형이다(IP 정책 금지⑴). 雪輪 등 전통 문양만 빌린다.
// 좌표계 120×168(표지 60×84의 두 배) — 오른쪽 위는 세로 제목 자리라 비워 두고, 주제는 아래·왼쪽에 둔다.
// 색은 CSS가 정한다(currentColor + 역할 클래스): hi/mid/lo/faint = 흰 글자색(--sheet) 농도, deep = 짙은 톤,
// accent = 모티프마다 하나뿐인 강조색.
// 모티프 키 목록의 정본은 literatureDisplay(빌드가 entry.json display.motif를 검사한다) — 여기서는 다시 내보내기만.
export { LITERATURE_COVER_MOTIFS };

const r1 = (n) => Math.round(n * 10) / 10;
const at = (cx, cy, r, deg) => `${r1(cx + r * Math.cos((deg * Math.PI) / 180))} ${r1(cy + r * Math.sin((deg * Math.PI) / 180))}`;

// 雪輪 — 원 둘레를 여섯 번 오목하게 끊은 눈 결정 테두리(전통 문양).
function yukiwa(cx, cy, r) {
  const p = [0, 1, 2, 3, 4, 5].map((k) => at(cx, cy, r, k * 60 - 90));
  return `M${p[0]}${p.map((_, k) => `A${r1(r * 0.6)} ${r1(r * 0.6)} 0 0 1 ${p[(k + 1) % 6]}`).join('')}Z`;
}

// 彼岸花 — 뒤로 말린 꽃잎 고리와 위로 뻗어 휘는 긴 수술. s = 크기 배율.
function lily(cx, cy, s) {
  const petals = [-150, -110, -70, -30, 10, 50, 130, 170].map((a) => `M${cx} ${cy}Q${at(cx, cy, 5 * s, a)} ${at(cx, cy, 6 * s, a + 55)}`);
  const stamens = [-172, -148, -122, -98, -78, -54, -30, -8].map((a) => {
    const end = at(cx, cy - 4 * s, 12 * s, a);
    return { d: `M${cx} ${cy}Q${at(cx, cy - 1 * s, 8 * s, a + (a < -90 ? 18 : -18))} ${end}`, tip: end.split(' ').map(Number) };
  });
  return { petals: petals.join(''), stamens };
}

function Lily({ x, y, s, stem }) {
  const { petals, stamens } = lily(x, y, s);
  return (
    <g>
      <path className="lit-art__deep" d={stem} fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g className="lit-art__accent" stroke="currentColor" fill="none" strokeLinecap="round">
        <path d={petals} strokeWidth={r1(1.5 * s)} />
        <path d={stamens.map((t) => t.d).join('')} strokeWidth="1.2" />
      </g>
      <g className="lit-art__accent" fill="currentColor">
        {stamens.map((t) => <circle key={t.tip.join()} cx={t.tip[0]} cy={t.tip[1]} r="1.3" />)}
      </g>
    </g>
  );
}

const SNOW = [[14, 14], [30, 8], [56, 6], [44, 22], [12, 56], [34, 50], [24, 76], [48, 72], [10, 118], [22, 108], [114, 160]];

// 배치 규칙(오너 2026-10-14 「글자가 그림과 겹치지 않게」): 세로 제목(오른쪽 위)·작가(그 왼쪽 아래) 칸 안에는
// 옅은 바탕결(faint, 투명도 .1)만 지나가고, 주제 도형은 그 칸 밖 — 왼쪽 띠·짧은 제목 아래 빈자리 — 에 둔다.
function SnowNight() {
  return (
    <>
      <path className="lit-art__faint" d={`${yukiwa(20, 34, 10)}${yukiwa(40, 92, 6)}`} fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g className="lit-art__mid" fill="currentColor">
        {SNOW.map(([x, y], i) => <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} />)}
      </g>
      <path className="lit-art__faint" d="M0 142C30 128 70 122 120 126V168H0Z" fill="currentColor" />
      <circle className="lit-art__glow" cx="44" cy="128" r="10" fill="currentColor" />
      <g className="lit-art__accent" fill="currentColor">
        <rect x="36" y="126" width="3" height="4" />
        <rect x="42" y="124" width="3" height="5" />
        <rect x="48" y="127" width="3" height="3" />
      </g>
      <path className="lit-art__lo" d="M0 138C20 132 42 140 56 158C78 162 100 160 120 158V168H0Z" fill="currentColor" />
    </>
  );
}

function Higanbana() {
  return (
    <>
      <circle className="lit-art__faint" cx="26" cy="34" r="13" fill="currentColor" />
      <path className="lit-art__deep" d="M0 156C40 152 80 160 120 156V168H0Z" fill="currentColor" />
      <Lily x={24} y={98} s={1.5} stem="M24 98C26 124 22 146 24 168" />
      <Lily x={42} y={130} s={0.9} stem="M42 130C41 144 43 156 42 168" />
      <Lily x={94} y={116} s={1.25} stem="M94 116C96 134 92 152 94 168" />
      <path className="lit-art__deep" d="M11 142C12 152 10 160 11 168" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <ellipse className="lit-art__accent" cx="11" cy="140" rx="2.4" ry="3.6" fill="currentColor" />
    </>
  );
}

// 숲길 끝, 위쪽 빈자리에 문 안의 문 — 가장 안쪽 어둠과 왼쪽 숲 그늘에 산고양이 눈.
function ForestDoors() {
  const doors = [[34, 16, 32, 60], [38.5, 28.5, 23, 46], [42, 38.5, 16, 35], [44.5, 46.5, 11, 26]];
  const arch = ([x, y, w, h]) => `M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}`;
  return (
    <>
      <path className="lit-art__faint" d="M36 76H64L96 168H8Z" fill="currentColor" />
      <path className="lit-art__deep" d="M5 168V58L13 24 21 58V168ZM17 168V96L24 66 29 90V168ZM84 168V156L97 136 110 156V168Z" fill="currentColor" />
      {doors.map((d, i) => (
        <path key={d[0]} className={i < 2 ? 'lit-art__mid' : 'lit-art__lo'} d={arch(d)} fill="none" stroke="currentColor" strokeWidth={i === 0 ? 2.2 : 1.6} />
      ))}
      <path className="lit-art__deep" d={`${arch(doors[3])}Z`} fill="currentColor" />
      <g className="lit-art__accent" fill="currentColor">
        <ellipse cx="47.6" cy="60" rx="1.6" ry="1.1" />
        <ellipse cx="52.4" cy="60" rx="1.6" ry="1.1" />
        <ellipse cx="11" cy="122" rx="1.3" ry="0.9" />
        <ellipse cx="15" cy="122" rx="1.3" ry="0.9" />
      </g>
    </>
  );
}

function InkSteam() {
  return (
    <>
      <circle className="lit-art__faint" cx="34" cy="98" r="28" fill="currentColor" />
      <circle className="lit-art__faint" cx="98" cy="96" r="16" fill="currentColor" />
      <g className="lit-art__mid" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 118C16 104 28 98 22 88S18 74 24 66" />
        <path d="M33 116C27 100 39 94 33 82S27 62 35 54C41 48 45 54 41 58" />
        <path d="M44 118C40 108 48 102 44 92" />
      </g>
      <path className="lit-art__lo" d="M14 122H52C50 136 42 142 33 142S16 136 14 122Z" fill="currentColor" />
      <path className="lit-art__mid" d="M11 122H55" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect className="lit-art__accent" x="96" y="138" width="8" height="10" rx="1" fill="currentColor" />
    </>
  );
}

// 粟の穂 — 문조의 모이. 짧은 제목 아래 빈자리에 고개 숙인 이삭 하나.
const MILLET = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [r1(92 - 1.3 * k + (k % 2 ? 2 : -2)), r1(94 + 2.8 * k)]);

function Birdcage() {
  const bars = [16, 22, 28, 34, 40, 46].map((x) => `M${x} 142V102Q${x} 86 31 82`).join('');
  return (
    <>
      <path className="lit-art__lo" d="M31 0V76" stroke="currentColor" strokeWidth="1.4" />
      <circle className="lit-art__lo" cx="31" cy="79" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path className="lit-art__lo" d={`M10 142V102Q10 82 31 82Q52 82 52 102V142${bars}M12 130H50`} fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect className="lit-art__mid" x="7" y="141" width="48" height="5" rx="1" fill="currentColor" />
      <g className="lit-art__hi" fill="currentColor">
        <path d="M20 131L26 124C28 120 34 118 38 120L42 124C40 129 32 131 26 130Z" />
        <circle cx="39" cy="118" r="4" />
      </g>
      <path className="lit-art__accent" d="M42 116.5L46 118L42 120Z" fill="currentColor" />
      <circle className="lit-art__deep" cx="39.5" cy="117.6" r="0.9" fill="currentColor" />
      <path className="lit-art__lo" d="M104 164C104 132 102 104 93 90" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <g className="lit-art__mid" fill="currentColor">
        {MILLET.map(([x, y]) => <ellipse key={y} cx={x} cy={y} rx="1.8" ry="1.4" />)}
        {[[18, 138.5], [24, 139.5], [36, 139], [44, 138.5], [84, 160], [92, 158]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.1" />)}
      </g>
    </>
  );
}

const ART = { 'snow-night': SnowNight, higanbana: Higanbana, 'forest-doors': ForestDoors, 'ink-steam': InkSteam, birdcage: Birdcage };

export default function LiteratureCoverArt({ motif }) {
  const Art = ART[motif];
  if (!Art) return null;
  return (
    <svg className={`lit-art lit-art--${motif}`} viewBox="0 0 120 168" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <Art />
    </svg>
  );
}
