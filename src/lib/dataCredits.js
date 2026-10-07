// 자료 출처 정본 — /credits 화면과 계약 테스트가 이 목록 하나를 읽는다 (오너 승인 2026-10-07).
//
// 왜 한 곳인가: 출처 고지가 생성기 주석에만 있어 사용자에게 닿지 않았다(감사 2026-10-07 —
// CC-CEDICT·FLELex·OSM 화면 표기 0). 화면·테스트·데이터 README가 따로 적으면 셋이 갈린다.
// 배치 원칙(오너 지시 「가능한 한 사용자 눈에 잘 안 들어오는 곳에」): 학습 화면에는 표기를
// 띄우지 않고 설정·도움말의 작은 링크로만 이 화면에 닿는다. CC 4.0 §3(a)(2)는 고지 정보를
// 담은 자원으로의 링크로 표기를 허용한다. 예외는 지도 곁 표기를 요구하는 OSM 하나(/world 베젤).
//
// 항목을 더하면 dataCredits.test.js의 원천 표지 목록도 함께 본다 — 코드에 원천 표지가
// 있는데 여기 없으면 CI가 잡는다. JMdict는 싣지 않는다 — import 라우트만 있고 운영
// morpheme_dictionary의 source=jmdict* 행이 0건(오너 조회 2026-10-07)이라 사용자에게 닿지 않는다.

export const DATA_CREDITS_UPDATED = '2026년 10월 7일';

export const DATA_CREDIT_SECTIONS = [
  {
    title: '중국어',
    items: [
      {
        id: 'cc-cedict',
        name: 'CC-CEDICT',
        holder: '© MDBG',
        use: '병음 경성 표기 일부(2,018단어)',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sourceUrl: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
        changes: '경성 단어만 골라 쓰고, 일부는 자체 기준으로 고쳤습니다. 가공한 데이터도 같은 라이선스로 제공합니다.',
      },
      {
        id: 'hsk30',
        name: 'HSK 3.0 어휘표 (ivankra/hsk30)',
        use: '품사·이합사 판별',
        license: 'MIT',
        licenseUrl: 'https://opensource.org/license/mit',
        sourceUrl: 'https://github.com/ivankra/hsk30',
      },
      {
        id: 'complete-hsk-vocabulary',
        name: 'complete-hsk-vocabulary',
        holder: 'drkameleon',
        use: 'HSK 단어장의 한자·병음·품사',
        license: 'MIT',
        licenseUrl: 'https://opensource.org/license/mit',
        sourceUrl: 'https://github.com/drkameleon/complete-hsk-vocabulary',
      },
    ],
  },
  {
    title: '일본어',
    items: [
      {
        id: 'kuromoji-ipadic',
        name: 'kuromoji.js · IPAdic',
        use: '형태소 분석·읽기(동봉 사전 IPAdic)',
        license: 'Apache-2.0',
        licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
        sourceUrl: 'https://github.com/takuyaa/kuromoji.js',
      },
      {
        id: 'open-anki-jlpt-decks',
        name: 'open-anki-jlpt-decks',
        holder: 'jamsinclair',
        use: 'JLPT 단어장의 표기·읽기·급수',
        license: 'MIT',
        licenseUrl: 'https://opensource.org/license/mit',
        sourceUrl: 'https://github.com/jamsinclair/open-anki-jlpt-decks',
      },
    ],
  },
  {
    title: '한자',
    items: [
      {
        id: 'unihan',
        name: 'Unicode Unihan',
        holder: '© Unicode, Inc.',
        use: '획수·부수·정체/간체 대응·일본 상용/인명용 한자 목록',
        license: 'Unicode License v3',
        licenseUrl: 'https://www.unicode.org/license.txt',
        sourceUrl: 'https://www.unicode.org/charts/unihan.html',
      },
      {
        id: 'babelstone-ids',
        name: 'BabelStone IDS',
        holder: 'Andrew West',
        use: '글자 구성 분해',
        license: '자유 이용',
        licenseUrl: 'https://www.babelstone.co.uk/CJK/IDS.HTML',
        sourceUrl: 'https://www.babelstone.co.uk/CJK/IDS.HTML',
      },
      {
        id: 'opencc',
        name: 'OpenCC',
        use: '간체·정체·신자체 대응',
        license: 'Apache-2.0',
        licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
        sourceUrl: 'https://github.com/BYVoid/OpenCC',
      },
      {
        id: 'libhangul-hanja',
        name: 'libhangul hanja.txt',
        holder: '© Choe Hwanjin',
        use: '한자 음·훈',
        license: 'BSD 3-Clause',
        licenseUrl: 'https://opensource.org/license/bsd-3-clause',
        sourceUrl: 'https://github.com/libhangul/libhangul',
      },
      {
        id: 'npm-hanja',
        name: 'hanja (npm)',
        use: '한자 음',
        license: 'MIT',
        licenseUrl: 'https://opensource.org/license/mit',
        sourceUrl: 'https://www.npmjs.com/package/hanja',
      },
    ],
  },
  {
    title: '프랑스어',
    items: [
      {
        id: 'flelex',
        name: 'FLELex',
        holder: 'UCLouvain CENTAL',
        use: '어휘 CEFR 등급',
        license: 'CC BY-NC-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        sourceUrl: 'https://cental.uclouvain.be/cefrlex/flelex/',
        changes: '등급 정보를 단어장 선정에 활용했습니다. 비영리 조건으로 사용합니다.',
      },
      {
        id: 'tatoeba',
        name: 'Tatoeba',
        holder: '문장별 기여자',
        use: '예문 일부',
        license: 'CC BY 2.0 FR',
        licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/',
        sourceUrl: 'https://tatoeba.org',
      },
    ],
  },
  {
    title: '지도',
    items: [
      {
        id: 'openstreetmap',
        name: 'OpenStreetMap',
        holder: '© OpenStreetMap 기여자',
        use: '월드 도시 지형',
        license: 'ODbL 1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        sourceUrl: 'https://www.openstreetmap.org/copyright',
      },
      {
        id: 'natural-earth',
        name: 'Natural Earth',
        use: '세계 지도 경계',
        license: '퍼블릭 도메인',
        licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
        sourceUrl: 'https://www.naturalearthdata.com/',
      },
      {
        id: 'etopo-2022',
        name: 'ETOPO 2022',
        holder: 'NOAA',
        use: '월드 지형 고도',
        license: '퍼블릭 도메인',
        licenseUrl: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
        sourceUrl: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
      },
    ],
  },
];

export const DATA_CREDIT_IDS = DATA_CREDIT_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
