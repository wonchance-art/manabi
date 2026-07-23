// 🏙️ 도쿄 도시 정밀맵 — 실 OSM geo v2.1을 CityScene 데이터 계약에 연결한다.
// 지형·POI·山手線 역 좌표는 tokyo.geo.js가 단일 진실원이며, 여기서는 게임용 EXIT만 덧씌운다.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { TOKYO_GEO } from './tokyo.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = TOKYO_GEO.meta.grid.w;
export const ROWS = TOKYO_GEO.meta.grid.h;

const POI_BY_ID = Object.fromEntries(TOKYO_GEO.pois.map((poi) => [poi.id, poi]));
const poiTile = (id) => POI_BY_ID[id].tile;

// 하네다 남부의 보행 세로축(v2.2 격자 x=543, y1030..1082 무단절). ENTRANCE에서 위로만 걸으면
// EXIT에 닿는 e2e 회랑이다. 공항 POI[563,1062]와 ≥15타일 이격 — 프롬프트 겹침 없음.
const EXIT_TILES = [[543, 1031], [543, 1032]];

export const ENTRANCE = { x: 543, y: 1040, facing: 'down' };

export const ZONES = [
  { id: 'shibuya', label: '渋谷', bounds: [0, 0, 60, 80], labelTile: [18, 15] },
  { id: 'ebisu-meguro', label: '恵比寿／目黒', bounds: [45, 80, 115, 190], labelTile: [78, 112] },
  { id: 'shinagawa', label: '品川／高輪', bounds: [120, 150, 230, 270], labelTile: [170, 178] },
  { id: 'shiba', label: '芝／浜松町', bounds: [205, 0, 300, 130], labelTile: [245, 22] },
  { id: 'tokyo-bay', label: '東京湾／お台場', bounds: [290, 100, 420, 240], labelTile: [347, 140] },
  { id: 'haneda', label: '羽田空港', bounds: [350, 560, 470, 667], labelTile: [390, 600] },
];

// 品川駅 POI는 같은 geo 좌표의 山手線 정기 교통 역으로 한 번만 렌더한다.
// 나머지 POI는 실좌표에서 스냅된 geo tile을 그대로 쓰는 설명 마커다.
export const CITY_NODES = [
  {
    id: 'haneda-airport', kind: 'spot', name: '羽田空港', facade: 'depart',
    tile: poiTile('haneda-airport'), facing: 'down', noStamp: true,
    desc: '도쿄 남쪽 바닷가의 공항 「羽田空港」(はねだくうこう). 시내와 철도·모노레일로 이어져요.',
  },
  {
    id: 'shibuya-scramble', kind: 'spot', name: '渋谷スクランブル交差点', facade: 'sign',
    tile: poiTile('shibuya-scramble'), facing: 'down', noStamp: true,
    desc: '여러 방향의 보행 신호가 함께 열리는 「渋谷スクランブル交差点」(しぶや すくらんぶる こうさてん).',
  },
  {
    id: 'tokyo-tower', kind: 'spot', name: '東京タワー', facade: 'tokyotower',
    tile: poiTile('tokyo-tower'), facing: 'down', noStamp: true,
    desc: '시바공원 곁에 선 전파탑 「東京タワー」(とうきょうたわー). 도쿄만 쪽 도심을 내려다봐요.',
  },
  {
    id: 'rainbow-bridge', kind: 'spot', name: 'レインボーブリッジ', facade: 'sign',
    tile: poiTile('rainbow-bridge'), facing: 'down', noStamp: true,
    desc: '시바우라와 오다이바를 잇는 현수교 「レインボーブリッジ」(れいんぼーぶりっじ).',
  },
  {
    id: 'odaiba-seaside-park', kind: 'spot', name: 'お台場海浜公園', facade: 'sign',
    tile: poiTile('odaiba-seaside-park'), facing: 'down', noStamp: true,
    desc: '도쿄만 인공섬의 해변 공원 「お台場海浜公園」(おだいば かいひんこうえん).',
  },
  {
    id: 'hamarikyu-gardens', kind: 'spot', name: '浜離宮恩賜庭園', facade: 'sign',
    tile: poiTile('hamarikyu-gardens'), facing: 'down', noStamp: true,
    desc: '바닷물을 끌어들인 연못이 있는 정원 「浜離宮恩賜庭園」(はまりきゅう おんしていえん).',
  },
  {
    id: 'zojoji', kind: 'spot', name: '増上寺', facade: 'sign',
    tile: poiTile('zojoji'), facing: 'down', noStamp: true,
    desc: '도쿄타워 가까이에 있는 불교 사찰 「増上寺」(ぞうじょうじ).',
  },
  {
    id: 'ebisu-garden-place', kind: 'spot', name: '恵比寿ガーデンプレイス', facade: 'sign',
    tile: poiTile('ebisu-garden-place'), facing: 'down', noStamp: true,
    desc: '에비스역 남쪽의 복합 공간 「恵比寿ガーデンプレイス」(えびす がーでんぷれいす).',
  },
  // ── v2.2 확장 POI 10 (검증 리서치 2026-07-15 — 전승은 헤지, 상표는 지리 참조만) ──
  {
    id: 'sensoji', kind: 'spot', name: '浅草寺', facade: 'kaminarimon',
    tile: poiTile('sensoji'), facing: 'down', noStamp: true,
    desc: '관음보살을 본존으로 하는 다이토구의 사찰 「浅草寺」(せんそうじ). 연기(縁起)에 따르면 628년 창건으로 전해지고, 가미나리몬(雷門)의 현재 문은 1960년 재건이에요.',
  },
  {
    id: 'tokyo-skytree', kind: 'spot', name: '東京スカイツリー', facade: 'skytree',
    tile: poiTile('tokyo-skytree'), facing: 'down', noStamp: true,
    desc: '스미다구의 높이 634m 전파탑 「東京スカイツリー」(とうきょうすかいつりー). 2012년 5월에 문을 열었어요.',
  },
  {
    id: 'ueno-park', kind: 'spot', name: '上野恩賜公園', facade: 'sign',
    tile: poiTile('ueno-park'), facing: 'down', noStamp: true,
    desc: '박물관·미술관·동물원이 모여 있는 다이토구의 공원 「上野恩賜公園」(うえのおんしこうえん). 1873년 지정된 일본 최초의 공원들 중 하나예요.',
  },
  {
    id: 'tokyo-station-marunouchi', kind: 'spot', name: '東京駅丸の内駅舎', facade: 'station',
    tile: poiTile('tokyo-station-marunouchi'), facing: 'down', noStamp: true,
    desc: '붉은 벽돌로 지어진 도쿄역 마루노우치 역사 「東京駅丸の内駅舎」(とうきょうえきまるのうちえきしゃ). 1914년 개업했고, 국가 중요문화재로 2012년 창건 당시 모습으로 복원됐어요.',
  },
  {
    id: 'ginza-4-chome', kind: 'spot', name: '銀座四丁目', facade: 'depart',
    tile: poiTile('ginza-4-chome'), facing: 'down', noStamp: true,
    desc: '긴자 중심부의 교차점 「銀座四丁目」(ぎんざよんちょうめ) 교차점. 모퉁이의 시계탑 건물(1932년 준공)이 거리의 상징으로 알려져 있어요.',
  },
  {
    id: 'meiji-jingu', kind: 'spot', name: '明治神宮', facade: 'torii',
    tile: poiTile('meiji-jingu'), facing: 'down', noStamp: true,
    desc: '메이지 천황과 쇼켄 황태후를 모시는 시부야구의 신사 「明治神宮」(めいじじんぐう). 1920년에 창건됐어요.',
  },
  {
    id: 'tokyo-metropolitan-government', kind: 'spot', name: '東京都庁', facade: 'depart',
    tile: poiTile('tokyo-metropolitan-government'), facing: 'down', noStamp: true,
    desc: '신주쿠에 있는 도쿄도 청사 「東京都庁」(とうきょうとちょう). 1991년에 이전했고, 지상 202m의 전망실을 무료로 열어요.',
  },
  {
    id: 'ryogoku-kokugikan', kind: 'spot', name: '両国国技館', facade: 'sign',
    tile: poiTile('ryogoku-kokugikan'), facing: 'down', noStamp: true,
    desc: '스미다구의 오즈모(大相撲) 경기장 「両国国技館」(りょうごくこくぎかん). 현 건물은 1984년 준공돼 1985년 1월 대회부터 쓰였어요.',
  },
  {
    id: 'nakameguro-meguro-river', kind: 'spot', name: '中目黒（目黒川）', facade: 'sign',
    tile: poiTile('nakameguro-meguro-river'), facing: 'down', noStamp: true,
    desc: '메구로강을 따라 벚나무 가로수가 이어지는 「中目黒（目黒川）」(なかめぐろ（めぐろがわ）) 일대. 강변 약 4km에 약 800그루의 벚나무가 줄지어 서 있어요.',
  },
  {
    id: 'kanda-myojin', kind: 'spot', name: '神田明神', facade: 'torii',
    tile: poiTile('kanda-myojin'), facing: 'down', noStamp: true,
    desc: '정식 명칭이 간다신사(神田神社)인 지요다구의 신사 「神田明神」(かんだみょうじん). 사전(社伝)에 따르면 730년 창건으로 전해지고, 간다마쓰리(神田祭)로 알려져 있어요.',
  },
  // ── v2.3 서브컬처 확장 3곳(오너 2026-07-18 — "서브컬처 요소 곳곳에") — geo POI_SOURCE에
  //   실좌표로 추가 후 재생성(단일 진실원 계약 유지). IP 규율: 특정 작품·캐릭터·상호 무언급,
  //   거리·문화 일반 참조만.
  {
    id: 'akihabara-electric-town', kind: 'spot', name: '秋葉原電気街', facade: 'sign',
    tile: poiTile('akihabara-electric-town'), facing: 'down', noStamp: true,
    desc: '전후 라디오 부품 노점에서 시작된 것으로 전해지는 「秋葉原電気街」(あきはばら でんきがい). 지금은 전자부품 골목과 애니메이션·게임·만화 상점이 뒤섞인 서브컬처의 중심가로 알려져 있어요.',
  },
  {
    id: 'takeshita-street', kind: 'spot', name: '竹下通り', facade: 'sign',
    tile: poiTile('takeshita-street'), facing: 'down', noStamp: true,
    desc: '하라주쿠역 앞에서 시작하는 젊은 패션의 골목 「竹下通り」(たけしたどおり). 350m 남짓한 길에 개성 있는 옷 가게와 크레이프 노점이 이어지는 것으로 알려져 있어요.',
  },
  {
    id: 'otome-road', kind: 'spot', name: '乙女ロード', facade: 'sign',
    tile: poiTile('otome-road'), facing: 'down', noStamp: true,
    desc: '이케부쿠로 선샤인 거리 곁의 「乙女ロード」(おとめろーど). 여성 팬층 대상 애니메이션·만화 전문점이 모여 이런 애칭으로 불리는 것으로 알려져 있어요.',
  },
  // ── v2.4 동네 키워드 대확장 14곳(오너 2026-07-18 — "동네별 세세하게") — geo POI_SOURCE 재생성.
  //   IP 규율: 점포 상호 무언급(거리 통칭만), 환락가 미포함. 사실 검증: 연도·유래 전승 헤지.
  {
    id: 'tsukiji-outer-market', kind: 'spot', name: '築地場外市場', facade: 'sign',
    tile: poiTile('tsukiji-outer-market'), facing: 'down', noStamp: true,
    desc: '수산 도매 기능이 도요스로 옮겨간 뒤에도 남은 먹거리 골목 「築地場外市場」(つきじじょうがいしじょう). 아침 초밥·계란말이 꼬치를 든 줄이 이어지는 시장이에요.',
  },
  {
    id: 'toyosu-market', kind: 'spot', name: '豊洲市場', facade: 'sign',
    tile: poiTile('toyosu-market'), facing: 'down', noStamp: true,
    desc: '2018년 츠키지의 도매 기능을 이어받은 것으로 알려진 「豊洲市場」(とよすしじょう). 참치 경매를 유리 너머 견학 데크에서 볼 수 있어요.',
  },
  {
    id: 'omoide-yokocho', kind: 'spot', name: '思い出横丁', facade: 'sign',
    tile: poiTile('omoide-yokocho'), facing: 'down', noStamp: true,
    desc: '신주쿠역 서쪽의 꼬치구이 골목 「思い出横丁」(おもいでよこちょう). 전후 노점에서 시작된 것으로 전해지는 좁은 골목에 연기와 초롱이 이어져요.',
  },
  {
    id: 'shinjuku-gyoen', kind: 'spot', name: '新宿御苑', facade: 'sign',
    tile: poiTile('shinjuku-gyoen'), facing: 'down', noStamp: true,
    desc: '황실 정원에서 국민 공원이 된 「新宿御苑」(しんじゅくぎょえん). 일본·영국·프랑스식 정원이 한 울타리 안에 있고, 벚꽃 명소로 손꼽혀요.',
  },
  {
    id: 'yanaka-ginza', kind: 'spot', name: '谷中銀座', facade: 'sign',
    tile: poiTile('yanaka-ginza'), facing: 'down', noStamp: true,
    desc: '옛 정취의 야네센(谷根千) 골목을 대표하는 상점가 「谷中銀座」(やなかぎんざ). \'석양 계단\'으로 불리는 유야케단단 아래로 반찬 가게와 고양이 골목이 이어져요.',
  },
  {
    id: 'kagurazaka', kind: 'spot', name: '神楽坂', facade: 'sign',
    tile: poiTile('kagurazaka'), facing: 'down', noStamp: true,
    desc: '돌바닥 골목에 요정(料亭) 문화가 남은 언덕길 「神楽坂」(かぐらざか). 프랑스 문화 기관이 자리 잡으며 \'도쿄의 작은 파리\'로도 불려요.',
  },
  {
    id: 'ameyoko', kind: 'spot', name: 'アメヤ横丁', facade: 'sign',
    tile: poiTile('ameyoko'), facing: 'down', noStamp: true,
    desc: '우에노역 곁 고가 아래 시장 골목 「アメヤ横丁」(あめやよこちょう). 전후 암시장에서 시작된 것으로 전해지며, 건어물·과자·잡화 흥정 소리로 활기차요.',
  },
  {
    id: 'kappabashi', kind: 'spot', name: 'かっぱ橋道具街', facade: 'sign',
    tile: poiTile('kappabashi'), facing: 'down', noStamp: true,
    desc: '주방 도구 전문점이 늘어선 「かっぱ橋道具街」(かっぱばしどうぐがい). 식품 샘플·칼·냄비 — 요리사들의 거리로 알려져 있어요.',
  },
  {
    id: 'jimbocho', kind: 'spot', name: '神保町古書店街', facade: 'sign',
    tile: poiTile('jimbocho'), facing: 'down', noStamp: true,
    desc: '세계 최대급 고서점 거리로 알려진 「神保町古書店街」(じんぼうちょうこしょてんがい). 헌책 냄새와 카레 골목이 함께 있는 책의 동네예요.',
  },
  {
    id: 'sugamo-jizodori', kind: 'spot', name: '巣鴨地蔵通り', facade: 'sign',
    tile: poiTile('sugamo-jizodori'), facing: 'down', noStamp: true,
    desc: '\'할머니들의 하라주쿠\'라는 애칭으로 불리는 상점가 「巣鴨地蔵通り」(すがもじぞうどおり). 토게누키지조 참배와 붉은 속옷 가게로 알려져 있어요.',
  },
  {
    id: 'daikanyama', kind: 'spot', name: '代官山', facade: 'sign',
    tile: poiTile('daikanyama'), facing: 'down', noStamp: true,
    desc: '낮은 언덕에 편집숍과 카페가 모인 동네 「代官山」(だいかんやま). 느긋한 골목 산책으로 사랑받는 세련된 주택가예요.',
  },
  {
    id: 'shimokitazawa', kind: 'spot', name: '下北沢', facade: 'sign',
    tile: poiTile('shimokitazawa'), facing: 'down', noStamp: true,
    desc: '고서·빈티지 옷·소극장·라이브하우스의 동네 「下北沢」(しもきたざわ). 젊은 문화의 거리로 알려진 골목 미로예요.',
  },
  {
    id: 'nakano-broadway', kind: 'spot', name: '中野ブロードウェイ', facade: 'sign',
    tile: poiTile('nakano-broadway'), facing: 'down', noStamp: true,
    desc: '만화·피규어·수집품 상점이 층층이 쌓인 「中野ブロードウェイ」(なかのぶろーどうぇい). 아키하바라와 나란히 꼽히는 서브컬처의 성지예요.',
  },
  {
    id: 'omotesando', kind: 'spot', name: '表参道', facade: 'sign',
    tile: poiTile('omotesando'), facing: 'down', noStamp: true,
    desc: '메이지 신궁의 참배길로 닦인 것에서 유래한 느티나무 가로수길 「表参道」(おもてさんどう). 지금은 건축가들의 플래그십 건물이 늘어선 거리로 알려져 있어요.',
  },
  // ── NPC 대화 노드(가공 무대 — geo POI 아님) — ot-11(전철)·ot-12(면세)·ot-07(편의점) 문화 도어.
  //   후쿠오카 패턴 그대로: kind:'npc' + npc 스크립트 키 + noStamp(스탬프 우주는 오너 결정 전 미확장).
  //   타일은 보행+보행인접+기존 마커 Chebyshev ≥3 이격을 스크립트로 검증해 고정.
  {
    id: 'tokyo-ekiin', kind: 'npc', npc: 'ekiin', chapter: 'ot-11-densha', name: '駅係員',
    tile: [185, 453], facing: 'down', noStamp: true,
    desc: '시부야역 플랫폼의 역무원(駅係員·えきかかりいん). 방송은 まもなく(곧)와 〜行き(~행) 두 개만 잡아도 내릴 역을 안 놓쳐요.',
  },
  {
    id: 'tokyo-menzei', kind: 'npc', npc: 'menzei', chapter: 'ot-12-menzei', name: '免税カウンター',
    tile: [479, 379], facing: 'down', noStamp: true,
    desc: '긴자 상업가의 면세(免税·めんぜい) 카운터. 여권과 「めんぜい、おねがいします」 한마디면 절차 시작 — 2026년 11월부터는 출국할 때 세금을 돌려받아요.',
  },
  {
    id: 'tokyo-konbini', kind: 'npc', npc: 'konbini', chapter: 'ot-07-konbini', name: 'コンビニ',
    tile: [181, 274], facing: 'down', noStamp: true,
    desc: '신주쿠의 24시간 편의점(コンビニ). 계산대 대답은 딱 두 개 — お願いします(네)·大丈夫です(됐어요).',
  },
];

export const STATIONS = TOKYO_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
  ...(station.id === 'shinagawa' ? { poiId: 'shinagawa-station' } : {}),
}));

export const TRANSIT_POINTS = [
  { id: 'haneda-airport', tile: poiTile('haneda-airport'), nameJa: '羽田空港' },
];

export const TRANSIT = [
  {
    id: 'tokyo-yamanote', nameJa: '山手線', mode: 'train', color: 0x8dbb45,
    stopIds: ['shibuya', 'ebisu', 'meguro', 'gotanda', 'osaki', 'shinagawa', 'takanawa-gateway', 'tamachi', 'hamamatsucho'],
    segmentMinutes: [3, 3, 3, 3, 4, 3, 3, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 24 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    id: 'tokyo-haneda-access', nameJa: '羽田アクセス線', mode: 'train', color: 0x4ba4d8,
    stopIds: ['haneda-airport', 'shinagawa', 'shibuya'], segmentMinutes: [14, 12], dwellMinutes: 2,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

// 하네다·시부야·시나가와의 전용 렌더크래프트는 후속 작업으로 남긴다.
// 현재는 CITY_NODES와 STATIONS의 공용 마커만 사용해 실제 장소를 중복 렌더하지 않는다.
export const PROPS = [
  { kind: 'airplane', tile: [560, 1058] },  // 羽田 에이프런 주기 여객기(무브랜드)
  { kind: 'airplane', tile: [567, 1058] },  // 羽田 제2 주기
  { kind: 'bigscreen', tile: [184, 445] },  // 渋谷 스크램블 대형 전광판(무브랜드)
  { kind: 'platform', tile: [355, 616] },   // 品川 승강장
  { kind: 'platform', tile: [357, 616] },   // 品川 승강장(연속 홈)
  // 서브컬처 3곳 곁 앰비언트(무브랜드·무문자) — 이격 ≥2 스크립트 검증.
  { kind: 'neon', tile: [503, 219] },       // 秋葉原 전기가이 네온
  { kind: 'bigscreen', tile: [505, 219] },  // 秋葉原 역전 대형 스크린
  { kind: 'stall', tile: [192, 379] },      // 竹下通り 크레이프 노점
  { kind: 'neon', tile: [194, 379] },       // 竹下通り 간판 네온
  { kind: 'neon', tile: [260, 53] },        // 乙女ロード 상점 네온
  { kind: 'stall', tile: [262, 53] },       // 乙女ロード 굿즈 노점
  // R4 애드온 서브컬처 kind(#262) — 무문자·무캐릭터 실루엣, 이격 ≥2 스크립트 검증.
  { kind: 'gachapon', tile: [507, 220] },   // 秋葉原 캡슐토이 머신
  { kind: 'arcade', tile: [504, 221] },     // 秋葉原 게임센터 캐비닛
  { kind: 'gachapon', tile: [264, 53] },    // 乙女ロード 캡슐토이 머신
];

export function buildTokyoGrid() {
  const grid = Uint8Array.from(TOKYO_GEO.terrain);
  for (const [x, y] of EXIT_TILES) {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = CITY_TILE.EXIT;
  }
  return grid;
}

export const TOKYO = {
  id: 'tokyo',
  name: '도쿄',
  cols: COLS,
  rows: ROWS,
  entrance: ENTRANCE,
  returnNode: 'tokyo',
  zones: ZONES,
  nodes: CITY_NODES,
  stations: STATIONS,
  transit: TRANSIT,
  transitPoints: TRANSIT_POINTS,
  railways: TOKYO_GEO.railways,
  props: PROPS,
  // 📖 여행책 지구제 v1 (D2 정본 — RFC docs/rfc-guidebook-districts.md·오너 승인 2026-07-23).
  // 개방 = 주동선 회랑 rect. 나머지는 guidebook 잠금 렌더 + soft wall.
  districts: {
    version: 'district-v1',
    open: [
      {
        id: 'yamanote-west',
        label: '야마노테·서부',
        tiles: { rects: [[195, 35, 320, 120], [140, 130, 250, 499], [170, 500, 320, 690]] },
      },
      {
        id: 'central-east',
        label: '중심·동부',
        tiles: { rects: [[340, 0, 540, 280], [500, 90, 700, 245], [430, 281, 530, 429]] },
      },
      {
        id: 'south-bay',
        label: '남부·만',
        tiles: { rects: [[330, 430, 590, 700]] },
      },
      {
        id: 'haneda',
        label: '하네다',
        tiles: { rects: [[525, 1020, 585, 1075]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  CITY_TILE,
  buildGrid: buildTokyoGrid,
};

export default TOKYO;
