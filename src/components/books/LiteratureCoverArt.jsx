import { useId } from 'react';
import { LITERATURE_COVER_MOTIFS } from '../../lib/literatureDisplay';
import './literature-cover-art.css';

// 정본 문학책 표지 그림 — 시리즈 A 「布装·型押し + 題簽」(오너 선택 2026-10-15 KST, 「A가 전반적으로 낫네」).
// 明治 말~昭和 초 문예서의 천 장정(クロス装)처럼, 표지는 작품 색의 천이고 그 위에 같은 색 계열 두 단(짙은 --dk · 옅은 --lt)으로
// 문양·장면을 찍는다(型押し·色版). 밝은 점은 강조색 하나(많아야 둘 — --acc·--acc2)뿐이다. 제목·작가는 그림 위가 아니라
// 따로 붙인 題簽(LiteratureCover) 위에 있어서 그림이 판면 전체를 쓴다. 원본 장정·삽화를 옮기거나 본뜨지 않는다(IP 정책 §2.1) —
// 시대 관례(布装·題簽·전통 문양)만 빌리고 장면은 작품 속에서 새로 고른다. 사람 몸은 그리지 않는다.
// 좌표계 120×168(표지 60×84의 두 배). 색은 CSS만 정한다: lit-art__dk·__dd·__lt·__acc·__acc2·__paper(literature-cover-art.css).
// 모티프 키 목록의 정본은 literatureDisplay(빌드가 entry.json display.motif를 검사한다) — 여기서는 다시 내보내기만.
export { LITERATURE_COVER_MOTIFS };

const C = (name) => `lit-art__${name}`;
const f1 = (v) => Math.round(v * 10) / 10;
// 결정적 의사난수 — 문양 위치가 렌더마다 같도록.
const scatter = (n, seed, [x0, y0, x1, y1]) => Array.from({ length: n }, (_, i) => {
  const r = (k) => { const v = Math.sin(seed * 97.1 + i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  return [f1(x0 + r(1) * (x1 - x0)), f1(y0 + r(2) * (y1 - y0)), r(3)];
});

// ── 전통 문양 부품 ──────────────────────────────────────────────
// 青海波 — 겹친 반원 세 겹을 엇갈려 쌓는다
const seigaiha = (x0, y0, x1, y1, r) => {
  const d = [];
  for (let row = 0, y = y0; y < y1 + r; row += 1, y += r * 0.5) {
    for (let x = x0 + (row % 2 ? r : 0); x < x1 + r * 2; x += r * 2) {
      for (const k of [1, 0.68, 0.36]) d.push(`M${f1(x - r * k)} ${f1(y)}A${f1(r * k)} ${f1(r * k)} 0 0 1 ${f1(x + r * k)} ${f1(y)}`);
    }
  }
  return d.join('');
};
// 桜 다섯 잎(끝이 갈라진 잎)
const sakura = (cx, cy, r, rot = 0) => {
  let d = '';
  for (let i = 0; i < 5; i += 1) {
    const a = ((rot + i * 72) * Math.PI) / 180;
    const p = (ang, rad) => `${f1(cx + Math.cos(ang) * rad)} ${f1(cy + Math.sin(ang) * rad)}`;
    d += `M${f1(cx)} ${f1(cy)}Q${p(a - 0.42, r * 1.05)} ${p(a - 0.12, r)}L${p(a, r * 0.82)}L${p(a + 0.12, r)}Q${p(a + 0.42, r * 1.05)} ${f1(cx)} ${f1(cy)}Z`;
  }
  return d;
};
const petal = (x, y, s, rot) => `M${f1(x)} ${f1(y - 2 * s)}C${f1(x + 1.4 * s)} ${f1(y - 1.2 * s)} ${f1(x + 1.4 * s)} ${f1(y + s)} ${f1(x)} ${f1(y + 2 * s)}C${f1(x - 1.4 * s)} ${f1(y + s)} ${f1(x - 1.4 * s)} ${f1(y - 1.2 * s)} ${f1(x)} ${f1(y - 2 * s)}Z`;
const petals = (seed, n, box, size = 1) => scatter(n, seed, box).map(([x, y, k]) => {
  const a = k * Math.PI; const s = size * (0.7 + k * 0.6);
  const rot = (px, py) => `${f1(x + (px - x) * Math.cos(a) - (py - y) * Math.sin(a))} ${f1(y + (px - x) * Math.sin(a) + (py - y) * Math.cos(a))}`;
  return `M${rot(x, y - 2 * s)}Q${rot(x + 1.8 * s, y)} ${rot(x, y + 2 * s)}Q${rot(x - 1.8 * s, y)} ${rot(x, y - 2 * s)}Z`;
}).join('');
// 雪輪 — 여섯 오목한 호로 된 눈 바퀴
const yukiwa = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 6; i += 1) {
    const a0 = (i * 60 * Math.PI) / 180; const a1 = ((i + 1) * 60 * Math.PI) / 180;
    const p0 = `${f1(cx + Math.cos(a0) * r)} ${f1(cy + Math.sin(a0) * r)}`; const p1 = `${f1(cx + Math.cos(a1) * r)} ${f1(cy + Math.sin(a1) * r)}`;
    d += `${i ? 'L' : 'M'}${p0}A${f1(r * 0.55)} ${f1(r * 0.55)} 0 0 1 ${p1}`;
  }
  return `${d}Z`;
};
// 瑞雲·雲文 — 둥근 머리 셋과 말린 꼬리
const cloud = (x, y, s) => `M${f1(x)} ${f1(y)}c${f1(-1 * s)} ${f1(-4 * s)} ${f1(5 * s)} ${f1(-6 * s)} ${f1(6 * s)} ${f1(-2 * s)}c${f1(1 * s)} ${f1(-4 * s)} ${f1(7 * s)} ${f1(-4 * s)} ${f1(7 * s)} 0c${f1(3 * s)} ${f1(-2 * s)} ${f1(7 * s)} 0 ${f1(6 * s)} ${f1(3 * s)}c${f1(3 * s)} 0 ${f1(4 * s)} ${f1(3 * s)} ${f1(1 * s)} ${f1(4 * s)}H${f1(x - 3 * s)}c${f1(-3 * s)} 0 ${f1(-4 * s)} ${f1(-4 * s)} ${f1(3 * s)} ${f1(-4 * s)}Z`;
// 渦 — 바람·물의 소용돌이 한 줄
const swirl = (x, y, r) => `M${f1(x - r * 3)} ${f1(y + r * 0.4)}C${f1(x - r * 1.5)} ${f1(y - r * 0.6)} ${f1(x + r * 0.2)} ${f1(y - r * 1.2)} ${f1(x + r)} ${f1(y - r * 0.2)}S${f1(x + r * 0.4)} ${f1(y + r)} ${f1(x - r * 0.2)} ${f1(y + r * 0.2)}S${f1(x + r * 0.2)} ${f1(y - r * 0.5)} ${f1(x + r * 0.4)} ${f1(y - r * 0.1)}`;
// 千鳥(물떼새)
const plover = (x, y, s) => `M${f1(x - 2.8 * s)} ${f1(y)}a${f1(2.8 * s)} ${f1(2.1 * s)} 0 1 0 ${f1(5.6 * s)} 0a${f1(2.8 * s)} ${f1(2.1 * s)} 0 1 0 ${f1(-5.6 * s)} 0ZM${f1(x + 2.5 * s)} ${f1(y - 0.7 * s)}l${f1(2.3 * s)} ${f1(0.5 * s)} ${f1(-2.3 * s)} ${f1(0.7 * s)}ZM${f1(x - 0.4 * s)} ${f1(y - 1.3 * s)}q${f1(-2.2 * s)} ${f1(-3.7 * s)} ${f1(-5.2 * s)} ${f1(-3.3 * s)}q${f1(2 * s)} ${f1(1.8 * s)} ${f1(3.2 * s)} ${f1(4.6 * s)}ZM${f1(x - 2.4 * s)} ${f1(y + 0.6 * s)}l${f1(-2.6 * s)} ${f1(1.2 * s)} ${f1(3 * s)} ${f1(-0.2 * s)}Z`;
// 四方 별(十字 빛)
const star4 = (x, y, r) => `M${x} ${f1(y - r)}L${f1(x + r * 0.22)} ${f1(y - r * 0.22)} ${f1(x + r)} ${y} ${f1(x + r * 0.22)} ${f1(y + r * 0.22)} ${x} ${f1(y + r)} ${f1(x - r * 0.22)} ${f1(y + r * 0.22)} ${f1(x - r)} ${y} ${f1(x - r * 0.22)} ${f1(y - r * 0.22)}Z`;
const dots = (seed, n, box, r0, r1) => scatter(n, seed, box).map(([x, y, k]) => { const r = f1(r0 + k * (r1 - r0)); return `M${f1(x - r)} ${y}a${r} ${r} 0 1 0 ${f1(r * 2)} 0a${r} ${r} 0 1 0 ${f1(-r * 2)} 0Z`; }).join('');
const rain = (seed, n) => scatter(n, seed, [-10, -10, 124, 168]).map(([x, y, k]) => `M${x} ${y}l${f1(-3 - k * 2)} ${f1(14 + k * 10)}`).join('');
// focal — 그 표지의 주제(題簽에 가리면 안 되는 것). 배경 문양은 題簽 밑으로 지나가도 된다(무늬 천 위에 題簽을 붙이는 실제 장정과 같다).
const Fill = ({ c, d, focal }) => <path className={C(c)} d={d} fill="currentColor" data-focal={focal ? '' : undefined} />;
const Line = ({ c, d, w = 0.6, cap, focal }) => <path className={C(c)} d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap={cap ? 'round' : undefined} strokeLinejoin={cap ? 'round' : undefined} data-focal={focal ? '' : undefined} />;

// ── 작품별 그림(초출 연대 순 아님 — ART 표 순서) ─────────────────────────

// 手袋を買いに(1943) — 雪輪 흩뿌림 위로 어린 여우 발자국이 마을 쪽으로, 작은 털장갑 하나(朱).
function SnowNight() {
  const rings = scatter(14, 1, [2, 4, 116, 164]);
  const prints = Array.from({ length: 9 }, (_, i) => [f1(14 + i * 6.2 + (i % 2) * 2.4), f1(156 - i * 9.5)]);
  return (
    <>
      <Fill c="lt" d={rings.map(([x, y, k]) => yukiwa(x, y, 4 + k * 7)).join('')} />
      <Fill c="dk" d={rings.filter((_, i) => i % 3 === 0).map(([x, y, k]) => yukiwa(x, y, 1.6 + k * 2.8)).join('')} />
      <Fill c="dk" d={prints.map(([x, y]) => `M${x} ${y}a1.4 1.7 0 1 0 2.8 0a1.4 1.7 0 1 0 -2.8 0ZM${f1(x - 1)} ${f1(y - 2.6)}a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0ZM${f1(x + 1.4)} ${f1(y - 3.1)}a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0ZM${f1(x + 3.4)} ${f1(y - 2.4)}a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0Z`).join('')} />
      <Fill c="acc" d="M14 132V122C14 116 24 116 24 122V132ZM14 127C10 127 9 120 11.6 119.4S14 123 14 124.2Z" focal />
      <Line c="paper" d="M14 129.4H24" w={1.1} />
    </>
  );
}

// ごん狐(1932) — 彼岸花(꽃잎이 뒤로 말린 꽃) 무리가 들을 덮고, 곤이 두고 간 밤 셋.
function Higanbana() {
  const flowers = [[22, 104, 1.2], [44, 120, 1], [14, 136, 0.9], [34, 148, 1.1], [58, 142, 0.8], [8, 112, 0.7], [52, 98, 0.75]];
  const bloom = ([x, y, s]) => Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2; const ex = x + Math.cos(a) * 7 * s; const ey = y + Math.sin(a) * 5 * s;
    return `M${x} ${y}Q${f1(x + Math.cos(a) * 4 * s)} ${f1(y + Math.sin(a) * 2 * s - 3 * s)} ${f1(ex)} ${f1(ey)}q${f1(Math.cos(a + 1.4) * 2 * s)} ${f1(Math.sin(a + 1.4) * 2 * s)} ${f1(Math.cos(a + 2.6) * 1.6 * s)} ${f1(Math.sin(a + 2.6) * 1.6 * s)}`;
  }).join('');
  return (
    <>
      <Line c="dk" d={flowers.map(([x, y, s]) => `M${x} ${y}V168`).join('')} w={0.9} />
      <Line c="dk" d={flowers.map(bloom).join('')} w={0.9} cap />
      <Line c="lt" d={flowers.map(([x, y, s]) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return `M${x} ${y}l${f1(Math.cos(a) * 9 * s)} ${f1(Math.sin(a) * 7 * s - 4 * s)}`; }).join('')).join('')} w={0.35} />
      <Fill c="lt" d={dots(2, 40, [2, 70, 118, 166], 0.4, 0.9)} />
      <Fill focal c="acc" d={[[20, 72], [32, 66], [27, 82]].map(([x, y]) => `M${x} ${y - 6}C${x + 2} ${y - 4} ${x + 6} ${y - 1} ${x + 5} ${y + 2}C${x + 4} ${y + 5} ${x - 4} ${y + 5} ${x - 5} ${y + 2}C${x - 6} ${y - 1} ${x - 2} ${y - 4} ${x} ${y - 6}Z`).join('')} />
      <Fill c="dd" d={[[20, 72], [32, 66], [27, 82]].map(([x, y]) => `M${x - 4.6} ${y + 1.6}C${x - 2} ${y + 4.6} ${x + 2} ${y + 4.6} ${x + 4.6} ${y + 1.6}C${x + 3} ${y + 5.6} ${x - 3} ${y + 5.6} ${x - 4.6} ${y + 1.6}Z`).join('')} />
    </>
  );
}

// 注文の多い料理店(1924) — 짙은 숲(줄기·바늘잎 나무 두 단) 한가운데 선 서양식 문, 금빛 손잡이.
function ForestDoors() {
  const firs = [[8, 40, 1.4], [26, 60, 1], [56, 36, 1.2], [70, 80, 0.8], [6, 96, 1.1], [92, 120, 1], [112, 150, 0.9]];
  const fir = ([x, y, s]) => `M${x} ${f1(y - 22 * s)}L${f1(x + 9 * s)} ${f1(y + 2 * s)}H${f1(x + 2 * s)}V${f1(y + 12 * s)}H${f1(x - 2 * s)}V${f1(y + 2 * s)}H${f1(x - 9 * s)}Z`;
  return (
    <>
      <Fill c="lt" d={firs.map(fir).join('')} />
      <Fill c="dk" d={[[18, 120, 1.3], [48, 150, 1.1], [100, 168, 1.2], [76, 168, 0.9]].map(fir).join('')} />
      <Line c="dk" d="M4 0V168M36 0V168M64 20V168" w={2.2} />
      <g transform="translate(-16 0)">
      <Fill c="dd" d="M28 140V92C28 82 52 82 52 92V140Z" focal />
      <Line c="acc" d="M28 140V92C28 82 52 82 52 92V140M40 84.6V140M31 96H37V112H31ZM43 96H49V112H43ZM31 118H37V134H31ZM43 118H49V134H43Z" w={0.7} />
      <Fill c="acc" d="M36.4 124a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM41 124a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z" />
      <Line c="acc" d="M26 140H54" w={1.2} />
      </g>
    </>
  );
}

// 鼻(1916) — 다이쇼 문예서의 雲文: 끓는 물에서 피어오르는 김을 말린 구름 문양으로, 한쪽 구석에 朱 落款 하나.
function InkSteam() {
  const clouds = [[8, 40, 1.2], [36, 64, 1], [4, 96, 1.4], [44, 112, 1.1], [16, 140, 1], [70, 150, 1.2], [60, 24, 0.8], [90, 132, 0.9]];
  return (
    <>
      <Fill c="lt" d={clouds.map(([x, y, s]) => cloud(x, y, s)).join('')} />
      <Line c="dk" d={clouds.map(([x, y, s]) => swirl(x + 6 * s, y - 2 * s, 2.2 * s)).join('')} w={0.6} />
      <Line c="lt" d="M18 168C14 150 26 140 20 124S28 100 22 86M30 168C27 154 36 146 32 132" w={0.9} cap />
      <Fill c="acc" d="M10 150H22V162H10Z" focal />
      <Line c="paper" d="M12.4 152.4H19.6V159.6H12.4ZM16 152.4V159.6M12.4 156H19.6" w={0.6} />
    </>
  );
}

// 文鳥(1908) — 生成り 천에 鳥籠과 조(粟) 이삭을 갈색 두 단으로, 흰 문조 한 마리의 부리만 朱.
function Birdcage() {
  const ears = [[12, 120, -20], [24, 128, -8], [8, 148, -30], [60, 150, 10], [98, 160, 16]];
  return (
    <>
      <Fill c="lt" d={dots(4, 60, [2, 110, 118, 166], 0.5, 1.1)} />
      <Line c="dk" d={ears.map(([x, y, r]) => `M${x} 168Q${f1(x + 2)} ${f1(y + 20)} ${x} ${y}`).join('')} w={0.8} />
      <Fill c="dk" d={ears.map(([x, y, r]) => Array.from({ length: 6 }, (_, i) => { const yy = y + i * 3; const xx = x + Math.sin((r * Math.PI) / 180) * i * 1.2; return `M${f1(xx - 1.4)} ${f1(yy)}a1.4 1.8 0 1 0 2.8 0a1.4 1.8 0 1 0 -2.8 0Z`; }).join('')).join('')} />
      <Line c="dk" d="M32 26V34M14 64C14 44 50 44 50 64M14 64V112M50 64V112M14 112H50M14 64H50M20 58V112M26 54V112M32 52V112M38 54V112M44 58V112M14 88H50" w={0.7} />
      <Fill c="dk" d="M10 112H54V117H10Z" focal />
      <Fill c="paper" d="M24 98c0 -6 6 -9 10 -7c2 -3 6 -3 7 0c-1 1 -3 1 -4 2c1 4 -2 8 -7 8h-6Z" focal />
      <Fill c="acc" d="M38 91.6l3.6 1.2 -3.6 1.4Z" />
      <Line c="dk" d="M24 98c0 -6 6 -9 10 -7c2 -3 6 -3 7 0M22 101H40" w={0.5} />
    </>
  );
}

// 羅生門(1915) — 煤竹 천에 楼門(2층 누문 · 곡선 처마) 실루엣을 짙게, 빗줄을 옅게, 錆朱 저녁 띠 하나와 까마귀.
function RainGate() {
  const pillars = [5, 17, 28.5, 40, 51].map((x) => `M${x} 91h4v56h-4Z`).join('');
  return (
    <>
      <Fill c="acc" d="M0 44H120V47H0Z" />
      <Fill focal c="dd" d={`M30 34l3 2h-6ZM-4 52C10 50 20 44 30 38C40 44 50 50 64 52L60 55C46 53 38 49 30 44C22 49 14 53 0 55ZM3 55H57V70H3ZM-1 70H61V72.4H-1ZM-8 82C8 80 18 76 30 72C42 76 52 80 66 82L62 85.6C50 84 40 81 30 78C20 81 10 84 -4 85.6ZM2 85.6H58V91H2Z${pillars}M2 100h56v2.6h-56ZM-4 147H64V151H-4ZM-8 151H68V155H-8ZM-12 155H72V168H-12Z`} />
      <Line c="dk" d="M6 58V67M10 58V67M14 58V67M18 58V67M42 58V67M46 58V67M50 58V67M54 58V67M24 58H36V67H24ZM4 88H56" w={0.45} />
      <Line c="lt" d={rain(5, 80)} w={0.55} />
      <Fill c="dd" d="M66 26q3 -3 6 -1q3 -2 6 1q-3 -1 -6 1q-3 -2 -6 -1zM52 18q2.4 -2.4 4.8 -0.8q2.4 -1.6 4.8 0.8q-2.4 -0.8 -4.8 0.8q-2.4 -1.6 -4.8 -0.8zM74 36q2 -2 4 -0.6q2 -1.4 4 0.6q-2 -0.6 -4 0.6q-2 -1.4 -4 -0.6z" />
    </>
  );
}

// 蜘蛛の糸(1918) — 극락 연못의 연잎·연꽃을 두 단으로 아래에 깔고, 위에서 곧게 내려오는 은빛 실 한 가닥과 작은 거미.
function LotusThread() {
  const pads = [[20, 128, 14], [62, 146, 12], [100, 160, 13], [6, 154, 9], [44, 104, 9], [86, 122, 8]];
  return (
    <>
      <Fill c="lt" d={pads.map(([x, y, r]) => `M${x} ${y}L${f1(x + r)} ${f1(y - r * 0.18)}A${r} ${f1(r * 0.42)} 0 1 1 ${f1(x + r * 0.96)} ${f1(y + r * 0.22)}Z`).join('')} />
      <Line c="dk" d={pads.map(([x, y, r]) => Array.from({ length: 5 }, (_, i) => { const a = Math.PI * (0.25 + i * 0.35); return `M${x} ${y}l${f1(Math.cos(a) * r * 0.9)} ${f1(Math.sin(a) * r * 0.38)}`; }).join('')).join('')} w={0.4} />
      <Fill c="dk" d="M30 110C26 102 28 94 34 90C34 96 36 100 34 104C38 98 42 96 46 96C44 102 40 106 34 110ZM34 110V128" />
      <Line c="dk" d="M34 110V128" w={0.8} />
      <Line c="acc" d="M50 0V138" w={0.5} focal />
      <Fill c="acc" d="M48.6 140a1.6 1.9 0 1 0 2.8 0a1.6 1.9 0 1 0 -2.8 0Z" focal />
      <Line c="acc" d="M47 138.6l-2 -1.6M47 141l-2.4 0.4M53 138.6l2 -1.6M53 141l2.4 0.4" w={0.4} />
      <Fill c="lt" d={dots(7, 26, [2, 6, 118, 90], 0.25, 0.6)} />
    </>
  );
}

// 山月記(1942) — 月に薄: 왼쪽 위 흰 달, 바람에 누운 억새가 들을 덮고, 그 속에 범의 등줄무늬가 어렴풋이.
function MoonTiger() {
  const blades = scatter(30, 8, [0, 96, 120, 168]).map(([x, y, k]) => `M${x} 168Q${f1(x + 4 + k * 6)} ${f1(y + 18)} ${f1(x + 16 + k * 10)} ${y}`).join('');
  return (
    <>
      <Fill c="acc" d="M10 34a14 14 0 1 0 28 0a14 14 0 1 0 -28 0Z" focal />
      <Fill c="lt" d="M14 30c3 -2 6 -1 7 1M26 40c2 0 4 1 4 3" />
      <Line c="lt" d={blades} w={0.7} />
      <Line c="dk" d={scatter(14, 9, [0, 110, 110, 168]).map(([x, y, k]) => `M${x} 168Q${f1(x + 6)} ${f1(y + 14)} ${f1(x + 20 + k * 8)} ${y}`).join('')} w={1} />
      <Fill c="dk" d={scatter(10, 11, [2, 80, 70, 110]).map(([x, y, k]) => `M${x} ${y}q${f1(3 + k * 2)} -4 ${f1(6 + k * 3)} 0q${f1(-3 - k)} -1 ${f1(-6 - k * 3)} 0Z`).join('')} />
      <Fill c="dd" d="M8 128c6 -6 18 -8 30 -6c6 1 10 4 12 8c-6 -2 -10 -2 -14 0c-8 -2 -18 -2 -28 -2Z" focal />
      <Line c="acc" d="M14 125l2 4M20 123.4l2 4.6M26 123l1.6 4.8M32 123.4l1.4 4.4M38 124.4l1 3.6" w={0.9} />
    </>
  );
}

// 坊っちゃん(1906) — 하늘색 천에 이불 속 메뚜기(バッタ)를 흩뿌리고, 아래에 松山 바다 물결, 강조색은 坊っちゃん団子 꼬치 하나.
function SteamSea() {
  const hoppers = scatter(11, 13, [4, 8, 116, 120]);
  const hopper = ([x, y, k]) => { const s = 0.9 + k * 0.45; const P = (dx, dy) => `${f1(x + dx * s)} ${f1(y + dy * s)}`; return `M${P(0, 0)}C${P(2, -2)} ${P(8, -2.4)} ${P(11, -0.8)}L${P(12.4, 0)}C${P(9, 1.4)} ${P(3, 1.4)} ${P(0, 0)}ZM${P(6, -1.2)}L${P(9.4, -5.6)} ${P(3.6, 2.6)}M${P(11, -0.8)}L${P(14.6, -4.4)}M${P(4, 0.8)}L${P(2.4, 3.6)}`; };
  return (
    <>
      <Fill c="lt" d={dots(14, 50, [2, 2, 118, 126], 0.3, 0.7)} />
      <Line c="dk" d={hoppers.map(hopper).join('')} w={0.9} cap />
      <Line c="dk" d={seigaiha(-4, 134, 124, 172, 6)} w={0.6} />
      <Line c="dd" d="M14 128L34 108" w={0.8} cap />
      <Fill c="acc" d="M17 125a2.6 2.6 0 1 0 0.1 0Z" focal />
      <Fill c="paper" d="M21.6 120.4a2.6 2.6 0 1 0 0.1 0Z" />
      <Fill c="acc2" d="M26.2 115.8a2.6 2.6 0 1 0 0.1 0Z" focal />
    </>
  );
}

// 檸檬(1925) — 丸善 서가의 화집을 쌓은 탑(두 단 회색), 그 꼭대기에 놓인 레몬 하나만 노랗게.
function LemonBooks() {
  const books = [[6, 150, 52, 10, 0], [10, 140, 46, 10, -2], [4, 128, 50, 11, 2], [12, 117, 40, 10, -1], [8, 106, 46, 10, 1]];
  return (
    <>
      <Line c="lt" d="M0 24H120M0 52H120M0 80H120M14 0V24M40 0V24M64 0V24M24 24V52M52 24V52M8 52V80M34 52V80M60 52V80" w={0.7} />
      <Fill c="lt" d={[2, 6, 9, 16, 19, 27, 31, 44, 47, 55, 58, 30, 35, 13].map((x, i) => `M${x} ${[4, 4, 8, 6, 4, 10, 6, 4, 8, 6, 10, 32, 30, 58][i]}h${[3, 2.4, 4, 2, 5, 3, 4, 2.6, 5, 3, 2.4, 4, 3, 4][i]}v${[20, 20, 16, 18, 20, 14, 18, 20, 16, 18, 14, 20, 22, 22][i]}h${-[3, 2.4, 4, 2, 5, 3, 4, 2.6, 5, 3, 2.4, 4, 3, 4][i]}Z`).join('')} />
      <Fill c="dk" d={books.map(([x, y, w, h, r]) => `M${x} ${y}h${w}v${h}h${-w}Z`).join('')} />
      <Line c="lt" d={books.map(([x, y, w, h]) => `M${x + 2} ${f1(y + h * 0.5)}h${w - 4}`).join('')} w={0.5} />
      <Fill c="acc" d="M20 102c0 -4.6 5 -7.6 11 -7.6s11 3 11 7.6 -5 7.6 -11 7.6 -11 -3 -11 -7.6ZM20.4 100.8l-4 1.2 4 1.4ZM41.6 100.8l4 1.2 -4 1.4Z" focal />
      <Line c="acc2" d="M24 98.4q4 -2.4 9 -1.6" w={0.7} cap />
    </>
  );
}

// よだかの星(1934) — 별 문양을 흩뿌린 밤, 위로 곧게 날아오르는 쏙독새 그림자, 왼쪽 위에서 푸르게 타는 별 하나.
function NightjarStar() {
  return (
    <>
      <Fill c="lt" d={scatter(36, 3, [2, 2, 118, 166]).map(([x, y, k]) => star4(x, y, 1 + k * 2.4)).join('')} />
      <Line c="dk" d="M0 150C20 140 30 146 46 138S80 136 120 128M0 160C24 152 50 158 72 150S104 148 120 144" w={1.2} />
      <Fill c="dk" d="M0 150C20 140 30 146 46 138S80 136 120 128V168H0Z" />
      <Fill c="dd" d="M40 82l3 -6 3 6 10 -4 -9 8 -1 8 -3 -4 -3 4 -1 -8 -9 -8Z" focal />
      <Fill c="acc" d={star4(22, 26, 9)} focal />
      <Fill c="acc2" d="M18.6 26a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0Z" />
    </>
  );
}

// 高瀬舟(1916) — 観世水(소용돌이 물결)를 아래 절반에, 위에서 늘어진 버들가지, 강을 내려가는 배 한 척과 그 등불.
function NightBoat() {
  const kanze = [[10, 112, 6], [36, 122, 7], [64, 112, 6], [92, 124, 7], [20, 142, 7], [50, 150, 6], [80, 144, 7], [108, 156, 6]];
  return (
    <>
      <Line c="lt" d={kanze.map(([x, y, r]) => `${swirl(x, y, r)}M${f1(x - r * 3)} ${f1(y + r * 0.4)}C${f1(x - r * 4)} ${f1(y + r * 1.2)} ${f1(x - r * 5.2)} ${f1(y + r * 1.4)} ${f1(x - r * 6)} ${f1(y + r)}`).join('')} w={0.8} />
      <Line c="dk" d="M4 0C8 20 6 44 10 72M10 0C14 18 13 40 17 64M16 0C19 14 19 30 22 48M2 10C4 30 2 52 5 84M22 0C24 10 25 22 27 34" w={0.9} cap />
      <Fill c="dk" d={scatter(18, 6, [2, 10, 26, 80]).map(([x, y]) => `M${x} ${y}c0.8 1 0.8 3 0 4c-0.8 -1 -0.8 -3 0 -4Z`).join('')} />
      <Fill c="dd" d="M18 102H64L58 108H23Z" focal />
      <Line c="dd" d="M58 102L66 80" w={0.9} />
      <Fill c="dd" d="M30 102v-6c0 -2 2 -3 3.4 -3s3.4 1 3.4 3v6ZM44 102v-5.6c0 -2 2 -3 3.4 -3s3.4 1 3.4 3V102Z" />
      <Fill c="acc" d="M38.4 97a1.8 2.2 0 1 0 3.6 0a1.8 2.2 0 1 0 -3.6 0Z" focal />
    </>
  );
}

// セロ弾きのゴーシュ(1934) — 오선보 줄과 음표를 판면에 흘리고, 기울어 선 첼로 그림자, 창가로 찾아온 뻐꾸기 하나.
function CelloNight() {
  const staff = [44, 94, 140].map((y) => Array.from({ length: 5 }, (_, i) => `M0 ${y + i * 2.4}C40 ${y + i * 2.4 - 6} 80 ${y + i * 2.4 + 6} 120 ${y + i * 2.4}`).join('')).join('');
  return (
    <>
      <Line c="lt" d={staff} w={0.45} />
      <Fill c="lt" d={[[10, 46], [24, 43], [70, 98], [96, 92], [14, 142], [60, 140], [86, 146]].map(([x, y]) => `M${x} ${y}a2 1.5 0 1 0 4 0a2 1.5 0 1 0 -4 0ZM${x + 3.6} ${y}v-9h0.8v9Z`).join('')} />
      <g transform="translate(-4 0) rotate(-18 30 100)" data-focal="">
        <Fill c="dk" d="M30 70C23 70 19 75 20 82C20.6 86 23 88 23 90S19 94 19 101C19 111 24 118 30 118S41 111 41 101C41 94 37 92 37 90S39.4 86 40 82C41 75 37 70 30 70ZM28.6 30h2.8v42h-2.8ZM28 30c-1 -3 0 -6 2 -6s3 2 2 4.6l-0.6 1.4ZM30 118v8" />
        <Line c="lt" d="M25.6 86c-1.4 2.6 -1 5.4 0.4 7.4M34.4 86c1.4 2.6 1 5.4 -0.4 7.4M25.6 100h8.8M29.2 34V108M30.8 34V108" w={0.4} />
      </g>
      <g transform="translate(-2 80)"><Fill c="paper" d="M60 72c-3 -2 -6 -1 -6.6 2c3 0 5 1 6 3c2 0.4 5 0 6 -2c-1.6 -2 -3.4 -2.6 -5.4 -3ZM66 75l4 -1.6 -3.4 3.2Z" focal /></g>
    </>
  );
}

// 銀河鉄道の夜(1934) — 군청 천에 은하수 띠(두 단)와 별, 띠를 비스듬히 오르는 기차와 철교를 금박처럼, 북십자 하나.
function NightTrain() {
  const band = 'M-10 168L-10 122 92 -10H132L28 168Z';
  const core = 'M-10 168L-10 146 104 -10H118L12 168Z';
  const inBand = scatter(220, 21, [0, 0, 120, 168]).filter(([x, y]) => { const t = x + y * 0.62; return t > 62 && t < 132; });
  const cars = [0, 14, 28].map((dx) => `M${12 + dx} 112h12.6v9h-12.6Z`).join('');
  const windows = [0, 14, 28].map((dx) => `M${14.4 + dx} 114.4h3v2.6h-3ZM${19.4 + dx} 114.4h3v2.6h-3Z`).join('');
  return (
    <>
      <Fill c="dk" d={band} />
      <Fill c="lt" d={core} />
      <Fill c="lt" d={dots(31, 46, [0, 0, 120, 168], 0.25, 0.9)} />
      <Fill c="paper" d={inBand.map(([x, y, k]) => { const r = f1(0.25 + k * 0.5); return `M${f1(x - r)} ${y}a${r} ${r} 0 1 0 ${f1(r * 2)} 0a${r} ${r} 0 1 0 ${f1(-r * 2)} 0Z`; }).join('')} />
      <g transform="translate(-10 10) rotate(-52 40 122)" data-focal="">
        <Fill c="acc" d={`M58 110H72L75 114V121H58ZM62 106h3v4h-3Z${cars}`} />
        <Fill c="dd" d={windows} />
        <Line c="acc" d={`M-6 122.5H78M-6 134H78${[-6, 6, 18, 30, 42, 54, 66].map((x) => `M${x} 122.5L${x + 3} 134M${x + 6} 122.5L${x + 3} 134`).join('')}`} w={0.6} />
      </g>
      <Fill c="acc" d={star4(22, 22, 6)} focal />
    </>
  );
}

// こころ(1914) — 波に千鳥: 青海波를 아래 절반에 두 단으로 찍고, 생지색 물떼새 셋이 바다 위를 난다(가마쿠라 해변).
function KamakuraLetter() {
  return (
    <>
      <Line c="lt" d={seigaiha(-4, 88, 124, 172, 7)} w={0.75} />
      <Line c="dk" d={seigaiha(-4, 88, 124, 172, 7).split('M').filter((_, i) => i % 3 === 1).map((s) => `M${s}`).join('')} w={0.75} />
      <Fill c="paper" d={`${plover(22, 62, 1.3)}${plover(40, 48, 1.1)}${plover(12, 40, 0.95)}`} focal />
    </>
  );
}

// やまなし(1923) — 골짜기 바닥에서 올려다본 물: 물 무늬 고리와 거품, 바닥의 게 둘, 떨어진 야마나시와 물총새 그림자.
function CrabPear() {
  const rings = [[30, 40, 16], [84, 140, 14], [16, 120, 10]];
  return (
    <>
      <Line c="lt" d={rings.map(([x, y, r]) => [1, 0.7, 0.4].map((k) => `M${f1(x - r * k)} ${y}a${f1(r * k)} ${f1(r * k * 0.4)} 0 1 0 ${f1(r * k * 2)} 0a${f1(r * k)} ${f1(r * k * 0.4)} 0 1 0 ${f1(-r * k * 2)} 0Z`).join('')).join('')} w={0.7} />
      <Line c="dk" d={dots(16, 14, [6, 20, 60, 110], 0.8, 2)} w={0.5} />
      <Fill c="dk" d="M0 156Q30 148 60 154T120 150V168H0Z" />
      <Fill c="dd" d="M14 150a5 3 0 1 0 10 0a5 3 0 1 0 -10 0ZM14.6 147.6l-3 -4 2.4 -0.6 2.2 3.4ZM23.4 147.6l3 -4 -2.4 -0.6 -2.2 3.4ZM36 156a4 2.6 0 1 0 8 0a4 2.6 0 1 0 -8 0ZM36.6 154l-2.6 -3.2 2 -0.4 1.8 2.8ZM43.4 154l2.6 -3.2 -2 -0.4 -1.8 2.8Z" />
      <Fill c="acc" d="M36 98a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z" focal />
      <Line c="dk" d="M43 91q1 -4 3.6 -5" w={0.8} cap />
      <Fill c="acc2" d="M30 32c-3 -3 -4 -8 -2 -11c2 -1 5 1 6 4l6 -3 -4 6c1 3 0 6 -2 7l4 8 -6 -6c-1 0 -2 -1 -2 -2l-4 6Z" focal />
      <Fill c="acc" d="M32.6 36.4l1.6 2 -2.2 -0.6Z" />
    </>
  );
}

// 風の又三郎(1934 · 사후) — 바람 소용돌이(渦)가 판면을 가로지르고, 날리는 잎, 언덕 위 작은 분교, 붉게 물든 잎 몇 장.
function WindHill() {
  const swirls = [[28, 30, 7], [70, 58, 6], [20, 82, 6], [86, 100, 7], [50, 116, 5]];
  const leaves = scatter(18, 17, [4, 10, 116, 130]);
  const leaf = ([x, y, k]) => { const a = k * 6.2; const dx = Math.cos(a) * 3; const dy = Math.sin(a) * 3; return `M${f1(x - dx)} ${f1(y - dy)}Q${f1(x - dy)} ${f1(y + dx)} ${f1(x + dx)} ${f1(y + dy)}Q${f1(x + dy)} ${f1(y - dx)} ${f1(x - dx)} ${f1(y - dy)}Z`; };
  return (
    <>
      <Line c="dk" d={swirls.map(([x, y, r]) => swirl(x, y, r)).join('')} w={1.1} cap />
      <Line c="lt" d={swirls.map(([x, y, r]) => swirl(x + 4, y + 8, r * 0.7)).join('')} w={0.8} cap />
      <Fill c="lt" d={leaves.map(leaf).join('')} />
      <Fill c="acc" d={leaves.filter((_, i) => i % 6 === 0).map(leaf).join('')} />
      <Fill c="dk" d="M0 150C30 136 70 132 120 140V168H0Z" />
      <Fill c="dd" d="M38 136l9 -7 9 7ZM40 136h14v8h-14Z" focal />
      <Fill c="paper" d="M42.4 138h3v3h-3ZM48.4 138h3v3h-3Z" />
    </>
  );
}

// トロッコ(1922) — 귤밭 비탈을 내리꽂는 두 줄 레일과 침목, 귤나무 둥근 잎 덩이를 두 단으로, 익은 귤만 주황.
function DuskRails() {
  const trees = scatter(16, 19, [2, 8, 118, 160]);
  return (
    <>
      <Fill c="lt" d={trees.map(([x, y, k]) => { const r = f1(6 + k * 5); return `M${f1(x - r)} ${y}a${r} ${f1(r * 0.8)} 0 1 0 ${f1(r * 2)} 0a${r} ${f1(r * 0.8)} 0 1 0 ${f1(-r * 2)} 0Z`; }).join('')} />
      <Line c="dk" d="M24 168L58 0M50 168L66 0" w={1.1} />
      <Line c="dk" d={Array.from({ length: 16 }, (_, i) => { const t = i / 16; return `M${f1(24 + 34 * t - 1)} ${f1(168 - 168 * t)}H${f1(50 + 16 * t + 1)}`; }).join('')} w={0.7} />
      <Fill focal c="acc" d={trees.flatMap(([x, y, k], i) => (i % 2 || (x > 62 && y < 124) ? [] : [[x - 3, y - 1], [x + 2.4, y + 1.6]])).map(([x, y]) => `M${f1(x - 1.5)} ${f1(y)}a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0Z`).join('')} />
    </>
  );
}

// 杜子春(1920) — 仙人의 瑞雲이 판면을 떠가고, 이야기 끝 泰山 기슭의 복숭아꽃과 열매 하나.
function PeachHouse() {
  const clouds = [[4, 40, 1.4], [48, 70, 1], [10, 98, 1.2], [60, 124, 1.1], [20, 150, 1]];
  return (
    <>
      <Fill c="lt" d={clouds.map(([x, y, s]) => cloud(x, y, s)).join('')} />
      <Line c="dk" d={clouds.map(([x, y, s]) => cloud(x, y, s)).join('')} w={0.6} />
      <Line c="dd" d="M0 140C14 132 22 136 30 128S44 122 52 116" w={1.2} cap />
      <Fill c="dk" d={[[12, 134], [26, 128], [40, 120], [50, 114], [20, 142]].map(([x, y], i) => sakura(x, y, 3, i * 30)).join('')} />
      <Fill c="acc" d="M34 136c-4 0 -6 4 -5 7c2 4 8 4 10 0c1 -3 -1 -7 -5 -7Z" focal />
      <Fill c="acc2" d="M34 136c2 -3 5 -4 8 -3c-2 2 -5 3 -8 3Z" />
    </>
  );
}

// 人間椅子(1925) — 다이쇼 말 탐정 잡지의 아르데코: 칠흑 천에 부채꼴 햇살 선과 가죽 안락의자를 회흑 두 단으로, 금빛 이음매 선과 눈 하나.
function DecoChair() {
  return (
    <>
      <Line c="lt" d={[[4, 70], [10, 44], [22, 30], [38, 30], [50, 44], [57, 70], [70, 96], [90, 120]].map(([x, y]) => `M30 168L${x} ${y}`).join('')} w={0.5} />
      <Fill c="lt" d="M14 80C14 70 20 66 30 66S46 70 46 80V112H14ZM6 100C6 94 10 92 14 92V128H6ZM46 92C50 92 54 94 54 100V128H46ZM6 112h48v18h-48ZM9 130h4v12h-4ZM47 130h4v12h-4Z" focal />
      <Line c="acc" d="M18 84H42M18 96H42M30 70V110M14 112H46M4 146H58" w={0.6} />
      <Fill c="acc" d={[[22, 78], [38, 78], [22, 90], [38, 90], [22, 102], [38, 102]].map(([x, y]) => `M${x - 0.9} ${y}a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0Z`).join('')} />
      <Fill c="paper" d="M25 96Q30 92.6 35 96Q30 99.4 25 96Z" />
      <Fill c="dd" d="M28.7 96a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z" />
    </>
  );
}

// 刺青(1910) — 메이지 말 탐미 문예서: 판면 가득 거미줄(두 단)과 위에서 내려온 실, 한가운데 女郎蜘蛛만 먹과 금빛 줄무늬로.
function SpiderWeb() {
  const cx = 30; const cy = 100;
  const spokes = Array.from({ length: 12 }, (_, i) => (i * 30 * Math.PI) / 180);
  const ring = (r) => spokes.map((a, i) => `${i ? 'L' : 'M'}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`).join('');
  return (
    <>
      <Line c="lt" d={`${spokes.map((a) => `M${cx} ${cy}L${f1(cx + 90 * Math.cos(a))} ${f1(cy + 90 * Math.sin(a))}`).join('')}${[10, 20, 32, 46, 62, 80].map((r) => `${ring(r)}Z`).join('')}`} w={0.4} />
      <Line c="dk" d={`M${cx} 0V74${[10, 20, 32].map((r) => `${ring(r)}Z`).join('')}`} w={0.5} />
      <Line c="dd" d="M27 96L19 88 16 78M27 99L15 96 9 90M27 102L16 106 11 114M28 104L22 114 22 124M33 96L41 88 44 78M33 99L45 96 51 90M33 102L44 106 49 114M32 104L38 114 38 124" w={1} cap />
      <Fill c="dd" d="M26.4 96.5a3.6 3 0 1 0 7.2 0a3.6 3 0 1 0 -7.2 0ZM24.8 108a5.2 8.6 0 1 0 10.4 0a5.2 8.6 0 1 0 -10.4 0Z" focal />
      <Line c="acc" d="M25.8 104H34.2M25.2 108H34.8M25.8 112H34.2" w={1.1} />
    </>
  );
}

// 走れメロス(1940) — 범람한 강의 荒波(말린 물결)를 두 단으로, 먼 성벽 도시, 다리 기둥 사이를 뛰어 건너는 생지색 그림자.
function MelosRun() {
  const curls = scatter(22, 23, [-4, 84, 124, 150]);
  return (
    <>
      <Fill c="dk" d="M0 44h6v-6h3v6h9v-10h4v-4h3v4h4v10h9v-8h4v-4h4v4h4v8h8v-6h3v6h9v-10h4v-4h3v4h4v10h12v6H0Z" />
      <Fill c="dk" d="M0 84Q20 78 34 84T70 82T120 84V150H0Z" />
      <Line c="lt" d={curls.map(([x, y, k]) => { const r = 3 + k * 4; return `M${f1(x - r * 1.6)} ${y}Q${f1(x - r)} ${f1(y - r * 1.2)} ${f1(x + r * 0.2)} ${f1(y - r * 0.6)}Q${f1(x + r * 0.6)} ${f1(y + r * 0.2)} ${f1(x - r * 0.1)} ${f1(y + r * 0.3)}`; }).join('')} w={0.9} cap />
      <Fill c="dd" d="M6 80h4v14h-4ZM50 78h4v14h-4ZM0 150Q30 144 60 150T120 148V168H0Z" />
      <Fill c="paper" d="M29.4 62a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0Z" focal />
      <Line c="paper" d="M31 65L27 74 20 78M29 70L36 76 41 74M30 67L24 64 20 66M31 67L37 64 41 60" w={1.8} cap />
    </>
  );
}

// 人間失格(1948) — はしがき의 사진 석 장: 생지색 인화지 테두리 셋을 비스듬히 겹치고, 가운데 한 장에만 웃는 道化 가면(입술만 朱).
function ClownPhotos() {
  return (
    <>
      <Fill c="lt" d={dots(29, 30, [2, 2, 118, 166], 0.3, 0.8)} />
      <g transform="rotate(-9 24 40)" data-focal="">
        <Fill c="paper" d="M10 22h28v34h-28Z" />
        <Fill c="dk" d="M13 25h22v22h-22Z" />
        <Line c="paper" d="M16 47V36H32V47M20 36V31H28V36" w={0.6} />
      </g>
      <g transform="rotate(7 32 92)" data-focal="">
        <Fill c="paper" d="M16 72h32v40h-32Z" />
        <Fill c="dk" d="M19 75h26v27h-26Z" />
        <Fill c="paper" d="M23 88a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z" />
        <Line c="dd" d="M27.5 86Q29 84.4 30.5 86M33.5 86Q35 84.4 36.5 86" w={0.9} cap />
        <Line c="acc" d="M28 90.5Q32 95 36 90.5" w={1.1} cap />
      </g>
      <g transform="rotate(-4 26 140)" data-focal="">
        <Fill c="paper" d="M10 122h30v36h-30Z" />
        <Fill c="dd" d="M13 125h24v24h-24Z" />
      </g>
    </>
  );
}

// 斜陽(1947) — 이즈 산장의 지는 해를 크게 두 단으로, 비스듬히 기운 햇살 선, 아래 언덕과 산장, 그리고 검은 뱀 한 마리.
function SettingSun() {
  return (
    <>
      <Line c="lt" d="M30 104L-10 60M30 104L0 40M30 104L16 26M30 104L36 24M30 104L56 30M30 104L76 44M30 104L96 64" w={0.8} />
      <Fill c="dk" d="M6 104A24 24 0 0 1 54 104Z" focal />
      <Fill c="lt" d="M14 104A16 16 0 0 1 46 104Z" />
      <Line c="dk" d="M0 110H120M8 118H52M14 126H46M20 134H40" w={0.8} />
      <Fill c="dk" d="M0 150Q30 136 60 144T120 140V168H0Z" />
      <Fill c="dd" d="M10 146l8 -6 8 6ZM12 146h12v6h-12Z" focal />
      <Line c="acc" d="M64 160c6 -4 10 0 14 -2s6 -6 10 -4 4 4 8 2" w={1.6} cap focal />
      <Fill c="acc" d="M95.4 156.4a2 1.4 0 1 0 4 0a2 1.4 0 1 0 -4 0Z" />
    </>
  );
}

// 女生徒(1939) — 쇼와 10년대 소녀 잡지의 서정: 엄마의 서양 우산이 판면을 비스듬히 가로지르고, 둥근 안경, 장미 한 송이만 붉게.
function UmbrellaRose() {
  return (
    <>
      <Fill c="lt" d={dots(33, 34, [2, 2, 118, 166], 0.4, 1.1)} />
      <Line c="dk" d="M6 23a6 6 0 1 0 12 0a6 6 0 1 0 -12 0ZM24 23a6 6 0 1 0 12 0a6 6 0 1 0 -12 0ZM18 22q3 -2 6 0M6 22l-5 -3M36 22l5 -3" w={1.1} />
      <g transform="rotate(-30 32 96)" data-focal="">
        <Fill c="dk" d="M32 48L22 120H42Z" />
        <Line c="lt" d="M32 48L28 120M32 48L36 120" w={0.5} />
        <Line c="dd" d="M32 120V138Q32 143 27 143T22 138M32 42V48" w={1.6} cap />
      </g>
      <Line c="dd" d="M52 166L48 138" w={1} />
      <Fill c="dd" d="M49.6 152C44 150 42 146 43 143C47 144 49.6 147 49.6 152ZM50.6 158C55 157 58 154 58 150C54 150.6 51.4 153.6 50.6 158Z" />
      <Fill c="acc" d="M42 134a6 6 0 1 0 12 0a6 6 0 1 0 -12 0Z" focal />
      <Line c="paper" d="M45 133.6Q48 130.6 51 133.6Q48 136 45 133.6ZM46 136.6Q48 138.6 50 136.6" w={0.6} />
    </>
  );
}

// 桜の森の満開の下(1947) — 桜散らし: 판면을 덮은 벚꽃 송이를 두 단으로, 그 사이로 지는 꽃잎, 薄桜 송이 셋.
function BlossomStorm() {
  const flowers = scatter(24, 41, [-6, -6, 126, 174]);
  const pale = [[18, 118, 9, 10], [34, 148, 6, 40], [10, 154, 5, 70]];
  return (
    <>
      <Fill c="dk" d={flowers.map(([x, y, k]) => sakura(x, y, 6 + k * 6, k * 70)).join('')} />
      <Fill c="dd" d={flowers.map(([x, y]) => `M${f1(x - 1.3)} ${y}a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z`).join('')} />
      <Fill c="lt" d={petals(43, 30, [0, 0, 120, 168], 0.9)} />
      <Fill c="acc" d={pale.map(([x, y, r, rot]) => sakura(x, y, r, rot)).join('')} focal />
      <Fill c="dd" d={pale.map(([x, y]) => `M${x - 1.4} ${y}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0Z`).join('')} />
    </>
  );
}

// 천결(布目)·종이결(和紙) — 모든 표지 공통 층. 숫자 행렬은 잡음→투명도 변환일 뿐 색이 아니다 — 색은 CSS(flood-color·color)가 정한다.
function Surface({ id }) {
  return (
    <defs>
      <pattern id={`${id}-cloth`} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
        <path className={C('weave')} d="M0 0.4H1.6M0.4 0V1.6" stroke="currentColor" strokeWidth="0.3" />
        <path className={C('weave-hi')} d="M0 1.2H1.6M1.2 0V1.6" stroke="currentColor" strokeWidth="0.25" />
      </pattern>
      <filter id={`${id}-print`} x="0" y="0" width="120" height="168" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="3" result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale="0.45" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id={`${id}-paper`} x="0" y="0" width="120" height="168" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="fine" />
        <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.4 0 0 0 -1.2" result="grainA" />
        <feFlood className="lit-paper__grain" result="grainC" />
        <feComposite in="grainC" in2="grainA" operator="in" result="grain" />
        <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 0 0 0 1" result="flecksA" />
        <feFlood className="lit-paper__fleck" result="fleckC" />
        <feComposite in="fleckC" in2="flecksA" operator="in" result="fleck" />
        <feMerge><feMergeNode in="grain" /><feMergeNode in="fleck" /></feMerge>
      </filter>
    </defs>
  );
}

const ART = {
  'snow-night': SnowNight, higanbana: Higanbana, 'forest-doors': ForestDoors, 'ink-steam': InkSteam, birdcage: Birdcage,
  'rain-gate': RainGate, 'lotus-thread': LotusThread, 'moon-tiger': MoonTiger, 'steam-sea': SteamSea,
  'lemon-books': LemonBooks, 'nightjar-star': NightjarStar, 'night-boat': NightBoat, 'cello-night': CelloNight,
  'night-train': NightTrain, 'kamakura-letter': KamakuraLetter, 'crab-pear': CrabPear, 'wind-hill': WindHill,
  'dusk-rails': DuskRails, 'peach-house': PeachHouse, 'deco-chair': DecoChair, 'spider-web': SpiderWeb,
  'melos-run': MelosRun, 'clown-photos': ClownPhotos, 'setting-sun': SettingSun, 'umbrella-rose': UmbrellaRose, 'blossom-storm': BlossomStorm,
};

export default function LiteratureCoverArt({ motif }) {
  // 한 화면에 표지가 여럿 — 무늬·필터 id를 표지마다 따로 둔다(url(#…)은 같은 문서 안 조각 참조뿐).
  const id = `lp${useId().replace(/[^\w-]/g, '')}`;
  const Art = ART[motif];
  if (!Art) return null;
  return (
    <svg className={`lit-art lit-art--${motif}`} viewBox="0 0 120 168" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <Surface id={id} />
      <rect width="120" height="168" fill={`url(#${id}-cloth)`} />
      <g filter={`url(#${id}-print)`}><Art /></g>
      <rect className="lit-paper" width="120" height="168" filter={`url(#${id}-paper)`} />
    </svg>
  );
}
