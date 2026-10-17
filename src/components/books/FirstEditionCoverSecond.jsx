import { Black_Han_Sans, Dela_Gothic_One, GFS_Didot, Gochi_Hand, Goudy_Bookletter_1911, IM_Fell_English, Josefin_Sans, Jost, Kaushan_Script, Libre_Caslon_Display, Nanum_Myeongjo, Shippori_Mincho_B1, Song_Myung, Yellowtail, Yuji_Syuku } from 'next/font/google';

// 「초판 장정」 2차 묶음(오너 「원본 책 재구성하는 방식으로 표지 만들기까지 완성」 2026-10-17 KST) — 한국어 7 · 영어 9 · 프랑스어 3.
// 근거(실물 사진·서지 기록)는 docs/literature-pipeline.md §8.7, 키는 lib/firstEditionCover.js. 사람 몸 · 출판사 문장·모노그램 · 캐릭터 그림 ·
// 실존 인물 서명은 그리지 않는다(Le Petit Prince의 왕자 · Moby-Dick 가운데 문장 · Hemingway 서명 · nrf). 좌표 120×168.
// 글꼴은 실물 글자와 나란히 놓고 고른 당시 글꼴의 가장 가까운 공개 글꼴이다(오너 「폰트 구해가면서 적용시켜봐 당시 글꼴로. 원본 대조하면서」 —
// 대조표는 §8.7). 배포 빌드는 저장소 사본(vendor/google-fonts)에서만 글꼴을 읽는다.
const songMyung = Song_Myung({ display: 'swap', preload: false, weight: '400', variable: '--font-fe-songmyung' }); // 해서 붓 — 『동백꽃』 · 『감자』 제목(굵기 하나 — weight를 주지 않는다)
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
// 근대 한국 책(오너 「근대 작품들 살펴보고 폰트 새로 적용. 현재는 너무 모던함」 2026-10-17 KST) — 한글과 한자를 따로 고른다.
// 한글 표지 글꼴(송명 · 나눔명조 · 독도 …)에는 한자가 없어 金裕貞 著 · 詩集 · 開闢이 기기마다 다른 시스템 글꼴로 그려졌다(실측).
// 한자는 쓰키지 활판 5호 명조(Shippori Mincho B1 — 당시 조선 인쇄소도 한자 활자는 일본에서 들여왔다), 붓 한자는 해서 붓(Yuji Syuku),
// 1950년대 도안 글자는 Black Han Sans. 한글 활자는 조선100년체(1920년대 조선일보 활자 복원 — 원본 그대로 public/fonts, first-edition-cover.css).
const shippori = Shippori_Mincho_B1({ display: 'swap', preload: false, weight: ['500', '800'], subsets: ['latin'], variable: '--font-fe-shippori' }); // 800 — 1925 『진달내ᄭᅩᆺ』 굵은 활자
const yuji = Yuji_Syuku({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-yuji' });
const blackHan = Black_Han_Sans({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-blackhan' });
const dela = Dela_Gothic_One({ display: 'swap', preload: false, weight: '400', subsets: ['latin'], variable: '--font-fe-dela' }); // 굵은 고딕 한자(Black Han Sans에는 한자가 없다)
export const SECOND_FONT_CLASS = [songMyung, myeongjo, josefin, jost, kaushan, yellowtail, gochi, goudy, fell, didot, caslon, shippori, yuji, blackHan, dela].map((font) => font.variable).filter(Boolean).join(' ');

const stack = (variable, family, ...rest) => [`var(${variable}, "${family}")`, `"${family}"`, ...rest].join(', ');
/** 한자 — 한글 글꼴 뒤에 둔다(한글 글꼴에 한자가 없으면 글자마다 이 글꼴로 내려온다). */
const HANJA = stack('--font-fe-shippori', 'Shippori Mincho B1', 'serif');
const BRUSH_HANJA = stack('--font-fe-yuji', 'Yuji Syuku', HANJA);
/** 근대 한글 활자 — 조선100년체(한자 없음 → HANJA). @font-face는 first-edition-cover.css(원본 TTF 그대로). */
export const KO_PRINT = `"Chosun Centennial", ${HANJA}`;
const SONGMYUNG = stack('--font-fe-songmyung', 'Song Myung', HANJA);
const MYEONGJO = stack('--font-fe-myeongjo', 'Nanum Myeongjo', HANJA);
const HEAVY = stack('--font-fe-blackhan', 'Black Han Sans', stack('--font-fe-dela', 'Dela Gothic One', HANJA)); // 한자(詩)는 같은 굵은 고딕으로
/** 옛한글 조합(ᄭᅩᆺ)이 되는 굵은 명조 — Noto Serif KR wght 700 제목 사본(first-edition-cover.css · public/fonts/manabi-old-hangul). Google Fonts 조각 파일은
 * 자모가 갈려 조합이 깨지고, 조선100년체 · 재민체는 옛한글 자모를 조합하지 못한다(실측). 굵기는 오너 대조 사진의 1925 활자에 맞췄다. */
const OLD_HANGUL = `"Manabi Old Hangul Title", ${HANJA}`;
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
  dongbaek: { ground: '#cdc5a6', ink: '#383d45', red: '#d6604f', pale: '#e2dbc3' },
  isang: { ground: '#dccaa2', ink: '#6a3122', green: '#37452f' },
  gamja: { ground: '#c9785a', ink: '#1d1b22' },
  jindallae: { ground: '#def0cb', ink: '#0d100c', band: '#ecc485' },
  'jeongeum-1955': { ground: '#ae9a6b', ink: '#0a150a', teal: '#2a5953' },
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
/** 오른쪽→왼쪽 가로쓰기 — 글자(자소 묶음) 단위로 뒤집는다(옛한글 ᄭᅩᆺ은 자모 셋이 한 글자). */
const rtlGraphemes = (text) => [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].map((part) => part.segment).reverse();

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
      <V x={56} y={68} size={12.5} step={14.5} font={KO_PRINT} fill={tone.light} text={display.coverTitle} />{/* 한글만 근대 활자(오너 「운수 좋은 날은 한글만 더 옛날 글꼴로」) */}
      <V x={84} y={74} size={6.4} step={7.6} font={MYEONGJO} fill={tone.ink} weight="700" text={display.coverAuthor} />
      <path d="M22 148h76" stroke={tone.ink} strokeWidth=".8" />
      <T x={60} y={158} size={5.4} font={MYEONGJO} fill={tone.light} weight="700" spacing="1.2">{rtl(display.coverEdition)}</T>
    </g>
  );
}

// 박문문고 1941 — 문고 관례: 가는 이중 테 · 위 총서 이름 · 세로 제목 · 작가 · 아래 출판사(가로는 오른쪽→왼쪽, 시대 관례). 문고는 납활자 — 한글 조선100년체 · 한자 쓰키지 명조.
function Bakmun({ display, tone }) {
  return (
    <g lang="ko">
      <rect x="7" y="7" width="106" height="154" fill="none" stroke={tone.ink} strokeWidth=".9" />
      <rect x="9.6" y="9.6" width="100.8" height="148.8" fill="none" stroke={tone.ink} strokeWidth=".35" />
      {display.coverEdition && <T x={60} y={23} size={6} font={HANJA} fill={tone.ink} spacing="2">{rtl(display.coverEdition)}</T>}
      <path d="M44 28h32" stroke={tone.ink} strokeWidth=".4" />
      <V x={58} y={46} size={10.5} step={11.6} font={KO_PRINT} fill={tone.ink} text={display.coverTitle} />
      <V x={84} y={50} size={6} step={7} font={HANJA} fill={tone.ink} text={display.coverAuthor} />
      <path d="M44 140h32" stroke={tone.ink} strokeWidth=".4" />
      <T x={60} y={151} size={5.4} font={HANJA} fill={tone.ink} spacing="1.4">{rtl(display.coverImprint)}</T>
    </g>
  );
}

// 『동백꽃』 붉은 동백 판(오너 사진) — 회베이지 종이(밝은 얼룩) · 왼쪽 위 붓 세로 제목(먹빛) · 위 작은 동백 한 송이와 오른쪽 위로 뻗는 잎 ·
// 아래 큰 동백과 둘레 잎 · 왼쪽 아래 떨어진 꽃잎. 꽃잎 · 잎은 스텐실처럼 바탕색 틈(잎맥 · 꽃잎 사이)이 남는다.
const CAMELLIA_LEAVES = [
  [66, 30, -55, 1.35], [78, 20, -25, 1.45], [94, 22, 0, 1.4], [104, 40, 30, 1.3], [86, 50, 60, 1.25], [100, 8, -50, 1.1],
  [46, 116, -155, 1.45], [54, 96, -115, 1.4], [74, 88, -82, 1.55], [96, 94, -45, 1.5], [104, 118, -5, 1.4], [100, 144, 35, 1.45], [82, 154, 75, 1.2], [46, 142, 168, 1.3],
];
function Dongbaek({ display, tone }) {
  const leaf = ([x, y, angle, scale]) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <path d="M0 0C4-4.4 11-4.6 17 0C11 4.6 4 4.4 0 0z" fill={tone.ink} />
      <path d="M1.6 0H15" stroke={tone.ground} strokeWidth=".45" strokeLinecap="round" />
    </g>
  );
  const camellia = (cx, cy, r) => (
    <g transform={`translate(${cx} ${cy})`}>
      {[0, 1, 2, 3, 4].map((k) => <ellipse key={k} cx="0" cy={-r * 0.5} rx={r * 0.56} ry={r * 0.6} transform={`rotate(${k * 72 + 12})`} fill={tone.red} stroke={tone.pale} strokeWidth=".7" />)}
      <circle r={r * 0.3} fill="#c4b67c" stroke={tone.pale} strokeWidth=".5" />
    </g>
  );
  return (
    <g lang="ko">
      <ellipse cx="34" cy="96" rx="26" ry="42" fill={tone.pale} opacity=".45" /><ellipse cx="94" cy="78" rx="24" ry="13" fill={tone.pale} opacity=".35" />
      <path d="M58 40C70 30 86 22 116 14M70 120C84 110 98 106 116 110" fill="none" stroke={tone.ink} strokeWidth=".9" strokeLinecap="round" />
      {CAMELLIA_LEAVES.map(leaf)}
      {camellia(56, 40, 13)}
      {camellia(74, 124, 21)}
      <ellipse cx="26" cy="152" rx="7" ry="4" transform="rotate(-12 26 152)" fill={tone.red} stroke={tone.pale} strokeWidth=".5" />
      <V x={22} y={24} size={14} step={15.5} font={SONGMYUNG} fill={tone.ink} text={display.coverTitle} />
    </g>
  );
}

// 『이상선집』 백양당 1949 — 바랜 크림 종이 얼룩 · 왼쪽에 위에서 아래로 큰 붓 한자 「李箱選集」(적갈) · 오른쪽 아래 짙은 초록 새(머리는 왼쪽,
// 날개는 오른쪽 위로 펼침) · 새 왼쪽과 아래로 빠르게 그은 빗금(날아가는 자국).
const ISANG_HATCH = [[50, 113, 16], [48, 118, 20], [52, 123, 14], [54, 128, 18], [60, 134, 12], [66, 142, 24], [74, 148, 18], [58, 108, 9]];
function Isang({ display, tone }) {
  return (
    <g lang="ko">
      <ellipse cx="92" cy="30" rx="22" ry="14" fill="#a8916a" opacity=".16" /><ellipse cx="96" cy="150" rx="18" ry="14" fill="#a8916a" opacity=".12" />
      <V x={30} y={32} size={28} step={35} font={BRUSH_HANJA} fill={tone.ink} text={display.coverTitle} />
      <g stroke={tone.green} strokeWidth=".5" strokeLinecap="round" opacity=".85">
        {ISANG_HATCH.map(([x, y, width]) => <path key={`${x}-${y}`} d={`M${x} ${y}h${width}`} />)}
      </g>
      <g fill={tone.green}>
        <path d="M70 120c3-4 8-5 12-3 6-7 15-13 30-17-6 5-10 10-13 15 7-1 11 0 15 2-7 1-12 3-16 8 2 4 2 10 0 15-3-4-7-6-12-7-4 1-10 0-14-3-1-3 0-7 3-10z" />
        <path d="M68 121l-7-2.4 7-.9z" />
        <path d="M84 128c2 6 7 11 5 20-4-5-7-10-7-16z" />
      </g>
      <circle cx="74" cy="118.4" r=".75" fill={tone.ground} />
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
      <V x={72} y={60} size={40} step={40} font={SONGMYUNG} fill={tone.ink} text={display.coverTitle} />{/* 굵은 붓 — 기랑해랑(현대 마커)에서 해서 붓으로 */}
      <V x={96} y={28} size={7.4} step={8.6} font={HANJA} fill={tone.ink} text={display.coverAuthor} />
      <V x={44} y={34} size={7.8} step={9} font={HANJA} fill={tone.ink} text={display.coverSubtitle} />
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

// 『진달내ᄭᅩᆺ』 1925 중앙서림 총판본(470-1) — 연초록 종이 · 오른쪽 책등 쪽 주황 띠 · 활자만, 가로는 오른쪽→왼쪽: 작은 「金素月詩集」과 그 아래 짧은 줄 ·
// 큰 「진달내ᄭᅩᆺ」(글자 사이 넓게) · 제목 아래 굵은 줄 · 맨 아래 「—1925—」. 옛한글 ᄭᅩᆺ은 조합되는 명조로(OLD_HANGUL).
// 판 배치 · 색은 오너가 준 대조 사진(중앙서림본 복각 표지)에서 잰 값(2026-10-17 KST) — 글자는 띠를 뺀 초록 면 가운데(x≈56)에 선다.
// 색은 공통 낡음을 거친 렌더가 사진(바탕 #d3e4c0 · 띠 #e3bb7e)과 같도록 그만큼 밝게 둔다.
const JINDALLAE = Object.freeze({
  band: 105.1, // 오른쪽 띠(책등 쪽 종이)의 왼쪽 끝
  subtitle: { center: 56.2, step: 7.07, base: 35.34, size: 5.56 }, subRule: 'M37 37.05h38.6',
  title: { center: 56.3, step: 16.05, base: 50.4, size: 10.3 }, rule: 'M21.6 53.5h68.6',
  edition: { center: 57.45, step: 5.85, base: 136.3, size: 4.34 },
});
function Jindallae({ display, tone }) {
  const L = JINDALLAE;
  const row = (chars, { center, step, base, size }, font, key, weight) => chars.map((char, index) => (
    <T key={`${key}${index}`} x={center + (index - (chars.length - 1) / 2) * step} y={base} size={size} font={font} fill={tone.ink} weight={weight}>{char}</T>
  ));
  return (
    <g lang="ko">
      {row([...rtl(display.coverSubtitle)], L.subtitle, HANJA, 's', 800)}
      <path d={L.subRule} stroke={tone.ink} strokeWidth=".6" />
      {/* 글자 사이를 letterSpacing으로 벌리면 옛한글 자모(ᄭ · ᅩ · ᆺ) 사이에도 틈이 생겨 조합이 깨진다 — 글자마다 자리를 준다 */}
      {row(rtlGraphemes(display.coverTitle), L.title, OLD_HANGUL, 't')}
      <path d={L.rule} stroke={tone.ink} strokeWidth="1" />
      {row([...display.coverEdition], L.edition, HANJA, 'e', 800)}
    </g>
  );
}

// 『하늘과 바람과 별과 詩』 정음사 1955 증보판 — 황토색 종이 · 왼쪽 위에서 아래로 굵은 도안 글자 세로 제목. 낱말은 크게(가로가 조금 넓은 납작한 글자),
// 「과」는 작게 앞 글자 오른쪽 아래에 오른쪽 맞춤으로 붙는다 · 「詩」도 같은 굵은 고딕 · 아래 가로로 청록 명조 「尹東柱 詩集」(尹 東 柱는 넓게, 詩集은 붙여).
// 손으로 그린 도안 글자라 간격이 고르지 않아, 글자 칸(먹 상자 [위, 아래, 왼쪽, 오른쪽])은 오너가 준 대조 사진(2026-10-17 KST)에서 글자마다 잰 값을
// 그대로 쓴다(사진 너비 = 판 너비, 세로 비율 그대로 — 판보다 긴 사진 아래 끝 8은 그림뿐이라 잘린다).
// 표지 그림(학 · 붉은 꽃 · 색 면)은 김환기 작품이라 그리지 않는다 — 글자 자리만 실물대로.
// 오른쪽 끝은 한 줄(오너 「오른쪽 끝이 일렬 재서 깔끔하게」) — 사진에서 잰 칸의 오른쪽 끝(26.7–27.6, 손 도안이라 고르지 않다)을 평균 27.2에
// 모으고, 글자마다 잰 폭 · 위아래는 그대로 둔다.
const JEONGEUM_RIGHT = 27.2;
// [위, 아래, 폭, 먹 보정] — 먹 보정은 글리프마다 먹의 오른쪽 끝이 칸 오른쪽에서 벗어나는 만큼(렌더 실측: 하 · 바 · 람의 ㅏ 획은 나오고 늘 · 별은 들어간다).
const JEONGEUM_BOXES = Object.freeze([
  [7.5, 20.7, 16.8, -1], [22.2, 36.6, 17.4, 0.4], [37.5, 44.1, 7.5, -0.4], [45.6, 57.9, 16.5, -0.8], [60.6, 74.4, 16.8, -1],
  [76.5, 82.8, 7.2, -0.4], [84.3, 98.4, 16.5, 0.6], [100.5, 107.7, 6.9, -0.4], [109.5, 125.1, 16.5, -0.4],
].map(([top, bottom, width, nudge]) => [top, bottom, JEONGEUM_RIGHT - width + nudge, JEONGEUM_RIGHT + nudge]));
const JEONGEUM_BYLINE = Object.freeze({ centers: [25.5, 46.8, 67.8, 90.8, 105.3], top: 152.7, bottom: 162.9 });
// 글꼴 먹 비율(글자 크기 1에 대한 먹 너비 · 높이) — 렌더 실측. 도안 글자의 먹은 dominant-baseline central에서 먹 높이의 1/10 위로 뜨고,
// 명조 한자(아래 줄)는 1/20 아래로 처진다 — 둘 다 그만큼 되돌린다.
const JEONGEUM_INK = Object.freeze({ hangul: { width: 0.765, height: 0.76 }, small: { width: 0.74, height: 0.74 }, hanja: { width: 0.94, height: 0.75 }, byline: { height: 0.9 } });
function Jeongeum1955({ display, tone }) {
  const chars = display.coverTitle.split(' ').flatMap((word) => [...word]);
  const byline = [...display.coverSubtitle.replaceAll(' ', '')];
  if (chars.length !== JEONGEUM_BOXES.length || byline.length !== JEONGEUM_BYLINE.centers.length) {
    throw new Error(`jeongeum-1955: 글자 칸은 실물 제목 ${JEONGEUM_BOXES.length}자 · 아래 줄 ${JEONGEUM_BYLINE.centers.length}자에 맞춰 잰 값이다`);
  }
  const B = JEONGEUM_BYLINE;
  const bylineSize = (B.bottom - B.top) / JEONGEUM_INK.byline.height;
  return (
    <g lang="ko">
      {chars.map((char, index) => {
        const [top, bottom, left, right] = JEONGEUM_BOXES[index];
        const ink = /\p{Script=Han}/u.test(char) ? JEONGEUM_INK.hanja : right - left < 10 ? JEONGEUM_INK.small : JEONGEUM_INK.hangul;
        const size = (right - left) / ink.width;
        const flat = (bottom - top) / (size * ink.height);
        return (
          <g key={index} transform={`translate(${((left + right) / 2).toFixed(2)} ${((top + bottom) / 2 + (bottom - top) / 10).toFixed(2)}) scale(1 ${flat.toFixed(3)})`}>
            <text x={0} y={0} fontSize={size.toFixed(2)} textAnchor="middle" dominantBaseline="central" fill={tone.ink} style={{ fontFamily: HEAVY }}>{char}</text>
          </g>
        );
      })}
      <g>
        {byline.map((char, index) => (
          <text key={`b${index}`} x={B.centers[index]} y={((B.top + B.bottom) / 2 - (B.bottom - B.top) / 20).toFixed(2)} fontSize={bylineSize.toFixed(2)} textAnchor="middle" dominantBaseline="central" fill={tone.teal} style={{ fontFamily: HANJA }}>{char}</text>
        ))}
      </g>
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

/** 바탕 조각 — 잉크가 아니라 종이라 닳은 활자(잉크 층) 밖, 결(grain) 아래에 그린다. */
export const SECOND_UNDER = {
  jindallae: ({ tone }) => <rect x={JINDALLAE.band} y="0" width={120 - JINDALLAE.band} height="168" fill={tone.band} />,
};

export const SECOND_DRAW = {
  gaebyeok: Gaebyeok, bakmun: Bakmun, dongbaek: Dongbaek, isang: Isang, gamja: Gamja, jindallae: Jindallae, 'jeongeum-1955': Jeongeum1955,
  'secker-diagonal': SeckerDiagonal, 'secker-numerals': SeckerNumerals, 'scribner-blind': ScribnerBlind, 'scribner-plain': ScribnerPlain,
  'hogarth-bell': HogarthBell, huebsch: Huebsch, 'harper-blind': HarperBlind, 'ticknor-arabesque': TicknorArabesque, 'egerton-boards': EgertonBoards,
  'gallimard-blanche': GallimardBlanche, 'gallimard-essais': GallimardEssais, reynal: Reynal,
};
