# 지구제 7도시 라이브 시각 감사

## 결론

리옹·보르도·스트라스부르·서울·부산·코트다쥐르·레만 연안의 `district-v1`을 dev 게스트
하니스로 직접 열어, 개방↔잠금 경계에서 아래 두 상태를 도시별로 확인했다.

1. 잠금 지구는 지리 골격과 도로 선형을 남기되 저채도 종이 지도 톤으로 렌더된다.
2. 플레이어는 잠금 타일로 진입하지 않고 개방 타일에 머무르며, 4.2초 안내
   `이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.`를 표시한다.

7/7 도시에서 두 계약이 모두 동작했다. 런타임 결함이나 진행 차단은 발견하지 않았다. 다만
스트라스부르와 코트다쥐르의 밝은 보행 지형에서는 개방 지면과 잠금 종이 톤의 명도 차가 작아,
다음 톤 조정 때 잠금 면의 점묘·빗금 대비를 소폭 높일 후보로 남긴다.

## 범위와 환경

- 발주: 이슈 #150 코멘트 `5051753765`의 W1 report-only SPEC.
- 착수 정본: `origin/main` `31b0d68eaf03b7a8a44ee502c66c7cb6800db953`.
- 환경: 공식 nvm Node `v22.23.1`, `NEXT_PUBLIC_WORLD_DEV_GUEST=1`, Next.js dev 게스트 하니스.
- 브라우저 캡처: 1026×720 JPEG, 게임 캔버스 320×288(정확히 10×9타일).
- 방법: `?spawn=city:<id>@x,y`로 개방 경계 타일에 진입한 뒤, 잠금 방향 D-pad를 실제 홀드해
  soft wall을 발동했다. 첫 프랑스·한국 도시의 입국 브리핑은 화면의 `닫고 입장`으로 정상 소비한
  뒤 지구 상태를 촬영했다.
- 비범위: 런타임·도시 데이터·테스트·API·DB 수정, 잠금 rect 재저작, 톤 변경.

공유 3000번 dev 서버는 장시간 실행 상태에서 `/world`가 500을 반환했으므로 종료하거나 재시작하지
않았다. 같은 소스와 `node_modules`를 사용한 격리 임시 복사본을 3011번 포트에 띄워 캡처하고, 완료 후
서버와 임시 복사본을 정리했다.

## 도시별 실측

| 도시 | 게스트 경계 스폰 | 잠금 방향 | 잠금 종이 톤 | soft wall | 관찰 |
|---|---|---:|---|---|---|
| 리옹 | `city:lyon@239,139` | → | [화면](img/districts-live-lyon-guidebook.jpg) | [화면](img/districts-live-lyon-soft-wall.jpg) | 개방 공원·가로수와 회색 종이 격자가 수직 경계에서 분명히 갈린다. |
| 보르도 | `city:bordeaux@315,191` | → | [화면](img/districts-live-bordeaux-guidebook.jpg) | [화면](img/districts-live-bordeaux-soft-wall.jpg) | 개방 도로·횡단보도는 진한 원색, 잠금 도로는 간소 회색 선형으로 남는다. |
| 스트라스부르 | `city:strasbourg@110,257` | ← | [화면](img/districts-live-strasbourg-guidebook.jpg) | [화면](img/districts-live-strasbourg-soft-wall.jpg) | 도로 골격은 읽히지만 밝은 개방 지면과 종이 톤의 명도 차는 7도시 중 작은 편이다. |
| 서울 | `city:seoul@995,573` | → | [화면](img/districts-live-seoul-guidebook.jpg) | [화면](img/districts-live-seoul-soft-wall.jpg) | 개방 간선의 짙은 차도와 잠금 종이 도로가 높은 대비로 분리된다. |
| 부산 | `city:busan@810,423` | → | [화면](img/districts-live-busan-guidebook.jpg) | [화면](img/districts-live-busan-soft-wall.jpg) | 개방 도로망과 잠금 외곽 실루엣이 끊김 없이 이어지고 진입만 차단된다. |
| 코트다쥐르 | `city:cote-dazur@600,191` | ← | [화면](img/districts-live-cote-dazur-guidebook.jpg) | [화면](img/districts-live-cote-dazur-soft-wall.jpg) | 밝은 보도와 종이 톤이 가깝지만 잠금 도로 선형·식생 생략으로 상태를 구분할 수 있다. |
| 레만 연안 | `city:leman-riviera@80,140` | ← | [화면](img/districts-live-leman-riviera-guidebook.jpg) | [화면](img/districts-live-leman-riviera-soft-wall.jpg) | 개방 녹지·가로수와 잠금 종이 골격의 대비가 가장 선명한 축에 든다. |

## 공통 관찰

- 안내는 7도시 모두 캔버스 상단 안쪽에 한 줄로 수용되어 잘림·뷰포트 이탈이 없다.
- 잠금 충돌 뒤 플레이어 좌표는 경계의 개방 타일에 유지된다. 카메라 점프나 잠금 면 침범은 없다.
- 잠금 면에서도 도로·수면·지리 윤곽은 남아, RFC의 “지도에 있지만 아직 안 가 본 동네” 문법을
  유지한다. 세부 프롭·NPC·발견 표식은 잠금 면에서 노출되지 않았다.
- 프랑스학·한국학 진입 브리핑은 지구 레이어보다 위에서 먼저 안내되고, 닫은 뒤 D-pad와 soft wall이
  정상 복구된다. 두 오버레이가 동시에 남는 상태는 재현되지 않았다.
- 전체 월드 셸·날씨·시계는 라이브 값이므로 재촬영 바이트는 고정 대상이 아니다. 납품한 14개 JPEG
  자체는 아래 aggregate SHA를 2회 읽어 byte-identical임을 확인했다.

## 산출물 무결성

- 파일 수: 14(7도시 × guidebook/soft-wall 2장).
- 전 파일: JPEG/JFIF, 1026×720.
- 정렬된 개별 SHA 목록의 aggregate SHA-256(2회 동일):
  `726c2c7e4626bf111c8e2525b3cde86ad0b4aa161d0fa46bcad195281908305d`.

| 파일 | SHA-256 |
|---|---|
| `districts-live-bordeaux-guidebook.jpg` | `d4e3ea8427d02c20bfa9e8f13d90af0271d14976813069088bd34e46078e8dc0` |
| `districts-live-bordeaux-soft-wall.jpg` | `8055c1ac041513048c1c5afb1d82684ad469e3376e3e40b2865739bd9ae00864` |
| `districts-live-busan-guidebook.jpg` | `b89fd8f9d54383000308b12e8c1c84052799b6ef371cba8b1f33cf8b50709ec4` |
| `districts-live-busan-soft-wall.jpg` | `7bd9595af2498674c8b6c42472ace7a9f462febe433c32bb34d45a8902cd0a95` |
| `districts-live-cote-dazur-guidebook.jpg` | `f949c34aa77efe0318c2069cc9314bd0d47b365b516f2ae260c7c11566b13c78` |
| `districts-live-cote-dazur-soft-wall.jpg` | `5a117d1f05d879b3edcbe8d7780b1c6469d36d598b74797639fe33467222d3bd` |
| `districts-live-leman-riviera-guidebook.jpg` | `802f88068773e662806f9f36a50ae445f0683aafdad856186ba9f5fb3cbdf14f` |
| `districts-live-leman-riviera-soft-wall.jpg` | `7a5a09f71dbded1320ec8ed4fe80799356c100aa71b3b35de8582c4d723bac8b` |
| `districts-live-lyon-guidebook.jpg` | `17e60061f398dff886f764959011e9e1b8f0f80a95cc2de5ae31a670f26719c0` |
| `districts-live-lyon-soft-wall.jpg` | `b0d723e991fc1ac101b45ecaeee8527dbd33f192c2bbc5589247ce22c48eb7b4` |
| `districts-live-seoul-guidebook.jpg` | `8c04ebf420ccf87476e0ec1bdd83af05d3f2d67ef21902217c8c61d30ebd9281` |
| `districts-live-seoul-soft-wall.jpg` | `26045dc5bf09896b3076bde3964fe5225fc626a66175b23ca401d8c8b859e229` |
| `districts-live-strasbourg-guidebook.jpg` | `7a187215da4c13b73a2d18b717e54ba3f37a4352ce14f5736f526a16db64ae90` |
| `districts-live-strasbourg-soft-wall.jpg` | `2d7bbe6c44fabf41c41af36fac328b6fca321a9408786b32824f84159e122483` |

## 검증

- `npx vitest run src/components/world/__tests__/cityDistricts.test.js`: 1파일·21테스트 green.
- `npm test`: 212파일·2141테스트 green.
- `npm run lint`: green.
- 타깃 테스트 메모리(`/usr/bin/time -l`): maximum RSS 2,828,386,304 bytes,
  peak footprint 48,077,664 bytes, swap 0.
- 전체 테스트 메모리(`/usr/bin/time -l`): maximum RSS 2,328,363,008 bytes,
  peak footprint 25,300,040 bytes, swap 0.

## 판정

W1 라이브 시각 감사는 **green**이다. 7도시 지구제는 개방 경계, 잠금 종이 톤, 안내 카피,
진입 차단을 같은 문법으로 제공한다. 스트라스부르·코트다쥐르의 낮은 명도 차는 기능 결함이 아닌
후속 미감 조정 후보이며, 현 상태로 오너 사후 확인 자료에 사용할 수 있다.
