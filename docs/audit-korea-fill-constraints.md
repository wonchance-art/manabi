# S23 — 한국 도시 채움 시스템 제약 조사

- 기준: `origin/main` `9d19d75fce0d476f350bf092d8410541bc499495` (#506 merge)
- 범위: 서울·부산의 학습 도어와 NPC를 채울 때 재사용 가능한 현 계약
- 방식: 도시 loader 전수, 라우팅 helper·실제 UI bridge·콘텐츠 registry·관련 Vitest 정적 감사
- 성격: report-only. runtime·도시 데이터·테스트·DB를 수정하지 않는다.

## 결론 요약

1. 서울 `CITY_NODES` 23개와 부산 14개는 모두 `kind: 'spot'`이다. 두 도시 모두
   `track` 0, `chapter` 0, `npc` 0이다. 부산 자갈치의 `story-scene` gate는 학습 chapter가
   아니다.
2. 도어 helper가 아는 track 값은 정확히 `japanese`, `french`, `english`, `chinese` 네
   가지다. `korean`/`ko` track과 한국어 학습 route·registry는 없다.
3. 다만 helper 지원과 실제 플레이 지원은 같지 않다. `toInteractiveNode()`가 `track`을
   버리므로 현재 UI bridge에서는 영어 CEFR slug가 불어로 오라우팅되고, 일본어 N5와 중국어
   HSK slug는 열리지 않는다. 불어와 레거시 일본어 `ot-*`만 fallback 덕분에 살아 있다.
4. NPC는 track이나 chapter를 쓰지 않는 독립 overlay다. 불어 NPC 11종이 이미
   `ja=불어 원문`, `yomi=불어 원문+한글 독음`, `ko=한국어 뜻`으로 일본어 명칭의 슬롯을
   재사용한다. 따라서 영어 NPC를 같은 방식으로 넣는 것은 신규 track 없이 가능하지만,
   DOM `lang="ja"`와 일본어 전용 `JaText`, 독음 비노출이라는 기술 부채가 남는다.
5. 인천공항 광장 노드는 영어 시작점이 아니다. 현재는 하네다의 일본어
   `n5-tokyo-01` story scene으로 들어가는 게이트다. 영어 자산은 A1~C2 문법 route와
   런던·시드니 도어 12종이 있으나 영어 NPC는 없다.
6. 가장 작은 제품 방향은 `english + 실존 A1/A2 chapter` 도어와 영어 NPC를 서울·부산에
   두는 것이다. 새 track은 필요 없지만, 콘텐츠 배선 전에 공용 `track` 전달 결함과
   end-to-end 회귀 게이트를 별도 승인 작업으로 먼저 고쳐야 한다. 한국어 자체를 학습
   대상으로 삼으려면 `korean` track을 새로 설계해야 한다.

## 1. 서울·부산 `CITY_NODES`와 chapter 계약

### 현 payload

| 도시 | 노드 수 | `kind` | `track` | `chapter` | `npc` | 별도 gate |
|---|---:|---|---:|---:|---:|---|
| 서울 | 23 | `spot` 23 | 0 | 0 | 0 | 0 |
| 부산 | 14 | `spot` 14 | 0 | 0 | 0 | 자갈치 `story-scene` 1 |

서울과 부산은 geo POI를 그대로 `map()`해 `spot`을 만든다. 반환 객체에는 `id`, `kind`,
`name`, `nameKo`, `contentLocale`, `facade`, `tile`, `facing`, `noStamp`, `desc`만 있고
`track`·`chapter`·`npc`가 없다
([서울](../src/components/world/cities/seoul.js#L67),
[부산](../src/components/world/cities/busan.js#L70)). 부산 자갈치에만
`gate: { type: 'story-scene', scene: 'jagalchi-market-scene' }`가 조건부 추가되며
이는 문법 route가 아니라 같은 게임 안의 액트 씬이다
([부산](../src/components/world/cities/busan.js#L83)).

두 도시의 copy/geo 계약은 `contentLocale: 'ko'`, `nameField: 'nameKo'`,
`localeSlots: 'central-lookup-expandable'`이다. 이것은 장소명·설명 locale 계약이지
학습 언어 track 선언이 아니다
([서울 테스트](../src/components/world/__tests__/citySeoul.test.js#L29),
[부산 테스트](../src/components/world/__tests__/cityBusan.test.js#L28)).

### 테스트가 보장하는 것과 보장하지 않는 것

- 서울·부산 전용 테스트는 geo 크기, entrance 회랑, 한국어 exact-key/copy, POI·역
  보행성·3타일 이격, transit, 메모리를 검사한다. `track`·`chapter`의 존재·부재·값은
  assert하지 않는다
  ([서울](../src/components/world/__tests__/citySeoul.test.js#L10),
  [부산](../src/components/world/__tests__/cityBusan.test.js#L9)).
- 전 도시 공용 게이트는 어떤 노드에 `track`이 생기면 `chapter`도 있어야 하고,
  track 없는 chapter는 레거시 `ot-NN-*`만 허용한다. 그러나 도시별 최소 도어 수나
  chapter의 registry 실존 여부는 검사하지 않는다
  ([공용 게이트](../src/components/world/__tests__/cityDescCoverage.test.js#L28)).
- 따라서 현재 서울·부산의 0개 도어는 공용 게이트를 vacuous pass한다. 추후 채울 때는
  도시 테스트에 `track`·실존 chapter·보행 타일을 직접 고정해야 한다.

## 2. 도어 track 라우팅

### helper가 선언한 값 전수

`trackChapterHref(track, chapter)`의 module-private `TRACK_ROUTES`가 유일한 정본이다
([정의](../src/components/world/cultureDoors.js#L48)).

| track 값 | 허용 chapter | 목적지 | 콘텐츠 현황 | 현 도시 노드 |
|---|---|---|---:|---:|
| `japanese` | `ot-NN-*`, `n5-NN[a]?-*` | `/japanese/grammar/<slug>` | 전체 88, helper 통과 26 | 명시 track 4 |
| `french` | `a0`~`c2` `-NN-*` | `/french/grammar/<slug>` | 60, helper 통과 60 | 36 |
| `english` | `a0`~`c2` `-NN-*` 형식 | `/english/grammar/<slug>` | 전체 53, helper 통과 48 | 12 |
| `chinese` | `ot-NN-*`, `h1`~`h6` `-NN-*` | `/chinese/grammar/<slug>` | 68, helper 통과 68 | 12 |
| `korean` / `ko` | 없음 | 없음 | registry·route 없음 | 0 |

세부 제약은 다음과 같다.

- 일본어 전체 N4~N1 chapter는 콘텐츠 registry에는 있어도 도어 helper가 거부한다.
  명시 track 도어로 열 수 있는 본편은 N5뿐이다
  ([정규식](../src/components/world/cultureDoors.js#L43)).
- 영어 OT 5개는 `ot-*`라서 영어의 공용 CEFR 정규식에서 빠진다. 영어 도어로 바로 쓸 수
  있는 것은 A1~C2 48개다.
- 프랑스어와 영어는 slug 모양이 같으므로 track이 보존되지 않으면 언어를 판별할 수 없다.
- 중국어의 `ot-*`는 일본어 legacy와 동형이다. track이 없으면 일본어로 오라우팅된다.

각 언어의 실제 학습 페이지는 독립 `/[language]/grammar/[slug]` route가 해당 registry의
`ALL_CHAPTERS`를 정적 파라미터로 만든다. 영어의 예는
[route](<../src/app/(app)/english/grammar/[slug]/page.jsx#L1>)와
[registry](../src/content/english/index.js#L68)다. 통합 언어 정본도
English/French/Japanese/Chinese 네 개뿐이다
([`REF_LANGS`](../src/content/refLangs.js#L5)).

### 실제 연결 구조와 현재 bridge 결함

도어는 별도 Phaser 학습 씬이 아니다.

```text
CityScene 근접 node
  → toInteractiveNode(node)
  → GameCanvas 확인 prompt
  → onOpenChapter(chapter, node.track)
  → WorldPage router.push(track별 /grammar/<slug>)
```

`GameCanvas`는 chapter를 NPC보다 먼저 처리하고
([상호작용 우선순위](../src/components/world/GameCanvas.jsx#L767)),
확인 뒤 `onOpenChapter(chapter, node.track)`을 호출한다
([확인 prompt](../src/components/world/GameCanvas.jsx#L2952)).
`WorldPage`는 명시 track helper를 먼저 시도한 뒤 일본어 legacy, 마지막으로 불어 fallback을
시도한다
([라우터](../src/views/WorldPage.jsx#L511)).

하지만 이 앞단의 `toInteractiveNode()` 반환 객체에는 `chapter`는 있고 `track`이 없다
([bridge](../src/components/world/cultureDoors.js#L8)). `CityScene`도 이 함수를 거쳐
근접 노드를 React로 전달한다
([CityScene](../src/components/world/CityScene.js#L1928)).
따라서 현재 exact main의 end-to-end 결과는 다음과 같다.

| 입력 노드 | helper 단독 기대 | 실제 UI bridge 결과 |
|---|---|---|
| `english + a1-01-be-verb` | `/english/...` | `track` 소실 → `/french/grammar/a1-01-be-verb` |
| `french + a1-01-pronouns-etre` | `/french/...` | `track` 소실, 불어 fallback으로 우연히 정상 |
| `japanese + n5-04-desu-da` | `/japanese/...` | `track` 소실 → 두 fallback 모두 거부, 이동 없음 |
| track 없음 + `ot-07-konbini` | 일본어 legacy | `/japanese/...` 정상 |
| `chinese + h1-02-you` | `/chinese/...` | `track` 소실 → 이동 없음 |
| `chinese + ot-02-tones` | `/chinese/...` | `track` 소실 → `/japanese/...` 오라우팅 |

기존 테스트가 이 결함을 잡지 못하는 이유도 분명하다. 런던 테스트는 door 객체와
`trackChapterHref()`를 직접 연결해 기대 URL을 확인하고 CITY_NODES에 `track`이 남아 있는지만
본다
([런던 테스트](../src/components/world/__tests__/londonDoors.test.js#L8)).
반면 `toInteractiveNode()` 테스트 fixture와 기대 객체에는 `track` 자체가 없다
([bridge 테스트](../src/components/world/__tests__/cultureDoors.test.js#L4)).

### chapter 실존성의 추가 공백

현재 explicit-track 도시 노드 64개를 각 registry와 대조하면 6개가 실존하지 않는다.

| 도시 | door | 저작 chapter |
|---|---|---|
| 리옹 | `fr-19`, `fr-20` | `a2-02-articles`, `a2-03-descriptive-adjectives` |
| 보르도 | `fr-21`, `fr-22` | `a2-05-past-participles`, `a2-07-conditional` |
| 스트라스부르 | `fr-23`, `fr-24` | `a2-10-relative-clauses`, `a2-12-instructions` |

저작값은 각
[리옹](../src/components/world/lyonDoors.js#L8),
[보르도](../src/components/world/bordeauxDoors.js#L8),
[스트라스부르](../src/components/world/strasbourgDoors.js#L8) door module에서 확인했다.
공용 게이트는 `track+chapter` 동시 존재만 보고 registry membership은 보지 않기 때문이다.
한국 도시 도어는 기존 ID/slug를 복사하지 말고 새 전역 유일 ID와 실제 registry slug를
사용하며, membership을 도시 테스트에 고정해야 한다.

## 3. NPC 스크립트 계약과 비일본어 선례

### 데이터·소비 계약

NPC 도시 노드는 `kind: 'npc'`, `npc: '<NPC_SCRIPTS key>'`로 overlay를 연다. script에는
`label`, `emoji`, `intro`, `steps`, 선택적 `reward`가 있고 step 형태는 다음과 같다
([계약 주석](../src/components/world/npcScripts.js#L13)).

- `narr`: `{ t: 'narr', text }`
- `say`: `{ t: 'say', who, ja, yomi, ko, narr? }`
- `ask/choice`: `{ t: 'ask', mode: 'choice', prompt, choices, why }`
- `ask/type`: `{ t: 'ask', mode: 'type', before, after, answer, accept, hint?, why }`
- 일본 신사 전용 `omikuji`

`NpcDialog`가 `npc` key로 script를 찾고, 대사·선택지는 `JaText(ja, yomi)`, 뜻 토글은
`ko`, 직접 입력 정답은 `accept`로 처리한다
([초기화](../src/components/world/NpcDialog.jsx#L31),
[대사 렌더](../src/components/world/NpcDialog.jsx#L163),
[문항 렌더](../src/components/world/NpcDialog.jsx#L260)).
track·chapter·학습 페이지 이동은 이 계약에 없다. 한 노드에 `npc`와 `chapter`를 함께 넣으면
chapter가 먼저 소비되므로 NPC를 열 수 없다. 기존 불어 채움처럼 도어와 NPC를 인접한 별도
노드로 두어야 한다.

### 불어 재사용 선례

현 `NPC_SCRIPTS` 21종 중 11종이 불어 콘텐츠다. 첫 선례인 보르도 생장역 script는
다음처럼 필드를 재사용한다
([`gare-accueil`](../src/components/world/npcScripts.js#L192)).

| 필드 이름 | 불어 script의 실제 의미 | 예 |
|---|---|---|
| `ja` | 목표 언어 원문(불어) | `Bonjour ! Je peux vous aider ?` |
| `yomi` | 원문 반복 + 괄호 속 한글 독음 | `... (봉주르! 주 푸 부 제데?)` |
| `ko` | 한국어 뜻 | `안녕하세요! 도와드릴까요?` |
| `prompt`·`why`·`narr` | 한국어 진행·해설 | 길 묻기·정답 근거 |
| `accept` | 라틴 문자 정답과 대소문자 변형 | `Merci`, `merci`, `MERCI` |

리옹·보르도·스트라스부르의 round 2 NPC도 같은 패턴을 쓴다
([리옹 시장](../src/components/world/npcScripts.js#L916),
[보르도 제과점](../src/components/world/npcScripts.js#L1050),
[스트라스부르 서점](../src/components/world/npcScripts.js#L1184)).

이 선례는 데이터 parser가 목표 언어를 검사하지 않아 비일본어 문장을 담을 수 있음을
증명한다. 그러나 locale-neutral 계약은 아니다.

- 대사·선택지·입력에 `lang="ja"`가 하드코딩돼 있다
  ([대사](../src/components/world/NpcDialog.jsx#L180),
  [문항](../src/components/world/NpcDialog.jsx#L272)).
- `JaText`는 일본어 한자-가나 정렬기이고, 정렬 실패 시 `fallbackPron=false`이면 `yomi`를
  별도 발음으로 표시하지 않는다
  ([구현](../src/views/refShared.jsx#L116)).
- 뜻 버튼 문구도 `한국어 뜻`으로 고정이다.
- script나 node에 `contentLocale`/`track`이 없어 renderer가 언어를 전환할 수 없다.

따라서 한국 도시의 **영어 NPC**는 불어와 같은 재사용으로 현재 overlay에 넣을 수 있지만
발음·접근성은 불완전하다. 반대로 **한국어를 목표 언어로 가르치고 일본어/영어 뜻을
보이는 NPC**는 현재 `ja/yomi/ko` 의미와 맞지 않으므로 locale-neutral
`text/reading/gloss/lang` 계층으로 확장하는 편이 안전하다.

## 4. 인천공항과 en 자산

### 인천공항은 현재 일본어 시작점

광장의 `incheon-airport`는 `track`·`chapter`가 없는
`gate: { type: 'story-scene', scene: 'airport', label: '✈ 도쿄' }` 노드다
([노드](../src/components/world/worldNodes.js#L117),
[테스트](../src/components/world/__tests__/worldNodes.test.js#L59)).
`GameCanvas`가 이 씬에 싣는 콘텐츠는 일본어 reading
`n5-tokyo-01`이고
([import와 ID](../src/components/world/GameCanvas.jsx#L150)),
실제 장소도 하네다 공항, 대사도 일본어 입국심사다
([scene payload](../src/content/japanese/reading/n5_tokyo_scene1.js#L11)).

즉 인천은 지리적으로 한국에 있는 출발 게이트일 뿐 en track 자산이나 영어 chapter 진입점은
아니다. 영어 콘텐츠에서 “Incheon”을 예문으로 쓰는 것과 플레이 가능한 영어 시작점도
구분해야 한다.

### 사용 가능한 영어 자산

- 영어 registry: OT 5 + A1~C2 48 = 53 chapter. 현 door helper로는 A1~C2 48개만
  route 가능하다.
- 영어 grammar page: `/english/grammar/[slug]`.
- 도어 콘텐츠: 런던 `en-01~06` 6종
  ([데이터](../src/components/world/londonDoors.js#L1))과 시드니 `en-07~12` 6종
  ([데이터](../src/components/world/sydneyDoors.js#L1)). 12개 모두 실존 A1/A2 chapter이고
  상호 비중복이다
  ([검증](../src/components/world/__tests__/cityDoorSets.test.js#L13)).
- 도어 line 스키마는 `{ en, reading, gloss }`지만 도시 노드에는 첫 line만 `desc`로 복사되고,
  상호작용은 해당 grammar page로 이동한다
  ([런던 배선](../src/components/world/cities/london.js#L98),
  [시드니 배선](../src/components/world/cities/sydney.js#L88)).
- 영어 NPC script와 영어 전용 NPC renderer는 0개다.
- A1~C2 48개 중 기존 영어 도어가 쓰는 chapter는 12개이므로, 새 track을 만들지 않고
  한국 도시용 새 door ID에 연결할 수 있는 미사용 실존 chapter는 36개다. 단, 앞 절의
  `track` bridge 수선이 선행돼야 한다.

## 5. 서울·부산 채움 옵션

| 옵션 | 신규 track 발명 | 현 exact main에서 end-to-end | 필요한 일 | 판정 |
|---|---|---|---|---|
| `english + 실존 A1~C2` 도어 | 없음 | 영어→불어 오라우팅 | `track` bridge 보존·통합 테스트, 새 유일 ID·도시 배선 | **권장, 공용 결함 수선 후 가능** |
| track 없는 일본어 `ot-NN-*` | 없음 | 정상 | 새 유일 ID·도시 배선·콘텐츠 방향 승인 | **기술적으로 즉시 가능**, 한국 지리와 학습 방향은 별도 |
| `japanese + 실존 N5` | 없음 | 이동 없음 | `track` bridge 보존·통합 테스트 | 수선 후 가능 |
| `french + 실존 A0~C2` | 없음 | fallback으로 우연히 정상 | 실존 slug 확인·새 유일 ID | 기술적으로 가능, 한국 도시 맥락에는 비권장 |
| `chinese + 실존 ot/H1~H6` | 없음 | HSK 무반응, ot는 일본어 오라우팅 | `track` bridge 보존·통합 테스트 | 수선 후 가능 |
| `korean + 신규 chapter` 도어 | **필요** | route 없음 | registry·content·page·`REF_LANGS`·`TRACK_ROUTES`·slug 규칙·UI/test 전부 | **시스템 확장 + owner-gate** |
| 영어 NPC (`ja/yomi/ko` 재사용) | 해당 없음 | overlay 동작 | 새 script key·별도 NPC node; locale/독음 부채 수용 또는 renderer 일반화 | 신규 track 없이 가능 |
| 한국어 학습 NPC | 해당 없음 | 물리적 표시는 가능하나 의미 계약 부적합 | 목표문·독음·뜻·`lang`을 locale-neutral로 일반화 | 시스템 확장 권장 |

### 안전한 순서

1. 오너가 한국 도시의 학습 방향을 정한다. “한국 사용자에게 영어를 가르친다”면 기존
   `english`를 재사용하고, “외국인에게 한국어를 가르친다”면 `korean` 신규 track이 필요하다.
2. 기존 track 재사용안이라도 콘텐츠를 넣기 전에 `toInteractiveNode()`의 `track` 보존과
   CityScene→WorldPage end-to-end URL 테스트를 먼저 고친다. unknown explicit track은
   불어 fallback으로 흘리지 않고 fail-closed하도록 함께 고정하는 것이 안전하다.
3. 서울·부산 도어는 실제 registry membership, track, chapter, 보행 타일, 전역 유일 ID를
   도시 테스트에서 직접 assert한다.
4. NPC는 도어와 별도 노드로 둔다. 영어 1차는 불어 선례를 재사용할 수 있지만, 후속 다언어
   확산 전에는 `ja/yomi/ko`와 `lang="ja"`를 locale-neutral 계약으로 바꾸는 것이 좋다.

## 최종 판정

서울·부산 채움에 새 `korean` track이 기술적으로 필수인 것은 아니다. 한국 사용자가 영어를
연습하는 설계라면 기존 `english` registry·grammar page·미사용 chapter 36개를 재사용할 수
있고, NPC도 불어 선례를 따라 추가할 수 있다. 다만 현재 main은 explicit track을 UI bridge에서
잃으므로 영어 도어를 바로 저작하면 잘못된 불어 route로 보낸다. 따라서 **“영어 track 재사용 +
track 전달 결함 선행 수선”**이 신규 track 없이 가능한 최소 조합이다.

한국어 자체를 학습 대상으로 삼는 설계는 별개다. 현 저장소에는 Korean registry, route,
chapter slug, door track, 다언어 NPC 의미 계약이 하나도 없으므로 콘텐츠만 추가해서는
완성할 수 없다. 이 경우에는 방향 결정을 받은 뒤 시스템 확장 SPEC을 새로 발주해야 한다.

## 검증

- 공식 nvm Node `v22.23.1`.
- 조사 canonical payload 독립 A/B: 각 1,612 bytes, byte-identical SHA-256
  `02917c1664b53709ef3b26a2ff28d72d4a3ac9c4da0f26af345c9aa02c4c592a`.
- 관련 8파일: 111 tests PASS.
- 기본 5초 전체 실행에서 `cityDistrictBoundarySigns` 1건이 suite 부하로 timeout됐으나,
  같은 exact tree 단독 실행은 1파일 5 tests PASS / 3.36s.
- 최종 `set -o pipefail` 전체 단일 worker + `--testTimeout=30000`:
  231 files / 2,248 tests PASS / 283.22s / exit 0.
- 최종 전체 프로세스 peak RSS: 2,738,784 KiB.
- 문서 소스 링크 43개 / 누락·범위 초과 0. 제품 코드·도시 데이터·테스트·DB 변경 0.
