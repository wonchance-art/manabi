# 12-hip — 11-center 레이아웃 × '힙한' 서체 체계 5 (2026-10-15 KST)

**오너 요청**: 「폰트 힙한 걸로 못 바꾸나, 사용 자유로운 걸로」.

**바꾸지 않은 것**: 레이아웃은 11-center 그대로다(가운데 정렬 축 x105, 좌우 여백 M = 14mm, ①一本の線·⑤断面). 사실·문구·크레딧·실측 그림도 11-center와 같다.

**바꾼 것**: 서체 체계만 바꿨다. 제호 TONARI·となり도 체계별 서체로 바꿨다. 탐색 단계라 웹폰트 라이브 텍스트이고, 확정하면 아웃라인화는 따로 한다.

## 파일
- `systems.mjs`: 5개 체계의 역할별 서체·자간·woff2 kit
- `fit.cjs` → `fit.json`: 큰 글자 잉크 메트릭(canvas measureText)
- `build.mjs`: 결정적 생성기. 두 번 생성해 결과가 같았다. 11-center/build.mjs를 고친 것이다.
- `lib/build-line.mjs`, `data/ippon/`: 11-center 복사본
- `covers/{ippon,danmen}-H{1..5}.html`: 10장
- `compare.html` / `compare.png`: 행 = 표지, 열 = 체계, 2240px 폭
- `measure.cjs` → `measure.json`: 좌우 여백 실측
- `layout.json`

재생성(Node 24, 이 폴더에서):
```
node fit.cjs        # 서체를 바꿀 때만
node build.mjs
```

## 체계
| 체계 | 제호 TONARI | となり | 특집 제목 富士吉田 | 문구 | 그림 곁 문장 | 호 표기 / 01 / 크레딧 | 계열 수 |
|---|---|---|---|---|---|---|---|
| H1 レトロ・ディスプレイ | Dela Gothic One | Dela Gothic One | Dela Gothic One | Zen Kaku Gothic New 500 | Zen Kaku 700 | Zen Kaku 500 / 500 / 400 | 2 |
| H2 エディトリアル | Instrument Serif *Italic* | Kaisei Tokumin 800 | Kaisei Tokumin 800 | Zen Kaku 500 | Kaisei Tokumin 500 | Zen Kaku 500 / Instrument Serif Italic / Zen Kaku 400 | 3 |
| H3 ドット | DotGothic16 | DotGothic16 | DotGothic16 | Zen Kaku 500 | Zen Kaku 700 | Zen Kaku 500 / Space Grotesk 500 / Zen Kaku 400 | 3 |
| H4 筆 | Yuji Syuku | Yuji Syuku | Yuji Syuku | Zen Maru Gothic 500 | Klee One 600 | Zen Maru 500 / 500 / 400 | 3 |
| H5 コンデンス・グロテスク | Big Shoulders Display 900 | Murecho 900 | Murecho 900 | Murecho 500 | Murecho 700 | Murecho 500 / 500 / 400 | 2 |

- **장식 서체는 큰 글자에만 썼다.** 큰 글자는 제호 28mm급, となり 9.2mm, 제목 30/38mm다.
- **읽는 글자는 모두 본문용 고딕·교과서체다.** 문구 5.6mm(390px에서 10.4px), 그림 곁 문장 6mm, 크레딧 3.24mm.
- **제호 크기**: 폭 ≤157.7mm와 대문자 잉크 높이 ≤28.14mm 가운데 작은 쪽을 따랐다.
  - 폭이 정한 체계: Dela(H1) 156mm, Yuji(H4) 152mm
  - 높이가 정한 체계: Instrument Italic(H2) 107mm, DotGothic16(H3) 95mm, Big Shoulders(H5) 99mm(압축·이탤릭이라 좁다)
- 제호 아래 끝은 53.3mm로 고정했다. 그 아래 배치는 11-center와 같은 값이다.
- **큰 글자 3역할(제호·となり·제목)은 같은 woff2를 ascent/descent-override로 다시 선언했다.** 글자 상자가 잉크 높이와 같아지고(check-cover 겹침), 잉크 실측(fit.json)으로 광학 중심을 보정했다. 글리프는 그대로다.
- **H3 제호 자간 0**: DotGothic16은 고정폭이라 자간을 주면 「I」가 떨어져 보였다(1차 시트에서 확인).
- **H5 호수 「01」은 Murecho**: Big Shoulders의 「1」이 「I」처럼 읽혀서 바꿨다(1차 시트에서 확인).
- **타 잡지 모방 점검**: H5는 굵은 그로테스크 계열이지만 압축(condensed) 글꼴이고 표지 폭의 47%만 쓴다. 밤 바탕은 사진이 아닌 단색이다. 넓은 기하 블랙을 재단까지 꽉 채우고 사진 위에 흰 글자로 얹는 조합이 아니다. H2의 이탤릭 대문자 세리프는 &Premium(소문자 브래킷 세리프 + & 마크)과 대소문자·구조가 다르다.

## 라이선스 확인 (모두 SIL OFL 1.1)
- 확인 방법: github.com/google/fonts의 각 폴더 `METADATA.pb`(license 필드)와 `OFL.txt`(「SIL Open Font License, Version 1.1」 문구, 첫 저작권 줄)를 열람했다.
- 기준: google/fonts `main` = `d47d546884f75bbf718d3ddbb8d4627c68b9c782`. 열람 2026-10-15 20:41 KST.
- 상업 이용 조건이 애매한 개인 배포 무료 폰트는 쓰지 않았다.

| 서체 | METADATA license | OFL.txt 저작권 | 확인 URL |
|---|---|---|---|
| Dela Gothic One | OFL | Copyright 2020 The Dela Gothic Project Authors | https://github.com/google/fonts/tree/main/ofl/delagothicone |
| Zen Kaku Gothic New | OFL | Copyright 2022 The Zen Kaku Gothic Project Authors | https://github.com/google/fonts/tree/main/ofl/zenkakugothicnew |
| Instrument Serif | OFL | Copyright 2022 The Instrument Serif Project Authors | https://github.com/google/fonts/tree/main/ofl/instrumentserif |
| Kaisei Tokumin | OFL | Copyright 2020 The Kaisei Project Authors | https://github.com/google/fonts/tree/main/ofl/kaiseitokumin |
| DotGothic16 | OFL | Copyright 2020 The DotGothic16 Project Authors | https://github.com/google/fonts/tree/main/ofl/dotgothic16 |
| Space Grotesk | OFL | Copyright 2020 The Space Grotesk Project Authors | https://github.com/google/fonts/tree/main/ofl/spacegrotesk |
| Yuji Syuku | OFL | Copyright 2021 The Yuji Project Authors | https://github.com/google/fonts/tree/main/ofl/yujisyuku |
| Zen Maru Gothic | OFL | Copyright 2021 The Zen Maru Gothic Project Authors | https://github.com/google/fonts/tree/main/ofl/zenmarugothic |
| Klee One | OFL | Copyright 2020 The Klee Project Authors | https://github.com/google/fonts/tree/main/ofl/kleeone |
| Big Shoulders Display | OFL | Copyright 2019 The Big Shoulders Project Authors | https://github.com/google/fonts/tree/main/ofl/bigshouldersdisplay |
| Murecho | OFL | Copyright 2021 The Murecho Project Authors | https://github.com/google/fonts/tree/main/ofl/murecho |

**확정 시 주의(OFL 1.1)**
- 제호를 아웃라인 그림으로 만드는 것은 OFL 적용 밖이다(OFL-FAQ 1.1·1.13, 03-mast 검토와 같다).
- 수정한 글자를 폰트 파일로 배포하면 Modified Version 조건이 생긴다.
- Reserved Font Name이 있는 서체를 수정해 폰트로 배포할 때는 이름을 바꿔야 한다.

kit URL(큰 글자 override용 `text=` 부분집합, 공백 포함)은 2026-10-15 20:41:21 KST에 조회했다(systems.mjs).

## check-cover
10장 모두 **통과**했다(겹침 0·안전선 안·최소 글자 크기·대비).

## 좌우 여백 실측(잉크, mm, 왼쪽/오른쪽 — measure.json)
| 표지 | 제호 | となり | 호 표기 | 제목 | 문구(최대 차) | 그림 곁 문장 | 크레딧 |
|---|---|---|---|---|---|---|---|
| ippon-H1 | 27.2/27.4 | 87.4/87.5 | 87.1/87.5 | 43.4/43.6 | −0.7 | 28.6/29.4 | 49.5/49.5 |
| ippon-H2 | 51.2/51.4 | 91.2/91.1 | 87.7/87.1 | 44.9/45.0 | −0.7 | 28.1/28.8 | 49.5/49.5 |
| ippon-H3 | 57.7/57.6 | 90.7/90.7 | 86.5/86.5 | 44.6/44.6 | −0.7 | 28.6/29.4 | 49.5/49.5 |
| ippon-H4 | 29.2/29.4 | 91.6/91.5 | 87.0/87.5 | 44.0/44.0 | −0.7 | 28.2/28.8 | 49.5/49.5 |
| ippon-H5 | 55.5/55.3 | 90.1/90.1 | 86.3/86.9 | 43.9/43.9 | −0.6 | 28.0/28.6 | 50.2/50.1 |
| danmen-H1 | 27.2/27.4 | 87.4/87.5 | 87.0/87.4 | 27.0/27.2 | −0.6 | 67.8/68.8 | 47.5/47.6 |
| danmen-H2 | 51.2/51.4 | 91.2/91.1 | 87.7/87.1 | 28.9/29.0 | −0.6 | 66.8/67.8 | 47.5/47.6 |
| danmen-H3 | 57.7/57.6 | 90.7/90.7 | 86.5/86.5 | 28.5/28.5 | −0.6 | 67.8/68.8 | 47.5/47.6 |
| danmen-H4 | 29.2/29.4 | 91.5/91.5 | 87.0/87.4 | 27.8/27.8 | −0.6 | 66.0/67.1 | 47.5/47.6 |
| danmen-H5 | 55.5/55.3 | 90.1/90.1 | 86.3/86.9 | 27.6/27.6 | −0.4 | 65.6/66.4 | 47.9/48.1 |

- 제호·となり·제목의 좌우 차이는 0–0.2mm다. 나머지는 0.0–1.1mm다(⑤ 그림 곁 문장의 끝 구두점 때문이며 11-center와 같은 수준).

## 판단
- **H1**: 가장 레트로하고 매대에서 세다. Dela의 となり가 TONARI에 바짝 붙어 덩어리가 무겁다.
- **H2(추천)**: 이탤릭 세리프 제호와 장식 명조 제목의 대비가 현대 에디토리얼로 선다. 밝은 ①과 가장 잘 맞고 타 잡지와도 멀다.
- **H3**: 개성은 가장 강하다. 획이 가늘어 밤 바탕에서 약하고, 「도트」가 町 이야기와 연결되지 않는다.
- **H4**: 붓 제목은 좋다. Yuji의 라틴은 고전 세리프에 가까워 제호에서 '붓' 성격이 약하다.
- **H5(추천)**: 압축 그로테스크 제호와 Murecho 900 제목이 밤 ⑤에서 가장 힙하고 세다. 읽는 글자도 Murecho 한 벌이라 단정하다.
