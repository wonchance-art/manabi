// 🎖️ 스탬프 마일스톤 칭호 카피 정본 — Claude 콘텐츠 소유(S3 계약: 키는 stampMilestones.js).
// 규격: name 4~12자, line 12~50자·해요체. 상호·인물·브랜드 무재현.
export const WORLD_TITLE_COPY = Object.freeze({
  'stamp-10': Object.freeze({
    name: '첫 발자국 수집가',
    line: '도장 열 개 — 여권에 여행의 리듬이 생겼어요.',
  }),
  'stamp-30': Object.freeze({
    name: '골목까지 아는 여행자',
    line: '서른 곳의 기억 — 지도가 이야기로 바뀌기 시작해요.',
  }),
  'stamp-60': Object.freeze({
    name: '대륙을 잇는 탐험가',
    line: '예순 곳 — 바다 건너까지 발자국이 이어졌어요.',
  }),
  'stamp-85': Object.freeze({
    name: '세계를 걸은 사람',
    line: '여든다섯 곳 전부 — 이 여권엔 빈 칸이 없어요.',
  }),
  'discovery-lyon': Object.freeze({
    name: '리옹 완주자',
    line: '론과 소옌이 만나는 언덕마다 — 이 도시의 숨결을 느껴봤어요.',
  }),
  'discovery-bordeaux': Object.freeze({
    name: '보르도 산책자',
    line: '가론강을 따라 고풍의 골목까지 — 와인처럼 깊고 부드러운 도시네요.',
  }),
  'discovery-strasbourg': Object.freeze({
    name: '스트라스부르 여행가',
    line: '수로와 목재 건물 사이로 — 알자스의 색채를 모두 수집했어요.',
  }),
});

export function worldTitleCopyForKey(titleKey) {
  return WORLD_TITLE_COPY[titleKey] ?? null;
}
