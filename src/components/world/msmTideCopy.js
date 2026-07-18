// 🌊 몽생미셸 조수 카피 — phase(low/rising/high/falling)별 성벽·도어 안내문.
// montSaintMichelTide의 tideCopyKey(=phase)를 키로 소비한다. 톤은 수도원 씬과 동일하게
// ko 서술 + A2 프랑스어 한 문장(fr/reading/gloss) — 발음·뜻은 학습 병기 계약을 따른다.

export const MSM_TIDE_COPY = Object.freeze({
  low: Object.freeze({
    ko: '물이 다 빠졌어요. 갯벌이 수평선까지 드러나요 — 옛 순례자들은 썰물 때 이 만을 걸어서 건넜대요.',
    fr: 'La mer est basse.',
    reading: '라 메르 에 바스',
    gloss: '바다가 낮아요(썰물)',
  }),
  rising: Object.freeze({
    ko: '밀물이 시작됐어요. 「말이 달리는 속도」라고 전해질 만큼 빠른 조수가 만을 채워 와요.',
    fr: 'La marée monte.',
    reading: '라 마레 몽트',
    gloss: '조수가 올라와요(밀물)',
  }),
  high: Object.freeze({
    ko: '만조예요. 몽생미셸이 다시 바다 위의 섬이 돼요 — 성벽 아래까지 물이 차올라요.',
    fr: 'La mer est haute.',
    reading: '라 메르 에 오트',
    gloss: '바다가 높아요(만조)',
  }),
  falling: Object.freeze({
    ko: '물이 빠지기 시작해요. 갯벌이 조금씩 돌아오고, 물길이 은빛 무늬를 그려요.',
    fr: 'La marée descend.',
    reading: '라 마레 데상',
    gloss: '조수가 내려가요(썰물 시작)',
  }),
});

export function msmTideCopyFor(tideCopyKey) {
  return MSM_TIDE_COPY[tideCopyKey] ?? null;
}
