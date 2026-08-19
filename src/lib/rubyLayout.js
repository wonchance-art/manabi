// 병음 조판 — 병음 토글 시 한자 간격이 변하지 않게 하면서(폭 1em 균일 그리드),
// 병음 줄이 '일자'로 보이게 하는 규칙(오너 요청 2026-08-19).
//
// 배경: 네이티브 <ruby>는 rt가 base보다 넓으면 base를 밀어 셀을 넓힌다. 중국어 병음은
// chuāng·shuāng처럼 긴 음절이 한자 1em을 넘기므로, 병음을 켜고 끌 때마다 글자가
// 좌우로 밀렸다. 그래서 rt를 절대배치로 빼고 base 폭을 1em으로 고정했다(#1056).
//
// 1차 시도(글자 크기 축소)의 실패: 긴 병음만 font-size를 줄였더니(0.46/0.42/0.36em)
// 겹침은 해결됐지만 병음의 세로 지표(윗변·베이스라인·글자 키)가 음절마다 달라져
// "글자마다 병음 위치가 다르다"는 오너 지적을 받았다(2026-08-19, 배포 확인).
// 윗변 지터 실측 ±2px + 글자 키 최대 28% 편차 — 한 줄로 읽히지 않는다.
//
// 해법: 글자 크기는 전부 0.5em 하나로 통일하고, 셀보다 긴 병음만 **가로로 압축**한다
// (CSS transform: scaleX). scaleX는 세로 지표를 전혀 건드리지 않으므로 모든 병음의
// 높이·베이스라인·윗변이 동일해 일자가 되고, 폭은 셀 안으로 들어와 겹침이 사라진다.
// 루비를 눌러 맞추는 압축은 일본어 조판(JIS X 4051)에서도 표준 관행이다.
//
// 판정을 글자 '수'가 아니라 추정 '폭'으로 하는 이유: màn(3자)이 21.3px로 셀(20px)을
// 넘는 반면 shí(3자)는 안 넘는다 — m·w가 i·l의 3.5배 폭이라 글자 수는 폭의 대리가
// 못 된다(글자 수 기반이던 rubyWidthStep의 잔여 겹침 0.94%가 정확히 이 부류였다).
//
// 실측 근거(Chromium, 콘텐츠 예문 426문장·고유 음절 475·인접쌍 3,191 전수):
//   - 등배(0.5em) 유지 시 겹침: 쌍의 7.8%, 문장의 35.7%, 최대 12px → 등배 불가
//   - 아래 추정식 k 적용 시: 겹침 0쌍, 최악 여유 1.45px, 추정 오차 최대 0.64px
//   - 축소 대상은 고유 음절의 29.9%(잦은 wǒ·kàn 등 1~3자 단폭은 원본 그대로)
//   - k 하한 0.5 부근은 chuāng·shuāng·zhuāng 계열 5음절뿐

// 소문자·기호의 전각 대비 폭(Chromium system-ui 실측, font-size 무관 비율).
// 성조 부호는 폭에 영향이 없어(ā=a 실측 동일) NFD 정규화로 벗겨 기본 글자로 조회한다.
const ADV = {
  a: 0.613, b: 0.635, c: 0.55, d: 0.635, e: 0.615, f: 0.344, g: 0.635, h: 0.634,
  i: 0.278, j: 0.278, k: 0.579, l: 0.278, m: 0.974, n: 0.634, o: 0.612, p: 0.635,
  q: 0.635, r: 0.398, s: 0.521, t: 0.392, u: 0.634, v: 0.592, w: 0.818, x: 0.592,
  y: 0.592, z: 0.525, "'": 0.275, '’': 0.318,
};
// 대문자(고유명사 어두 — Guǎngzhōu). 소문자와 다른 폭이라 별도 표.
const ADV_UPPER = {
  A: 0.705, B: 0.686, C: 0.698, D: 0.77, E: 0.632, F: 0.575, G: 0.775, H: 0.752,
  I: 0.295, J: 0.295, K: 0.656, L: 0.557, M: 0.863, N: 0.748, O: 0.787, P: 0.603,
  Q: 0.787, R: 0.695, S: 0.635, T: 0.598, U: 0.732, V: 0.684, W: 0.989, X: 0.685,
  Y: 0.611, Z: 0.685,
};

const RT_EM = 0.5;    // rt font-size (base 대비) — index.css `.word-token rt`와 일치해야 한다
const TRACKING = 0.03; // rt letter-spacing -0.03em — 위와 동일하게 일치 필수
const FIT_EM = 0.94;   // 목표 폭(셀 1em 대비) — 폰트별 폭 편차·추정 오차 흡수 여유
const FLOOR = 0.5;     // 압축 하한 — 이 밑으로는 가독성이 무너진다

/**
 * 병음 한 음절 → 가로 압축비 k (CSS `--rt-k`, `scaleX(var(--rt-k, 1))`).
 * 셀(1em) 안에 들어오는 음절은 undefined(원본 폭 유지).
 * @param {string} reading 병음 음절
 * @returns {string|undefined} '0.52'~'0.99' 또는 undefined
 */
export function rubyFitScale(reading) {
  const r = String(reading || '');
  if (!r) return undefined;
  const chars = [...r.normalize('NFD').replace(/[̀-ͯ]/g, '')];
  let est = 0;
  for (const c of chars) est += ADV[c] ?? ADV_UPPER[c] ?? 0.8; // 미지 글자는 넓게 가정(안전)
  est -= (chars.length - 1) * TRACKING;
  const k = FIT_EM / (RT_EM * est);
  if (k >= 1) return undefined;
  // 내림 2자리 — 올림하면 목표 폭을 도로 넘을 수 있다
  return String(Math.max(FLOOR, Math.floor(k * 100) / 100));
}

/**
 * rubyFitScale의 JSX 편의 래퍼 — 압축이 필요할 때만 CSS 변수 스타일을 돌려준다.
 * @param {string} reading 병음 음절
 * @returns {{'--rt-k': string}|undefined}
 */
export function rubyFitStyle(reading) {
  const k = rubyFitScale(reading);
  return k ? { '--rt-k': k } : undefined;
}
