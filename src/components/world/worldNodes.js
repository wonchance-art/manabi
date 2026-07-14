// 🗺️ 장소 노드 시스템 — 학습 월드(GameCanvas)의 주요 지점(도시·공항·항구·랜드마크)과
// 그 상호작용(게이트)을 한 곳에 모은 정적 데이터. mapData.js(자동 생성, 무수정)는 읽기 전용으로만
// 소비한다 — 좌표는 POI(등장방형 투영 산출값)에서 그대로 가져온다.
//
// 노드 모양:
//   { id, name, desc, kind:'city'|'airport'|'port'|'landmark', tile:[x,y],
//     gate?: { type:'story-scene', scene:'airport', label } | { type:'ferry', to:'<node id>', label } }
//   desc: A(말 걸기)로 여는 GBC 설명 박스에 이름과 함께 표시하는 1~2문장(전 노드·명산 필수).
//
// gate 없는 노드는 표지 마커만(김해공항·도시·랜드마크) — 이름 라벨은 없고, A로 desc를 읽는다.
// gate 있는 노드는 근접 시 A로 상호작용(desc는 게이트 프롬프트에 한 줄 병기):
//   · story-scene : 같은 Phaser 게임의 씬으로 전환(인천공항 → 공항 스토리 씬 → 도쿄 독해).
//   · ferry       : 확인 다이얼로그 → 페이드 → 상대 항구 인접 land 로 이동(보상·XP 없음, 왕방향 대칭).
//
// React/Next/Phaser 의존 0 — vitest(node)에서 그대로 임포트해 무결성을 검증한다.

import { POI, MAP_W, MAP_H, TERRAIN, decodeMap, project } from './mapData';
import { buildPlayableGrid } from '../../lib/world/mapGeo';

// 명산(名山) — 전용 도트 조각. lon/lat 는 build-map.mjs NAMED_PEAKS 와 동일값이라
// project() 로 얻는 타일이 build-map 이 PEAK 로 보장한 타일과 정확히 일치한다(오프셋 0). peak 필드는
// GameCanvas 가 t_peak_<peak> 전용 텍스처를 골라 마커 대신 그리는 키다. 게이트 없음(A로 desc 열람).
//   백두·금강은 DMZ 북측이라 도달 불가 — 철조망 너머로 보이기만 하는 의도된 연출(라벨은 근접 시).
const NAMED_PEAKS = [
  { id: 'geumgang', name: '금강산', peak: 'geumgang', lon: 128.115, lat: 38.667, desc: '기암괴석으로 이름난 명산. 계절마다 다른 이름으로 불릴 만큼 경치가 빼어나요.' },
  { id: 'seorak', name: '설악산', peak: 'seorak', lon: 128.470, lat: 38.120, desc: '험준한 봉우리와 단풍으로 유명한 강원도의 명산이에요.' },
  { id: 'bukhan', name: '북한산', peak: 'bukhan', lon: 126.990, lat: 37.660, desc: '서울을 굽어보는 화강암 명산. 도심 가까이 우뚝 솟아 있어요.' },
  { id: 'jiri', name: '지리산', peak: 'jiri', lon: 127.730, lat: 35.340, desc: '남부 내륙에 넉넉하고 웅장한 산줄기를 펼친 명산이에요.' },
  { id: 'halla', name: '한라산', peak: 'halla', lon: 126.530, lat: 33.370, desc: '제주도 한가운데 우뚝한 한국 남단 최고봉. 정상에 백록담 분화구가 있어요.' },
  { id: 'aso', name: '아소산', peak: 'aso', lon: 131.090, lat: 32.880, desc: '일본 규슈의 활화산. 세계에서 손꼽히는 거대한 칼데라를 품고 있어요.' },
].map(({ id, name, peak, lon, lat, desc }) => {
  const { x, y } = project(lon, lat);
  return { id, name, kind: 'landmark', tile: [x, y], peak, desc };
});

// 규슈(九州) 대표 관광지 — 전국맵 규슈 지역을 실좌표로 채운다(도시 정밀맵과 별개, 마커+desc).
//   tile 은 project(lon,lat) 산출값을 육지 최근접 보행칸으로 스냅한 결정값(오프라인 계산·하드코딩).
//   기존 노드(fukuoka·dazaifu-shrine=太宰府天満宮·aso=阿蘇山)와 중복 스팟은 제외. gate 없음(A로 desc).
//   軍艦島(端島)은 앞바다 섬(실좌표는 sea)이라 나가사키 해안의 접근 가능한 대리 마커로 스냅한다
//   (desc 로 '배로' 안내). 그래서 全 노드가 비차단(!isBlocked) 타일 위 — worldNodes 무결성 통과.
const KYUSHU_SPOTS = [
  // 福岡
  { id: 'yanagawa', name: '야나가와', tile: [135, 317], desc: '해자를 사공이 노 젓는 배로 도는 강 뱃놀이(川下り·かわくだり)로 알려진 수향(水郷) 「柳川」(やながわ).' },
  { id: 'mojiko-retro', name: '모지코 레트로', tile: [145, 298], desc: '메이지·다이쇼기 서양식 건물이 보존된 항구 지구 「門司港レトロ」(もじこうレトロ). 기타큐슈시.' },
  // 佐賀
  { id: 'yoshinogari', name: '요시노가리', tile: [134, 313], desc: '야요이 시대 환호(環濠) 집락 유적을 복원한 사적 공원 「吉野ヶ里歴史公園」(よしのがりれきしこうえん).' },
  { id: 'karatsu-castle', name: '가라쓰성', tile: [126, 310], desc: '가라쓰만을 내려다보는 언덕 위 성 「唐津城」(からつじょう). ‘마이즈루성’이라고도 불려요.' },
  { id: 'yutoku-inari', name: '유토쿠 이나리 신사', tile: [128, 319], desc: '주칠(朱漆) 누각 구조의 이나리 신사 「祐徳稲荷神社」(ゆうとくいなりじんじゃ). 일본 3대 이나리의 하나로 꼽혀요.' },
  // 長崎
  // 글로버 정원·大浦天主堂 은 같은 南山手 언덕(~150m)이라 한 노드로 합침(마커 겹침 회피, Codex #94).
  { id: 'glover-garden', name: '글로버 정원', tile: [124, 328], desc: '개항기 외국인 거류지의 서양식 저택 정원 「グラバー園」(グラバーえん)과, 곁의 현존 일본 最古(최고) 목조 고딕 성당 「大浦天主堂」(おおうらてんしゅどう·세계문화유산)이 있는 南山手(みなみやまて) 언덕.' },
  { id: 'gunkanjima', name: '군함도(端島)', tile: [122, 324], desc: '나가사키 앞바다의 해저 탄광 무인도 「端島／軍艦島」(はしま／ぐんかんじま). 군함을 닮은 외형으로 불리며 세계문화유산 — 섬이라 나가사키에서 배로 가요(마커는 나가사키 해안 기준).' },
  { id: 'huis-ten-bosch', name: '하우스텐보스', tile: [123, 319], desc: '네덜란드 거리·건물을 재현한 대형 테마파크 「ハウステンボス」. 사세보시.' },
  // 熊本
  { id: 'kumamoto-castle', name: '구마모토성', tile: [141, 326], desc: '가토 기요마사가 축성한 성 「熊本城」(くまもとじょう). 2016년 지진 피해 후 복구가 진행되고 있어요.' },
  { id: 'amakusa-sakitsu', name: '아마쿠사 사키쓰', tile: [127, 338], desc: '잠복 기리시탄 관련 유산 「天草／崎津集落」(あまくさ／さきつしゅうらく). 사키쓰 집락·교회가 세계문화유산에 포함돼요.' },
  // 大分
  { id: 'beppu-onsen', name: '벳푸 온천', tile: [156, 314], desc: '색·형태가 다른 원천을 도는 ‘지고쿠메구리(地獄めぐり·지옥순례)’로 알려진 온천지 「別府温泉」(べっぷおんせん).' },
  { id: 'yufuin', name: '유후인', tile: [153, 315], desc: '유후다케 기슭의 온천 마을 「由布院（湯布院）」(ゆふいん). 료칸과 거리 산책으로 찾는 관광지예요.' },
  { id: 'usa-jingu', name: '우사 신궁', tile: [154, 308], desc: '전국 하치만(八幡) 신사의 총본궁 「宇佐神宮」(うさじんぐう). 725년 창건.' },
  // 宮崎
  { id: 'takachiho', name: '다카치호 협곡', tile: [152, 328], desc: '아소 화산의 화쇄류(火砕流) 퇴적물이 식어 굳고 침식되어 형성된 주상절리 협곡 「高千穂峡」(たかちほきょう). 마나이 폭포(真名井の滝)와 보트 놀이로 알려져요.' },
  { id: 'aoshima-jinja', name: '아오시마 신사', tile: [155, 351], desc: '파식대(鬼の洗濯板)에 둘러싸인 아오시마 섬에 자리한 신사 「青島神社」(あおしまじんじゃ).' },
  { id: 'udo-jingu', name: '우도 신궁', tile: [155, 355], desc: '해안 절벽의 동굴 안에 본전이 있는 신사 「鵜戸神宮」(うどじんぐう).' },
  // 鹿児島
  { id: 'sakurajima', name: '사쿠라지마', tile: [141, 357], desc: '가고시마만에 있는 활화산 「桜島」(さくらじま). 지금도 분화 활동이 이어지는 상징적 화산이에요.' },
  { id: 'sengan-en', name: '센간엔', tile: [138, 355], desc: '사쓰마 번주 시마즈 가문의 별저 정원 「仙巌園」(せんがんえん). 사쿠라지마를 차경(借景)으로 삼아요.' },
  { id: 'kirishima-jingu', name: '기리시마 신궁', tile: [144, 349], desc: '니니기노미코토를 모시는 신사 「霧島神宮」(きりしまじんぐう). 주칠 사전(社殿)으로 알려져요.' },
  { id: 'ibusuki-onsen', name: '이부스키 온천', tile: [139, 365], desc: '데워진 모래에 몸을 묻는 ‘스나무시(砂むし·모래찜질)’ 온천으로 알려진 온천지 「指宿温泉」(いぶすきおんせん).' },
].map((s) => ({ id: s.id, name: s.name, kind: 'landmark', tile: s.tile, desc: s.desc }));

// 熊本 마스코트 쿠마몬 — 오너 방침으로 유지(전국구 대표 유루캐라). kind:'landmark'(A로 desc).
//   나머지 현은 공식 캐릭터(승인 필요) 대신 아래 "맛집(명물 요리)" 노드로 대체(컴플라이언스).
const MASCOTS = [
  { id: 'mascot-kumamon', name: '쿠마몬(熊本)', kind: 'landmark', mascot: 'kumamon', tile: [138, 324], desc: '구마모토현의 캐릭터 「くまモン」(쿠마몬). 검은 곰에 빨간 볼이 특징이에요.' },
];

// 규슈 명물 맛집 노드 — "현실 정보 융합" 원칙: 각 현 대표 명물 요리를 찾아가는 가게로(gourmet → t_gourmet).
//   kind:'landmark'(A로 desc). 요리 자체(郷土料理/名物) 중심·검증본, 확실한 노포만 상호 병기. 단정 회피.
const GOURMET = [
  { id: 'gourmet-fukuoka', name: '하카타 모츠나베(福岡)', tile: [138, 304], desc: '소·돼지 곱창(모츠)과 부추를 간장·된장 국물에 끓이는 후쿠오카 대표 나베 「もつ鍋」(모츠나베). 명란 「明太子」(멘타이코)도 하카타의 상징 — ふくや(福岡市博多区)가 1949년 처음 만든 것으로 알려졌어요.' },
  { id: 'gourmet-saga', name: '시시리안 라이스(佐賀)', tile: [132, 316], desc: '밥 위에 볶은 고기·생채소를 올리고 마요네즈를 뿌리는 사가시의 향토 그루메 「シシリアンライス」(시시리안 라이스). 브랜드 소고기 「佐賀牛」(사가규)도 알려져 있어요.' },
  { id: 'gourmet-nagasaki', name: '나가사키 짬뽕(長崎)', tile: [125, 325], desc: '면·해산물·채소를 돼지·닭 육수로 끓인 나가사키 대표 면 「ちゃんぽん」(찬폰). 1899년 노포 四海樓(시카이로)에서 고안된 것으로 전해져요. 튀긴 면의 「皿うどん」(사라우동)도.' },
  { id: 'gourmet-oita', name: '도리텐(大分)', tile: [159, 315], desc: '닭고기에 튀김옷을 입혀 튀긴 오이타 향토요리 「とり天」(도리텐). 벳푸 노포 東洋軒(도요켄) 발상으로 알려졌어요. 브랜드어 「関あじ・関さば」(세키아지·세키사바)도.' },
  { id: 'gourmet-miyazaki', name: '치킨난반(宮崎)', tile: [154, 348], desc: '튀긴 닭을 단촛물에 담가 타르타르 소스를 얹는 미야자키 대표 요리 「チキン南蛮」(치킨난반). 노베오카·미야자키시에 발상 이야기가 함께 전해져요. 여름엔 찬 된장국밥 「冷や汁」(히야지루)도.' },
  { id: 'gourmet-kagoshima', name: '흑돼지·시로쿠마(鹿児島)', tile: [136, 358], desc: '가고시마산 「黒豚」(구로부타·흑돼지) 돈카츠·샤부샤부가 대표적. 곱게 간 얼음에 연유·과일·팥을 얹은 빙과 「白熊」(시로쿠마)는 天文館むじゃき(1947)가 고안한 것으로 전해져요.' },
].map((m) => ({ id: m.id, name: m.name, kind: 'landmark', gourmet: true, tile: m.tile, desc: m.desc }));

export const WORLD_NODES = [
  // 서울 — 스폰 도시.
  { id: 'seoul', name: '서울', kind: 'city', tile: [POI.SEOUL.x, POI.SEOUL.y], desc: '대한민국의 수도. 한강이 도시를 가로지르고, 예부터 지금까지 나라의 중심지예요.' },
  // 인천공항(영종도) — 기존 하드코딩 "도쿄 여행" 게이트를 이 노드로 이관. A → 공항 스토리 씬.
  {
    id: 'incheon-airport', name: '인천공항', kind: 'airport', tile: [POI.INCHEON.x, POI.INCHEON.y],
    gate: { type: 'story-scene', scene: 'airport', label: '✈ 도쿄' },
    desc: '한국의 관문 국제공항. 여기서 비행기를 타고 도쿄로 떠나요.',
  },
  // 김해공항 — 게이트 없음(표지 마커만).
  { id: 'gimhae-airport', name: '김해공항', kind: 'airport', tile: [POI.GIMHAE_AIR.x, POI.GIMHAE_AIR.y], desc: '부산 곁의 국제공항. 영남 지방 하늘길의 중심이에요.' },
  // 부산 — 도시.
  { id: 'busan', name: '부산', kind: 'city', tile: [POI.BUSAN.x, POI.BUSAN.y], desc: '한국 제2의 도시이자 최대 항구도시. 바다와 산이 어우러져 있어요.' },
  // 부산국제여객터미널 — 후쿠오카항행 페리.
  {
    id: 'busan-port', name: '부산국제여객터미널', kind: 'port', tile: [POI.BUSAN_TERMINAL.x, POI.BUSAN_TERMINAL.y],
    gate: { type: 'ferry', to: 'fukuoka-port', label: '⚓ 후쿠오카' },
    desc: '일본으로 가는 국제여객선이 드나드는 항구. 후쿠오카행 페리가 출발해요.',
  },
  // 후쿠오카항 — 부산행 페리(왕방향 대칭).
  {
    id: 'fukuoka-port', name: '후쿠오카항', kind: 'port', tile: [POI.FUKUOKA_PORT.x, POI.FUKUOKA_PORT.y],
    gate: { type: 'ferry', to: 'busan-port', label: '⚓ 부산' },
    desc: '일본 규슈의 관문 항구. 부산행 페리가 오가요.',
  },
  // 후쿠오카(도시) — 계층형 맵 진입 노드. A → 도시 정밀맵(CityScene 'city:fukuoka')으로 들어간다.
  //   gate.type:'city' 는 story-scene(공항)·ferry 와 나란한 세 번째 게이트 종류(도시 진입). 도시맵
  //   하카타항 출구 타일 → 이 노드 앞으로 복귀(CityScene worldReturn). 페리 하선점(항구) 곁이라 동선 정합.
  {
    id: 'fukuoka', name: '후쿠오카', kind: 'city', tile: [POI.FUKUOKA.x, POI.FUKUOKA.y],
    gate: { type: 'city', to: 'fukuoka', label: '🏙️ 시내' },
    desc: '규슈 최대 도시. 하카타항·라멘 골목·텐진 상점가를 걸어서 돌아볼 수 있어요.',
  },
  // ── NPC 도트 대화(마스터플랜 A-1) — 페리 목적지 후쿠오카 인근 land 에 배치. gate 없음, npc 필드로 대화. ──
  // A(말 걸기) → React NpcDialog 오버레이(npcScripts). 완주 시 방문 기념 스탬프(로컬 전용 파일럿 — 공유 없음).
  // 하카타 라멘 전문점(고정 점포) — 후쿠오카항 곁 land. 하카타가 돈코츠·替え玉 본고장이라 지리 정합.
  //   포장마차(屋台)가 아닌 이유: 야타이는 직접 주문→식후 현금 계산이 관행(후쿠오카시 공식 안내)이라
  //   챕터 ot-10 이 가르치는 券売機/食券 첫 단계와 모순 — 식권기가 있는 고정 점포로 통일(Codex P1-2).
  //   (id 'fukuoka-ramen' 은 유지 — 미배포·미수집 상태 확인, 스크립트 key 'ramen' 과 일관.)
  //   ── 도시 이전(계층형 맵) ── 이 라멘 NPC 는 후쿠오카 도시 정밀맵(하카타 라멘 골목)으로 이전됐다.
  //   city:'fukuoka' 필드로 "도시 소속"을 표시한다 — 전국맵 렌더/미니맵에서는 제외되고(GameCanvas 가
  //   !node.city 로 필터), 도시맵(CityScene)이 cities/fukuoka.js 의 로컬 좌표로 배치한다. nodeId 는
  //   'fukuoka-ramen' 그대로 유지해 스탬프 연속성을 지킨다(getNode 로 이름/스탬프 해석은 여기서 계속).
  //   npcScripts(대화 내용)·다자이후 신사(전국맵 유지)는 무수정. tile 은 전국 좌표(테스트 정합용 · 미렌더).
  {
    id: 'fukuoka-ramen', name: '하카타 라멘 전문점', kind: 'npc', tile: [131, 306],
    npc: 'ramen', city: 'fukuoka',
    desc: '입구에 券売機(켄바이키)가 놓인 하카타 돈코츠 라멘 전문점. 주인장이 면 굳기를 물어봐요 — 「替え玉お願いします」를 써 볼 곳.',
  },
  // 다자이후 신사 — 후쿠오카 남동쪽 내륙 land(실제 다자이후텐만구가 후쿠오카 시가지 남동).
  {
    id: 'dazaifu-shrine', name: '다자이후 신사', kind: 'npc', tile: [138, 310],
    npc: 'shrine',
    desc: '붉은 鳥居(도리이)가 선 신사. 미코상이 참배 예절(二礼二拍手一礼)과 오미쿠지를 알려줘요.',
  },
  // 도쿄 — 도시.
  { id: 'tokyo', name: '도쿄', kind: 'city', tile: [POI.TOKYO.x, POI.TOKYO.y], desc: '일본의 수도. 세계에서 가장 사람이 많이 사는 대도시권이에요.' },
  // 하네다 — 랜드마크(표지 마커만).
  { id: 'haneda', name: '하네다', kind: 'landmark', tile: [POI.HANEDA.x, POI.HANEDA.y], desc: '도쿄의 바닷가 국제공항. 일본에서 가장 붐비는 하늘길이에요.' },
  // 백두산 — 설산 랜드마크(게이트 없음, 마커만). DMZ 북측이라 철조망 너머로 보이기만 하고
  //   실제로는 도달 불가 — 의도된 연출(넘어갈 수 없는, 멀리 보이는 설산). PEAK 타일 위. peak='baekdu'.
  { id: 'baekdu', name: '백두산', kind: 'landmark', tile: [POI.BAEKDU.x, POI.BAEKDU.y], peak: 'baekdu', desc: '한반도에서 가장 높은 산. 정상에 천지라는 큰 화산 호수가 있어요.' },
  // 후지산 — 설산 랜드마크(게이트 없음). PEAK 타일 위, 혼슈에서 도달 가능. peak='fuji'.
  { id: 'fuji', name: '후지산', kind: 'landmark', tile: [POI.FUJI.x, POI.FUJI.y], peak: 'fuji', desc: '일본에서 가장 높은 산. 좌우 대칭의 아름다운 원뿔 모양으로 유명해요.' },
  // 명산 6종(금강·설악·북한·지리·한라·아소) — 전용 도트 조각 + 이름 라벨.
  ...NAMED_PEAKS,
  // 규슈 대표 관광지 20종(福岡~鹿児島) — 전국맵 규슈 지역 채우기(마커+desc).
  ...KYUSHU_SPOTS,
  // 熊本 쿠마몬 마스코트(1) + 규슈 6현 명물 맛집 노드(현실 정보 융합).
  ...MASCOTS,
  ...GOURMET,
  // 동해항 — 사카이미나토행 페리(실존 DBS 항로 모티프).
  {
    id: 'donghae-port', name: '동해항', kind: 'port', tile: [POI.DONGHAE_PORT.x, POI.DONGHAE_PORT.y],
    gate: { type: 'ferry', to: 'sakaiminato-port', label: '⚓ 사카이미나토' },
    desc: '동해 국제여객터미널. 일본 산인 지방으로 가는 항로가 열려 있어요.',
  },
  // 사카이미나토 — 동해항행 페리(왕방향 대칭).
  {
    id: 'sakaiminato-port', name: '사카이미나토', kind: 'port', tile: [POI.SAKAIMINATO.x, POI.SAKAIMINATO.y],
    gate: { type: 'ferry', to: 'donghae-port', label: '⚓ 동해' },
    desc: '돗토리현의 항구 도시. 신지호와 다이센으로 가는 관문이에요.',
  },
  // 거제 — 도시(게이트 없음, 표지 마커만). 두 다리로 이어진 섬(거제대교·통영 / 거가대교·가덕도·부산).
  { id: 'geoje', name: '거제', kind: 'city', tile: [POI.GEOJE.x, POI.GEOJE.y], desc: '거제대교로 통영과, 거가대교로 가덕도·부산과 이어진 섬. 조선업으로 이름난 항구 도시예요.' },
  // 통영 — 도시(게이트 없음, 표지 마커만). 견내량 건너 거제대교로 거제와 이어지는 본토측 관문.
  { id: 'tongyeong', name: '통영', kind: 'city', tile: [POI.TONGYEONG.x, POI.TONGYEONG.y], desc: '한려수도의 항구 도시. 견내량을 건너는 거제대교로 거제와 이어지고, 예부터 이름난 수산의 고장이에요.' },
  // 다이센 — 랜드마크(게이트 없음). peak 필드는 넣지 않음 — 전용 도트 조각은 후속, 일반 마커+라벨.
  { id: 'daisen', name: '다이센', kind: 'landmark', tile: [POI.DAISEN.x, POI.DAISEN.y], desc: '산인 지방의 명봉. 모양이 후지산을 닮아 "호키후지"라고도 불려요.' },
  // 돗토리 — 랜드마크(게이트 없음). 코야마호 곁의 해안 사구.
  { id: 'tottori', name: '돗토리', kind: 'landmark', tile: [POI.TOTTORI.x, POI.TOTTORI.y], desc: '일본 최대의 사구가 펼쳐진 해안 도시. 코야마호를 곁에 두고 있어요.' },
];

// id → 노드(게이트 참조 해석·페리 목적지 조회용).
export function getNode(id) {
  return WORLD_NODES.find((n) => n.id === id) || null;
}

// ── 미니맵 다운샘플(순수 함수) ──
// mapData 격자(TERRAIN 코드)를 factor×factor 블록으로 묶어 저해상 미니맵 코드 격자를 만든다.
// 6색 이내(sea/land/river/fence/mountain/peak)로 접으며, 블록 대표값은 "눈에 띄어야 하는 것" 우선순위:
//   fence(DMZ 차단벽) > river/lake(내륙 수계) > peak(설산) > mountain(산지) > land/plain/bridge(육지) > sea.
// (lake→RIVER, plain·bridge→LAND 로 접는다 — 평야는 육지와 동색, 산지·설산만 별색으로 강조.)
// 반환: { w, h, codes:Uint8Array(w*h) } — codes[i] ∈ {SEA,LAND,RIVER,FENCE,MOUNTAIN,PEAK}. 결정적·부작용 없음.
export function downsampleMinimap(grid, factor = 4) {
  const w = Math.ceil(MAP_W / factor);
  const h = Math.ceil(MAP_H / factor);
  const codes = new Uint8Array(w * h);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      let hasFence = false, hasWater = false, hasPeak = false, hasMountain = false, hasLand = false;
      const y0 = by * factor, x0 = bx * factor;
      for (let dy = 0; dy < factor; dy++) {
        const ty = y0 + dy;
        if (ty >= MAP_H) break;
        for (let dx = 0; dx < factor; dx++) {
          const tx = x0 + dx;
          if (tx >= MAP_W) break;
          const c = grid[ty * MAP_W + tx];
          if (c === TERRAIN.FENCE) hasFence = true;
          else if (c === TERRAIN.RIVER || c === TERRAIN.LAKE) hasWater = true;
          else if (c === TERRAIN.PEAK) hasPeak = true;
          else if (c === TERRAIN.MOUNTAIN) hasMountain = true;
          else if (c === TERRAIN.LAND || c === TERRAIN.BRIDGE || c === TERRAIN.PLAIN) hasLand = true;
        }
      }
      codes[by * w + bx] = hasFence ? TERRAIN.FENCE
        : hasWater ? TERRAIN.RIVER
          : hasPeak ? TERRAIN.PEAK
            : hasMountain ? TERRAIN.MOUNTAIN
              : hasLand ? TERRAIN.LAND
                : TERRAIN.SEA;
    }
  }
  return { w, h, codes };
}

// 미니맵 편의: 현재 맵을 디코드 → 플레이 가능 격자(광장 SEA→LAND)로 변환해 다운샘플.
// buildPlayableGrid 를 거쳐 런타임 격자·관리자 뷰와 동일 산출을 표시한다(P2-6 — raw 격자 불일치 해소).
// GameCanvas 미니맵 오버레이가 1회 호출.
export function buildMinimap(factor = 4) {
  return downsampleMinimap(buildPlayableGrid(decodeMap()), factor);
}
