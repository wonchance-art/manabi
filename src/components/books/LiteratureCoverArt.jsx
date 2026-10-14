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

const SNOW = [[14, 14], [30, 8], [62, 6], [12, 56], [24, 76], [10, 118], [22, 132], [56, 124], [76, 120], [114, 112], [112, 18]];

function SnowNight() {
  return (
    <>
      <path className="lit-art__faint" d={`${yukiwa(19, 36, 10)}${yukiwa(16, 98, 6)}`} fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g className="lit-art__mid" fill="currentColor">
        {SNOW.map(([x, y], i) => <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} />)}
      </g>
      <path className="lit-art__faint" d="M0 142C30 128 70 122 120 126V168H0Z" fill="currentColor" />
      <circle className="lit-art__glow" cx="97" cy="121" r="10" fill="currentColor" />
      <g className="lit-art__accent" fill="currentColor">
        <rect x="89" y="119" width="3" height="4" />
        <rect x="95" y="117" width="3" height="5" />
        <rect x="101" y="120" width="3" height="3" />
      </g>
      <path className="lit-art__lo" d="M0 162C40 160 76 142 120 134V168H0Z" fill="currentColor" />
    </>
  );
}

function Higanbana() {
  return (
    <>
      <circle className="lit-art__faint" cx="26" cy="34" r="13" fill="currentColor" />
      <path className="lit-art__deep" d="M0 150C30 140 70 146 120 138V168H0Z" fill="currentColor" />
      <Lily x={24} y={100} s={1.5} stem="M24 100C26 124 22 144 24 168" />
      <Lily x={47} y={124} s={1.15} stem="M47 124C46 140 49 154 48 168" />
      <path className="lit-art__deep" d="M13 140C14 150 12 160 13 168" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <ellipse className="lit-art__accent" cx="13" cy="138" rx="2.4" ry="3.6" fill="currentColor" />
    </>
  );
}

function ForestDoors() {
  const doors = [[6, 82, 48, 82], [13, 96, 34, 62], [19, 107, 22, 46], [24, 115, 12, 33]];
  const arch = ([x, y, w, h]) => `M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}`;
  return (
    <>
      <path className="lit-art__deep" d="M4 168V60L12 30 20 60V168ZM40 168V70L50 20 60 70V168ZM88 168V140L100 108 112 140V168Z" fill="currentColor" />
      {doors.map((d, i) => (
        <path key={d[0]} className={i < 2 ? 'lit-art__mid' : 'lit-art__lo'} d={arch(d)} fill="none" stroke="currentColor" strokeWidth={i === 0 ? 2.2 : 1.6} />
      ))}
      <path className="lit-art__deep" d={`${arch(doors[3])}Z`} fill="currentColor" />
      <g className="lit-art__accent" fill="currentColor">
        <ellipse cx="27.5" cy="132" rx="1.7" ry="1.2" />
        <ellipse cx="32.5" cy="132" rx="1.7" ry="1.2" />
      </g>
    </>
  );
}

function InkSteam() {
  return (
    <>
      <circle className="lit-art__faint" cx="44" cy="106" r="32" fill="currentColor" />
      <g className="lit-art__mid" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M32 118C26 106 38 100 32 92S28 80 34 74" />
        <path d="M44 116C38 104 50 98 44 88S38 74 46 68C52 63 55 70 51 73" />
        <path d="M56 118C52 110 60 104 56 96" />
      </g>
      <path className="lit-art__lo" d="M18 122H70C68 136 56 142 44 142S20 136 18 122Z" fill="currentColor" />
      <path className="lit-art__mid" d="M14 122H74" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect className="lit-art__accent" x="98" y="140" width="8" height="10" rx="1" fill="currentColor" />
    </>
  );
}

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
      <g className="lit-art__mid" fill="currentColor">
        {[[18, 138.5], [24, 139.5], [36, 139], [44, 138.5], [72, 160], [80, 157], [88, 161]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.1" />)}
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
