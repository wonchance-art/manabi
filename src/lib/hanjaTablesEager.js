// 판서 캔버스 전용 — 훈음 글자를 캔버스 요소로 저장하므로 표가 동기로 있어야 한다(지연 로드 중 간체 동형 · 빈 훈음이
// 저장되면 남는다). 이 모듈을 정적으로 부른 청크(TeachingBoardCanvas — 이미 지연 청크)에만 세 표가 실린다.
// 표는 지연 로드 정본(hanjaTables.js)의 같은 캐시에 채운다 — 두 벌 캐시를 만들지 않는다.
// 뷰어 첫 JS · 일반 부품은 이 모듈을 부르지 않는다(계약: hanjaTablesLazy.test.js).
import koTable from './data/hanjaKo.json';
import hunTable from './data/hanjaHun.json';
import tradTable from './data/hanjaTrad.json';
import { seedHanjaTables } from './hanjaTables';

seedHanjaTables({ koTable, hunTable, tradTable });
