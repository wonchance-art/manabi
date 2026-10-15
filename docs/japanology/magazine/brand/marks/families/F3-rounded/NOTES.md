# F3 둥글고 다정한 (Rounded Neighbor) — NOTES (2026-10-15 KST)

**한 줄 콘셉트**: 모서리를 깎아 낸 차분한 굵기와 넉넉한 자간, 그리고 글자 곁에 하나 더 앉은 주홍 '이웃 점'. 말을 거는 옆집 같은 마크다.

기존 패밀리(Murecho 굵은 고딕, 기둥 = 대문자 높이의 23.5%, 자간 = 기둥 × 0.42)와 반대 방향으로 갔다.

- 굵기를 낮췄다: 기둥 = 대문자 높이의 16.4%.
- 자간을 넓혔다: 면적식 평균 = W × 1.8.
- 각진 꺾임을 없앴다.
- 주홍은 글자 일부가 아니라 글자 밖의 점 하나다.

## 파일
- `svg/TONARI-{light,dark}.svg`(우산·국제) · `svg/tonari-hira-{light,dark}.svg`(となり, 일본 시리즈) · `svg/tonari-kata-{light,dark}.svg`(トナリ, 하이브리드·경계)
  - 모두 아웃라인 path이고 `<text>`는 없다.
  - light = 밤 글자, dark = 눈 글자다. 이웃 점은 두 판 모두 주홍이다.
- `build-f3.py`: 유일한 생성기. 이것이 svg·`family.json`·`card.html`을 만든다.
- `family.json`: 원리 숫자, 가나 배율·확장량, 글자 쌍별 실측 간격, 산출 SHA256.
- `card.html` → `card.png`(폭 1500): 세 마크를 같은 배율로 놓고 밝은/밤 바탕 두 줄로 보인다. 그 아래 24px 웹 헤더, 표지 제호 폭 80%(312px) 견본이 있다.

## 가족 원리(숫자) — 세 마크 공통
단위는 서체 단위(1em = 1000)다. 라틴 대문자 높이는 H = 730이다.

| 원리 | 값 |
|---|---|
| 기준 기둥 W | 120. 라틴 I 기둥(M+ Medium 그대로). 아래 반경·간격·점은 모두 W의 배수다 |
| 평균 획 굵기(2×면적÷둘레) | 세 마크 모두 **103.9**. 가나 6자 평균을 TONARI 평균에 맞춰 이분법으로 윤곽 확장량 6.785를 정했다 |
| 획 끝 | 반원. 반경 = 그 획 굵기 × 0.5(M+ Rounded 고유 원리를 그대로 유지) |
| 바깥 모서리(꺾임·꼭짓점) 반경 | **W × 0.30 = 36**. 모폴로지 열기(−r, +r) |
| 안쪽 모서리(이음) 필렛 | **W × 0.20 = 24**. 모폴로지 닫기(+r, −r) |
| 가나 높이 | 가나 단어 잉크 높이 = H × 1.06. 배율 0.9127은 となり·トナリ 평균으로 정했다 |
| 글자 사이 | 면적식으로 정한다(아래 설명). 2D 최단 거리 ≥ W × 1.15 |
| 이웃 점 | 지름 W × 1.45. 바닥선에 앉는다(라틴 y=0, 가나 = 단어 잉크 바닥). 점 높이 띠에서 마지막 글자와 띄우는 거리 = G × 0.55 |

글자 사이 면적식:
- 단어 띠를 80줄로 자른다(라틴 0~H, 가나 잉크 띠).
- 줄마다 마주 보는 윤곽 사이 거리를 잰다. 깊이 상한은 1.25G다.
- 그 평균이 G = W × 1.8이 되게 한다.

반경을 '획 굵기 대비 %'로 고정했으므로, 마크를 어떤 크기로 쓰든 둥근 정도가 세 마크에서 같다. 잡지다운 절제를 위해 두 가지를 정했다.
- 굵기는 Medium으로 낮췄다.
- 모서리는 완전한 반원이 아니라 30%만 깎았다. 각이 살짝 남아 장난감처럼 보이지 않는다.

## 손 수정 내역(모두 `build-f3.py`의 표·숫자로만)
1. **가나 크기·굵기 맞춤**
   - 배율 0.9127.
   - 윤곽 +6.785(둥근 이음 확장). 가나 세로 기둥 113.2 → 배율 뒤 103.3 → 확장 뒤 약 117(≈ W × 0.97). 평균 획 굵기가 라틴과 같아지는 값이다.
   - 기둥만 W에 맞추면(확장 8.35) 가나가 3% 무겁게 보였다(가로획이 라틴보다 굵음). 그래서 기준을 평균 획 굵기로 바꿨다.
2. **둥근 처리**: 모든 글리프에 열기 r = 36 → 닫기 r = 24를 같은 순서로 적용했다.
   - N·A 꼭짓점, R 이음, な 교차, ナ 이음이 같은 반경으로 정리된다.
   - 원호 분할: quad_segs 16, 곡선 평탄화 12분할(고정).
3. **쌍 보정(PAIR, × W)**: 면적식이 못 잡는 광학 차이만 고쳤다.
   - O–N −0.15(둥근-직선 사이가 벌어 보임)
   - R–I −0.10(R 다리 아래 빈 삼각형)
   - ト–ナ +0.20(ト 짧은 획이 ナ 가로획 끝을 겨눠 24px에서 뭉침)
4. **이웃 점**: 서체 글리프가 아니라 원 하나를 작도했다. 1.30W로 시작했는데 24px 헤더에서 점(약 4px)이 티끌처럼 보여 1.45W(24px에서 약 5.5px)로 키웠다.
5. 기각한 시도:
   - 줄별 수평 거리만으로 최소 간격을 잡았다 → ト 짧은 획이 대각선으로 ナ에 붙었다. 그래서 2D 최단 거리로 바꿨다.
   - 평균 G = W × 1.15 → 최소 간격만 걸려 전부 촘촘했다.
   - 평균 G = W × 2.0 → 간판처럼 흩어졌다.

글자 쌍 실측(서체 단위, `family.json`). 평균은 깊이 상한을 적용한 줄별 거리 평균이다.

| 쌍 | 면적식 평균 | 2D 최단 거리 |
|---|---|---|
| T–O | 261.9 | 138 |
| O–N | 201.5 | 155.6 |
| N–A | 227.9 | 138 |
| A–R | 227.9 | 138 |
| R–I | 205.5 | 160.3 |
| と–な | 266.0 | 138 |
| な–り | 254.5 | 138 |
| ト–ナ | 270.0 | 146.4 |
| ナ–リ | 253.4 | 138 |

## 작은 크기
- 웹 헤더 24px(마크 높이 24px): 기둥 약 3.8px, 이웃 점 약 5.2–5.6px. 명·암 모두 획이 뭉치지 않는다(card 실측).
- 표지 제호 폭 312px: TONARI 높이 약 61px, となり 약 98px, トナリ 약 105px. 가로로 긴 TONARI가 가장 낮다.

## 재생성
리포 루트에서 Node 24 기준으로 실행한다.

```
F3_PYLIB=<shapely 설치 폴더(시스템에 있으면 생략)> python3 -I docs/japanology/magazine/brand/marks/families/F3-rounded/build-f3.py
node <스크래치패드>/shotfull.cjs docs/japanology/magazine/brand/marks/families/F3-rounded/card.html docs/japanology/magazine/brand/marks/families/F3-rounded/card.png 1500
```

- 의존 패키지: fontTools 4.67.0, **shapely 2.2.0(GEOS 3.14.1)**. 모폴로지 결과는 GEOS 버전에 따라 소수점이 달라질 수 있으므로 버전을 고정한다.
- 서체는 `prototype/cover-machi01/08-mast/build-mast.py`의 `font_path`로 받는다. 고정 커밋, SHA256 검증, 캐시 `TONARI_FONT_CACHE`를 쓴다. 리포에는 서체 파일을 두지 않는다.
- 두 번 빌드해 산출물이 바이트 단위로 같은 것을 확인했다(SHA256):
  - `svg/TONARI-light.svg` `48f436d1172bb52a3e9b3a64c1f53058dcba08e82375abcdd3fe8be5972ebb90`
  - `svg/TONARI-dark.svg` `c4e3d8311d0d50f784a1602a2c83c5474afafb27a53c6bd1b6f58fb96905eee8`
  - `svg/tonari-hira-light.svg` `603cb0bb3ffa5cec766516a57cec84d34d0f900f92a8464170e04d850c4e2502`
  - `svg/tonari-hira-dark.svg` `bced6a85f15730ed8ab68ef4d9f25d17ec3c4a3d30300f93ddf02deec6847d6e`
  - `svg/tonari-kata-light.svg` `07df1ad74c92593678570606c099282da0c865cd386994b27b49d0919a06e323`
  - `svg/tonari-kata-dark.svg` `9908e2e801bad650b6d1afb44cd4bbf64f07e4333eab0dcf9679aa1a65b5d57a`

## 출발 서체 라이선스(SIL OFL 1.1, 열람 2026-10-15 23:37 KST)
| 서체 | 저작권 | URL(google/fonts 고정 커밋 `67bc647ce1910e92f461bcc82aae30f21d21a9cc`) | SHA256 |
|---|---|---|---|
| M PLUS Rounded 1c Medium, Version 1.059.20150529(설계 Coji Morishita, M+ Fonts Project) | Copyright 2016 The Rounded M+ Project Authors. | https://raw.githubusercontent.com/google/fonts/67bc647ce1910e92f461bcc82aae30f21d21a9cc/ofl/mplusrounded1c/MPLUSRounded1c-Medium.ttf | `adfde1b6bae58719c4e0144612a94232e72fc5ca655c4722165fe88d06521a70` |

라이선스 확인:
- `ofl/mplusrounded1c/METADATA.pb`는 `license: "OFL"`이다.
- 같은 커밋의 이 폴더에는 OFL.txt가 없다(404 실측). 그래서 서체 name 테이블 ID 13·14를 함께 확인했다: "This Font Software is licensed under the SIL Open Font License, Version 1.1." / http://scripts.sil.org/OFL.
- 산출물은 서체 파일이 아니라 아웃라인 그림이다. 따라서 OFL 재배포 조건(RFN·동봉)은 적용되지 않는다(OFL-FAQ 1.1·1.13). 출처는 여기에 기록한다.

비교만 하고 쓰지 않은 후보(모두 OFL, 같은 커밋):
- Zen Maru Gothic Medium/Bold — 라틴 대문자가 M+보다 평범했다.
- Kiwi Maru — 둥근 명조라 '고딕 둥근' 성격이 흐려졌다.
- Nunito(wght 600–800) — 라틴만 있다.
- Quicksand(wght 700) — 라틴만 있다. RFN 'Quicksand'.
- Varela Round — 라틴만 있다. RFN 'Varela'.

라틴과 가나를 한 설계자가 한 원리로 그린 M+ 한 벌이 '가족' 조건에 가장 맞았다.

## 모방 점검(대조는 글자 기술로만, 타사 이미지 반입 없음)
- **POPEYE**(부풀린 버블, 하이라이트): F3는 Medium 굵기의 모노라인에 가깝다. 볼륨·하이라이트·분홍이 없다. 다르다.
- **BRUTUS**(울트라 블랙, 글자 붙음): 굵기·자간이 정반대다.
- **&Premium**(세리프 소문자 + 원 안 &): 다르다.
- **CLASSY.**(끝에 마침표를 둔 세리프 대문자 제호): 마침표라는 장치만 겹친다.
  - F3 점은 둥근 산세리프에 붙은 주홍 원이다. 지름은 W × 1.45로, 기둥보다 크다.
  - 가나 마크에서는 「。」 자리에 앉는다. 성격이 다르다고 판단했다.
- 결론: 버린 안 없음. 다만 '끝 점' 장치 자체는 흔하다(아래 약점).

## 스스로 본 약점
- 글자꼴 자체는 M+ Rounded Medium에서 크게 벗어나지 않는다. 고유성은 간격·둥근 반경 통일·이웃 점에 기대고 있어, 서체만 깔아도 비슷한 인상이 나온다.
- 24px에서는 이웃 점이 약 5.2–5.6px로 작다. 주홍 대비 3.9:1이라 밤 바탕에서는 더 약하다.
