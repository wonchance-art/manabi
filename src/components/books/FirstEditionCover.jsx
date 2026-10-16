import { useId } from 'react';
import { Metamorphous, Noto_Serif_SC, Rye } from 'next/font/google';
import { FIRST_EDITION_BINDINGS, romanYear } from '../../lib/firstEditionCover';
import { PERIOD_FONTS, SECOND_DRAW, SECOND_FONT_CLASS, SECOND_GROUNDS } from './FirstEditionCoverSecond';
import './first-edition-cover.css';

// 중국어·프랑스어 정본 책 표지 — 「초판 장정」 시리즈(LIT-SRC-WS-1, 오너 「권장대로」 2026-10-17 KST). 규칙·근거는 lib/firstEditionCover.js.
// 60×84(서재 표지 규격, 영어·일본어 책과 같다) · 그림 좌표 120×168. 장정(binding)마다 초판 앞표지의 자리를 따른다 — 『呐喊』은 실물대로
// 오른쪽→왼쪽 가로쓰기다. 모두 SVG 한 장이고 장식이다(aria-hidden — 카드의 제목 글자가 읽어 준다).
// 배포 빌드는 저장소 사본(vendor/google-fonts)에서만 글꼴을 읽으므로 이 호출을 바꾸면 사본도 함께 받는다.
const song = Noto_Serif_SC({ weight: ['400', '600'], subsets: ['latin'], display: 'swap', preload: false, variable: '--font-ws-song' });
const pointed = Metamorphous({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-ws-pointed' });
const ornate = Rye({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-ws-ornate' });

const SONG = 'var(--font-ws-song, "Noto Serif SC"), "Noto Serif SC", "Songti SC", STSong, serif';
// 당시 글꼴(오너 「당시 글꼴로, 원본 대조하면서」 2026-10-17 KST) — Lemerre 1873은 엘제비르(옛 로만) 활자, Pagnerre 1862 · Marpon 1885 판권 글자는 디도.
const ELZEVIR = PERIOD_FONTS.FELL;
const DIDONE = PERIOD_FONTS.DIDOT;
const POINTED = 'var(--font-ws-pointed, Metamorphous), Metamorphous, Georgia, serif';
const ORNATE = 'var(--font-ws-ornate, Rye), Rye, Georgia, serif';
const FONT_CLASS = [song.variable, pointed.variable, ornate.variable, SECOND_FONT_CLASS].filter(Boolean).join(' ');

/** 바탕 색 — 장정마다 실물 사진에서 잰 값(『呐喊』은 바랜 벽돌색을 원래 색에 가깝게 되돌린 값). 책은 물건이라 테마를 따라 바뀌지 않는다. */
export const FIRST_EDITION_GROUNDS = Object.freeze({
  nahan: { ground: '#b5462f', ink: '#27232b' },
  kaiming: { ground: '#ebe2cc', ink: '#3b2d22' },
  lemerre: { ground: '#d9c6a2', ink: '#221c17' },
  marpon: { ground: '#eee5d2', ink: '#3a3834' },
  hetzel: { ground: '#bb4630', ink: '#1d1716' },
  pagnerre: { ground: '#b9c2c3', ink: '#1d2124', red: '#8a1f1b' },
  ...SECOND_GROUNDS,
});

function T({ x, y, size, font, fill, spacing, italic, weight, children, ...rest }) {
  return (
    <text x={x} y={y} fontSize={size} textAnchor="middle" fill={fill} letterSpacing={spacing} fontStyle={italic ? 'italic' : undefined} fontWeight={weight} style={{ fontFamily: font }} {...rest}>{children}</text>
  );
}

// 新潮社 1923 『呐喊』 — 검은 판 안 바탕색 글자, 가로 오른쪽→왼쪽(실물: 「喊 呐」). 제목·작가를 한 자씩 거꾸로 놓는다.
function Nahan({ display, tone }) {
  const rtl = (value) => [...value].reverse().join('　');
  const size = [...display.coverTitle].length <= 2 ? 8.6 : 7.2;
  const wave = `M45 63${' q1.5 -1.4 3 0 t3 0'.repeat(5)}`;
  return (
    <g>
      <rect x="35" y="44" width="50" height="33" fill={tone.ink} />
      <rect x="37.3" y="46.3" width="45.4" height="28.4" fill="none" stroke={tone.ground} strokeWidth=".7" />
      <g lang="zh-Hans">
        <T x={60} y={59.5} size={size} font={SONG} fill={tone.ground} weight="600">{rtl(display.coverTitle)}</T>
        <path d={wave} fill="none" stroke={tone.ground} strokeWidth=".7" />
        <T x={60} y={70.2} size={4.6} font={SONG} fill={tone.ground} weight="600">{rtl(display.coverAuthor)}</T>
      </g>
      <path d="M52 72.3h16" stroke={tone.ground} strokeWidth=".6" />
    </g>
  );
}

// 开明书店 1928 『背影』 — 시대 관례: 세로 큰 제목(오른쪽) · 세로 작가(왼쪽) · 가는 이중 테 · 아래 출판사.
function Kaiming({ display, tone }) {
  const title = [...display.coverTitle];
  const author = [...display.coverAuthor];
  return (
    <g>
      <rect x="10" y="10" width="100" height="148" fill="none" stroke={tone.ink} strokeWidth="1" />
      <rect x="12.4" y="12.4" width="95.2" height="143.2" fill="none" stroke={tone.ink} strokeWidth=".4" />
      <g lang="zh-Hans">
        {title.map((char, index) => <T key={`t${index}`} x={74} y={46 + index * 24} size={19} font={SONG} fill={tone.ink} weight="600">{char}</T>)}
        {author.map((char, index) => <T key={`a${index}`} x={50} y={58 + index * 7} size={5.6} font={SONG} fill={tone.ink}>{char}</T>)}
        <path d="M38 116h44" stroke={tone.ink} strokeWidth=".5" />
        <T x={60} y={140} size={4.4} font={SONG} fill={tone.ink} spacing="1.2">{display.coverImprint}</T>
      </g>
    </g>
  );
}

// Lemerre 1873 — 담황색 인쇄 표지 · 대문자 활자 가운데 · 출판사 도안 자리에 덩굴(도안은 그리지 않는다).
function Lemerre({ display, tone }) {
  const [first, second] = display.coverTitle.toUpperCase().split('\n');
  const ink = tone.ink;
  return (
    <g lang="fr">
      <T x={60} y={20} size={4.2} spacing=".9" font={ELZEVIR} fill={ink}>{display.coverAuthor.toUpperCase()}</T>
      <path d="M54 24h12" stroke={ink} strokeWidth=".4" />
      {second ? <><T x={60} y={40} size={7.4} spacing=".6" font={ELZEVIR} fill={ink}>{first}</T><T x={60} y={54} size={12} spacing="1.2" font={ELZEVIR} fill={ink}>{second}</T></>
        : <T x={60} y={50} size={12} spacing="1.2" font={ELZEVIR} fill={ink}>{first}</T>}
      {display.coverSubtitle && <T x={60} y={64} size={4} italic font={ELZEVIR} fill={ink}>{display.coverSubtitle}</T>}
      <g fill="none" stroke={ink} strokeWidth=".7" strokeLinecap="round">
        <path d="M60 84v22M60 92c-5-3-10-1-11 4 4 2 8 0 11-4zM60 92c5-3 10-1 11 4-4 2-8 0-11-4zM60 100c-6-2-12 1-12 7 5 1 10-2 12-7zM60 100c6-2 12 1 12 7-5 1-10-2-12-7z" />
        <circle cx="60" cy="82.6" r="1.4" fill={ink} />
      </g>
      <T x={60} y={134} size={5.2} spacing="1" font={ELZEVIR} fill={ink}>{display.coverPlace.toUpperCase()}</T>
      <T x={60} y={141} size={3.4} spacing=".4" font={ELZEVIR} fill={ink}>{display.coverImprint.toUpperCase()}</T>
      <path d="M55 145h10" stroke={ink} strokeWidth=".35" />
      <T x={60} y={151} size={3.6} spacing=".6" font={ELZEVIR} fill={ink}>{romanYear(display.coverYear)}</T>
    </g>
  );
}

const PARURE_LEAVES = Array.from({ length: 10 }, (_, i) => ({ cx: 14 + (i % 2 ? 3 : -3), cy: 150 - i * 9, rotate: i % 2 ? -35 : 35 }));
const PARURE_FLOWERS = Array.from({ length: 4 }, (_, i) => ({ x: 13 + (i % 2 ? 4 : -2), y: 140 - i * 24 }));
const PARURE_STONES = Array.from({ length: 11 }, (_, i) => {
  const t = (i - 5) / 5;
  const s = 1.6 + (1 - Math.abs(t)) * 1.6;
  return { x: 60 + t * 24, y: 96 + (1 - t * t) * 18, s };
});

// Marpon & Flammarion 1885 — 크림 그림 표지 · 뾰족한 손글씨 제목(계단식) · 왼쪽 꽃덩굴 · 아래 두루마리.
// 실물의 날개 단 여인은 사람이라 빼고, 그 자리에 작품의 목걸이(다이아몬드 리비에르)를 그린다.
function Marpon({ display, tone }) {
  const ink = tone.ink;
  const [first, second] = display.coverTitle.toUpperCase().split('\n');
  return (
    <g lang="fr">
      {display.coverEdition && <T x={60} y={14} size={3.2} spacing=".6" font={DIDONE} fill={ink}>{display.coverEdition.toUpperCase()}</T>}
      <T x={62} y={25} size={5.4} font={POINTED} fill={ink}>{display.coverAuthor.toUpperCase()}</T>
      {second ? <><T x={40} y={46} size={9} font={POINTED} fill={ink}>{first}</T><T x={70} y={66} size={17} spacing=".3" font={POINTED} fill={ink}>{second}</T></>
        : <T x={64} y={60} size={17} spacing=".3" font={POINTED} fill={ink}>{first}</T>}
      <path d="M14 162 C10 130 18 100 13 66" fill="none" stroke={ink} strokeWidth=".8" />
      {PARURE_LEAVES.map((leaf) => <ellipse key={leaf.cy} cx={leaf.cx} cy={leaf.cy} rx="3.4" ry="1.5" transform={`rotate(${leaf.rotate} ${leaf.cx} ${leaf.cy})`} fill={ink} opacity=".75" />)}
      {PARURE_FLOWERS.map((flower) => (
        <g key={flower.y} transform={`translate(${flower.x} ${flower.y})`}>
          {[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={(Math.cos(k * 1.2566) * 2).toFixed(2)} cy={(Math.sin(k * 1.2566) * 2).toFixed(2)} r="1.5" fill={tone.ground} stroke={ink} strokeWidth=".4" />)}
          <circle r=".9" fill={ink} />
        </g>
      ))}
      <path d="M36 92 Q60 128 84 92" fill="none" stroke={ink} strokeWidth=".4" />
      {PARURE_STONES.map((stone) => <path key={stone.x} d={`M${stone.x.toFixed(1)} ${(stone.y - stone.s).toFixed(1)}l${stone.s.toFixed(1)} ${stone.s.toFixed(1)}-${stone.s.toFixed(1)} ${stone.s.toFixed(1)}-${stone.s.toFixed(1)}-${stone.s.toFixed(1)}z`} fill={tone.ground} stroke={ink} strokeWidth=".5" />)}
      <path d="M40 140h40c3 0 3 8 0 8H40c-3 0-3-8 0-8z" fill={tone.ground} stroke={ink} strokeWidth=".6" />
      <T x={60} y={145.2} size={2.9} font={DIDONE} fill={ink}>{display.coverImprint.toUpperCase()}</T>
      <T x={60} y={160} size={2.6} font={DIDONE} fill={ink}>{display.coverPlace.toUpperCase()}</T>
    </g>
  );
}

// Hetzel 붉은 천 — 먹 실선 → 먹 뇌문 띠 → 금박 넝쿨 띠 → 뇌문 · 가운데 큰 원(먹·금박 고리) 안 금박 제목 · 위아래 작은 원(모노그램 대신 별).
function Hetzel({ display, tone, id }) {
  const gold = `url(#${id}-gold)`;
  const lines = display.coverTitle.toUpperCase().split('\n');
  // 줄 자리 — 4줄(LE / TOUR DU MONDE / EN / 80 JOURS): 작은 줄과 큰 줄이 번갈아(실물).
  const rows = [[80, 3.4], [87.4, 5], [92.6, 3.2], [100, 6.4]];
  const band = (x, w, fill) => <path fillRule="evenodd" fill={fill} d={`M${x} ${x}h${120 - 2 * x}v${168 - 2 * x}h-${120 - 2 * x}z M${x + w} ${x + w}v${168 - 2 * x - 2 * w}h${120 - 2 * x - 2 * w}v-${168 - 2 * x - 2 * w}z`} />;
  const star = (cy) => (
    <g transform={`translate(60 ${cy})`}>
      <circle r="10.5" fill={tone.ink} /><circle r="9" fill="none" stroke={gold} strokeWidth=".8" />
      <path d="M0-6l1.6 4.2 4.4.2-3.4 2.8 1.2 4.4L0 3.1-3.8 5.6l1.2-4.4L-6-1.6l4.4-.2z" fill={gold} />
    </g>
  );
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4dc94" /><stop offset=".55" stopColor="#d4aa4f" /><stop offset="1" stopColor="#9c752a" /></linearGradient>
        <pattern id={`${id}-key`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={tone.ink} /><path d="M0 4.6h4.6V1.4H2v1.8" fill="none" stroke={tone.ground} strokeWidth=".8" /></pattern>
        <pattern id={`${id}-vine`} width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill={tone.ground} /><path d="M0 4c2-3 4-3 4 0s2 3 4 0" fill="none" stroke={gold} strokeWidth=".8" /><circle cx="4" cy="2" r=".7" fill={gold} /></pattern>
        <path id={`${id}-arcT`} d="M39.5 88 A20.5 20.5 0 0 1 80.5 88" /><path id={`${id}-arcB`} d="M37.8 88 A22.2 22.2 0 0 0 82.2 88" />
      </defs>
      <rect x="4" y="4" width="112" height="160" fill="none" stroke={tone.ink} strokeWidth=".8" />
      {band(6, 4, `url(#${id}-key)`)}{band(11, 5, `url(#${id}-vine)`)}{band(17, 3, `url(#${id}-key)`)}
      {star(36)}{star(140)}
      <circle cx="60" cy="88" r="31" fill={tone.ink} /><circle cx="60" cy="88" r="29" fill="none" stroke={gold} strokeWidth="1.2" />
      <circle cx="60" cy="88" r="26.6" fill={tone.ground} /><circle cx="60" cy="88" r="25.4" fill="none" stroke={gold} strokeWidth=".4" />
      <g lang="fr" style={{ fontFamily: ORNATE }} fill={gold}>
        <text fontSize="4.2" letterSpacing=".4"><textPath href={`#${id}-arcT`} startOffset="50%" textAnchor="middle">{display.coverAuthor.toUpperCase()}</textPath></text>
        <text fontSize="3.4" letterSpacing=".5" dominantBaseline="hanging"><textPath href={`#${id}-arcB`} startOffset="50%" textAnchor="middle">{display.coverEdition.toUpperCase()}</textPath></text>
        {lines.map((line, index) => {
          const [y, size] = rows[index + (4 - lines.length)] || rows[3];
          return <T key={`${index}-${line}`} x={60} y={y} size={size} font={ORNATE} fill={gold}>{line}</T>;
        })}
      </g>
    </g>
  );
}

// Pagnerre 1862 — 표제지 구성: 작가 · 굵고 가는 줄 · LES / 빨간 MISÉRABLES · 줄 · 부(part) · 부 제목 · 권(tome) · 아래 PARIS·출판사·연도 · 이중 테.
function Pagnerre({ display, tone }) {
  const ink = tone.ink;
  const [first, second] = display.coverTitle.toUpperCase().split('\n');
  const [name, sub] = display.coverPartTitle.toUpperCase().split('\n');
  const rule = (y) => <><path d={`M44 ${y}h32`} stroke={ink} strokeWidth="1" /><path d={`M47 ${y + 1.6}h26`} stroke={ink} strokeWidth=".35" /></>;
  return (
    <g lang="fr">
      <rect x="8" y="8" width="104" height="152" fill="none" stroke={ink} strokeWidth=".7" />
      <rect x="10" y="10" width="100" height="148" fill="none" stroke={ink} strokeWidth=".3" />
      <T x={60} y={24} size={4.6} spacing="1" font={DIDONE} fill={ink}>{display.coverAuthor.toUpperCase()}</T>
      {rule(28)}
      {second ? <><T x={60} y={39} size={4.2} spacing="1" font={DIDONE} fill={ink}>{first}</T><T x={60} y={51} size={10} spacing=".9" font={DIDONE} fill={tone.red}>{second}</T></>
        : <T x={60} y={49} size={10} spacing=".9" font={DIDONE} fill={tone.red}>{first}</T>}
      {rule(56)}
      <T x={60} y={71} size={3.8} spacing=".8" font={DIDONE} fill={ink}>{display.coverPart.toUpperCase()}</T>
      <T x={60} y={sub ? 82 : 84} size={name.length < 14 ? 7.6 : 5.6} spacing=".5" font={DIDONE} fill={ink}>{name}</T>
      {sub && <T x={60} y={88} size={3.6} spacing=".3" font={DIDONE} fill={ink}>{sub}</T>}
      <T x={60} y={99} size={4.4} italic font={DIDONE} fill={ink}>{display.coverTome}</T>
      <T x={60} y={136} size={5} spacing="1" font={DIDONE} fill={ink}>{display.coverPlace.toUpperCase()}</T>
      <T x={60} y={142.4} size={3.3} spacing=".4" font={DIDONE} fill={ink}>{display.coverImprint.toUpperCase()}</T>
      <T x={60} y={150} size={3.6} spacing=".6" font={DIDONE} fill={ink}>{romanYear(display.coverYear)}</T>
    </g>
  );
}

const DRAW = { nahan: Nahan, kaiming: Kaiming, lemerre: Lemerre, marpon: Marpon, hetzel: Hetzel, pagnerre: Pagnerre, ...SECOND_DRAW };

// ── 시리즈 공통 원칙(오너 「이전에 커버 만들었던 것처럼 일관성 줄 수 있는 원칙 일부와 빈티지 효과」 2026-10-17 KST) ──
// ① 틀: 60×84 · 왼쪽 접힘(경첩) 그림자 하나 — 시리즈 A(일본 책) · 빅토리아 천 장정과 같은 자리(CSS .fe-cover).
// ② 재질: 장정마다 material(paper · cloth · board · burlap) 하나 — 결의 세기와 낡음의 세기가 재질로만 정해진다.
// ③ 낡음(빈티지): 모든 책에 같은 네 겹 — 가장자리 바램(테두리 쪽 갈변) · 얼룩(종이·보드만, 갈색 점) · 모서리 닳음 · 인쇄 번짐(글자·그림 가장자리가
//    살짝 거칠어짐). 위치·모양은 장정 이름에서 나온 씨앗으로 정해져 늘 같다(결정적 — 같은 책은 언제 그려도 같은 낡음).
const AGING = Object.freeze({
  paper: { grain: 0.1, toning: 0.26, foxing: 5, wear: 0.16, ink: 0.42 },
  board: { grain: 0.14, toning: 0.3, foxing: 7, wear: 0.2, ink: 0.3 },
  cloth: { grain: 0.06, toning: 0.18, foxing: 0, wear: 0.24, ink: 0.3 },
  burlap: { grain: 0.08, toning: 0.16, foxing: 0, wear: 0.18, ink: 0.3 },
});

/** 장정 이름 → 0–1 난수열(mulberry32). 같은 이름이면 늘 같은 열. */
function seeded(name) {
  let state = [...name].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Aging({ id, binding, material }) {
  const age = AGING[material];
  const random = seeded(binding);
  const spots = Array.from({ length: age.foxing }, () => ({ cx: 8 + random() * 104, cy: 8 + random() * 152, r: 0.8 + random() * 2.4, o: 0.08 + random() * 0.12 }));
  const corner = 5 + random() * 4;
  return (
    <g pointerEvents="none">
      <rect width="120" height="168" fill={`url(#${id}-toning)`} />
      {spots.map((spot) => <circle key={`${spot.cx.toFixed(1)}-${spot.cy.toFixed(1)}`} cx={spot.cx.toFixed(1)} cy={spot.cy.toFixed(1)} r={spot.r.toFixed(2)} fill="#7a4a1e" opacity={spot.o.toFixed(2)} />)}
      {/* 모서리 닳음 — 앞쪽(오른쪽) 두 모서리가 먼저 닳는다 */}
      <path d={`M120 0h-${corner.toFixed(1)}q${(corner * 0.7).toFixed(1)} ${(corner * 0.3).toFixed(1)} ${corner.toFixed(1)} ${corner.toFixed(1)}z`} fill="#fff" opacity={age.wear} />
      <path d={`M120 168h-${(corner * 0.8).toFixed(1)}q${(corner * 0.55).toFixed(1)} -${(corner * 0.25).toFixed(1)} ${(corner * 0.8).toFixed(1)} -${(corner * 0.8).toFixed(1)}z`} fill="#fff" opacity={age.wear} />
      <rect x="0" y="0" width="120" height=".8" fill="#fff" opacity={age.wear * 0.5} /><rect x="0" y="167.2" width="120" height=".8" fill="#fff" opacity={age.wear * 0.5} />
    </g>
  );
}

/** work: 대조표의 작품({display: {binding, coverTitle, ...}}). 표기가 없거나 장정을 모르면 그리지 않는다. */
export default function FirstEditionCover({ work }) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const display = work?.display;
  const binding = display && Object.hasOwn(FIRST_EDITION_BINDINGS, display.binding) ? display.binding : null;
  if (!binding) return null;
  const tone = FIRST_EDITION_GROUNDS[binding];
  const Draw = DRAW[binding];
  const { material } = FIRST_EDITION_BINDINGS[binding];
  const age = AGING[material];
  // 정의 id — React 트리가 둘 이상인 화면에서도 겹치지 않게 장정 이름을 붙인다.
  const id = `ws-${reactId}-${binding}`;
  return (
    <span className={`fe-cover ${FONT_CLASS}`.trim()} style={{ '--fe-ground': tone.ground }} data-binding={binding} data-material={material} aria-hidden="true">
      <svg className="fe-cover__art" viewBox="0 0 120 168" focusable="false">
        <defs>
          {/* 종이·천 결 — 고운 잡티(세기는 재질) */}
          <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" />
            <feColorMatrix values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${age.grain} 0`} />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          {/* 인쇄 번짐 — 글자·그림 가장자리를 살짝 흔든다(활판·석판 인쇄와 오래된 박) */}
          <filter id={`${id}-ink`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="11" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={age.ink} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* 가장자리 바램 — 가운데는 그대로, 테두리 쪽으로 갈변 */}
          <radialGradient id={`${id}-toning`} cx="50%" cy="48%" r="72%">
            <stop offset=".55" stopColor="#5a3a1a" stopOpacity="0" />
            <stop offset="1" stopColor="#5a3a1a" stopOpacity={age.toning} />
          </radialGradient>
        </defs>
        <rect width="120" height="168" fill={tone.ground} />
        <rect width="120" height="168" fill={tone.ground} filter={`url(#${id}-grain)`} />
        <g filter={`url(#${id}-ink)`}><Draw display={display} tone={tone} id={id} /></g>
        <Aging id={id} binding={binding} material={material} />
      </svg>
    </span>
  );
}
