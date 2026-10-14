import { describe, expect, it } from 'vitest';
import { ART_CATALOG } from '../../content/art/index.js';
import { JP_MAP_PINS } from '../../content/studies/japanMapPins.js';
import {
  artCurationWorks,
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
        id: 'work-a', wikidata: 'Q5', artist: 'artist-a',
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
        image: { url: 'https://example.org/a.jpg', sourceUrl: 'https://example.org/a', license: 'public-domain', alt: '큰 파도 아래 작은 배들' },
      },
      {
        id: 'work-b', wikidata: 'Q6', artist: 'artist-a',
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

  it('작품마다 일본어 해설이 하나 이상 — 읽기 자료가 되는 원문', () => {
    for (const work of ART_CATALOG.works) {
      expect(work.descriptions.some((description) => description.language === 'ja'), work.id).toBe(true);
    }
  });

  it('크레딧은 실제 출처 이름을 담는다 — ColBase는 정부표준이용규약 2.0, 시카고 미술관은 CC BY 4.0', () => {
    for (const work of ART_CATALOG.works) {
      for (const description of work.descriptions) {
        const expected = { colbase: ['ColBase', 'jp-gov-standard-2.0'], aic: ['Art Institute of Chicago', 'cc-by-4.0'] }[description.source];
        expect(description.credit, `${work.id} ${description.sourceId}`).toContain(expected[0]);
        expect(description.license).toBe(expected[1]);
      }
    }
  });

  it('이미지는 시카고 미술관 CC0(퍼블릭 도메인 작품)만, 박물관 요청 캡션과 함께', () => {
    const images = ART_CATALOG.works.filter((work) => work.image).map((work) => work.image);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.url).toMatch(/^https:\/\/www\.artic\.edu\/iiif\/2\/[0-9a-f-]{36}\/full\/843,\/0\/default\.jpg$/);
      expect(image.license).toBe('cc0');
      expect(image.credit).toMatch(/The Art Institute of Chicago\. CC0$/);
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

  it('이미지는 퍼블릭 도메인/CC0 + 대체 텍스트만', () => {
    const catalog = fixture();
    catalog.works[0].image = { ...catalog.works[0].image, license: 'cc-by-nc', alt: '' };
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/image.license/);
    expect(errors).toMatch(/image.alt/);
  });

  it('소장처 하나 이상, 장소 역할 3종, 없는 참조는 실패', () => {
    const catalog = fixture();
    catalog.works[1].places = [{ place: 'nowhere', role: 'stored' }];
    catalog.works[1].artist = 'ghost';
    const errors = validateArtCatalog(catalog).join('\n');
    expect(errors).toMatch(/없는 장소 nowhere/);
    expect(errors).toMatch(/role: holding\|depicted\|made/);
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
  it('카드: 원문 날짜 표기·시대·소장처는 늘 「소장」·그림 속 장소·크레딧', () => {
    const card = artInfoCard(fixture(), 'work-a');
    expect(card.date).toEqual({ text: '天保2～5年頃', periods: [{ ko: '에도 시대', native: '江戸時代' }] });
    expect(card.artist.years).toBe('1760–1849');
    expect(card.holdings.map((h) => [h.id, h.label, h.url])).toEqual([
      ['museum-a', '소장', 'https://colbase.nich.go.jp/collection_items/x'],
      ['museum-b', '소장', 'https://www.artic.edu/artworks/1'],
    ]);
    expect(card.depicted.map((p) => p.id)).toEqual(['coast-a']);
    expect(card.credits).toEqual([{ language: 'ja', credit: '甲博物館所蔵 / ColBase', license: '정부표준이용규약 2.0', sourceUrl: 'https://colbase.nich.go.jp/collection_items/x' }]);
    expect(JSON.stringify(card)).not.toMatch(/전시/);
    expect(artInfoCard(fixture(), 'missing')).toBeNull();
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
