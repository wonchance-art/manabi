// vitest 설정 — 이전까지 설정 파일 없이 기본값으로 돌았다.
//
// 왜 생겼나(2026-08-19): world 스위트를 분리하자(P1) 남은 182파일이 같은 CPU(4코어)를
// 더 촘촘히 나눠 쓰게 되면서, 무거운 콘텐츠 로드 테스트들이 연쇄적으로 타임아웃에 걸렸다
// (contentSchemaContract 10s 훅, contentOverrides french 30s, cityRoadAutotile 60s 훅).
// 개별 타임아웃을 계속 올리는 건 두더지 잡기라, 여기서 두 가지를 함께 고정한다.
//
// 1) 기본 타임아웃 상향: 이 리포의 테스트는 4트랙 콘텐츠·26도시 geo를 통째로 로드하는
//    무거운 훅이 많다. 기본 5s/10s는 애초에 이 규모에 맞지 않았다.
//    30s도 부족했다 — 콘텐츠 레지스트리 전수 테스트는 단독 7s인데 4코어 병렬 경합에서
//    4배 이상 늘어 간헐 초과한다(2026-08-19 실측: contentOverrides·refQuiz).
//    동시성을 2까지 낮춰도 초과는 남고 총 시간만 비슷해(70.6s vs 78s) 타임아웃으로 푼다.
// 2) 파일 동시성 제한: 4코어에서 파일을 과하게 병렬화하면 개별 테스트의 실시간이 늘어
//    타임아웃을 유발한다. 코어 수에 맞춰 상한을 둔다.
//
// 수정(2026-08-19): 처음 쓴 `poolOptions.{threads,forks}.max*`는 **vitest 4에서 제거된
// 키**라 조용히 무시되고 있었다(실행 시 DEPRECATED 경고로 발견). 상한이 실제로는 걸린 적이
// 없었다는 뜻이라, 현행 API인 top-level `maxWorkers`로 옮긴다.
import { fileURLToPath } from 'node:url';

const config = {
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    testTimeout: 90_000,
    hookTimeout: 60_000,
    maxWorkers: 4,
  },
};

export default config;
