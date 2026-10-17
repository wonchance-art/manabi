import { EB_Garamond, Noto_Serif_KR } from 'next/font/google';
import { romanYear } from '../../lib/firstEditionCover';
import { Blind, PERIOD_FONTS, T, Weave } from './FirstEditionCoverSecond';

// 「초판 장정」 3차 묶음(오너 「되는 언어로만 ㄱㄱ」 2026-10-17 KST) — 영어 7 · 프랑스어 2 · 한국어 1. 근거(실물 사진·서지 기록)는
// docs/literature-pipeline.md §8.8, 키는 lib/firstEditionCover.js. 좌표 120×168 · 시리즈 공통 원칙(재질 · 낡음 · 경첩)은 FirstEditionCover.
// 18세기 책(1759 · 1776 · 1782 · 1791)은 출판사 표지가 없었다 — 민짜 종이 표지·보드로 팔리고 산 사람이 가죽으로 장정했다. 그 책의 얼굴은
// 속표지(표제지)라 앞면에 속표지를 그린다(레이드지 결 · 글자 줄 · 괘선 · 연도). 출판사 도안(Bell and Daldy 종 · Swan Sonnenschein 문장)과
// 초상(프랭클린 권두 초상 · 베네딕트 사진), 일본 황실 16엽 국화 문장 모양은 그리지 않는다. 18세기 긴 s(ſ)는 읽기 쉽게 보통 s로 쓴다.
const garamond = EB_Garamond({ display: 'swap', preload: false, weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-fe-garamond' }); // Hartmann 1935 「Garamont」 · 18세기 프랑스 이탤릭
const myeongjo = Noto_Serif_KR({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-kr-serif' }); // 1919 보성사 명조 활자(한자 섞어 짜기)
export const THIRD_FONT_CLASS = [garamond, myeongjo].map((font) => font.variable).filter(Boolean).join(' ');

export const GARAMOND = 'var(--font-fe-garamond, "EB Garamond"), "EB Garamond", Garamond, Georgia, serif';
export const KR_SERIF = 'var(--font-fe-kr-serif, "Noto Serif KR"), "Noto Serif KR", "Nanum Myeongjo", serif';
const { CASLON, DIDOT, JOSEFIN, YELLOWTAIL } = PERIOD_FONTS;

/** 바탕 색 — 실물 사진에서 잰 값(빛바램은 조금 되돌림). 책은 물건이라 테마를 따라 바뀌지 않는다. */
export const THIRD_GROUNDS = Object.freeze({
  'buisson-1791': { ground: '#efe6d2', ink: '#2b2620' },
  'parker-1859': { ground: '#4a3a3a', ink: '#382b2b', light: '#5f4d4d' },
  'bell-daldy-1862': { ground: '#6b2a26', ink: '#521e1b', light: '#82413b' },
  'strahan-1776': { ground: '#ede3cc', ink: '#29231c' },
  'millar-1759': { ground: '#eadfc6', ink: '#2a241d' },
  'houghton-1946': { ground: '#4e6658', top: '#2c4842', bottom: '#e09a62', petal: '#e8743a', petalLight: '#f4a27c', steel: '#8fa3b0', hilt: '#6b4a35', ink: '#1d1a17', light: '#f5f2ea' },
  'sonnenschein-1887': { ground: '#5a2b2c', ink: '#431f20', light: '#73403f' },
  'geneve-1782': { ground: '#ebe0c8', ink: '#2a241e' },
  'hartmann-1935': { ground: '#eee7d8', ink: '#1f1d1b', grey: '#3a3a3a', red: '#b5443a' },
  'boseongsa-1919': { ground: '#e9ddbf', ink: '#2a2620' },
});

/** 레이드지 결 — 가는 가로 발 자국 + 성긴 세로 사슬 자국(18세기 손으로 뜬 종이). */
export function Laid({ id, color }) {
  return (
    <>
      <defs>
        <pattern id={`${id}-laid`} width="22" height="1.2" patternUnits="userSpaceOnUse">
          <rect width="22" height="1.2" fill={color} />
          <path d="M0 .3H22" stroke="#000" strokeOpacity=".045" strokeWidth=".25" />
          <path d="M11 0V1.2" stroke="#000" strokeOpacity=".05" strokeWidth=".35" />
        </pattern>
      </defs>
      <rect width="120" height="168" fill={`url(#${id}-laid)`} />
    </>
  );
}

/** 굵은-가는 이중 괘선(속표지 아래 출판지 위 · thick-thin rule). */
export const Rule = ({ y, from = 30, to = 90, ink }) => (
  <g stroke={ink}><path d={`M${from} ${y}H${to}`} strokeWidth=".7" /><path d={`M${from} ${y + 1.3}H${to}`} strokeWidth=".25" /></g>
);

/** 작은 꽃 장식 — 18세기 활자 꽃(fleuron)을 줄인 모양(속표지 목판 도안은 옮기지 않는다). */
export const Fleuron = ({ x, y, ink }) => (
  <g fill={ink} transform={`translate(${x} ${y})`}>
    <path d="M0 -3.2c1.1 1.2 1.1 2.4 0 3.2-1.1-.8-1.1-2 0-3.2z" />
    <path d="M0 0c1.6-1.4 3.4-1.4 4.6 0-1.2 1.2-3 1.2-4.6 0zM0 0c-1.6-1.4-3.4-1.4-4.6 0 1.2 1.2 3 1.2 4.6 0z" />
    <circle cx="0" cy="1.6" r=".7" />
  </g>
);

const compactRoman = (year) => year.replace(/ /gu, ''); // 「MDCCLXXVI」 — 영국 속표지는 띄우지 않는다

/** 판 고정 글자(속표지 원문 그대로 — 화면 라벨이 아니라 그림 속 활자다, copy-standard 영어 라벨 규칙 밖). */
const IMPRINT_TEXT = Object.freeze({
  strahanTitle: 'Formerly Professor of Moral Philosophy in the University of GLASGOW.',
  strahanVolumes: 'IN TWO VOLUMES.',
  millarUniversity: 'University of GLASGOW.',
  millarEdinburgh: 'And A. KINCAID and J. BELL, in EDINBURGH.',
});

// ── 영어 ──

// Buisson 1791 『Mémoires de la vie privée de Benjamin Franklin』 — 자서전의 첫 판(프랑스어 번역)이자 첫 출판. 민짜 종이 표지로 팔렸다(색 기록 없음)
// → 속표지: 넓게 띄운 대문자 다섯 줄 · 이탤릭 두 줄 · 꽃 장식(목판 종려·리라 도안은 줄인 꽃으로) · A PARIS · 출판사 · 이중 괘선 · 연도.
function Buisson1791({ display, tone, id }) {
  const [first, ...rest] = display.coverTitle.toUpperCase().split('\n');
  const [sub1, sub2] = display.coverPartTitle.split('\n');
  return (
    <g lang="fr">
      <Laid id={id} color={tone.ground} />
      <T x={60} y={30} size={10.4} font={DIDOT} fill={tone.ink} spacing="1.8">{first}</T>
      {rest.map((line, index) => <T key={line} x={60} y={40 + index * 7.4} size={index === 1 ? 5.4 : 4.4} font={DIDOT} fill={tone.ink} spacing={index === 1 ? '.5' : '.9'}>{line}</T>)}
      <T x={60} y={77} size={4.2} font={GARAMOND} fill={tone.ink} italic>{sub1}</T>
      {sub2 && <T x={60} y={82.4} size={4.2} font={GARAMOND} fill={tone.ink} italic>{sub2}</T>}
      <Fleuron x={60} y={102} ink={tone.ink} />
      <T x={60} y={124} size={5} font={DIDOT} fill={tone.ink} spacing="1.6">{display.coverPlace.toUpperCase()}</T>
      <T x={60} y={131} size={3.5} font={DIDOT} fill={tone.ink}>{display.coverImprint}</T>
      <Rule y={135.5} from={42} to={78} ink={tone.ink} />
      <T x={60} y={145} size={5.4} font={DIDOT} fill={tone.ink} spacing=".6">{display.coverEdition}</T>
    </g>
  );
}

// John W. Parker and Son 1859 『On Liberty』 — 짙은 초콜릿 갈색 고운 결 천 · 앞면 민압만: 가장자리 5mm 안 세 줄 테 · 그 안 두 줄 판(안쪽 모서리 계단). 글자 없음.
function Parker1859({ tone, id }) {
  const stepped = (inset, step) => {
    const a = inset;
    const b = 120 - inset;
    const c = 168 - inset;
    return `M${a + step} ${a}H${b - step}V${a + step}H${b}V${c - step}H${b - step}V${c}H${a + step}V${c - step}H${a}V${a + step}H${a + step}Z`;
  };
  return (
    <g>
      <Weave id={id} color={tone.ground} />
      <Blind tone={tone}>
        {[5, 6.3, 7.6].map((inset) => <rect key={inset} x={inset} y={inset} width={120 - inset * 2} height={168 - inset * 2} fill="none" strokeWidth=".35" />)}
        <path d={stepped(16, 3)} fill="none" strokeWidth=".55" />
        <path d={stepped(17.6, 3)} fill="none" strokeWidth=".3" />
      </Blind>
    </g>
  );
}

// Bell and Daldy 1862 『The Thoughts of the Emperor M. Aurelius Antoninus』(George Long 역) — 자줏빛 적갈색 알갱이 결 천. 실물 사진(캘리포니아대 소장본)은
// 앞면에 글자도 테도 보이지 않는다 — 같은 출판사 작은 8절판 관례대로 가는 민압 한 줄 테만(확신 낮음 · §8.8).
function BellDaldy1862({ tone, id }) {
  return (
    <g>
      <defs>
        <pattern id={`${id}-pebble`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <rect width="2.4" height="2.4" fill={tone.ground} />
          <circle cx=".7" cy=".8" r=".45" fill="#000" fillOpacity=".09" /><circle cx="1.8" cy="1.8" r=".4" fill="#fff" fillOpacity=".05" />
        </pattern>
      </defs>
      <rect width="120" height="168" fill={`url(#${id}-pebble)`} />
      <Blind tone={tone}><rect x="6.5" y="6.5" width="107" height="155" fill="none" strokeWidth=".4" /></Blind>
    </g>
  );
}

// Strahan & Cadell 1776 『The Wealth of Nations』 1권 — 민짜 보드로 팔린 4절판 → 속표지(캐즐론): AN · 띄운 I N Q U I R Y · 작은 대문자 줄 ·
// 「Nature and Causes」 · WEALTH OF NATIONS · 저자 · 이탤릭 직함 · 권 · 이중 괘선 · 런던 · 출판사 · 연도. 장식 없이 간격만.
function Strahan1776({ display, tone, id }) {
  const year = romanYear(display.coverYear);
  const lines = display.coverTitle.split('\n');
  const style = [
    { y: 25, size: 4.2, spacing: '1.2', upper: true },
    { y: 35, size: 7.6, spacing: '3.4', upper: true },
    { y: 42, size: 3.2, spacing: '1', upper: true },
    { y: 51, size: 6, spacing: '.3', upper: false },
    { y: 58, size: 3.2, spacing: '1', upper: true },
    { y: 67, size: 6.4, spacing: '.9', upper: true },
  ];
  return (
    <g lang="en">
      <Laid id={id} color={tone.ground} />
      {lines.map((line, index) => <T key={line} x={60} y={style[index].y} size={style[index].size} font={CASLON} fill={tone.ink} spacing={style[index].spacing}>{style[index].upper ? line.toUpperCase() : line}</T>)}
      <T x={60} y={79} size={3.6} font={CASLON} fill={tone.ink}>{display.coverAuthor}</T>
      <T x={60} y={84.5} size={2.5} font={GARAMOND} fill={tone.ink} italic>{IMPRINT_TEXT.strahanTitle}</T>
      <T x={60} y={96} size={3.1} font={CASLON} fill={tone.ink} spacing=".8">{IMPRINT_TEXT.strahanVolumes}</T>
      <T x={60} y={102} size={3.4} font={CASLON} fill={tone.ink} spacing=".8">{display.coverTome.toUpperCase()}</T>
      <Rule y={109} from={16} to={104} ink={tone.ink} />
      <T x={60} y={122} size={3.8} font={CASLON} fill={tone.ink} spacing="1.4">{display.coverPlace.toUpperCase()}</T>
      <T x={60} y={128.5} size={2.6} font={CASLON} fill={tone.ink} spacing=".3">{`PRINTED FOR ${display.coverImprint.toUpperCase()}, IN THE STRAND.`}</T>
      <T x={60} y={136} size={3.4} font={CASLON} fill={tone.ink} spacing=".6">{`${compactRoman(year)}.`}</T>
    </g>
  );
}

// A. Millar 1759 『The Theory of Moral Sentiments』 — 민짜 보드로 팔린 8절판 → 속표지(캐즐론): THE · 크게 띄운 THEORY · OF · MORAL SENTIMENTS ·
// 저자·직함 · 꽃 장식(목판 항아리·잎 도안은 줄인 꽃으로) · 런던 · 출판사 두 줄 · 띄운 로마 숫자 연도.
function Millar1759({ display, tone, id }) {
  const year = romanYear(display.coverYear);
  const [the, theory, of, moral] = display.coverTitle.toUpperCase().split('\n');
  return (
    <g lang="en">
      <Laid id={id} color={tone.ground} />
      <T x={60} y={26} size={3.8} font={CASLON} fill={tone.ink} spacing="2.4">{the}</T>
      <T x={60} y={40} size={10.6} font={CASLON} fill={tone.ink} spacing="3">{theory}</T>
      <T x={60} y={48} size={3.4} font={CASLON} fill={tone.ink} spacing="1.6">{of}</T>
      <T x={60} y={57} size={5.4} font={CASLON} fill={tone.ink} spacing=".7">{moral}</T>
      <path d="M50 63H70" stroke={tone.ink} strokeWidth=".3" />
      <T x={60} y={71} size={4} font={CASLON} fill={tone.ink} spacing=".5">{display.coverAuthor.toUpperCase()}</T>
      <T x={60} y={77.5} size={3} font={CASLON} fill={tone.ink}>{`${display.coverSubtitle} in the`}</T>
      <T x={60} y={82} size={3} font={CASLON} fill={tone.ink}>{IMPRINT_TEXT.millarUniversity}</T>
      <Fleuron x={60} y={102} ink={tone.ink} />
      <T x={60} y={121} size={4.2} font={CASLON} fill={tone.ink} spacing="1.4">{display.coverPlace.toUpperCase()}</T>
      <T x={60} y={127.5} size={2.9} font={CASLON} fill={tone.ink}>{`${display.coverImprint}, in the STRAND;`}</T>
      <T x={60} y={132} size={2.9} font={CASLON} fill={tone.ink}>{IMPRINT_TEXT.millarEdinburgh}</T>
      <T x={60} y={140} size={3.6} font={CASLON} fill={tone.ink} spacing=".5">{`${year}.`}</T>
    </g>
  );
}

// 꽃잎 — 씨앗 고정 의사 난수(같은 표지는 늘 같게). 국화는 원근으로 기운 헝클어진 꽃이다 — 대칭 16엽 원판(황실 문장) 모양이 되지 않게
// 꽃잎 수·길이·각도를 고르지 않게 흩는다.
function petals(cx, cy, count) {
  let seed = 1946;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const angle = rand() * Math.PI * 2;
    const length = 12 + rand() * 17;
    const bend = (rand() - 0.5) * 6;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length * 0.72; // 원근 — 위에서 비스듬히 본 꽃
    const mx = cx + dx * 0.5 - Math.sin(angle) * bend;
    const my = cy + dy * 0.5 + Math.cos(angle) * bend;
    out.push({ d: `M${cx.toFixed(1)} ${cy.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${(cx + dx).toFixed(1)} ${(cy + dy).toFixed(1)}`, light: rand() > 0.62, width: 1.4 + rand() * 1.6 });
  }
  return out;
}
const PETALS = petals(38, 38, 96);

// Houghton Mifflin 1946 『The Chrysanthemum and the Sword』 재킷 — 위 짙은 청록에서 아래 복숭아빛으로 · 왼쪽 위 헝클어진 주황 국화를 칼(카타나)이
// 비스듬히 지난다 · 흰 손글씨 제목(필기체 「The」 「and the」 + 좁고 획 대비 큰 「Chrysanthemum」 「Sword」) · 기하 산세리프 소개 글 · 로만 대문자 작가.
function Houghton1946({ display, tone, id }) {
  const [the, flower, rest] = display.coverTitle.split('\n');
  const cut = rest.lastIndexOf(' ');
  const [andThe, sword] = [rest.slice(0, cut), rest.slice(cut + 1)];
  return (
    <g lang="en">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone.top} /><stop offset=".55" stopColor={tone.ground} /><stop offset="1" stopColor={tone.bottom} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}><stop offset="0" stopColor={tone.petalLight} stopOpacity=".55" /><stop offset="1" stopColor={tone.petalLight} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="120" height="168" fill={`url(#${id}-sky)`} />
      <ellipse cx="38" cy="38" rx="36" ry="29" fill={`url(#${id}-glow)`} />
      <ellipse cx="38" cy="38" rx="9" ry="6.5" fill={tone.petal} />
      <g fill="none" strokeLinecap="round">
        {PETALS.map((petal, index) => <path key={index} d={petal.d} stroke={petal.light ? tone.petalLight : tone.petal} strokeWidth={petal.width} />)}
      </g>
      {/* 칼 — 날은 왼쪽 아래에서 꽃을 지나 오른쪽 위로, 둥근 날밑과 감은 손잡이 */}
      <path d="M4 66Q44 50 79 30.5" fill="none" stroke={tone.steel} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4.4 66.6Q44 50.6 79 31.2" fill="none" stroke="#dfe7ec" strokeWidth=".4" />
      <ellipse cx="80" cy="30.2" rx="1.4" ry="3.2" transform="rotate(-21 80 30.2)" fill="#1f2422" />
      <path d="M81.4 29.6L104 21" stroke={tone.hilt} strokeWidth="2.2" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((step) => <path key={step} d={`M${84 + step * 4} ${28.3 - step * 1.53}l1.6 1.4M${84 + step * 4} ${29.7 - step * 1.53}l1.6-1.4`} stroke="#d8c7a6" strokeWidth=".35" />)}
      <T x={95} y={72} size={12} font={YELLOWTAIL} fill={tone.light}>{the}</T>
      <g transform="translate(60 92) scale(.6 1)"><T x={0} y={0} size={24} font={DIDOT} fill={tone.light}>{flower}</T></g>
      <T x={27} y={108} size={8.6} font={YELLOWTAIL} fill={tone.light}>{andThe}</T>
      <g transform="translate(80 111) scale(.72 1)"><T x={0} y={0} size={22} font={DIDOT} fill={tone.light}>{sword}</T></g>
      {['An investigation of the pattern of Japanese', 'culture which suggests a program for new under-', 'standing among nations.'].map((line, index) => (
        <T key={line} x={10} y={124 + index * 4.6} size={3.4} font={JOSEFIN} fill={tone.ink} anchor="start">{line}</T>
      ))}
      <T x={60} y={152} size={7.4} font={CASLON} fill={tone.ink} spacing="1.3">{display.coverAuthor.toUpperCase()}</T>
    </g>
  );
}

// Swan Sonnenschein, Lowrey & Co. 1887 『Capital』(무어·에이블링 역 영어 첫 판) — 적갈색 고운 결 천 · 앞면 민압만: 가장자리 두 줄 테 · 12mm 안 두 줄 판.
// 글자 없음(책등 금박만 — 책등은 그리지 않는다) · 속표지 출판사 문장은 그리지 않는다.
function Sonnenschein1887({ tone, id }) {
  return (
    <g>
      <Weave id={id} color={tone.ground} />
      <Blind tone={tone}>
        <rect x="5" y="5" width="110" height="158" fill="none" strokeWidth=".6" />
        <rect x="6.6" y="6.6" width="106.8" height="154.8" fill="none" strokeWidth=".3" />
        <rect x="17" y="17" width="86" height="134" fill="none" strokeWidth=".55" />
        <rect x="18.6" y="18.6" width="82.8" height="130.8" fill="none" strokeWidth=".3" />
      </Blind>
    </g>
  );
}

// ── 프랑스어 ──

// 제네바 1782 『Les Confessions … suivies des Rêveries du promeneur solitaire』 8절판(몽상의 첫 판 — 2권 끝) → 속표지: 이탤릭 대문자 LES ·
// CONFESSIONS · DE · 그림자 장식 대문자 J. J. ROUSSEAU · 이탤릭 Suivies · DES RÊVERIES · Du Promeneur Solitaire · 권 · 꽃 · A GENEVE · 장식 괘선 · 연도.
function Geneve1782({ display, tone, id }) {
  const year = romanYear(display.coverYear);
  const [les, confessions, de, author] = display.coverTitle.split('\n');
  const [suivies, reveries] = display.coverPartTitle.split('\n');
  return (
    <g lang="fr">
      <Laid id={id} color={tone.ground} />
      <T x={60} y={24} size={4.6} font={GARAMOND} fill={tone.ink} italic spacing="1.8">{les.toUpperCase()}</T>
      <T x={60} y={37} size={9.4} font={DIDOT} fill={tone.ink} spacing=".5">{confessions.toUpperCase()}</T>
      <T x={60} y={45} size={3.4} font={DIDOT} fill={tone.ink} spacing="1">{de.toUpperCase()}</T>
      {/* 그림자(음영) 장식 대문자 — 속이 빈 글자 + 오른쪽 아래 그림자 */}
      <T x={60.5} y={56.5} size={7.2} font={DIDOT} fill={tone.ink} spacing=".6">{author.toUpperCase()}</T>
      <T x={60} y={56} size={7.2} font={DIDOT} fill={tone.ground} stroke={tone.ink} strokeWidth=".3" spacing=".6">{author.toUpperCase()}</T>
      <T x={60} y={65} size={4.4} font={GARAMOND} fill={tone.ink} italic>{suivies}</T>
      <T x={60} y={75} size={6.4} font={DIDOT} fill={tone.ink} spacing="1">{reveries.toUpperCase()}</T>
      <T x={60} y={84} size={5} font={DIDOT} fill={tone.ink}>{display.coverSubtitle}</T>
      <T x={60} y={97} size={3.9} font={DIDOT} fill={tone.ink} spacing="1">{display.coverTome.toUpperCase()}</T>
      <Fleuron x={60} y={110} ink={tone.ink} />
      <T x={60} y={128} size={4.4} font={GARAMOND} fill={tone.ink} italic spacing=".8">{display.coverPlace.toUpperCase()}</T>
      <g fill={tone.ink}>{Array.from({ length: 15 }, (_, index) => <path key={index} d={`M${39 + index * 3} 133.2l1 -1 1 1 -1 1z`} />)}</g>
      <T x={60} y={142} size={4} font={DIDOT} fill={tone.ink} spacing=".5">{`${year.split(' ').join('. ')}.`}</T>
    </g>
  );
}

// Paul Hartmann 1935 『Poèmes français』(「Poèmes dédiés aux amis français」 수록) — 크림 종이 표지 · 테 없음 · 두 색(검정·빨강) 가라몽 대문자 가운데:
// 작가 · 빨강 제목 두 줄 · 실린 시집 네 줄 · 큰 빈칸 · 연도 · 빨강 출판사 · 주소.
function Hartmann1935({ display, tone }) {
  const year = romanYear(display.coverYear);
  const [poemes, francais] = display.coverTitle.toUpperCase().split('\n');
  return (
    <g lang="fr">
      <T x={60} y={30} size={3.4} font={GARAMOND} fill={tone.grey} spacing="1.5">{display.coverAuthor.toUpperCase()}</T>
      <T x={60} y={45} size={8.6} font={GARAMOND} fill={tone.red} spacing="2.6">{poemes}</T>
      <T x={60} y={55} size={8.6} font={GARAMOND} fill={tone.red} spacing="2.6">{francais}</T>
      {['VERGERS, LES ROSES', 'LES FENÊTRES', 'CARNET DE POCHE', 'POÈMES ÉPARS'].map((line, index) => (
        <T key={line} x={60} y={66 + index * 4.6} size={3} font={GARAMOND} fill={tone.ink} spacing="1">{line}</T>
      ))}
      <T x={60} y={128} size={3.1} font={GARAMOND} fill={tone.ink} spacing="1.2">{compactRoman(year)}</T>
      <T x={60} y={134} size={3.3} font={GARAMOND} fill={tone.red} spacing="1">{display.coverImprint.toUpperCase()}</T>
      <T x={60} y={139} size={2.5} font={GARAMOND} fill={tone.ink} spacing=".8">{display.coverEdition.toUpperCase()}</T>
    </g>
  );
}

// ── 한국어 ──

// 1919 보성사 인쇄 『宣言書』(기미독립선언서) — 가로 긴 한 장(20.5×45.8cm)이라 책 표지 비율에는 오른쪽 첫머리만 담는다: 오른쪽 끝 큰 「宣言書」,
// 그 왼쪽으로 본문 세로줄이 오른쪽→왼쪽. 본문은 우리가 싣는 1919 원문 첫머리 그대로(띄어쓰기 없이 활자처럼 빽빽이 — 보성사판의 오식 「我鮮朝」는
// 정본 글자 「我朝鮮」으로 쓴다).
const DECLARATION_OPENING = '吾等은玆에我朝鮮의獨立國임과朝鮮人의自主民임을宣言하노라此로써世界萬邦에告하야人類平等의大義를克明하며此로써子孫萬代에誥하야民族自存의正權을永有케하노라.半萬年歷史의權威를仗하야此를宣言함이며二千萬民衆의誠忠을合하야此를佈明함이며民族의恒久如一한自由發展을爲하야此를主張함이며人類的良心의發露에基因한世界改造의大機運에順應幷進하기爲하야此를提起함이니是ㅣ天의明命이며時代의大勢ㅣ며全人類共存同生權의正當한發動이라天下何物이던지此를沮止抑制치못할지니라.舊時代의遺物인侵略主義强權主義의犧牲을作하야有史以來累千年에처음으로異民族箝制의痛苦를';
const COLUMN = 26;
function Boseongsa1919({ display, tone }) {
  const chars = [...DECLARATION_OPENING];
  const columns = Array.from({ length: Math.ceil(chars.length / COLUMN) }, (_, index) => chars.slice(index * COLUMN, (index + 1) * COLUMN).join(''));
  const vertical = { writingMode: 'vertical-rl', fontFamily: KR_SERIF };
  return (
    <g lang="ko">
      <text x={106} y={22} fontSize={9.2} letterSpacing={3.2} fill={tone.ink} style={vertical}>{display.coverTitle}</text>
      {columns.map((column, index) => (
        <text key={index} x={93.5 - index * 7.4} y={14} fontSize={5.1} letterSpacing={.28} fill={tone.ink} style={vertical}>{column}</text>
      ))}
    </g>
  );
}

export const THIRD_DRAW = {
  'buisson-1791': Buisson1791, 'parker-1859': Parker1859, 'bell-daldy-1862': BellDaldy1862, 'strahan-1776': Strahan1776, 'millar-1759': Millar1759,
  'houghton-1946': Houghton1946, 'sonnenschein-1887': Sonnenschein1887, 'geneve-1782': Geneve1782, 'hartmann-1935': Hartmann1935, 'boseongsa-1919': Boseongsa1919,
};
