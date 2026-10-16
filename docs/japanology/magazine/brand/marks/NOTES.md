# となり 브랜드 마크(워드마크) 세트 — NOTES (2026-10-15 KST)

오너 요청 「tonari만 알파벳 버전이랑 히라가나/가타카나 버전으로 브랜드 마크 뽑아볼까」에 따른 마크 세트다. 표지 제호와 별개로, 잡지·서비스 어디에나 쓰는 워드마크다.

역할(오너 정정 2026-10-15 KST):

| 마크 | 역할 |
|---|---|
| **TONARI** | 국제·보편 — 우산 브랜드. 일본 외 나라 시리즈와 서비스를 대표 |
| **となり** | 일본 국내 시리즈 |
| **トナリ** | 하이브리드/경계 — 일본×다른 나라가 만나는 꼭지 |

TONARI는 manabi 앱 안의 매거진 브랜드다. 그래서 앱 아이콘·파비콘은 만들지 않았다(그 자리는 manabi 유지). 대신 실제 화면 견본을 시트에 넣었다.

## 파일
- `svg/`: 마크마다 `-light`(밤 글자) / `-dark`(눈 글자). 모두 아웃라인 path이고 서체 `<text>`는 없다.
  - 패밀리: `F-up`(TONARI) · `F-hira`(となり) · `F-kata`(トナリ) · `F-lo`(tonari)
  - 스타일 안: `L1-up` · `L1-lo` · `L2-up` · `L2-lo` · `H1` · `H2` · `H3` · `K1` · `K2`
  - 락업: `HL-tonari`·`HL-tonari-k`(계층), `LK-kr`(선택)
  - 사용 예: `use-chip-kotoba.svg`(꼭지 칩), `use-sticker.svg`(스티커)
- `sheet.html` / `sheet.png` 순서:
  1. 맨 위 패밀리(역할 라벨, 같은 배율)
  2. 패밀리 마크별 큰 크기 + 표지 제호 폭 80% + 웹 헤더 24px(명·암)
  3. 계층 락업
  4. 화면별 사용 견본
  5. 다른 스타일 안
- `marks.json`: 마크별 의도·수정·출발 서체, 패밀리 계산값(가나 배율 0.8925·가나 윤곽 확장 18.48단위·기둥 170·자간 71.4).
- 재생성(리포 루트, Node 24):
  ```
  python3 -I docs/japanology/magazine/brand/marks/build-marks.py
  node docs/japanology/magazine/brand/marks/shoot.cjs
  ```
  - 서체는 `prototype/cover-machi01/08-mast/build-mast.py`의 고정 커밋·SHA256 검증·캐시(`TONARI_FONT_CACHE`)로 받는다. 리포에 서체 파일은 두지 않는다.
  - 두 번 빌드해 산출물 SHA256이 같은 것을 확인했다.

## 출발 서체 라이선스(모두 SIL OFL 1.1, google/fonts `67bc647ce1910e92f461bcc82aae30f21d21a9cc`)
| 키 | 서체(버전) | 저작권 | 경로 | SHA256 |
|---|---|---|---|---|
| murecho | Murecho 1.010 가변 → wght 700 | Copyright 2021 The Murecho Project Authors | murecho/Murecho[wght].ttf | `3a273c2f11e0164f829bc15c0689e587fe34d1493ff167d5afff8fe71a29e667` |
| instrument | Instrument Serif 1.000 | Copyright 2022 The Instrument Serif Project Authors | instrumentserif/InstrumentSerif-Regular.ttf | `498efd461f6ddfcb7a111bf9a565709d2085d48201d501ead960d93e84ffbb88` |
| instrument-i | Instrument Serif Italic 1.000 | 위와 같음 | instrumentserif/InstrumentSerif-Italic.ttf | `08939b8bdf534afec24ae0ef5e03f948940cd9a8fe08e7fecbad040e62327385` |
| bigshoulders | Big Shoulders Display 2.002 가변 → wght 800 | Copyright 2019 The Big Shoulders Project Authors | bigshouldersdisplay/BigShouldersDisplay[wght].ttf | `60e208dc276a1c35fc5b62e94f9fb959c40c11783a9eb7548175c14b1fbeb720` |
| kaisei | Kaisei Tokumin ExtraBold 5.003 | Copyright 2020 The Kaisei Project Authors | kaiseitokumin/KaiseiTokumin-ExtraBold.ttf | `bf44bb3e23cc703bfb19111833f78e651998d0a2b1863eff9e88cecb38a8bc53` |
| dela | Dela Gothic One 1.005 | Copyright 2020 The Dela Gothic Project Authors | delagothicone/DelaGothicOne-Regular.ttf | `4ff87a0965f1b0505e5a2c58424bc6ad3cff27e56a82f21c2fc9d6b0e3857ee2` |
| zenmaru | Zen Maru Gothic Black 1.001 | Copyright 2021 The Zen Maru Gothic Authors | zenmarugothic/ZenMaruGothic-Black.ttf | `6bd74fe76cd39ee0ec18775c3661d845343fb3f6f8fa09a3076638417baf741f` |
| (K2) | 서체 없음 — 직선·원호로 직접 작도 | — | — | — |

- 산출물은 서체 파일이 아니라 아웃라인 그림이므로 OFL 재배포 조건(RFN·동봉) 적용 밖이다(OFL-FAQ 1.1·1.13). 출처는 여기에 기록한다.
- 화면 견본의 본문 글자(목차·제목 자리 표시 등)는 시트 HTML에서 Google Fonts를 불러 쓴 견본용이고, 마크가 아니다.

## 패밀리(최우선) — 한 기하 원리로 그린 TONARI · となり · トナリ
출발 서체는 Murecho다. 한 디자이너가 라틴·가나를 같은 기하로 그린 OFL 서체라서 골랐다. 여기에 아래 네 원리를 숫자로 고정했다.

1. **같은 획 굵기**: 라틴 대문자 기둥(I = 170단위)이 기준이다. 가나는 배율을 맞춘 뒤 윤곽을 18.48단위 확장했다. 이로써 배율 뒤 가나 기둥 = 170이 된다(Murecho 가나 기둥 평균 153.5).
2. **같은 높이**: 가나 잉크 높이 = 대문자 높이 × 1.04. 가나 배율은 0.8925다. 가나는 네모 안에서 작아 보이므로 4%를 키웠다.
3. **같은 리듬**: 세 표기 모두 잉크 사이 = 기둥 × 0.42(71.4단위)다.
4. **주홍 하나**: 각 표기에서 '본체 곁에 떨어져 선 작은 획' 하나만 주홍이다.
   - TONARI의 A 가로대(두 다리 사이의 이웃 획) · となり의 と 첫 획 · トナリ의 ト 짧은 획 · tonari의 i 점
   - 겹치는 부분은 본체 색이 위에 온다.
   - 주홍은 대비 3.9:1이라 비글자 장식이다. 단색 인쇄에서는 본체 색으로 바꿔도 형태가 같다.

평가: 시트 맨 위 세 칸을 **같은 배율**로 놓았다. TONARI의 기둥과 となり·トナリ의 획 굵기가 눈으로 같고, 높이·자간 리듬·주홍 위치 규칙이 한 가족으로 읽힌다(sheet.png 맨 위).

### 계층 락업(우산 + 시리즈)
- `HL-tonari`: TONARI(크게)
  - 그 아래 얇은 밤 선(기둥의 22%)을 둔다.
  - 선 아래 왼쪽에 시리즈 となり(TONARI em의 34%)를 둔다.
  - 같은 굵기·자간 원리라 크기만 다른 한 가족이다.
- `HL-tonari-k`: 같은 구조에 시리즈 トナリ를 넣었다.
- `LK-kr`(선택, 우선순위 낮춤): となり 아래 작은 TONARI를 となり 폭에 맞춰 자간을 벌렸다. 한국 독자용 후보다.

## 다른 스타일 안(표기별 의도·수정)
### 알파벳
- **L1 에디토리얼 세리프**: 12-hip H2 계열.
  - `L1-up` TONARI(Instrument Serif)
    - T·A 대문자선 위로 솟은 세리프 끝·꼭짓점(>722)을 40%로 눌렀다.
    - R 다리 끝 +22.
    - 윤곽 +8(웹 헤더 24px에서 헤어라인 보강).
    - 자간 0.02–0.035em.
  - `L1-lo` tonari(Instrument Serif Italic)
    - **t 가로획 오른쪽 끝(점 25–29)을 +64 늘여 o에 닿게** 했다. 이웃 글자끼리 손을 잡는 이음이다.
    - 윤곽 +8.
- **L2 압축 그로테스크**: 12-hip H5 계열, Big Shoulders Display 800.
  - `L2-up`
    - A 가로대를 내리고 사선 위 x를 보정했다.
    - 꼭짓점 윗변을 좁혔다.
    - R 다리 발끝 폭을 좁혀 곧게 세웠다.
    - 자간 0.035–0.05em.
  - `L2-lo`
    - t 가로대 왼쪽 돌기를 깎고 오른쪽을 늘렸다. 가로대가 o 쪽으로만 뻗는다.
- **L3 자유안 = 패밀리 Murecho**(`F-up`·`F-lo`) — 기하 산세리프.

### 히라가나
- **H1 명조**(Kaisei Tokumin ExtraBold):
  - な 교차부 바늘구멍(윤곽 1) 삭제.
  - な 고리 속공간 112×130%.
  - 자간 0.05em.
  - 장식 명조의 구슬 맺음이 12-hip H2 제목과 같은 목소리다.
- **H2 굵은 고딕 디스플레이**(Dela Gothic One):
  - な 고리 속공간(96×52, 거의 막힘)을 170×210%로 열었다.
  - 자간 0.035em.
- **H3 둥근**(Zen Maru Gothic Black):
  - な 고리 속공간 145×175%.
  - 자간 0.04em.
- 패밀리 `F-hira`.

### 가타카나
- **K1 굵은 고딕**(Dela Gothic One):
  - ト 짧은 획 끝 +36(ナ 쪽으로 뻗음).
  - 윤곽 −10(헤더 24px에서 틈 확보).
  - 시험 기각: ナ 줄기 머리를 자르면 「テ」로 읽혔다.
- **K2 모노라인 기하(직접 작도)**: 서체 없이 그렸다.
  - 굵기 104 단일, 끝은 모두 직각 절단.
  - ト = 수직 줄기 + −22° 짧은 획.
  - ナ·リ = 직선 + 62° 원호 꼬리 하나(2차 베지어 30° 조각).
- 패밀리 `F-kata`.

## 화면별 사용 견본(sheet '화면별 사용 견본' 절)
- 더미 글자는 모두 「（ダミー）」「Série ——（ダミー）」「Titre（ダミー）」「写真ダミー」로 표시했다. 사실 주장은 없다.
- **TONARI**:
  - 서재 매거진 진열대 머리(390px, 1440px는 50% 축소)
  - 일본 외 시리즈 가상 표지 제호(시리즈명 자리 표시)
  - SNS 공유 이미지 1200×630(50% 축소)
- **となり**:
  - 일본 시리즈 표지 제호(一つの町 01 富士吉田, 12-hip 배치를 단순화)
  - 호 목차 페이지 머리
  - 뷰어 扉 머리(밤)
  - 크레딧 「となり編集部」(마크 + 글자 / 글자만)
- **トナリ**:
  - 꼭지 라벨 칩 「トナリ｜ことば」(한일 비교 꼭지, 40·24px)
  - 연결 키워드 페이지 머리
  - 원형 주홍 스티커(스티커 위에서는 ト 획을 밤색으로 바꿈)

## 모방 점검(대조 시트 `diff-marks.png`는 스크래치패드 mast-refs/에만 — 타사 이미지 리포 반입 금지)
- **BRUTUS** — 울트라 블랙 넓은 산세리프 대문자, 글자끼리 붙음, 둥글게 뭉친 속공간, 사진 위 흰색, 가장자리 변형.
  - 패밀리 TONARI(볼드, 보통 폭, 열린 자간, 주홍 가로대), L2(압축, 무장식)와 굵기·비례·자간·장식이 다르다.
- **&Premium** — 똑바른 굵은 브래킷 세리프 소문자 + 원 안의 「&」.
  - L1-lo(가는 이탤릭 세리프)·L1-up(가는 디스플레이 대문자)과 굵기·기울기·대소문자 구성이 다르고, & 마크가 없다.
- **POPEYE** — 부풀린 둥근 버블 글자, 하이라이트, 분홍.
  - 둥근 계열은 H3 となり뿐이다. H3는 가나이고 볼륨·하이라이트·색이 없다.
- 결론: 버린 안 없음.

## 추천
- **패밀리 세트(F)를 브랜드 체계로 채택**: TONARI(우산) · となり(일본 시리즈) · トナリ(하이브리드).
  - 세 마크가 같은 굵기·높이·자간·주홍 규칙으로 한 가족이 된다.
  - 계층 락업과 웹 헤더 24px에서도 무너지지 않는다.
- 표기별 대체 후보:
  - 알파벳: L1-lo(이탤릭 tonari, 에디토리얼 지면용)
  - 히라가나: H1(Kaisei 명조, 표지 제호용)
  - 가타카나: K2(모노라인 작도, 꼭지 라벨용)
