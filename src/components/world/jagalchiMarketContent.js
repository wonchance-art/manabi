// 🐟 자갈치 경매 아침 씬(jagalchi-market-scene) 4막 텍스트 — Claude 소유 콘텐츠.
// 키는 jagalchiMarketScene.js JAGALCHI_MARKET_ACTS 의 act id 와 1:1 (씬 골격 = Codex-1, 텍스트 = Claude).
// 축 구조: 한국어권 도시라 현지어 축 = 부산 사투리 원문(local), gloss = 표준어 풀이 —
// MSM 의 [ko/fr/reading/gloss] 와 달리 reading(발음) 축이 없다(설정 언어와 문자가 같음).
// 사실 검증 2026-07-18: 자갈밭 갯가 어원 전승(헤지)·"오이소 보이소 사이소" 축제 표어 통설·
// 중도매인 수신호·회 골목 1층 구매→2층 식당 관행·남항 방파제/영도 지리 — 인명·상호 무언급.

export const JAGALCHI_ACT_COPY = Object.freeze({
  'dawn-pier': Object.freeze({
    title: '새벽 부두',
    ko: '해 뜨기 전 자갈치 부두. 밤배가 들어오면 상자째 생선이 내려지고, 얼음 트럭이 줄을 서요. 자갈치라는 이름은 자갈밭 갯가에서 왔다고 전해져요.',
    local: '오이소, 보이소, 사이소!',
    gloss: '오세요, 보세요, 사세요! — 자갈치 아지매들의 인사로 알려진 말이에요.',
  }),
  'auction-floor': Object.freeze({
    title: '경매장',
    ko: '손가락 신호와 종소리로 몇 초 만에 생선 상자가 주인을 찾아요. 중도매인들의 수신호는 외부인은 읽기 어려운 자갈치의 언어예요.',
    local: '마, 퍼뜩 온나!',
    gloss: '얼른 오라는 부산말 — 경매장은 발걸음도 말도 빨라요.',
  }),
  'hoe-alley': Object.freeze({
    title: '회 골목',
    ko: '1층에서 갓 산 생선을 2층 식당이 바로 회로 떠 줘요. \'자갈치에서 회 한 접시\'는 부산 여행의 오래된 공식이에요.',
    local: '이기 오늘 아침에 들어온 기라예.',
    gloss: '이게 오늘 아침에 들어온 거예요 — 신선함이 자랑인 골목이에요.',
  }),
  'breakwater-lighthouse': Object.freeze({
    title: '방파제 등대',
    ko: '시장 끝 방파제에 서면 남항 건너 영도가 보여요. 갈매기와 뱃고동 — 하루를 시작한 시장 뒤로 바다가 다시 잔잔해져요.',
    local: '바다 내음 마이 맡고 가이소.',
    gloss: '바다 냄새 많이 맡고 가세요 — 자갈치식 배웅이에요.',
  }),
});

// 씬 골격 계약: ctx.onActChange({ actId }) → 이 lookup 으로 패널 표시. 미정의 id 는 null(패널 숨김).
export function jagalchiActCopy(actId) {
  return JAGALCHI_ACT_COPY[actId] || null;
}
