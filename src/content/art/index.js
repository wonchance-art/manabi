// 「그림 한 장 읽기」 정본 카탈로그 — 개체 4종(작가·장소·시대·작품) + 큐레이션. 형식·규칙은 src/lib/artCatalog.js, 절차는 README.md.
import artists from './artists.json';
import curations from './curations.json';
import periods from './periods.json';
import places from './places.json';
import works from './works.json';

export const ART_CATALOG = Object.freeze({ artists, places, periods, works, curations });
