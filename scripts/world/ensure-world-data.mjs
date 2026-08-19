#!/usr/bin/env node
// Overpass 원본 스냅샷(scripts/data) 확보 — 도시 파이프라인 재현 테스트 전용.
//
// 왜 리포에 없나: 이 데이터는 52파일·43MB인데 **런타임·빌드가 전혀 참조하지 않는다**.
// 오직 도시 geo를 재생성했을 때 파이프라인 결정성을 재현 검증하는 용도다. 모든 clone과
// CI 체크아웃이 매번 43MB를 받을 이유가 없어 main에서 분리했다(오너 승인 2026-08-19 P2).
//
// 어디에 있나: `world-data` 브랜치에 그대로 보존된다(히스토리 유실 없음).
// 복원: node scripts/world/ensure-world-data.mjs  (npm run world:fetch-data)
//
// 조용한 스킵을 두지 않는 이유: 데이터가 없다고 테스트를 건너뛰면 "검증했다"는 착시가
// 생긴다. 없으면 받아오고, 받아오지 못하면 명확한 안내와 함께 실패한다.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const dataDir = path.join(root, 'scripts/data');
const REF = process.env.WORLD_DATA_REF || 'world-data';

const count = () => (existsSync(dataDir) ? readdirSync(dataDir).filter((f) => f.endsWith('.json')).length : 0);

if (count() > 0) {
  console.log(`world data: 이미 있음 (${count()}파일) — ${path.relative(root, dataDir)}`);
  process.exit(0);
}

const git = (args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

try {
  console.log(`world data: ${REF}에서 복원 중…`);
  try {
    git(['rev-parse', '--verify', `${REF}^{commit}`]);
  } catch {
    git(['fetch', '--depth', '1', 'origin', `${REF}:${REF}`]);
  }
  git(['checkout', REF, '--', 'scripts/data']);
  // 워킹트리에만 두고 인덱스에서는 뺀다 — 다시 커밋되는 사고 방지(.gitignore와 이중 방어).
  try { git(['restore', '--staged', 'scripts/data']); } catch { /* 구버전 git 폴백 */ }
  console.log(`world data: 복원 완료 (${count()}파일)`);
} catch (err) {
  console.error(`
✗ world data를 가져오지 못했습니다.

  이 데이터(scripts/data, Overpass 원본 스냅샷)는 리포 용량 때문에 '${REF}' 브랜치에
  분리 보관돼 있습니다. 도시 파이프라인 테스트를 돌리려면 먼저 받아야 합니다.

  수동 복원:
    git fetch --depth 1 origin ${REF}:${REF}
    git checkout ${REF} -- scripts/data

  원인: ${err?.message || err}
`);
  process.exit(1);
}
