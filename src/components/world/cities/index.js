import FUKUOKA from './fukuoka.js';
import TOKYO from './tokyo.js';
import OSAKA from './osaka.js';
import KYOTO from './kyoto.js';
import BUSAN from './busan.js';
import SEOUL from './seoul.js';
import GRAND_PARIS from './grand-paris.js';
import MONT_SAINT_MICHEL from './mont-saint-michel.js';

// 실제 플레이 씬과 관리자 전체 맵 뷰어가 함께 쓰는 도시 레지스트리.
// 도시를 추가할 때 이 목록만 갱신하면 두 화면에 같은 순서로 노출된다.
export const CITY_MAPS = Object.freeze([
  FUKUOKA, TOKYO, OSAKA, KYOTO, BUSAN, SEOUL, GRAND_PARIS, MONT_SAINT_MICHEL,
]);

export const CITY_DATA = Object.freeze(
  Object.fromEntries(CITY_MAPS.map((city) => [city.id, city])),
);
