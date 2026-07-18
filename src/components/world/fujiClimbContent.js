// 🗻 후지 등산 씬(fuji-climb-scene) 4막 텍스트 — Claude 소유 콘텐츠 (액트 씬 3호).
// 키는 fujiClimbScene.js FUJI_CLIMB_ACTS 의 act id 와 1:1 (씬 골격 = Codex-1, 텍스트 = Claude).
// 축 구조: MSM 미러 [ko 해설 / ja 현지어 원문 / reading 한글 발음 / gloss 뜻] — 일본어 도시라
// 발음 축 복원(자갈치 [ko/local/gloss] 와의 차이). 문법 축은 ja 도어 4종과 비중복(に·見える·ましょう).
// 사실 검증 2026-07-18: 요시다 루트 최다 이용 통설·스바루라인 5합목 ~2,305m("2,300m 부근" 헤지)·
// 御来光 존칭 어원·お鉢巡り 사발 어원 전승·산장 여름 개장 통설. 산장 상호·버스 브랜드 무언급.

export const FUJI_CLIMB_ACT_COPY = Object.freeze({
  'fifth-station': Object.freeze({
    title: '5합목',
    ko: '후지산 등반은 보통 5합목에서 시작해요. 요시다 루트의 5합목은 해발 2,300m 부근으로 알려져 있고, 여기부터는 버스도 말도 없이 두 발로만 올라가요.',
    ja: 'ここから頂上まで、歩いて登ります。',
    reading: '코코카라 초조마데, 아루이테 노보리마스.',
    gloss: '여기서 정상까지 걸어서 올라가요. (て형 연결)',
  }),
  'mountain-hut-night': Object.freeze({
    title: '산장의 밤',
    ko: '7~8합목 산장에서 이른 저녁을 먹고 몇 시간 눈을 붙여요. 여름 등산철에만 여는 산장이 많은 것으로 알려져 있어요 — 새벽 출발이 해돋이의 조건이에요.',
    ja: '明日は二時に出発します。',
    reading: '아시타와 니지니 슛파츠시마스.',
    gloss: '내일은 2시에 출발해요. (시간 조사 に)',
  }),
  goraiko: Object.freeze({
    title: '고라이코',
    ko: '정상 부근에서 맞는 해돋이를 御来光(고라이코)라고 불러요 — \'오시는 빛\'이라는 존칭이 붙은 말로, 구름바다 위로 해가 떠올라요.',
    ja: '御来光が見えます!',
    reading: '고라이코가 미에마스!',
    gloss: '해돋이가 보여요! (자발 동사 見える)',
  }),
  'ohachi-meguri': Object.freeze({
    title: '오하치메구리',
    ko: '정상의 분화구 둘레를 한 바퀴 도는 길을 お鉢巡り(오하치메구리)라 해요. \'사발 둘레 돌기\'라는 뜻으로 전해져요 — 내려가기 전 마지막 한 바퀴예요.',
    ja: '火口の周りを一周しましょう。',
    reading: '카코노 마와리오 잇슈시마쇼.',
    gloss: '분화구 둘레를 한 바퀴 돌아요. (권유 ましょう)',
  }),
});

// 씬 골격 계약: ctx.onActChange({ actId }) → 이 lookup 으로 패널 표시. 미정의 id 는 null(패널 숨김).
export function fujiClimbActCopy(actId) {
  return FUJI_CLIMB_ACT_COPY[actId] || null;
}
