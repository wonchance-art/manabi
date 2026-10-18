import { romanYear } from '../../lib/firstEditionCover';
import { Blind, KO_PRINT, PERIOD_FONTS, T, Weave } from './FirstEditionCoverSecond';
import { Fleuron, GARAMOND, KR_SERIF, Laid, Rule } from './FirstEditionCoverThird';

// 틀 장정(LIT-IMPORT-1) — 작품 전용 그림 없이 표기 데이터(색 · 장식 · 글자 줄)로 짓는 초판식 앞표지. 키 · 색 · 장식 목록은
// lib/firstEditionCover.js(TEMPLATE_*). 구성은 실물 재구성에서 되풀이된 것만 옮겼다(천 민압 테 · 속표지 글자 줄 · 인쇄 표지 테 ·
// 활판 재킷 · 세로 표지) — 사람 · 문장 · 도안은 그리지 않는다(시리즈 원칙 그대로). 좌표 120×168, 공통 낡음 · 경첩은 FirstEditionCover.
const { CASLON, DIDOT, JOSEFIN } = PERIOD_FONTS;
/** 중국어 송체(『呐喊』 · 『背影』 장정과 같은 글꼴 — 글꼴 변수는 FirstEditionCover가 싣는다). 명조(KR_SERIF)에는 간체자(从 · 园 · 鲁)가 없다. */
export const SONG = 'var(--font-ws-song, "Noto Serif SC"), "Noto Serif SC", "Songti SC", STSong, serif';

/** 글자 수에 맞춰 줄이는 크기 — 줄이 판 너비(약 96)를 넘지 않게. 라틴 대문자 평균 폭 0.68em 가정. */
const fit = (text, size, width = 96, em = 0.68) => Math.min(size, width / Math.max(1, [...text].length * em));

// 천 장정 — 민압 세 줄 테 · 테 + 안쪽 판 · 금박 제목(가운데 위, 겹 테). 글자는 금박 제목일 때만.
function TemplateCloth({ display, tone, id }) {
  const lines = display.coverTitle.split('\n');
  return (
    <g lang="en">
      <Weave id={id} color={tone.ground} />
      <Blind tone={tone}>
        {[5, 6.3, 7.6].map((inset) => <rect key={inset} x={inset} y={inset} width={120 - inset * 2} height={168 - inset * 2} fill="none" strokeWidth=".35" />)}
        {display.coverOrnament === 'blind-panel' && <rect x="17" y="17" width="86" height="134" fill="none" strokeWidth=".55" />}
        {display.coverOrnament === 'blind-panel' && <rect x="18.6" y="18.6" width="82.8" height="130.8" fill="none" strokeWidth=".3" />}
      </Blind>
      {display.coverOrnament === 'gilt-title' && (
        <g>
          <rect x="24" y="34" width="72" height={14 + lines.length * 10} fill="none" stroke={tone.gilt} strokeWidth=".5" />
          {lines.map((line, index) => (
            <T key={line} x={60} y={48 + index * 10} size={fit(line.toUpperCase(), 7.4, 64)} font={DIDOT} fill={tone.gilt} spacing=".6">{line.toUpperCase()}</T>
          ))}
        </g>
      )}
    </g>
  );
}

// 18세기 속표지 — 첫 줄 크게, 다음 줄은 번갈아 작은 대문자 · 큰 대문자, 저자 · (부제) · 이중 괘선 · 출판지 · 출판사 · 붙인 로마 숫자 연도.
function TemplateTitlePage({ display, tone, id }) {
  const year = romanYear(display.coverYear).replace(/ /gu, '');
  const lines = display.coverTitle.split('\n');
  const sizes = lines.map((line, index) => fit(line.toUpperCase(), index === 0 ? 9.6 : index % 2 ? 4 : 6.4));
  let y = 26;
  return (
    <g lang="en">
      <Laid id={id} color={tone.ground} />
      {lines.map((line, index) => {
        y += index === 0 ? 0 : sizes[index] + 4;
        return <T key={line} x={60} y={y} size={sizes[index]} font={CASLON} fill={tone.ink} spacing={index === 0 ? '2' : '.8'}>{line.toUpperCase()}</T>;
      })}
      <T x={60} y={y + 13} size={fit(display.coverAuthor, 3.8)} font={CASLON} fill={tone.ink}>{display.coverAuthor}</T>
      {display.coverSubtitle && <T x={60} y={y + 19} size={fit(display.coverSubtitle, 2.8)} font={GARAMOND} fill={tone.ink} italic>{display.coverSubtitle}</T>}
      <Fleuron x={60} y={Math.max(y + 34, 100)} ink={tone.ink} />
      <Rule y={118} from={18} to={102} ink={tone.ink} />
      {display.coverPlace && <T x={60} y={128} size={3.8} font={CASLON} fill={tone.ink} spacing="1.4">{display.coverPlace.toUpperCase()}</T>}
      {display.coverImprint && <T x={60} y={134.5} size={fit(display.coverImprint.toUpperCase(), 2.8)} font={CASLON} fill={tone.ink} spacing=".3">{display.coverImprint.toUpperCase()}</T>}
      <T x={60} y={142} size={3.4} font={CASLON} fill={tone.ink} spacing=".6">{`${year}.`}</T>
    </g>
  );
}

// 프랑스 인쇄 표지 — (홑 · 겹 테) · 작가 대문자 · 빨강 제목 · 부제 · 출판지 · 출판사 · 띄운 로마 숫자 연도.
function TemplateWrapper({ display, tone }) {
  const lines = display.coverTitle.split('\n');
  return (
    <g lang="fr">
      {display.coverOrnament !== 'plain' && <rect x="8" y="8" width="104" height="152" fill="none" stroke={tone.ink} strokeWidth=".5" />}
      {display.coverOrnament === 'double-rule' && <rect x="10.4" y="10.4" width="99.2" height="147.2" fill="none" stroke={tone.ink} strokeWidth=".25" />}
      <T x={60} y={32} size={fit(display.coverAuthor.toUpperCase(), 5, 80)} font={DIDOT} fill={tone.ink} spacing="1">{display.coverAuthor.toUpperCase()}</T>
      {lines.map((line, index) => (
        <T key={line} x={60} y={54 + index * 12} size={fit(line.toUpperCase(), 10, 88)} font={DIDOT} fill={tone.accent} spacing=".6">{line.toUpperCase()}</T>
      ))}
      {display.coverSubtitle && <T x={60} y={58 + lines.length * 12} size={fit(display.coverSubtitle, 4, 80)} font={GARAMOND} fill={tone.ink} italic>{display.coverSubtitle}</T>}
      <path d="M52 104h16" stroke={tone.ink} strokeWidth=".4" />
      {display.coverPlace && <T x={60} y={132} size={4} font={DIDOT} fill={tone.ink} spacing="1.4">{display.coverPlace.toUpperCase()}</T>}
      {display.coverImprint && <T x={60} y={139} size={fit(display.coverImprint.toUpperCase(), 3.6, 84)} font={DIDOT} fill={tone.ink} spacing=".8">{display.coverImprint.toUpperCase()}</T>}
      <T x={60} y={147} size={3.6} font={DIDOT} fill={tone.ink} spacing=".6">{romanYear(display.coverYear)}</T>
    </g>
  );
}

// 20세기 활판 재킷 — 바탕 한 색 · 위아래 굵은 띠 · 큰 제목(기하 산세리프) · 부제 · 작가 · 아래 출판사.
function TemplateJacket({ display, tone }) {
  const lines = display.coverTitle.split('\n');
  return (
    <g lang="en">
      <rect x="0" y="14" width="120" height="3" fill={tone.ink} />
      <rect x="0" y="151" width="120" height="3" fill={tone.ink} />
      {lines.map((line, index) => (
        <T key={line} x={60} y={54 + index * 15} size={fit(line.toUpperCase(), 13, 100, 0.62)} font={JOSEFIN} fill={tone.ink} weight="600" spacing=".4">{line.toUpperCase()}</T>
      ))}
      {display.coverSubtitle && <T x={60} y={62 + lines.length * 15} size={fit(display.coverSubtitle, 4.6, 90)} font={GARAMOND} fill={tone.ink} italic>{display.coverSubtitle}</T>}
      <T x={60} y={118} size={fit(display.coverAuthor.toUpperCase(), 6.4, 92)} font={CASLON} fill={tone.accent} spacing="1.2">{display.coverAuthor.toUpperCase()}</T>
      {display.coverImprint && <T x={60} y={146} size={fit(display.coverImprint.toUpperCase(), 3.6, 90)} font={JOSEFIN} fill={tone.ink} spacing="1.2">{display.coverImprint.toUpperCase()}</T>}
    </g>
  );
}

// 동아시아 세로 표지 — 가는 이중 테 · 오른쪽 큰 세로 제목(두 줄이면 오른쪽에서 왼쪽으로 두 열) · 그 왼쪽 세로 작가 · 아래 출판사(开明 1928 관례).
function TemplateCjkVertical({ display, tone }) {
  const columns = display.coverTitle.split('\n');
  const longest = Math.max(...columns.map((line) => [...line].length));
  const step = Math.min(24, 92 / longest); // 제목 세로 길이 ≤ 92 — 아래 출판사 괘선(y 132) 위에서 끝난다
  const size = Math.min(columns.length > 1 ? 15 : 19, step * 0.85);
  const face = /\p{Script=Hangul}/u.test(display.coverTitle + display.coverAuthor) ? KO_PRINT : SONG; // 한글 표지는 근대 활자(조선100년체 · 한자는 쓰키지 명조), 중국어는 송체
  const vertical = { writingMode: 'vertical-rl', textOrientation: 'upright', fontFamily: face }; // 섞인 라틴 글자(「阿Q正传」)도 눕히지 않는다
  const authorX = 76 - columns.length * size * 1.35 - 6;
  return (
    <g>
      <rect x="10" y="10" width="100" height="148" fill="none" stroke={tone.ink} strokeWidth="1" />
      <rect x="12.4" y="12.4" width="95.2" height="143.2" fill="none" stroke={tone.ink} strokeWidth=".4" />
      {columns.map((line, index) => (
        <text key={line} x={76 - index * size * 1.35} y={30} fontSize={size} letterSpacing={step - size} fill={tone.ink} fontWeight="600" style={vertical}>{line}</text>
      ))}
      <text x={Math.max(22, authorX)} y={40} fontSize={5.6} letterSpacing={1.4} fill={tone.ink} style={vertical}>{display.coverAuthor}</text>
      {display.coverImprint && <path d="M38 132h44" stroke={tone.ink} strokeWidth=".5" />}
      {display.coverImprint && <T x={60} y={145} size={fit(display.coverImprint, 4.4, 80, 1)} font={face} fill={tone.ink} spacing="1.2">{display.coverImprint}</T>}
    </g>
  );
}

export const TEMPLATE_DRAW = {
  'tpl-cloth': TemplateCloth, 'tpl-title-page': TemplateTitlePage, 'tpl-wrapper': TemplateWrapper, 'tpl-jacket': TemplateJacket, 'tpl-cjk-vertical': TemplateCjkVertical,
};
