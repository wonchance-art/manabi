import { Dokdo, East_Sea_Dokdo, GFS_Didot, Gochi_Hand, Goudy_Bookletter_1911, IM_Fell_English, Josefin_Sans, Jost, Kaushan_Script, Kirang_Haerang, Libre_Caslon_Display, Nanum_Myeongjo, Song_Myung, Yellowtail } from 'next/font/google';

// 「초판 장정」 2차 묶음(오너 「원본 책 재구성하는 방식으로 표지 만들기까지 완성」 2026-10-17 KST) — 한국어 7 · 영어 9 · 프랑스어 3.
// 근거(실물 사진·서지 기록)는 docs/literature-pipeline.md §8.7, 키는 lib/firstEditionCover.js. 사람 몸 · 출판사 문장·모노그램 · 캐릭터 그림 ·
// 실존 인물 서명은 그리지 않는다(Le Petit Prince의 왕자 · Moby-Dick 가운데 문장 · Hemingway 서명 · nrf). 좌표 120×168.
// 글꼴은 실물 글자와 나란히 놓고 고른 당시 글꼴의 가장 가까운 공개 글꼴이다(오너 「폰트 구해가면서 적용시켜봐 당시 글꼴로. 원본 대조하면서」 —
// 대조표는 §8.7). 배포 빌드는 저장소 사본(vendor/google-fonts)에서만 글꼴을 읽는다.
const kirang = Kirang_Haerang({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-kirang' }); // 『감자』 굵은 붓
const songMyung = Song_Myung({ display: 'swap', preload: false, weight: '400', variable: '--font-fe-songmyung' }); // 옛 활자 명조 · 『동백꽃』 해서 붓
const eastSea = East_Sea_Dokdo({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-eastsea' }); // 『이상선집』 가는 행서 붓
const dokdo = Dokdo({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-dokdo' }); // 『진달내꽃』 거친 손글씨
const myeongjo = Nanum_Myeongjo({ display: 'swap', preload: false, weight: ['700', '800'], subsets: ['latin'], variable: '--font-fe-myeongjo' }); // 『開闢』 · 문고 활자
const josefin = Josefin_Sans({ display: 'swap', preload: false, weight: ['400', '600'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-fe-josefin' }); // 1940년대 기하 산세리프
const jost = Jost({ display: 'swap', preload: false, weight: '700', subsets: ['latin'], variable: '--font-fe-jost' }); // 굵은 그로테스크
const kaushan = Kaushan_Script({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-kaushan' }); // 붓 필기체 「by」
const yellowtail = Yellowtail({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-yellowtail' }); // 1940년대 붓 필기체(1984)
const gochi = Gochi_Hand({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-gochi' }); // Vanessa Bell 둥근 손글씨
const goudy = Goudy_Bookletter_1911({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-goudy' }); // 1910년대 아츠앤크래프츠 세리프
const fell = IM_Fell_English({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-fell' }); // 손으로 쓴 로만(Le Petit Prince)
const didot = GFS_Didot({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-didot' }); // Gallimard 디도
const caslon = Libre_Caslon_Display({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-caslon' }); // Scribner 1925 고전 세리프
export const SECOND_FONT_CLASS = [kirang, songMyung, eastSea, dokdo, myeongjo, josefin, jost, kaushan, yellowtail, gochi, goudy, fell, didot, caslon].map((font) => font.variable).filter(Boolean).join(' ');

const stack = (variable, family, ...rest) => [`var(${variable}, "${family}")`, `"${family}"`, ...rest].join(', ');
const KIRANG = stack('--font-fe-kirang', 'Kirang Haerang', 'cursive');
const SONGMYUNG = stack('--font-fe-songmyung', 'Song Myung', '"Nanum Myeongjo"', 'serif');
const EASTSEA = stack('--font-fe-eastsea', 'East Sea Dokdo', 'cursive');
const DOKDO = stack('--font-fe-dokdo', 'Dokdo', 'cursive');
const MYEONGJO = stack('--font-fe-myeongjo', 'Nanum Myeongjo', 'serif');
const JOSEFIN = stack('--font-fe-josefin', 'Josefin Sans', 'Futura', 'sans-serif');
const JOST = stack('--font-fe-jost', 'Jost', 'Futura', 'sans-serif');
const KAUSHAN = stack('--font-fe-kaushan', 'Kaushan Script', 'cursive');
const YELLOWTAIL = stack('--font-fe-yellowtail', 'Yellowtail', '"Brush Script MT"', 'cursive');
const GOCHI = stack('--font-fe-gochi', 'Gochi Hand', 'cursive');
const GOUDY = stack('--font-fe-goudy', 'Goudy Bookletter 1911', 'Georgia', 'serif');
const FELL = stack('--font-fe-fell', 'IM Fell English', 'Georgia', 'serif');
const DIDOT = stack('--font-fe-didot', 'GFS Didot', 'Didot', 'serif');
const CASLON = stack('--font-fe-caslon', 'Libre Caslon Display', '"Big Caslon"', 'Georgia', 'serif');
/** 1차 장정(FirstEditionCover)도 같은 당시 글꼴을 쓴다 — Lemerre 엘제비르 활자 · Pagnerre·Marpon 디도. 3차(FirstEditionCoverThird)는 캐즐론·기하 산세리프·붓 필기체도. */
export const PERIOD_FONTS = Object.freeze({ FELL, DIDOT, CASLON, JOSEFIN, YELLOWTAIL });

/** 바탕 색 — 실물 사진에서 잰 값(빛바램은 조금 되돌림). 책은 물건이라 테마를 따라 바뀌지 않는다. */
export const SECOND_GROUNDS = Object.freeze({
  gaebyeok: { ground: '#1f1d1e', ink: '#b4302a', light: '#ece4d6' },
  bakmun: { ground: '#ddd0b2', ink: '#3a3024' },
  dongbaek: { ground: '#d8cfbb', ink: '#1f1c1a' },
  isang: { ground: '#d8c59f', ink: '#6c513e', green: '#647153' },
  gamja: { ground: '#c9785a', ink: '#1d1b22' },
  jindallae: { ground: '#b5a271', ink: '#3f2c1b' },
  jeongeum: { ground: '#a57146', ink: '#3b2e25', label: '#dfd0b6' },
  'secker-diagonal': { ground: '#c9b8a4', ink: '#efe6d6', green: '#5aa66c' },
  'secker-numerals': { ground: '#b4524e', ink: '#f6efe6', pale: '#c6796f' },
  'scribner-blind': { ground: '#2f4a45', ink: '#1a2a26', light: '#4f716a' },
  'scribner-plain': { ground: '#6aa9c2', ink: '#5590a8', light: '#86bdd2' },
  'hogarth-bell': { ground: '#ecc9a0', ink: '#263145' },
  huebsch: { ground: '#4d7292', ink: '#2c4a63', light: '#7095b2' },
  'harper-blind': { ground: '#42352c', ink: '#2e241e', light: '#5a4a3e' },
  'ticknor-arabesque': { ground: '#4a3a2d', ink: '#352a20', light: '#62503f' },
  'egerton-boards': { ground: '#847055', ink: '#6f5d46' },
  'gallimard-blanche': { ground: '#e8ddc6', ink: '#1e1b18', red: '#b3392f' },
  'gallimard-essais': { ground: '#d5d1c7', ink: '#1e1b18', red: '#b3392f' },
  reynal: { ground: '#f1e9d5', ink: '#1b1a18', blue: '#7f8fa0', star: '#efd56b' },
});

export function T({ x, y, size, font, fill, spacing, italic, weight, anchor = 'middle', children, ...rest }) {
  return <text x={x} y={y} fontSize={size} textAnchor={anchor} fill={fill} letterSpacing={spacing} fontStyle={italic ? 'italic' : undefined} fontWeight={weight} style={{ fontFamily: font }} {...rest}>{children}</text>;
}

/** 세로쓰기 — 글자마다 한 줄, 빈칸은 반 칸. */
function V({ x, y, size, step, font, fill, weight, text }) {
  let at = y;
  const out = [];
  [...text].forEach((char, index) => {
    if (char === ' ') { at += step * 0.45; return; }
    out.push(<T key={index} x={x} y={at} size={size} font={font} fill={fill} weight={weight}>{char}</T>);
    at += step;
  });
  return <g>{out}</g>;
}

const rtl = (text) => [...text].reverse().join('');

/** 천 결 무늬 — 고운 평직(rotate 45) · 세로 골(rotate 90). */
export function Weave({ id, color, ribbed = false }) {
  return (
    <>
      <defs>
        <pattern id={`${id}-weave`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform={ribbed ? 'rotate(90)' : 'rotate(45)'}>
          <rect width="3" height="3" fill={color} />
          <path d="M0 .5H3" stroke="#fff" strokeOpacity=".06" strokeWidth=".6" /><path d="M.5 0V3" stroke="#000" strokeOpacity=".08" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="120" height="168" fill={`url(#${id}-weave)`} />
    </>
  );
}

/** 민압(blind stamp) — 판에 눌린 자국: 짙은 글자 + 아래로 반 픽셀 밝은 테. */
export function Blind({ tone, children }) {
  return (
    <g>
      <g transform="translate(0 .45)" fill={tone.light} stroke={tone.light} strokeWidth=".2" opacity=".8">{children}</g>
      <g fill={tone.ink} stroke={tone.ink} strokeWidth=".2">{children}</g>
    </g>
  );
}

// ── 한국어 ──

// 『開闢』 1924 — 검정 바탕 · 위 빨강 판에 흰 음각 제호(가로 오른쪽→왼쪽) · 흰 세로 제목 · 빨강 작가 · 아래 호수.
function Gaebyeok({ display, tone }) {
  return (
    <g lang="ko">
      <rect x="14" y="14" width="92" height="32" fill={tone.ink} />
      <rect x="16.4" y="16.4" width="87.2" height="27.2" fill="none" stroke={tone.light} strokeWidth=".6" />
      <T x={60} y={38.5} size={21} font={MYEONGJO} fill={tone.light} weight="800" spacing="6">{rtl(display.coverImprint)}</T>
      <V x={56} y={68} size={12.5} step={14.5} font={MYEONGJO} fill={tone.light} weight="800" text={display.coverTitle} />
      <V x={84} y={74} size={6.4} step={7.6} font={MYEONGJO} fill={tone.ink} weight="700" text={display.coverAuthor} />
      <path d="M22 148h76" stroke={tone.ink} strokeWidth=".8" />
      <T x={60} y={158} size={5.4} font={MYEONGJO} fill={tone.light} weight="700" spacing="1.2">{rtl(display.coverEdition)}</T>
    </g>
  );
}

// 박문문고 1941 — 문고 관례: 가는 이중 테 · 위 총서 이름 · 세로 제목 · 작가 · 아래 출판사(가로는 오른쪽→왼쪽, 시대 관례).
function Bakmun({ display, tone }) {
  return (
    <g lang="ko">
      <rect x="7" y="7" width="106" height="154" fill="none" stroke={tone.ink} strokeWidth=".9" />
      <rect x="9.6" y="9.6" width="100.8" height="148.8" fill="none" stroke={tone.ink} strokeWidth=".35" />
      {display.coverEdition && <T x={60} y={23} size={6} font={SONGMYUNG} fill={tone.ink} weight="600" spacing="2">{rtl(display.coverEdition)}</T>}
      <path d="M44 28h32" stroke={tone.ink} strokeWidth=".4" />
      <V x={58} y={46} size={10.5} step={11.6} font={SONGMYUNG} fill={tone.ink} weight="700" text={display.coverTitle} />
      <V x={84} y={50} size={6} step={7} font={SONGMYUNG} fill={tone.ink} weight="600" text={display.coverAuthor} />
      <path d="M44 140h32" stroke={tone.ink} strokeWidth=".4" />
      <T x={60} y={151} size={5.4} font={SONGMYUNG} fill={tone.ink} spacing="1.4">{rtl(display.coverImprint)}</T>
    </g>
  );
}

// 『동백꽃』 1938 속표지 — 왼쪽 큰 붓글씨 세로 제목 · 그 위 작은 「短篇集」 · 오른쪽 아래 「金裕貞 著」.
function Dongbaek({ display, tone }) {
  return (
    <g lang="ko">
      <V x={30} y={20} size={7.4} step={8.4} font={SONGMYUNG} fill={tone.ink} weight="600" text={display.coverSubtitle} />
      <V x={46} y={66} size={31} step={31} font={SONGMYUNG} fill={tone.ink} text={display.coverTitle} />
      <V x={86} y={98} size={8.6} step={10.2} font={SONGMYUNG} fill={tone.ink} weight="600" text={display.coverAuthor} />
    </g>
  );
}

// 『이상선집』 1949 — 바랜 크림 종이 얼룩 · 적갈 붓글씨 세로 제목 · 오른쪽에 날아가는 초록 새와 가는 물결선(판 안 제목만 작품 이름).
function Isang({ display, tone }) {
  return (
    <g lang="ko">
      <ellipse cx="90" cy="30" rx="22" ry="14" fill="#a8916a" opacity=".16" /><ellipse cx="24" cy="140" rx="18" ry="24" fill="#a8916a" opacity=".14" />
      <V x={40} y={58} size={36} step={34} font={EASTSEA} fill={tone.ink} text={display.coverTitle} />
      <g fill="none" stroke={tone.green} strokeWidth=".45" opacity=".7">
        <path d="M60 104c8-4 14 4 22 0s14-4 22 0" /><path d="M64 110c8-4 14 4 22 0s12-4 20 0" /><path d="M58 98c6-3 12 2 18 0" />
      </g>
      <path d="M66 84c6-6 12-8 18-6 4-6 10-10 18-10-4 4-8 8-10 13 5 0 9 2 12 5-6-1-11 0-15 3-3 3-8 4-13 3-4 0-7-3-10-8z" fill={tone.green} />
      <circle cx="98" cy="72.6" r=".8" fill="#2c3324" />
    </g>
  );
}

const GAMJA_FLOWERS = [[30, 130, 13], [60, 142, 12], [90, 126, 14], [104, 152, 9]];
// 『감자』 1935 — 주황 종이 · 위·좌·우 먹 덩굴 테 · 큰 붓글씨 세로 제목 · 오른쪽 「金東仁 作」 · 왼쪽 「短篇小說集」 · 아래 먹 꽃과 잎.
function Gamja({ display, tone }) {
  const vine = (path) => <path d={path} fill="none" stroke={tone.ink} strokeWidth="1.4" strokeLinecap="round" />;
  const loops = (points) => points.map(([x, y], index) => <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r="1.5" fill="none" stroke={tone.ink} strokeWidth=".9" />);
  return (
    <g lang="ko">
      {vine(`M8 12${' q4 -4 8 0 t8 0'.repeat(13)}`)}
      {vine(`M9 14${' q-4 4 0 8 t0 8'.repeat(13)}`)}
      {vine(`M111 14${' q4 4 0 8 t0 8'.repeat(13)}`)}
      {loops(Array.from({ length: 13 }, (_, index) => [12 + index * 8, 9]))}
      {loops(Array.from({ length: 12 }, (_, index) => [6, 18 + index * 8]))}
      {loops(Array.from({ length: 12 }, (_, index) => [114, 18 + index * 8]))}
      <V x={72} y={60} size={40} step={40} font={KIRANG} fill={tone.ink} text={display.coverTitle} />
      <V x={96} y={28} size={7.4} step={8.6} font={SONGMYUNG} fill={tone.ink} weight="700" text={display.coverAuthor} />
      <V x={44} y={34} size={7.8} step={9} font={SONGMYUNG} fill={tone.ink} weight="700" text={display.coverSubtitle} />
      <g fill={tone.ink}>
        {[[16, 118, -30], [44, 112, 20], [76, 116, -15], [104, 112, 30], [20, 154, 10], [80, 158, -20], [46, 160, 25]].map(([x, y, angle]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="9" ry="3.4" transform={`rotate(${angle} ${x} ${y})`} />
        ))}
      </g>
      {GAMJA_FLOWERS.map(([cx, cy, r]) => (
        <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
          {[0, 1, 2, 3, 4].map((k) => <ellipse key={k} cx="0" cy={-r * 0.55} rx={r * 0.34} ry={r * 0.52} transform={`rotate(${k * 72})`} fill={tone.ink} stroke={tone.ground} strokeWidth=".5" />)}
          <circle r={r * 0.2} fill={tone.ground} />
        </g>
      ))}
    </g>
  );
}

// 『진달내꽃』 1925(470-4) — 위 짙은 붓띠 안에 밝게 빠진 제목(가로 오른쪽→왼쪽) · 그 아래 「詩集」 · 진달래 가지와 바위 선화 · 아래 짙은 띠.
// 제목은 현대 표기(실물 「진달내ᄭᅩᆺ」의 옛한글은 글꼴·분석이 다루지 못한다 — 본문도 현대어 칸).
function Jindallae({ display, tone }) {
  const flower = (x, y, s) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={tone.ink} strokeWidth=".7">
      {[0, 1, 2, 3, 4].map((k) => <ellipse key={k} cx="0" cy="-3" rx="1.8" ry="3" transform={`rotate(${k * 72})`} />)}
      <path d="M0 0l1.5-4M0 0l-1.4-4.2" />
    </g>
  );
  return (
    <g lang="ko">
      <path d="M10 20c10-3 30 1 48-1s34-2 52 1l-2 8c2 5-1 11 1 17-16 2-34-1-50 1s-34 1-49-1c2-6-1-12 1-18z" fill={tone.ink} />
      <T x={60} y={39} size={19} font={DOKDO} fill={tone.ground} spacing="1">{rtl(display.coverTitle)}</T>
      <T x={36} y={58} size={7} font={SONGMYUNG} fill={tone.ink} weight="600" spacing="1.5">{rtl(display.coverSubtitle)}</T>
      <g fill="none" stroke={tone.ink} strokeWidth=".75" strokeLinecap="round">
        <path d="M22 138c4-18 10-34 14-56M30 112c6-6 10-14 12-22M27 124c-6-6-8-12-8-20M34 96c-5-4-7-9-7-15" />
        <path d="M66 136c-2-12 4-22 14-26 10-4 20 2 24 10 2 6 0 12-4 16zM74 128c4-6 10-8 16-6M80 134c6-2 12-1 16 2M72 118c3-4 8-5 12-4" />
      </g>
      {[[36, 80, 1], [42, 88, 0.85], [27, 82, 0.9], [19, 102, 0.8], [30, 70, 0.8]].map(([x, y, s]) => flower(x, y, s))}
      <path d="M12 146c14-2 30 1 48 0s32-2 48 0l-1 9c-16 2-32-1-48 0s-32 1-47-1z" fill={tone.ink} />
    </g>
  );
}

// 『하늘과 바람과 별과 시』 정음사 1948 — 거친 갈포 결 · 흰 종이 제첨 · 둥근 모서리 테 안 3줄.
function Jeongeum({ display, tone, id }) {
  return (
    <g lang="ko">
      <defs>
        <pattern id={`${id}-burlap`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <rect width="2.4" height="2.4" fill={tone.ground} />
          <path d="M0 .6H2.4M0 1.8H2.4" stroke="#000" strokeOpacity=".12" strokeWidth=".5" /><path d="M.6 0V2.4M1.8 0V2.4" stroke="#fff" strokeOpacity=".08" strokeWidth=".5" />
        </pattern>
      </defs>
      <rect width="120" height="168" fill={`url(#${id}-burlap)`} />
      <rect x="23" y="19" width="76" height="45" fill="#000" opacity=".12" />
      <rect x="22" y="18" width="76" height="45" fill={tone.label} />
      <rect x="26" y="22" width="68" height="37" rx="3" fill="none" stroke={tone.ink} strokeWidth=".5" />
      <T x={60} y={31.5} size={4.6} font={SONGMYUNG} fill={tone.ink} weight="600" spacing=".6">{display.coverSubtitle}</T>
      <T x={60} y={43.5} size={6.3} font={SONGMYUNG} fill={tone.ink} weight="700">{display.coverTitle}</T>
      <T x={60} y={54} size={4.4} font={SONGMYUNG} fill={tone.ink} spacing="1">{display.coverImprint}</T>
    </g>
  );
}

// ── 영어 ──

// Secker & Warburg 1945 — 대각선 두 색 · 크림 기울임 대문자 제목 · 「A FAIRY STORY」 · 필기체 「by」 · 굵은 작가.
function SeckerDiagonal({ display, tone }) {
  const [first, second] = display.coverTitle.toUpperCase().split('\n');
  const slant = (x, y) => `translate(${x} ${y}) skewX(-14)`;
  return (
    <g lang="en">
      <path d="M0 158L120 8V168H0z" fill={tone.green} />
      <g fill={tone.ink} style={{ fontFamily: JOSEFIN }} fontWeight="600" fontStyle="italic">
        <text transform={slant(12, 33)} fontSize="15.5" letterSpacing=".4">{first}</text>
        {second && <text transform={slant(30, 52)} fontSize="15.5" letterSpacing=".4">{second}</text>}
        <text transform={slant(24, 70)} fontSize="6" letterSpacing=".6">{display.coverSubtitle.toUpperCase()}</text>
      </g>
      <T x={78} y={112} size={24} font={KAUSHAN} fill={tone.ink}>by</T>
      <T x={60} y={151} size={7.6} font={JOST} fill={tone.ink} weight="700" spacing=".6">{display.coverAuthor.toUpperCase()}</T>
    </g>
  );
}

// Secker & Warburg 1949 적색 재킷 — 가운데 크고 옅은 세리프 숫자 · 흰 붓 필기체 작가 · 제목 두 줄 · 「a novel」.
function SeckerNumerals({ display, tone }) {
  const [first, second] = display.coverTitle.split('\n');
  return (
    <g lang="en">
      <T x={60} y={118} size={58} font={DIDOT} fill={tone.pale} textLength="108" lengthAdjust="spacingAndGlyphs">{display.coverEdition}</T>
      <T x={60} y={24} size={14} font={YELLOWTAIL} fill={tone.ink}>{display.coverAuthor}</T>
      <T x={60} y={74} size={20} font={YELLOWTAIL} fill={tone.ink}>{first}</T>
      {second && <T x={60} y={102} size={20} font={YELLOWTAIL} fill={tone.ink}>{second}</T>}
      <T x={60} y={152} size={15} font={YELLOWTAIL} fill={tone.ink}>{display.coverSubtitle}</T>
    </g>
  );
}

// Scribner 1925 진녹색 천 — 위 민압 세리프 대문자 제목 두 줄 · 아래 민압 작가.
function ScribnerBlind({ display, tone, id }) {
  const [first, second] = display.coverTitle.toUpperCase().split('\n');
  return (
    <g lang="en">
      <Weave id={id} color={tone.ground} />
      <Blind tone={tone}>
        <T x={60} y={28} size={9.6} font={CASLON} spacing="1.2">{first}</T>
        {second && <T x={60} y={44} size={12.6} font={CASLON} spacing="1.6">{second}</T>}
        <T x={60} y={153} size={5.4} font={CASLON} spacing=".4">{display.coverAuthor}</T>
      </Blind>
    </g>
  );
}

// Scribner 1952 하늘색 천 — 앞면 무지 · 오른쪽 아래 민압 흘림선(실물은 작가 서명 — 실존 인물 서명이라 형태 없는 흘림으로만).
function ScribnerPlain({ tone, id }) {
  return (
    <g>
      <Weave id={id} color={tone.ground} />
      <path d="M68 150c4-6 8-8 10-5s-4 6-1 6 6-8 9-7-2 6 1 6 5-5 8-5 3 3 6 2" fill="none" stroke={tone.ink} strokeWidth=".9" strokeLinecap="round" />
      <path d="M68 150.5c4-6 8-8 10-5" fill="none" stroke={tone.light} strokeWidth=".4" opacity=".6" />
    </g>
  );
}

// Hogarth 1929 재킷(Vanessa Bell) — 버프 · 남흑 한 색 · 손글씨 소문자 제목 · 아치 벽감 안 벽난로 선반과 시계 · 구슬 테 · 술 장식 띠.
function HogarthBell({ display, tone }) {
  const [first, second] = display.coverTitle.split('\n');
  const beads = Array.from({ length: 17 }, (_, index) => {
    const angle = Math.PI - (index * Math.PI) / 16;
    return [60 + Math.cos(angle) * 38.5, 92 - Math.sin(angle) * 38.5];
  });
  return (
    <g lang="en">
      <T x={34} y={23} size={16} font={GOCHI} fill={tone.ink}>{first}</T>
      {second && <T x={64} y={39} size={13} font={GOCHI} fill={tone.ink}>{second}</T>}
      <path d="M17 128V92A43 43 0 0 1 103 92V128Z" fill={tone.ink} />
      {beads.map(([x, y]) => <circle key={`${x.toFixed(1)}`} cx={x.toFixed(2)} cy={y.toFixed(2)} r="1.3" fill={tone.ground} />)}
      <rect x="38" y="112" width="44" height="10" fill={tone.ground} /><rect x="46" y="103" width="28" height="9" fill={tone.ground} />
      <rect x="50" y="122" width="20" height="6" fill={tone.ground} opacity=".9" />
      <circle cx="60" cy="96" r="6" fill={tone.ground} /><circle cx="60" cy="96" r="4.6" fill="none" stroke={tone.ink} strokeWidth=".6" />
      <path d="M60 96V92.6M60 96l2.4 1.2" stroke={tone.ink} strokeWidth=".7" strokeLinecap="round" />
      <rect x="15" y="129" width="90" height="4" fill={tone.ink} />
      {Array.from({ length: 12 }, (_, index) => <circle key={index} cx={19 + index * 7.4} cy="137.4" r="2.6" fill="none" stroke={tone.ink} strokeWidth="1" />)}
      <path d={`M15 143${' q3.75 -2.4 7.5 0 t7.5 0'.repeat(6)}`} fill="none" stroke={tone.ink} strokeWidth="1" />
      <T x={60} y={159} size={14} font={GOCHI} fill={tone.ink}>{display.coverAuthor.toLowerCase()}</T>
    </g>
  );
}

// B. W. Huebsch 1916 청색 천 — 위 민압 혼합 대소문자 세리프 세 줄 · 물결표 · 작가(왼쪽 정렬).
function Huebsch({ display, tone, id }) {
  const lines = display.coverTitle.split('\n');
  return (
    <g lang="en">
      <Weave id={id} color={tone.ground} />
      <Blind tone={tone}>
        {lines.map((line, index) => <T key={line} x={16} y={26 + index * 10.4} size={8} font={GOUDY} anchor="start">{line}</T>)}
        <T x={18} y={26 + lines.length * 10.4 + 1} size={9} font={GOUDY} anchor="start">~</T>
        <T x={16} y={26 + lines.length * 10.4 + 12} size={6.8} font={GOUDY} anchor="start">{display.coverAuthor}</T>
      </Blind>
    </g>
  );
}

// Harper 1851 — 민압 굵은 괘선 테두리와 가는 안쪽 괘선, 네 모서리 작은 꽃. 앞면 글자 없음 · 가운데 출판사 문장은 그리지 않는다.
function HarperBlind({ tone, id }) {
  const corner = (x, y) => <path key={`${x}-${y}`} d={`M${x} ${y - 2.4}l1 1.4 1.4 1-1.4 1-1 1.4-1-1.4-1.4-1 1.4-1z`} />;
  return (
    <g>
      <Weave id={id} color={tone.ground} />
      <Blind tone={tone}>
        <rect x="8" y="8" width="104" height="152" fill="none" strokeWidth="2.2" />
        <rect x="12" y="12" width="96" height="144" fill="none" strokeWidth=".6" />
        {[[12, 12], [108, 12], [12, 156], [108, 156]].map(([x, y]) => corner(x, y))}
      </Blind>
    </g>
  );
}

// Ticknor and Fields 1854 — 세로결 천 · 민압 삼중 괘선 · 네 모서리 꽃장식 · 가운데 큰 아라베스크 마름모. 앞면 글자 없음.
function TicknorArabesque({ tone, id }) {
  const corner = (x, y, sx, sy) => <path key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} d="M0 0c4 0 7 2 8 6-3-1-5 0-6 2-1-3-1-5-2-8zM0 0c0 4 2 7 6 8-1-3 0-5 2-6-3-1-5-1-8-2z" />;
  return (
    <g>
      <Weave id={id} color={tone.ground} ribbed />
      <Blind tone={tone}>
        <rect x="6" y="6" width="108" height="156" fill="none" strokeWidth="1" />
        <rect x="8.6" y="8.6" width="102.8" height="150.8" fill="none" strokeWidth=".45" />
        <rect x="10.4" y="10.4" width="99.2" height="147.2" fill="none" strokeWidth=".45" />
        {corner(11, 11, 1, 1)}{corner(109, 11, -1, 1)}{corner(11, 157, 1, -1)}{corner(109, 157, -1, -1)}
        <path d="M60 50c6 10 18 20 30 34-12 14-24 24-30 34-6-10-18-20-30-34 12-14 24-24 30-34z" fill="none" strokeWidth="1.1" />
        <path d="M60 60c4 7 12 15 20 24-8 9-16 17-20 24-4-7-12-15-20-24 8-9 16-17 20-24z" fill="none" strokeWidth=".6" />
        <path d="M60 70c-6 4-6 10 0 14 6-4 6-10 0-14zM60 84c-6 4-6 10 0 14 6-4 6-10 0-14zM46 84c4-6 10-6 14 0-4 6-10 6-14 0zM60 84c4-6 10-6 14 0-4 6-10 6-14 0z" fill="none" strokeWidth=".6" />
        <circle cx="60" cy="84" r="2.2" />
      </Blind>
    </g>
  );
}

// T. Egerton 1813 원판 보드(drab) — 얼룩진 종이 보드, 앞면 무지(라벨은 책등에만 — 책등은 그리지 않는다).
function EgertonBoards({ tone, id }) {
  return (
    <g>
      <defs>
        <filter id={`${id}-mottle`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="7" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect width="120" height="168" fill={tone.ground} filter={`url(#${id}-mottle)`} />
      <path d="M114 0h6v6zM114 168h6v-6z" fill="#e6dcc8" opacity=".35" />
    </g>
  );
}

// ── 프랑스어 ──

// Gallimard 1942 collection blanche — 크림 · 검정 단선 + 빨강 이중선 테 · 작가 · 빨강 제목 · 「ROMAN」 · 아래 출판사(nrf 모노그램은 그리지 않는다).
function GallimardBlanche({ display, tone }) {
  return (
    <g lang="fr">
      <rect x="7" y="7" width="106" height="154" fill="none" stroke={tone.ink} strokeWidth=".5" />
      <rect x="11" y="11" width="98" height="146" fill="none" stroke={tone.red} strokeWidth=".9" />
      <rect x="12.8" y="12.8" width="94.4" height="142.4" fill="none" stroke={tone.red} strokeWidth=".35" />
      <T x={60} y={34} size={5.4} font={DIDOT} fill={tone.ink} spacing=".9">{display.coverAuthor.toUpperCase()}</T>
      <T x={60} y={51} size={11.6} font={DIDOT} fill={tone.red} stroke={tone.red} strokeWidth=".35" spacing=".4">{display.coverTitle.toUpperCase()}</T>
      <T x={60} y={63} size={4.4} font={DIDOT} fill={tone.ink} spacing="1">{display.coverSubtitle.toUpperCase()}</T>
      <T x={60} y={148} size={5} font={DIDOT} fill={tone.ink} spacing="1">{display.coverImprint.toUpperCase()}</T>
    </g>
  );
}

// Gallimard 1942 「Les Essais」 XII — 레이드지 결 · 빨강 제목 두 줄 · 「PAR ALBERT CAMUS」 · 빨강 총서 · 아래 출판사(목판 문장 · nrf는 그리지 않는다).
function GallimardEssais({ display, tone, id }) {
  const [first, second] = display.coverTitle.toUpperCase().split('\n');
  return (
    <g lang="fr">
      <defs>
        <pattern id={`${id}-laid`} width="4" height="1.3" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.3" fill={tone.ground} /><path d="M0 .3H4" stroke="#000" strokeOpacity=".05" strokeWidth=".3" />
        </pattern>
      </defs>
      <rect width="120" height="168" fill={`url(#${id}-laid)`} />
      <T x={60} y={36} size={11.4} font={DIDOT} fill={tone.red} stroke={tone.red} strokeWidth=".25" spacing=".4">{first}</T>
      {second && <T x={60} y={50} size={11.4} font={DIDOT} fill={tone.red} stroke={tone.red} strokeWidth=".25" spacing=".4">{second}</T>}
      <T x={60} y={60} size={5.2} font={DIDOT} fill={tone.ink} spacing=".6">{`PAR ${display.coverAuthor.toUpperCase()}`}</T>
      <T x={60} y={112} size={5} font={DIDOT} fill={tone.red} spacing=".8">{display.coverEdition.toUpperCase()}</T>
      <T x={60} y={148} size={5.6} font={DIDOT} fill={tone.ink} spacing="1">{display.coverImprint.toUpperCase()}</T>
    </g>
  );
}

const STARS = [[28, 62, 2.6], [88, 56, 2.2], [50, 82, 2], [98, 86, 2.6], [20, 104, 2.2], [72, 106, 2.4], [56, 130, 2], [100, 124, 1.8], [34, 140, 1.8]];
// Reynal & Hitchcock 1943 재킷 배치 — 크림 · 위 청회 대문자 작가 · 검정 제목 · 노란 별들 · 왼쪽 아래 작은 글씨(왕자 그림 · 소행성은 그리지 않는다).
function Reynal({ display, tone }) {
  const star = (cx, cy, r) => {
    const points = Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const radius = index % 2 ? r * 0.45 : r;
      return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
    });
    return <polygon key={`${cx}-${cy}`} points={points.join(' ')} fill={tone.star} stroke="#d4b549" strokeWidth=".3" />;
  };
  return (
    <g lang="fr">
      <T x={60} y={19} size={5} font={JOSEFIN} fill={tone.blue} spacing=".7">{display.coverAuthor.toUpperCase()}</T>
      <T x={60} y={40} size={15} font={FELL} fill={tone.ink}>{display.coverTitle}</T>
      {STARS.map(([cx, cy, r]) => star(cx, cy, r))}
      <T x={14} y={152} size={4} font={FELL} fill={tone.ink} italic anchor="start">{display.coverEdition}</T>
    </g>
  );
}

export const SECOND_DRAW = {
  gaebyeok: Gaebyeok, bakmun: Bakmun, dongbaek: Dongbaek, isang: Isang, gamja: Gamja, jindallae: Jindallae, jeongeum: Jeongeum,
  'secker-diagonal': SeckerDiagonal, 'secker-numerals': SeckerNumerals, 'scribner-blind': ScribnerBlind, 'scribner-plain': ScribnerPlain,
  'hogarth-bell': HogarthBell, huebsch: Huebsch, 'harper-blind': HarperBlind, 'ticknor-arabesque': TicknorArabesque, 'egerton-boards': EgertonBoards,
  'gallimard-blanche': GallimardBlanche, 'gallimard-essais': GallimardEssais, reynal: Reynal,
};
