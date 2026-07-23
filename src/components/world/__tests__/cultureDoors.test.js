import { describe, expect, it, vi } from 'vitest';
import { BORDEAUX_DOORS } from '../bordeauxDoors.js';
import { COTE_DAZUR_DOORS } from '../coteDazurDoors.js';
import {
  cultureChapterHref,
  readingTextHref,
  resolveCultureChapterHref,
  toInteractiveNode,
  trackChapterHref,
} from '../cultureDoors.js';
import { GENEVA_DOORS } from '../genevaDoors.js';
import { LEMAN_DOORS } from '../lemanDoors.js';
import { LYON_DOORS } from '../lyonDoors.js';
import { MARSEILLE_DOORS } from '../marseilleDoors.js';
import { PARIS_DOORS } from '../parisDoors.js';
import { STRASBOURG_DOORS } from '../strasbourgDoors.js';
import { pushWorldCultureChapter } from '../../../views/worldChapterRouting.js';

describe('문화 도어 상호작용 계약', () => {
  it('Phaser 노드의 chapter·NPC·스탬프 필드를 React 근접 상태까지 보존한다', () => {
    expect(toInteractiveNode({
      id: 'ramen', name: 'ラーメン', desc: '설명', npc: 'ramen', noStamp: false,
      chapter: 'ot-10-ramen', track: 'japanese', reading: 'n5-tokyo-01',
      openNow: false, extra: '렌더 전용',
    })).toEqual({
      id: 'ramen', name: 'ラーメン', desc: '설명', gate: undefined,
      npc: 'ramen', noStamp: false, chapter: 'ot-10-ramen', track: 'japanese',
      reading: 'n5-tokyo-01', openNow: false,
    });
    expect(toInteractiveNode(null)).toBeNull();
  });

  it.each([
    ['ot-07-konbini', '/japanese/grammar/ot-07-konbini'],
    ['ot-08-izakaya', '/japanese/grammar/ot-08-izakaya'],
    ['ot-10-ramen', '/japanese/grammar/ot-10-ramen'],
    ['ot-12-menzei', '/japanese/grammar/ot-12-menzei'],
  ])('%s만 고정 문법 경로로 만든다', (chapter, href) => {
    expect(cultureChapterHref(chapter)).toBe(href);
  });

  it.each([null, '', '../admin', 'ot-10/ramen', 'ot-10-ramen?x=1', 'n5-01'])('안전하지 않은 챕터 값 %s은 거부한다', (chapter) => {
    expect(cultureChapterHref(chapter)).toBeNull();
  });

  it('A-2 독해 id만 고정 독해 경로로 만든다', () => {
    expect(readingTextHref('n5-tokyo-01')).toBe('/japanese/reading?node=n5-tokyo-01');
    expect(readingTextHref('n5-tokyo-15')).toBe('/japanese/reading?node=n5-tokyo-15');
  });

  it.each([null, '', '../admin', 'n5-tokyo-1', 'n5-tokyo-01&admin=1', 'ot-10-ramen'])('안전하지 않은 독해 값 %s은 거부한다', (reading) => {
    expect(readingTextHref(reading)).toBeNull();
  });

  // 가와구치코 ja 도어 선행 — track 명시 일본어 라우팅은 n5 본편 챕터까지 연다.
  describe('japanese track — n5 본편 확장', () => {
    it.each([
      ['n5-04-desu-da', '/japanese/grammar/n5-04-desu-da'],
      ['n5-07-existence', '/japanese/grammar/n5-07-existence'],
      ['n5-08-te-form', '/japanese/grammar/n5-08-te-form'],
      ['n5-10-kosoado', '/japanese/grammar/n5-10-kosoado'],
      ['n5-04b-meishi-neg-past', '/japanese/grammar/n5-04b-meishi-neg-past'],
      ['ot-10-ramen', '/japanese/grammar/ot-10-ramen'],
    ])('track 명시 %s 를 일본어 문법 경로로 만든다', (chapter, href) => {
      expect(trackChapterHref('japanese', chapter)).toBe(href);
    });

    it('레거시 폴백(cultureChapterHref)은 ot 전용 그대로 — n5 는 여전히 거부한다', () => {
      expect(cultureChapterHref('n5-04-desu-da')).toBeNull();
    });

    it('독해 텍스트·타 트랙 슬러그는 japanese track 에서 거부한다', () => {
      expect(trackChapterHref('japanese', 'n5-tokyo-01')).toBeNull();
      expect(trackChapterHref('japanese', 'n4-01-plain-form')).toBeNull();
      expect(trackChapterHref('japanese', 'h1-01-shi')).toBeNull();
      expect(trackChapterHref('japanese', 'a1-01-greetings')).toBeNull();
    });
  });
});

describe('CityScene → WorldPage 도어 URL 라우팅', () => {
  function routeInteractiveNode(sourceNode, router) {
    // CityScene가 ctx.setNear에 넘기는 bridge와 WorldPage의 production navigation 함수를
    // 순서대로 통과시킨다. 한국 도어 콘텐츠를 만들지 않는 virtual fixture다.
    const interactiveNode = toInteractiveNode(sourceNode);
    pushWorldCultureChapter(router, interactiveNode.chapter, interactiveNode.track);
    return interactiveNode;
  }

  it('가상 en 도어의 explicit track을 보존해 영어 URL로 이동한다', () => {
    const router = { push: vi.fn() };
    const interactiveNode = routeInteractiveNode({
      id: 'fixture-korea-en-door',
      name: '테스트 안내소',
      chapter: 'a1-01-be-verb',
      track: 'english',
    }, router);

    expect(interactiveNode.track).toBe('english');
    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith('/english/grammar/a1-01-be-verb');
  });

  it.each(['korean', '', null, '__proto__', 'toString'])(
    'unknown explicit track %j은 경고하고 불어 fallback 없이 비활성화한다',
    (track) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const router = { push: vi.fn() };

      routeInteractiveNode({
        id: `fixture-unknown-${track}`,
        name: '비활성 테스트 도어',
        chapter: 'a1-01-be-verb',
        track,
      }, router);

      expect(router.push).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(
        '[WorldPage] Unknown explicit culture track; chapter routing disabled.',
        track,
      );
      warn.mockRestore();
    },
  );

  it('알려진 explicit track의 잘못된 chapter도 타 언어 fallback 없이 닫는다', () => {
    expect(resolveCultureChapterHref('english', 'h1-01-shi')).toBeNull();
    expect(resolveCultureChapterHref('chinese', 'a1-01-be-verb')).toBeNull();
  });

  it('track 미지정 레거시 일본어·불어 fallback은 그대로 유지한다', () => {
    expect(resolveCultureChapterHref(undefined, 'ot-07-konbini'))
      .toBe('/japanese/grammar/ot-07-konbini');
    expect(resolveCultureChapterHref(undefined, 'a1-01-pronouns-etre'))
      .toBe('/french/grammar/a1-01-pronouns-etre');
  });

  it('기존 fr-01~26 도어의 bridge 이후 불어 URL을 모두 유지한다', () => {
    const frenchDoors = [
      ...PARIS_DOORS,
      ...MARSEILLE_DOORS,
      ...GENEVA_DOORS,
      ...LEMAN_DOORS,
      ...LYON_DOORS,
      ...BORDEAUX_DOORS,
      ...STRASBOURG_DOORS,
      ...COTE_DAZUR_DOORS,
    ]
      .filter((door) => /^fr-\d{2}$/.test(door.id) && Number(door.id.slice(3)) <= 26)
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(frenchDoors.map((door) => door.id))
      .toEqual(Array.from({ length: 26 }, (_, index) => `fr-${String(index + 1).padStart(2, '0')}`));

    for (const door of frenchDoors) {
      const router = { push: vi.fn() };
      const interactiveNode = routeInteractiveNode({ ...door, track: 'french' }, router);
      expect(interactiveNode.track, door.id).toBe('french');
      expect(router.push, door.id).toHaveBeenCalledOnce();
      expect(router.push, door.id)
        .toHaveBeenCalledWith(`/french/grammar/${encodeURIComponent(door.chapter)}`);
    }
  });
});
