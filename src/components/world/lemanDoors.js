// 🚪 레만호 연안 프랑스어 문화 도어 3종 (fr-16~18) — Claude 소유 콘텐츠. 프랑스어권
// 4세트(파리·MSM·마르세유·제네바)와 챕터·주제 비중복(a2 잔여 픽: 02·03·07).
// 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지). track: 'french' — trackChapterHref
// 라우팅. 사실·IP 규율: 도멘·상호·인명·행사 무언급(라보는 지리·전승만, 몽트뢰는 일반 거리 연주만).

export const LEMAN_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-16', name: '와인 카브', nameFr: 'Caveau de vignerons', track: 'french',
    chapter: 'a2-03-imparfait',
    culture: '라보 포도밭은 11세기 수도원들이 비탈을 계단식으로 개간한 데서 시작된 것으로 전해져요 — 지금도 가족 단위 카브들이 대를 이어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Avant, mon grand-père travaillait ces vignes.', reading: '아방, 몽 그랑페르 트라바예 세 비뉴.', gloss: '예전엔 할아버지가 이 포도밭을 가꾸셨어요. (반과거 — 과거의 습관)' }),
      Object.freeze({ fr: 'Le lac brillait sous le soleil.', reading: '르 라크 브리예 수 르 솔레이.', gloss: '호수가 햇살 아래 반짝이고 있었어요. (반과거 — 배경 묘사)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-17', name: '거리 음악가', nameFr: 'Musicien de rue', track: 'french',
    chapter: 'a2-02-passe-compose-etre',
    culture: '몽트뢰 호반은 온화한 기후 덕에 사철 산책객이 끊이지 않아 거리 연주가 일상 풍경으로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je suis arrivé à Montreux ce matin.', reading: '즈 스위 자리베 아 몽트뢰 스 마탱.', gloss: '오늘 아침 몽트뢰에 도착했어요. (être 복합과거 — arriver)' }),
      Object.freeze({ fr: 'Elle est restée pour écouter la musique.', reading: '엘 에 레스테 푸르 에쿠테 라 뮈지크.', gloss: '그녀는 음악을 들으려고 남았어요. (être 복합과거 — rester)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-18', name: '약국', nameFr: 'Pharmacie', track: 'french',
    chapter: 'a2-07-futur-simple',
    culture: '스위스 약국은 초록 십자 간판으로 통하고, 가벼운 증상은 약사 상담부터 받는 문화로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Vous prendrez ce médicament après le repas.', reading: '부 프랑드레 스 메디카망 아프레 르 르파.', gloss: '이 약은 식후에 드세요. (단순미래 — 부드러운 지시)' }),
      Object.freeze({ fr: 'Ça ira mieux demain.', reading: '사 이라 미외 드맹.', gloss: '내일이면 나아질 거예요. (단순미래 — aller 불규칙)' }),
    ]),
  }),
]);

export function lemanDoorById(id) {
  return LEMAN_DOORS.find((door) => door.id === id) ?? null;
}
