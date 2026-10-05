/**
 * 제한된 형태 일관성 검사. 중국어 의미의 정확성/원어민 품질을 판정하지 않는다.
 * 지원하지 않는 활용은 unknown으로 남기고, 원형이나 설명을 추측해 고치지 않는다.
 */
const comparison = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
const morpheme = value => comparison(value).replace(/^[-–]+|[-–]+$/gu, '');

export function koreanMorphologyConsistency(token) {
  const surface = comparison(token?.surface), lemma = comparison(token?.lemma);
  const forms = new Set((Array.isArray(token?.morphology) ? token.morphology : []).map(m => morpheme(m?.form)));
  const issues = [];
  let checked = false;
  // 가/오의 현재 해요체에 특정 -어요를 붙였다는 주장만 검사한다.
  // 아/어요라는 교체형 명칭, 과거 갔어요, 와요를 만드는 와 형태 등은 이 검사 밖이다.
  if ((lemma.endsWith('가다') && surface === `${lemma.slice(0, -1)}요`) ||
      (lemma.endsWith('오다') && surface === `${lemma.slice(0, -2)}와요`)) {
    if (forms.has('어요')) {
      checked = true;
      issues.push({ code: 'present_a_stem_with_specific_eoyo', field: 'morphology' });
    } else if (forms.has('아요')) checked = true;
  }
  // 방향이 명시된 합성동사의 활용을 반대 방향 원형으로 설명하는 명백한 모순.
  // 걸어요 등 동음 활용형에는 이 규칙을 일반화하지 않는다.
  if ((surface === '걸어가요' && lemma === '걸어오다') || (surface === '걸어와요' && lemma === '걸어가다')) {
    checked = true;
    issues.push({ code: 'opposite_motion_lemma', field: 'lemma' });
  }
  // v1의 pos는 원형 어휘의 품사다. X다 → X게 및 -게 분석을 모델이 함께
  // 제시한 경우, 문장 안 부사어 기능을 원형의 품사 부사로 저장하면 모순이다.
  // 동사/형용사 중 어느 쪽인지는 추측하지 않으며, 원형/형태가 불명확하면 보류한다.
  if (lemma.endsWith('다') && lemma.length > 1 && surface === `${lemma.slice(0, -1)}게` &&
      forms.has('게') && token?.pos === '부사') {
    checked = true;
    issues.push({ code: 'adverbial_form_as_lexical_pos', field: 'pos' });
  }
  return { status: issues.length ? 'contradiction' : checked ? 'consistent' : 'unknown', issues };
}
