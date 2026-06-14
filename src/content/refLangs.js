/**
 * 언어 레퍼런스 통합 인덱스
 * 강의 페이지(레퍼런스 뷰)와 라우트가 언어 구분 없이 같은 API로 접근한다.
 */
import french from './french';
import japanese from './japanese';
import english from './english';
import chinese from './chinese';

export const REF_LANGS = {
  English: {
    ...english,
    base: '/english',
    readKey: 'en_read_chapters',
    flag: '🇬🇧',
    name: '영어',
    langCode: 'en',
    blurb: 'A1부터 C2까지 학습 순서대로 배치된 **문법·어휘 레퍼런스**예요. 학교 영어로 «아는데 안 되는» 지점 — 한국어 감각과 충돌하는 관사·시제·어순 — 을 정면으로 공략합니다.',
    legend: ['🚨 한국인 함정', '🇰🇷 한국어와 비교', '🌱 어원 연결', '💡 팁'],
  },
  French: {
    ...french,
    base: '/french',
    readKey: 'fr_read_chapters',
    flag: '🇫🇷',
    name: '프랑스어',
    langCode: 'fr',
    blurb: 'A0 기초 상식부터 C2까지 학습 순서대로 배치된 **문법·어휘 레퍼런스**예요. 한국어 화자가 막히는 지점과, 영어와 라틴어 뿌리가 같은 단어의 연결고리를 함께 짚어줍니다.',
    legend: ['🚨 한국인 함정', '🇬🇧 영어와 비교', '🌱 라틴어 어원', '💡 팁'],
  },
  Japanese: {
    ...japanese,
    base: '/japanese',
    readKey: 'ja_read_chapters',
    flag: '🇯🇵',
    name: '일본어',
    langCode: 'ja',
    blurb: 'N5부터 N1까지 학습 순서대로 배치된 **문법·어휘 레퍼런스**예요. 한국어 화자의 3대 자산 — 같은 어순, 1:1 조사, 공유하는 한자어 — 를 무기로 쓰고, 어긋나는 지점은 정면으로 다룹니다.',
    legend: ['🚨 한국인 함정', '🇰🇷 한국어와 비교', '🈶 한자어 연결', '💡 팁'],
  },
  Chinese: {
    ...chinese,
    base: '/chinese',
    readKey: 'zh_read_chapters',
    flag: '🇨🇳',
    name: '중국어',
    langCode: 'zh',
    blurb: 'HSK 1급(H1)부터 6급(H6)까지 학습 순서대로 배치된 **문법·어휘 레퍼런스**예요. 한국어 화자의 최대 무기 — 공유하는 한자어 — 를 지렛대로 쓰고, 어순(SVO)·성조·양사처럼 어긋나는 지점은 정면으로 다룹니다.',
    legend: ['🚨 한국인 함정', '🇰🇷 한국어와 비교', '🈶 한자어 연결', '💡 팁'],
  },
};

export function getRefLang(name) {
  return REF_LANGS[name] || null;
}
