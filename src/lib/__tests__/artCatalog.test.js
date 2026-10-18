import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_CATALOG } from '../../content/art/index.js';
import { JP_MAP_PINS } from '../../content/studies/japanMapPins.js';
import {
  ART_GENRE_ARTIST_ROLE,
  ART_PD_DIED_BY,
  artCurationWorks,
  artDateDisplay,
  artDescriptionHashMismatches,
  artInfoCard,
  artWorksAtPlace,
  artWorksOverlapping,
  validateArtCatalog,
} from '../artCatalog.js';
import { sha256Hex } from '../literatureCanonical.js';

// 합성 픽스처 — 실제 박물관 해설이 아니다(원문은 ART-P0-2에서 출처에서 받아 해시와 함께 싣는다).
const TEXT = 'テスト用の解説文です。構図と細部を順に説明します。';
const TEXT_SHA = await sha256Hex(TEXT);

function fixture() {
  return {
    periods: [{ id: 'jp-edo', culture: 'jp', label: { ko: '에도 시대', native: '江戸時代' }, startYear: 1603, endYear: 1868 }],
    artists: [{
      id: 'artist-a', wikidata: 'Q1', name: { native: '作者甲', ko: '작가 갑', reading: 'さくしゃこう' },
      born: 1760, died: 1849, life: '합성 작가. 생애 요약 자리.', periods: ['jp-edo'],
    }],
    places: [
      { id: 'museum-a', wikidata: 'Q2', kind: 'museum', name: { native: '甲博物館', ko: '갑 박물관' }, city: '도쿄', lat: 35.72, lng: 139.78, links: { studiesPin: 'tokyo' } },
      { id: 'museum-b', wikidata: 'Q3', kind: 'museum', name: { native: 'B Museum', ko: 'B 미술관' }, city: '시카고', lat: 41.88, lng: -87.62 },
      { id: 'coast-a', wikidata: 'Q4', kind: 'landscape', name: { native: '甲沖', ko: '갑 앞바다' }, lat: 35.45, lng: 139.65 },
    ],
    works: [
      {
        id: 'work-a', wikidata: 'Q5', genre: 'print', artist: 'artist-a',
        title: { native: '甲図', ko: '갑 그림', reading: 'こうず' },
        date: { text: '天保2～5年頃', startYear: 1831, endYear: 1834, certainty: 'range' },
        periods: ['jp-edo'], medium: { native: '木版多色摺', ko: '다색 목판화' },
        places: [
          { place: 'museum-a', role: 'holding', url: 'https://colbase.nich.go.jp/collection_items/x' },
          { place: 'museum-b', role: 'holding', url: 'https://www.artic.edu/artworks/1' },
          { place: 'coast-a', role: 'depicted' },
        ],
        descriptions: [{
          language: 'ja', source: 'colbase', sourceId: 'cobas-1', sourceUrl: 'https://colbase.nich.go.jp/collection_items/x',
          credit: '甲博物館所蔵 / ColBase', license: 'jp-gov-standard-2.0', text: TEXT, textSha256: TEXT_SHA,
        }],
        terms: ['構図', '細部'], lookFor: ['배는 몇 척?'],
        image: { url: '/art/work-a.jpg', sourceUrl: 'https://example.org/a', license: 'public-domain', alt: '큰 파도 아래 작은 배들' },
      },
      {
        id: 'work-b', wikidata: 'Q6', genre: 'painting', artist: 'artist-a',
        title: { native: '乙図', ko: '을 그림' },
        date: { text: 'c. 1840', startYear: 1838, endYear: 1842, certainty: 'circa' },
        periods: ['jp-edo'], medium: { native: '木版' },
        places: [{ place: 'museum-b', role: 'holding', url: 'https://www.artic.edu/artworks/1' }],
        descriptions: [{
          language: 'en', source: 'aic', sourceId: '1', sourceUrl: 'https://api.artic.edu/api/v1/artworks/1',
          credit: 'Art Institute of Chicago', license: 'cc-by-4.0', text: TEXT, textSha256: TEXT_SHA,
        }],
        terms: [],
      },
    ],
    curations: [{ id: 'artist-a-special', kind: 'artist', title: { ko: '작가 갑 특집' }, works: ['work-b', 'work-a'] }],
  };
}

const pinIds = new Set(JP_MAP_PINS.map((pin) => pin.id));

/** JPEG SOF 마커에서 픽셀 크기 — 그림 파일과 카탈로그 width·height 대조용. */
function jpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

describe('정본 카탈로그(src/content/art) — 실제 리포 데이터', () => {
  it('계약을 지킨다 — 지역학 핀 연결까지 대조', async () => {
    expect(validateArtCatalog(ART_CATALOG, { studiesPinIds: pinIds })).toEqual([]);
    expect(await artDescriptionHashMismatches(ART_CATALOG), '해설은 받은 원문 그대로').toEqual([]);
  });

  it('첫 큐레이션(ART-P0-2): 호쿠사이·히로시게 풍경 우키요에 여덟 점, 연대순', () => {
    const works = artCurationWorks(ART_CATALOG, 'ukiyoe-landscape-hokusai-hiroshige');
    expect(works).toHaveLength(8);
    expect(new Set(works.map((work) => work.artist))).toEqual(new Set(['katsushika-hokusai', 'utagawa-hiroshige']));
    const starts = works.map((work) => work.date.startYear);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('둘째 큐레이션: 풍경 우키요에 속편 일곱 점, 연대순 · 첫 큐레이션과 겹치지 않는다', () => {
    const works = artCurationWorks(ART_CATALOG, 'ukiyoe-landscape-hokusai-hiroshige-2');
    expect(works).toHaveLength(7);
    const starts = works.map((work) => work.date.startYear);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const first = new Set(artCurationWorks(ART_CATALOG, 'ukiyoe-landscape-hokusai-hiroshige').map((work) => work.id));
    expect(works.filter((work) => first.has(work.id))).toEqual([]);
  });

  it('작가별 큐레이션은 그 작가의 작품만, 연대순', () => {
    for (const curation of ART_CATALOG.curations.filter((item) => item.kind === 'artist')) {
      const works = artCurationWorks(ART_CATALOG, curation.id);
      expect(new Set(works.map((work) => work.artist)).size, curation.id).toBe(1);
      const starts = works.map((work) => work.date.startYear);
      expect(starts, curation.id).toEqual([...starts].sort((a, b) => a - b));
    }
  });

  it('작품마다 일본어 해설이 하나 이상 — 읽기 자료가 되는 원문', () => {
    for (const work of ART_CATALOG.works) {
      expect(work.descriptions.some((description) => description.language === 'ja'), work.id).toBe(true);
    }
  });

  it('크레딧은 실제 출처 이름을 담는다 — ColBase는 정부표준이용규약 2.0, 시카고 미술관·문화유산 온라인은 CC BY 4.0', () => {
    for (const work of ART_CATALOG.works) {
      for (const description of work.descriptions) {
        const expected = {
          colbase: ['ColBase', 'jp-gov-standard-2.0'],
          aic: ['Art Institute of Chicago', 'cc-by-4.0'],
          bunka: ['문화유산 온라인(문화청)', 'cc-by-4.0'],
        }[description.source];
        expect(description.credit, `${work.id} ${description.sourceId}`).toContain(expected[0]);
        expect(description.license).toBe(expected[1]);
      }
    }
  });

  it('그림은 public/art에 둔 파일 — 파일이 있고 실제 픽셀 크기가 width·height와 같다(ART-IMG-001)', () => {
    const works = ART_CATALOG.works.filter((work) => work.image);
    expect(works.length).toBeGreaterThan(0);
    for (const { id, image } of works) {
      expect(image.url, id).toBe(`/art/${id}.jpg`);
      const file = path.join(process.cwd(), 'public', image.url);
      expect(fs.existsSync(file), `${file} 없음`).toBe(true);
      expect(jpegSize(fs.readFileSync(file)), id).toEqual({ width: image.width, height: image.height });
      expect(['cc0', 'public-domain', 'cc-by-4.0'], id).toContain(image.license);
      expect(image.credit, id).toMatch(/\S/);
      // CC BY 그림은 ColBase 사진뿐이고, 캡션이 소장관·ColBase·라이선스를 밝힌다(저작자 표시).
      if (image.license === 'cc-by-4.0') expect(image.credit, id).toMatch(/소장 · ColBase\(국립문화재기구\) · CC BY 4\.0$/);
    }
  });

  it('장르(ART-GENRE-001): 우키요에는 판화, 새 큐레이션은 회화·사진·건축 세 점씩 — 연대순, 서로 겹치지 않는다', () => {
    const genres = new Set(ART_CATALOG.works.map((work) => work.genre));
    expect(genres).toEqual(new Set(['print', 'painting', 'photograph', 'architecture']));
    for (const curationId of ['ukiyoe-landscape-hokusai-hiroshige', 'ukiyoe-landscape-hokusai-hiroshige-2']) {
      expect(new Set(artCurationWorks(ART_CATALOG, curationId).map((work) => work.genre)), curationId).toEqual(new Set(['print']));
    }
    const seen = new Set();
    for (const [curationId, genre] of [['modern-western-painting-japan', 'painting'], ['meiji-early-photographs', 'photograph'], ['meiji-taisho-architecture', 'architecture']]) {
      const works = artCurationWorks(ART_CATALOG, curationId);
      expect(works.map((work) => work.genre), curationId).toEqual([genre, genre, genre]);
      const starts = works.map((work) => work.date.startYear);
      expect(starts, curationId).toEqual([...starts].sort((a, b) => a - b));
      for (const work of works) { expect(seen.has(work.id), work.id).toBe(false); seen.add(work.id); }
    }
  });

  it('건축은 소장처 대신 소재지 — 문화유산 온라인 기록 링크와 함께', () => {
    for (const work of ART_CATALOG.works.filter((item) => item.genre === 'architecture')) {
      const located = work.places.filter((entry) => entry.role === 'located');
      expect(located.length, work.id).toBeGreaterThan(0);
      for (const entry of located) expect(entry.url, work.id).toMatch(/^https:\/\/online\.bunka\.go\.jp\/db\/heritages\/detail\/\d+$/);
      expect(work.descriptions.map((description) => description.source), work.id).toEqual(['bunka']);
    }
  });
});

describe('artCatalog 계약 — fail-closed', () => {
  it('완전한 픽스처는 통과', async () => {
    expect(validateArtCatalog(fixture(), { studiesPinIds: pinIds })).toEqual([]);
    expect(await artDescriptionHashMismatches(fixture())).toEqual([]);
  });

  it('전시 여부는 어디에도 저장하지 않는다(소장 ≠ 전시 중)', () => {
    const catalog = fixture();
    catalog.works[0].places[0].onView = true;
    catalog.places[0].gallery = '本館10室';
    const errors = validateArtCatalog(catalog);
    expect(errors.some((e) => e.includes('places[0].onView'))).toBe(true);
    expect(errors.some((e) => e.includes('places[0].gallery'))).toBe(true);
  });

  it('해설 라이선스는 허용 목록만, 크레딧·HTTPS 원문 주소 필수', () => {
    const catalog = fixture();
    Object.assign(catalog.works[0].descriptions[0], { license: 'all-rights-reserved', credit: '', sourceUrl: 'http://x.example' });
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/license: 허용 목록 밖/);
    expect(errors).toMatch(/credit/);
    expect(errors).toMatch(/sourceUrl/);
  });

  it('손으로 고친 해설은 원문 해시가 어긋난다', async () => {
    const catalog = fixture();
    catalog.works[0].descriptions[0].text += '（追記）';
    expect(await artDescriptionHashMismatches(catalog)).toEqual(['work-a.descriptions[0]']);
  });

  it('그림 주소는 public/art 파일만 — 미술관 서버 직접 연결은 실패', () => {
    const catalog = fixture();
    catalog.works[0].image.url = 'https://www.artic.edu/iiif/2/x/full/843,/0/default.jpg';
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/image\.url: \/art\//);
  });

  it('이미지는 퍼블릭 도메인/CC0/CC BY 4.0 + 대체 텍스트만', () => {
    const catalog = fixture();
    catalog.works[0].image = { ...catalog.works[0].image, license: 'cc-by-nc', alt: '' };
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/image.license/);
    expect(errors).toMatch(/image.alt/);
  });

  it('CC BY 그림은 캡션(저작자 표시)이 있어야 한다', () => {
    const catalog = fixture();
    catalog.works[0].image = { ...catalog.works[0].image, license: 'cc-by-4.0' };
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/cc-by-4\.0 그림은 캡션/);
    catalog.works[0].image.credit = '甲図 · 작가 갑 · 갑 박물관 소장 · ColBase(국립문화재기구) · CC BY 4.0';
    expect(validateArtCatalog(catalog)).toEqual([]);
  });

  it(`그림을 싣는 작품은 작가가 ${ART_PD_DIED_BY}년까지 세상을 떠났어야 한다(작품 저작권 — 사후 70년)`, () => {
    const catalog = fixture();
    catalog.artists[0].died = ART_PD_DIED_BY + 1;
    catalog.artists[0].born = 1900;
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/년까지 떠난 작가의 작품만 그림을 싣는다/);
    delete catalog.works[0].image;
    catalog.works[0].lookFor = [];
    expect(validateArtCatalog(catalog), '그림이 없으면 해설만 싣는다').toEqual([]);
    const boundary = fixture();
    boundary.artists[0].died = ART_PD_DIED_BY;
    expect(validateArtCatalog(boundary), `${ART_PD_DIED_BY}년에 떠난 작가는 그림을 싣는다`).toEqual([]);
  });

  it('장르는 정해진 넷만 — 작가 칸 이름이 장르를 따른다', () => {
    const catalog = fixture();
    catalog.works[0].genre = 'sculpture';
    delete catalog.works[1].genre;
    const errors = validateArtCatalog(catalog);
    expect(errors.filter((error) => error.includes('.genre: print|painting|photograph|architecture'))).toHaveLength(2);
    expect(ART_GENRE_ARTIST_ROLE).toEqual({ print: '그림', painting: '그림', photograph: '촬영', architecture: '설계' });
  });

  it('건축은 소재지(located) + 문화재 기록 링크, 소재지는 건축에만', () => {
    const catalog = fixture();
    catalog.works[0].genre = 'architecture';
    let errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/건축은 소재지\(located\)가 하나 이상/);
    catalog.works[0].places = [{ place: 'museum-a', role: 'located' }];
    errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/소재지는 문화재 기록 HTTPS 링크/);
    catalog.works[0].places[0].url = 'https://online.bunka.go.jp/db/heritages/detail/1';
    expect(validateArtCatalog(catalog)).toEqual([]);
    catalog.works[1].places.push({ place: 'museum-a', role: 'located', url: 'https://online.bunka.go.jp/db/heritages/detail/2' });
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/소재지\(located\)는 건축 작품에만/);
  });

  it('작품의 Wikidata QID는 없을 수 있다 — 있으면 형식 검사', () => {
    const catalog = fixture();
    delete catalog.works[1].wikidata;
    expect(validateArtCatalog(catalog)).toEqual([]);
    catalog.works[1].wikidata = 'not-a-qid';
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/works\[1\]\.wikidata/);
    delete catalog.artists[0].wikidata;
    expect(validateArtCatalog(catalog).join('\n'), '작가·장소는 여전히 필수').toMatch(/artists\[0\]\.wikidata/);
  });

  it('소장처 하나 이상, 장소 역할 4종, 없는 참조는 실패', () => {
    const catalog = fixture();
    catalog.works[1].places = [{ place: 'nowhere', role: 'stored' }];
    catalog.works[1].artist = 'ghost';
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/없는 장소 nowhere/);
    expect(errors).toMatch(/role: holding\|depicted\|made\|located/);
    expect(errors).toMatch(/소장처\(holding\)가 하나 이상/);
    expect(errors).toMatch(/없는 작가 ghost/);
  });

  it('날짜는 원문 표기 + 연도 범위, 거꾸로 된 범위는 실패', () => {
    const catalog = fixture();
    catalog.works[0].date = { text: '', startYear: 1834, endYear: 1831, certainty: 'range' };
    catalog.works[1].date = { text: 'c. 1840', startYear: 1842, endYear: 1838, certainty: 'circa' };
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/works\[0\]\.date\.text/);
    expect(errors).toMatch(/works\[1\]\.date: startYear ≤ endYear/);
  });

  it('Wikidata QID는 정규 키 — 형식·중복 검사', () => {
    const catalog = fixture();
    catalog.works[1].wikidata = 'Q5';
    catalog.places[2].wikidata = 'hokusai';
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/works\[1\]\.wikidata: 중복 Q5/);
    expect(errors).toMatch(/places\[2\]\.wikidata: Wikidata QID/);
  });

  it('용어·찾아볼 것은 3개 상한, 생애 요약 400자 상한', () => {
    const catalog = fixture();
    catalog.works[0].terms = ['a', 'b', 'c', 'd'];
    catalog.works[0].lookFor = ['1', '2', '3', '4'];
    catalog.artists[0].life = '가'.repeat(401);
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/terms/);
    expect(errors).toMatch(/lookFor/);
    expect(errors).toMatch(/life/);
  });

  it('지역학 핀 연결은 실제 핀만', () => {
    const catalog = fixture();
    catalog.places[0].links.studiesPin = 'atlantis';
    expect(validateArtCatalog(catalog, { studiesPinIds: pinIds }).join('\n')).toMatch(/없는 지역학 핀 atlantis/);
  });

  it('소장처는 소장품 기록 HTTPS 링크와 함께', () => {
    const catalog = fixture();
    delete catalog.works[0].places[0].url;
    catalog.works[1].places[0].url = 'http://www.artic.edu/artworks/1';
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/works\[0\]\.places\[0\]\.url/);
    expect(errors).toMatch(/works\[1\]\.places\[0\]\.url/);
  });

  it('해설 출처는 받는 곳 이름·id 형식만, 날짜 표기 출처도 같은 이름', () => {
    const catalog = fixture();
    catalog.works[0].descriptions[0].sourceId = 'A-11176';
    catalog.works[1].descriptions[0].source = 'met';
    catalog.works[0].date.source = 'wikipedia';
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/sourceId: colbase id 형식/);
    expect(errors).toMatch(/source: colbase\|aic/);
    expect(errors).toMatch(/date\.source/);
  });

  it('핵심 용어는 일본어 해설에 실제로 나오는 말만', () => {
    const catalog = fixture();
    catalog.works[0].terms = ['構図', '浮世絵'];
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/「浮世絵」가 일본어 해설에 없다/);
    expect(errors).not.toMatch(/「構図」/);
  });

  it('그림이 없는 작품에는 찾아볼 것을 두지 않는다', () => {
    const catalog = fixture();
    catalog.works[1].lookFor = ['배는 몇 척?'];
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/works\[1\]\.lookFor: 그림이 없으면/);
  });

  it('읽기 표시(＠よみ＠·+よみ+·【よみ】)가 섞인 해설은 싣지 않는다', () => {
    for (const text of ['宮＠みや＠は、熱田神宮に由来する。', '+かたきうち+の場面。', '春草【しゆんそう】、観山【かんざん】らによって']) {
      const catalog = fixture();
      catalog.works[0].descriptions[0].text = text;
      expect(validateArtCatalog(catalog).join('\n'), text).toMatch(/읽기 표시/);
    }
  });

  it('일본어 해설에 영어 문장이 섞이면 싣지 않는다 — 영어 해설·짧은 로마자는 그대로', () => {
    const catalog = fixture();
    catalog.works[0].descriptions[0].text = '箱根芦ノ湖畔で描かれた作品。This painting was created in 1897 at Ashinoko Lake in Hakone.';
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/영어 문장/);
    catalog.works[0].descriptions[0].text = 'ColBase（国立文化財機構）の解説。Kuroda Seikiの作品。';
    expect(validateArtCatalog(catalog).join('\n')).not.toMatch(/영어 문장/);
    const english = fixture();
    english.works[1].descriptions[0].text = 'This painting was created in 1897 at a lake in Hakone.';
    expect(validateArtCatalog(english).join('\n')).not.toMatch(/영어 문장/);
  });

  it('박물관 내부 메모가 섞인 해설은 싣지 않는다', () => {
    const catalog = fixture();
    catalog.works[0].descriptions[0].text = '解説の本文。（A-10569-7616と同様）(20131029_h21・22）';
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/내부 메모/);
  });

  it('큐레이션은 두 점 이상·중복 없음·있는 작품만', () => {
    const catalog = fixture();
    catalog.curations[0].works = ['work-a', 'work-a', 'work-z'];
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/중복 작품/);
    expect(errors).toMatch(/없는 작품 work-z/);
  });
});

describe('정보 카드·탐색', () => {
  it('카드: 원문 날짜 표기·시대·소장처는 늘 「소장처」·그림 속 장소·크레딧', () => {
    const card = artInfoCard(fixture(), 'work-a');
    expect(card.date).toEqual({ text: '天保2～5年頃', display: '天保2～5年頃', periods: [{ ko: '에도 시대', native: '江戸時代' }] });
    expect(card.artist.years).toBe('1760–1849');
    expect(card.holdings.map((h) => [h.id, h.label, h.url])).toEqual([
      ['museum-a', '소장처', 'https://colbase.nich.go.jp/collection_items/x'],
      ['museum-b', '소장처', 'https://www.artic.edu/artworks/1'],
    ]);
    expect(card.depicted.map((p) => p.id)).toEqual(['coast-a']);
    expect(card.credits).toEqual([{ language: 'ja', credit: '甲博物館所蔵 / ColBase', license: '정부표준이용규약 2.0', sourceUrl: 'https://colbase.nich.go.jp/collection_items/x' }]);
    expect(JSON.stringify(card)).not.toMatch(/전시/);
    expect(artInfoCard(fixture(), 'missing')).toBeNull();
  });

  // 화면 날짜(검토 반영): 출처의 영어 약식 표기(「c. 1830/33」)를 그대로 보이지 않는다 — 일본어 원문 표기만 그대로, 나머지는 한국어.
  it.each([
    [{ text: '江戸時代・安政4年(1857)', startYear: 1857, endYear: 1857, certainty: 'exact' }, '江戸時代・安政4年(1857)'],
    [{ text: '1857', startYear: 1857, endYear: 1857, certainty: 'exact' }, '1857년'],
    [{ text: '1830/33', startYear: 1830, endYear: 1833, certainty: 'range' }, '1830–33년'],
    [{ text: 'c. 1830/33', startYear: 1830, endYear: 1833, certainty: 'circa' }, '1830–33년경'],
    [{ text: 'c. 1830', startYear: 1830, endYear: 1830, certainty: 'circa' }, '1830년경'],
    [{ text: '1801-05', startYear: 1801, endYear: 1805, certainty: 'range' }, '1801–05년'],
    [{ text: '1795/1805', startYear: 1795, endYear: 1805, certainty: 'range' }, '1795–1805년'],
    [{ text: 'c. 1899/1901', startYear: 1899, endYear: 1901, certainty: 'circa' }, '1899–1901년경'],
  ])('날짜 표시 %j → %s', (date, display) => {
    expect(artDateDisplay(date)).toBe(display);
  });

  it('날짜 표시: 영어 표기는 카드에서 한국어로, 원문 표기에 이미 있는 시대 이름은 시대 칸에서 뺀다', () => {
    const catalog = fixture();
    catalog.works[1].date = { text: 'c. 1830/33', startYear: 1830, endYear: 1833, certainty: 'circa' };
    catalog.works[1].periods = ['jp-edo'];
    expect(artInfoCard(catalog, 'work-b').date).toEqual({ text: 'c. 1830/33', display: '1830–33년경', periods: [{ ko: '에도 시대', native: '江戸時代' }] });
    catalog.works[0].date = { text: '江戸時代・安政4年(1857)', startYear: 1857, endYear: 1857, certainty: 'exact' };
    expect(artInfoCard(catalog, 'work-a').date).toEqual({ text: '江戸時代・安政4年(1857)', display: '江戸時代・安政4年(1857)', periods: [] });
  });

  it('날짜 표시: 실제 카탈로그 — 화면 날짜에 영어 약식 표기(c. · /)가 남지 않는다', () => {
    for (const work of ART_CATALOG.works) {
      const { date } = artInfoCard(ART_CATALOG, work.id);
      expect(date.display, work.id).not.toMatch(/\bc\.|\//);
      for (const period of date.periods) expect(date.text.includes(period.native), `${work.id}: 시대 중복`).toBe(false);
    }
  });

  it('카드: 장르와 작가 칸 이름 · 건축은 「소재지」', () => {
    const catalog = fixture();
    expect(artInfoCard(catalog, 'work-a')).toMatchObject({ genre: 'print', artist: { role: '그림' }, located: [] });
    catalog.works[0].genre = 'architecture';
    catalog.works[0].places = [{ place: 'museum-a', role: 'located', url: 'https://online.bunka.go.jp/db/heritages/detail/1' }];
    const card = artInfoCard(catalog, 'work-a');
    expect(card.artist.role).toBe('설계');
    expect(card.holdings).toEqual([]);
    expect(card.located.map((place) => [place.id, place.label, place.url])).toEqual([['museum-a', '소재지', 'https://online.bunka.go.jp/db/heritages/detail/1']]);
    expect(artInfoCard(ART_CATALOG, 'uchida-kuichi-koraibashi').artist.role).toBe('촬영');
  });

  it('카드: 허용 밖 이미지는 그리지 않는다', () => {
    const catalog = fixture();
    catalog.works[0].image.license = 'cc-by-nc';
    expect(artInfoCard(catalog, 'work-a').image).toBeNull();
  });

  it('장소 역방향·큐레이션 순서·같은 시대 교차', () => {
    const catalog = fixture();
    expect(artWorksAtPlace(catalog, 'museum-b')).toEqual(['work-a', 'work-b']);
    expect(artWorksAtPlace(catalog, 'coast-a', 'holding')).toEqual([]);
    expect(artCurationWorks(catalog, 'artist-a-special').map((w) => w.id)).toEqual(['work-b', 'work-a']);
    expect(artWorksOverlapping(catalog, 1835, 1839)).toEqual(['work-b']);
    expect(artWorksOverlapping(catalog, 1800, 1900)).toEqual(['work-a', 'work-b']);
  });
});
