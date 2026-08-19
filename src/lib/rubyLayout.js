// 병음 조판 폭 — 병음 토글 시 한자 간격이 변하지 않게 하는 폭 예약 규칙(오너 요청 2026-08-19).
//
// 배경: 네이티브 <ruby>는 rt가 base보다 넓으면 base를 밀어 셀을 넓힌다. 중국어 병음은
// chuāng·shuāng처럼 6자 음절이 있어 한자 1em을 넘기므로, 병음을 켜고 끌 때마다 글자가
// 좌우로 밀렸다(요미가나는 대개 base 안에 들어와 이 문제가 드러나지 않았다).
// 표준 속성 ruby-overhang은 브라우저가 사실상 구현하지 않아 무력하다.
//
// 해법: rt를 절대배치로 빼 base 폭 계산에서 제외하고(간격 변화 0), 대신 긴 병음이 이웃
// 위로 넘쳐 겹치는 만큼만 이 글자의 최소 폭으로 예약한다. 전역 최장(1.6em)으로 모두
// 넓히면 본문이 성겨지므로 길이 구간별 최소 단계만 둔다.
//
// 실측 근거(Chromium, font-size 20px = 1em, rt 0.5em):
//   rt 폭 — 1~3자 ≤15.8px · 4자 21px · 5자 22.4px · 6자 31px  (한자 base 20px)
//   콘텐츠 예문 2,059개 전수: 겹침 24.3% → 2.2%, 최대 9.6px → 1.9px
//   음절 분포 4자 20.9% · 5자 8.2% · 6자+ 0.9% → 본문 폭 증가 약 5%
//   (남은 2.2%는 최대 1.9px = 글자 폭의 10%로 육안 식별이 어려워 여기서 멈춘다 —
//    더 올리면 본문 밀도 손실이 이득을 넘는다)

/**
 * 병음 한 음절 → 폭 단계. CSS의 `.word-token ruby[data-syl="N"]`이 최소 폭을 준다.
 * 대문자는 소문자보다 넓어 같은 글자 수라도 넘치므로 한 단계 올린다(고유명사 Guǎngzhōu).
 * @param {string} reading 병음 음절
 * @returns {'4'|'5'|'6'|undefined} 보정이 불필요하면 undefined
 */
export function rubyWidthStep(reading) {
  const r = String(reading || '');
  if (!r) return undefined;
  const n = [...r].length + (/[A-Z]/.test(r) ? 1 : 0);
  if (n >= 6) return '6';
  if (n === 5) return '5';
  if (n === 4) return '4';
  return undefined;
}
