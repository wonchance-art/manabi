# `/learn` 문법 콘텐츠 번들·초기 로드 기준선

- 상태: **기준선 보고서(구현 전)**
- 발주: 이슈 #150 코멘트 `5126671583`
- 중복 제거 키: `5126671583@3e5ce2909d8716da6861f67a028d3c51711191bd`
- 기준 `git rev-parse HEAD`: `3e5ce2909d8716da6861f67a028d3c51711191bd`
- 브랜치: `codex4/learn-lazy-load`
- 런타임: Node `v22.23.1`(nvm), npm `10.9.8`, Next.js `15.5.21`
- 측정일: 2026-07-30(KST), macOS arm64

## 결론

현재 `/learn` 루트의 브라우저 초기 JS에는 네 언어 문법 본문이 실리지 않는다. 프로덕션
manifest 기준 초기 스크립트는 raw `406,131` bytes, 실제 로컬 HTTP gzip 전송은 `123,977`
bytes였다. gzip HTML `6,376` bytes까지 합친 최초 문서+스크립트 전송 기준선은 `130,353`
bytes다. 네 언어의 대표 문법 slug도 초기 스크립트에서 각각 0건이었다.

반면 `src/content/refLangs.js`를 독립 production entry로 묶으면 정적 import graph에 문법
47개 모듈, Webpack module source `2,396,952` bytes가 포함된다. 이는 해당 entry의
unminified asset `9,998,063` bytes 중 `23.97%`다. 전체 entry를 minify+gzip한 결과는
`2,787,044` bytes지만, 이 값은 어휘·문형·레지스트리를 함께 포함한 **entry 전체**이므로
문법만의 전송 절감량으로 해석하면 안 된다.

따라서 후속 구현의 성능 목표는 `/learn` root client JS 축소가 아니다. `refLangs` 또는 언어
index를 소비하는 서버·기능 경계에서 사용하지 않는 47개 문법 모듈의 parse/evaluation을 피하고,
문법 상세 라우트에서는 대상 언어·레벨만 불러오는 것이다.

## 문법 기여도

Webpack 5.98.0의 module stat은 production grammar 파일만 집계했다. 테스트 파일과
`src/content/*/grammar/**` 밖의 어휘·문형·registry 코드는 제외했다.

| 언어 | 문법 모듈 | Webpack module bytes |
|---|---:|---:|
| French | 13 | 712,633 |
| Japanese | 7 | 654,284 |
| English | 10 | 529,627 |
| Chinese | 17 | 500,408 |
| **합계** | **47** | **2,396,952** |

현재 source 조립 규칙을 그대로 적용했을 때 한 레벨을 요청하며 import해야 하는 source input
상한은 다음과 같다. 여러 레벨이 공유하는 `expansion`/`scene_travel` 파일은 브라우저 module
cache와 공용 chunk로 재사용될 수 있으므로 레벨 행을 합산하지 않는다.

| 언어 | 레벨별 source input bytes |
|---|---|
| Japanese | OT 38,952 · N5 242,562 · N4 132,430 · N3 78,176 · N2 91,933 · N1 70,231 |
| French | A0 24,487 · A1 323,222 · A2 149,418 · B1 59,232 · B2 75,560 · C1 43,913 · C2 36,801 |
| English | OT 127,111 · A1 81,527 · A2 91,884 · B1 97,529 · B2 102,066 · C1 105,292 · C2 89,788 |
| Chinese | OT 26,667 · H1 163,599 · H2 60,119 · H3 75,288 · H4 53,990 · H5 62,726 · H6 58,019 |

French A1, English 전 레벨, Chinese H1처럼 공용 scene/expansion을 filter하는 경우에도
dynamic import는 파일 단위다. 후속 구현은 템플릿 경로가 아니라 literal import를 써야 하며,
실제 chunk bytes는 구현 후 Next build 산출물로 다시 측정해야 한다.

## `/learn` production build

`npm run build`의 `prebuild`가 service-worker version을 쓰므로 보고서 작업에서는 tracked
파일을 바꾸지 않는 `next build`를 직접 실행했다.

```bash
source "$NVM_DIR/nvm.sh"
nvm use 22
npm ci

NODE_OPTIONS=--max-old-space-size=8192 \
NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SUPABASE_SERVICE_ROLE_KEY=test-service-key \
/usr/bin/time -l npx next build
```

결과:

- build 성공, 정적 페이지 `469/469`
- `/learn`: route size `3.4 kB`, First Load JS `123 kB`
- 공용 First Load JS: `103 kB`
- 네 언어 `grammar/[slug]`: route size `149 B`, First Load JS `152 kB`
- wall `56.12 s`, user `101.05 s`, sys `11.71 s`
- maximum resident set size `7,948,566,528` bytes, swaps `0`
- 기존 lint warning 2건: `lessonAdapters.js`, `lessonModel.js`의 anonymous default export

초기 스크립트 raw/gzip 파일 합계 재현:

```bash
route='/(app)/learn/page'
jq -r --arg route "$route" '.pages[$route][]' .next/app-build-manifest.json |
while IFS= read -r asset; do
  raw=$(wc -c < ".next/$asset" | tr -d ' ')
  gzip9=$(gzip -9 -c ".next/$asset" | wc -c | tr -d ' ')
  printf '%s %s %s\n' "$raw" "$gzip9" "$asset"
done
```

manifest에 기록된 9개 파일의 합은 raw `406,131` bytes, `gzip -9` `123,432` bytes다.
Next production server가 실제로 보낸 gzip 합은 `123,977` bytes였다.

대표 콘텐츠 부재 검사는 다음 네 slug를 manifest의 9개 파일에서 검색했다.

```bash
route_scripts=$(jq -r '.pages["/(app)/learn/page"][]' .next/app-build-manifest.json)
for token in n5-04-desu-da a1-01-pronouns-etre a1-01-be-verb h1-01-shi; do
  hits=0
  while IFS= read -r asset; do
    if rg -q "$token" ".next/$asset"; then hits=$((hits + 1)); fi
  done <<< "$route_scripts"
  printf '%s hit_files=%s\n' "$token" "$hits"
done
```

네 token 모두 `hit_files=0`이었다.

## 로컬 production 초기 요청

```bash
NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SUPABASE_SERVICE_ROLE_KEY=test-service-key \
npx next start -p 3114

curl --raw -sS -H 'Accept-Encoding: gzip' -o /dev/null \
  -w 'status=%{http_code} bytes=%{size_download} start=%{time_starttransfer}s total=%{time_total}s\n' \
  http://127.0.0.1:3114/learn
```

새 `next start` 프로세스의 첫 요청과 동일 프로세스 warm 요청 결과:

| 표본 | gzip HTML bytes | start transfer | total |
|---|---:|---:|---:|
| cold 1 | 6,376 | 12.081 ms | 12.294 ms |
| warm 2 | 6,376 | 2.267 ms | 2.343 ms |
| warm 3 | 6,376 | 1.834 ms | 1.865 ms |
| warm 4 | 6,376 | 1.417 ms | 1.491 ms |
| warm 5 | 6,376 | 1.882 ms | 1.964 ms |

서버 RSS는 첫 요청 전 `267,136 KiB`, 첫 요청 후 `268,848 KiB`로 `1,712 KiB` 증가했다.
5회 후에는 `269,360 KiB`로 시작 대비 `2,224 KiB` 증가했다. 이 localhost 수치는 네트워크
사용자 지연이 아니라 동일 머신에서의 route/server 기준선이다.

## 독립 `refLangs` bundle 재현과 결정성

아래 명령은 repository 파일을 만들지 않고 OS 임시 디렉터리에 production Webpack asset을
생성한다. Next에 내장된 Webpack 5.98.0과 Terser를 사용한다.

```bash
/usr/bin/time -l node - <<'NODE'
(async () => {
const fs = require('fs'), os = require('os'), path = require('path');
const crypto = require('crypto'), zlib = require('zlib');
const bundled = require('next/dist/compiled/webpack/webpack');
const terser = require('next/dist/compiled/terser');
bundled.init();
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'manabi-ref-bench-'));
const stats = await new Promise((resolve, reject) => bundled.webpack({
  mode: 'production',
  context: process.cwd(),
  entry: './src/content/refLangs.js',
  target: ['web', 'es2020'],
  devtool: false,
  output: { path: out, filename: 'refLangs.js' },
  module: { rules: [{ test: /\.js$/, resolve: { fullySpecified: false } }] },
  optimization: { minimize: false, concatenateModules: false },
}, (error, result) => error ? reject(error) : resolve(result)));
if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
const json = stats.toJson({ all: false, modules: true });
const grammar = json.modules.filter(module =>
  /src\/content\/(japanese|french|english|chinese)\/grammar\//.test(module.name));
const code = fs.readFileSync(path.join(out, 'refLangs.js'), 'utf8');
const minified = (await terser.minify(code, {
  compress: true, mangle: true, format: { comments: false },
})).code;
const byLanguage = {};
for (const module of grammar) {
  const language = module.name.match(
    /src\/content\/(japanese|french|english|chinese)\/grammar\//)[1];
  const row = byLanguage[language] ||= { modules: 0, bytes: 0 };
  row.modules += 1;
  row.bytes += module.size;
}
const summary = {
  totalModules: json.modules.length,
  grammarModules: grammar.length,
  grammarWebpackBytes: grammar.reduce((sum, module) => sum + module.size, 0),
  byLanguage,
  unminifiedBytes: Buffer.byteLength(code),
  minifiedBytes: Buffer.byteLength(minified),
  gzipBytes: zlib.gzipSync(minified, { level: 9 }).length,
  assetSha256: crypto.createHash('sha256').update(minified).digest('hex'),
};
summary.summarySha256 = crypto.createHash('sha256')
  .update(JSON.stringify(summary)).digest('hex');
console.log(JSON.stringify(summary, null, 2));
fs.rmSync(out, { recursive: true, force: true });
})();
NODE
```

동일 checkout에서 독립 임시 디렉터리로 2회 실행한 결과:

| 항목 | run 1 | run 2 |
|---|---:|---:|
| total modules | 171 | 171 |
| grammar modules | 47 | 47 |
| grammar module bytes | 2,396,952 | 2,396,952 |
| unminified asset | 9,998,063 | 9,998,063 |
| minified asset | 8,164,381 | 8,164,381 |
| gzip-9 asset | 2,787,044 | 2,787,044 |
| maximum RSS | 616,939,520 | 614,498,304 |
| swaps | 0 | 0 |

- asset SHA-256 2회:
  `d9d9ce87174a5937efa8e95a960214df1f6be4001f0b1d6515ae0d08e36defb8`
- canonical summary SHA-256 2회:
  `ff724d31e7d6812fae89622b0eeeec8832905f4b9d95bbe7804c6c6c20ad3b3e`

## before/after 해석

이번 발주는 exact shared-file allowlist와 RFC 구현 승인을 주지 않았다. 따라서 source 구현을
하지 않았고 after 수치를 만들지 않았다. 허가되지 않은 변경으로 가상의 개선치를 만드는 대신,
후속 승인 PR에서 같은 명령으로 다음을 before/after 비교해야 한다.

1. `/learn` root 초기 스크립트와 HTML은 회귀 없이 동일하거나 감소할 것.
2. 문법 상세 cold request에서 평가된 grammar module이 전체 47개가 아니라 target level과
   경계상 필요한 인접 level로 제한될 것.
3. `refLangs` legacy eager entry 기준선은 호환 경로로 남는 동안 그대로일 수 있으므로, 새 lazy
   route entry의 asset/module graph를 별도로 기록할 것.
4. 전체 build, targeted/full vitest, 정렬 결정성, cold/warm RSS를 같은 Node 22 환경에서 기록할 것.
