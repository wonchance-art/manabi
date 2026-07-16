// 🏛️ 몽생미셸 수도원 씬(msm-abbey-scene) 4막 텍스트 — Claude 소유 콘텐츠.
// 키는 msmAbbeyScene.js MSM_ABBEY_ACTS 의 act id 와 1:1 (씬 골격 = Codex-1, 텍스트 = Claude).
// 2축 구조 [설정 언어 <현지 언어>]: ko 해설 / fr 학습 원문 / reading 은 fr 의 한글 발음 표기.
// 사실 검증 2026-07-17: 708 오베르 전승(헤지)·966 베네딕토회·13세기 라 메르베유·
// 1897 프레미에 미카엘상·"말보다 빠른 밀물" 옛말(전승 헤지). 배선 전 재검 완료 항목.

export const MSM_ABBEY_ACT_COPY = Object.freeze({
  'grand-staircase': Object.freeze({
    title: '대계단(Grand Degré)',
    ko: '성문에서 수도원까지, 바위산을 감아 오르는 큰 계단이에요. 708년 오베르 주교가 예배당을 세웠다는 전승에서 천 년의 순례가 시작됐어요.',
    fr: 'Le Grand Degré monte vers l\'abbaye.',
    reading: '르 그랑 드그레 몽트 베르 라베이.',
    gloss: '대계단이 수도원으로 올라가요.',
  }),
  'abbey-church': Object.freeze({
    title: '수도원 교회당(Église abbatiale)',
    ko: '바위산 꼭대기의 교회당. 966년 베네딕토회 수도원이 들어선 이래 증축을 거듭했고, 첨탑 꼭대기에는 1897년 만들어진 금빛 대천사 미카엘상이 서 있어요.',
    fr: 'Saint Michel veille sur la baie.',
    reading: '생 미셸 베유 쉬르 라 베.',
    gloss: '성 미카엘이 만(灣)을 지켜보고 있어요.',
  }),
  'la-merveille-cloister': Object.freeze({
    title: '라 메르베유 회랑(Cloître)',
    ko: '13세기에 지어진 고딕 별관 \'라 메르베유(경이)\'의 꼭대기 회랑. 가느다란 돌기둥 사이로 하늘과 바다가 함께 보여서, 하늘과 바다 사이에 떠 있다고 표현돼요.',
    fr: 'Le cloître flotte entre ciel et mer.',
    reading: '르 클루아트르 플로트 앙트르 시엘 에 메르.',
    gloss: '회랑이 하늘과 바다 사이에 떠 있어요.',
  }),
  'west-terrace': Object.freeze({
    title: '서쪽 테라스(Terrasse de l\'Ouest)',
    ko: '만 전체가 내려다보이는 테라스. 이곳의 밀물은 말이 달리는 속도만큼 빠르다는 옛말이 전해질 정도로, 조수 간만의 차가 유럽에서 손꼽히게 커요.',
    fr: 'La marée monte très vite ici.',
    reading: '라 마레 몽트 트레 비트 이시.',
    gloss: '여기는 밀물이 아주 빨리 들어와요.',
  }),
});

// 씬 골격 계약: ctx.onActChange({ actId }) → 이 lookup 으로 패널 표시. 미정의 id 는 null(패널 숨김).
export function msmAbbeyActCopy(actId) {
  return MSM_ABBEY_ACT_COPY[actId] || null;
}
