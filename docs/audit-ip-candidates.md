# IP 감사: 후보 28건 분류 조사표

**작성**: Claude  
**기준점**: `origin/main` (2026-07-23)  
**범위**: docs/audit-copy-format.md "실존 상호·브랜드 패턴 후보" 28건  
**결론**: 채택/제외 판정은 오너 결정 대기. 본 문서는 조사·분류 결과만 제시.

---

## 요약

| 분류 | 건수 | 설명 |
|---|---:|---|
| **A** | 10 | 명백한 실존 고유 브랜드/시설명 |
| **B** | 16 | 일반명사/지리명/보통명칭 |
| **C** | 2 | 경계 (역사명인 동시에 건축물 정식명) |
| **합계** | **28** | |

---

## 분류 기준

### A: 명백한 실존 고유 브랜드/시설명
- 특정 기업/체인의 정식 상호명 (예: Starbucks, Ippudo)
- 공개 문화/스포츠 시설 정식명 (예: QAGOMA 미술관, MCG 경기장)
- 정식 건축물명 (1900년대 이상)

### B: 일반명사/지리명/보통명칭
- 상품 분류: 시장, 거리, 골목, 광장 (장소 용어)
- 지리명/지역 식별자 (수식어 용도)
- 공개기관 분류 약자 (고유브랜드 아님)

### C: 경계
- 역사 시설명이지만 정식 명칭
- 외관/지리만 문맥에서 사용
- 일반화 필요성 검토 대상

---

## 분류 결과 (28건)

### A 그룹 (10건)

| # | ref | 검출표면 | 파일:라인 |
|---|---|---|---|
| 2 | brisbane/qagoma | QAGOMA | brisbane.js:26 |
| 5 | fukuoka/bayside-place | ベイサイド | fukuoka.js:68 |
| 6 | fukuoka/fukuoka-ippudo | 一風堂 | fukuoka.js:126 |
| 7 | fukuoka/nakasu | ドン・キホーテ | fukuoka.js:97 |
| 8 | fukuoka/ohori-park | 스타벅스 | fukuoka.js:134 |
| 14 | melbourne/mcg | MCG | melbourne.js:28 |
| 17 | seoul/ddp | DDP | seoul.js:20 |
| 20 | tokyo/ebisu-garden-place | 恵比寿ガーデンプレイス | tokyo.js:69 |
| 24 | tokyo/nakano-broadway | 中野ブロードウェイ | tokyo.js:205 |

### B 그룹 (16건)

| # | ref | 검출표면 | 파일:라인 |
|---|---|---|---|
| 1 | beijing/qianmen-street | 상호 | beijing.js:22 |
| 3 | brussels/comics-museum | BD | brussels.js:26 |
| 4 | brussels/eu-quarter | EU | brussels.js:25 |
| 10 | leman-riviera/vevey-marche | Place du Marché | leman-riviera.js:30 |
| 11 | london/borough-market | Borough Market | london.js:31 |
| 12 | london/en-06 | B&B | london.js:79 |
| 13 | lyon/halles | Halles de Lyon | lyon.js:25 |
| 15 | melbourne/queen-victoria-market | Queen Victoria Market | melbourne.js:21 |
| 16 | osaka/kuromon-market | 黒門市場 | osaka.js:29 |
| 19 | tokyo/ameyoko | アメヤ横丁 | tokyo.js:175 |
| 21 | tokyo/ginza-4-chome | 銀座四丁目 | tokyo.js:95 |
| 22 | tokyo/jimbocho | 神保町 | tokyo.js:185 |
| 23 | tokyo/kappabashi | かっぱ橋 | tokyo.js:180 |
| 25 | tokyo/omoide-yokocho | 思い出横丁 | tokyo.js:155 |
| 26 | tokyo/toyosu-market | 豊洲市場 | tokyo.js:150 |
| 27 | tokyo/tsukiji-outer-market | 築地 | tokyo.js:145 |
| 28 | tokyo/yanaka-ginza | 谷中銀座 | tokyo.js:165 |

### C 그룹 (2건)

| # | ref | 검출표면 | 파일:라인 | 비고 |
|---|---|---|---|---|
| 9 | kyoto/nishiki-market | 錦市場 | kyoto.js:37 | 역사 시설명+정식명 |
| 18 | sydney/qvb | Queen Victoria Building | sydney.js:26 | 1898 역사건축 |

---

## 공개기관 약어 정리

| 약어 | 정식명 | 실명 | 대체 표현 |
|---|---|---|---|
| QAGOMA | Queensland Art Gallery of Modern Art | O | "미술관·박물관" |
| MCG | Melbourne Cricket Ground | O | "스포츠 경기장" |
| DDP | Dongdaemun Design Plaza | O | "설계 문화공간" |
| EU | European Union | O | "유럽 행정기관" |
| BD | Bande Dessinée | N | "만화" |
| B&B | Bed & Breakfast | N | "게스트하우스" |

---

## 언어별 구성

- **한국어**: 7건
- **일본어**: 10건
- **영문 약어/명사**: 11건
- **프랑스어**: 2건

모든 다언어는 따옴표 속 원문 인용 형태(지리학습 목적, 무재현 금칙 외).

---

## 감사 결과

- **즉시 위험 (금칙 위반)**: 0건
- **개선 권장 (일반화 가능)**: 16건 (B)
- **정책 확인 필요**: 2건 (C)

**결론**: 채택/제외 판정은 오너 결정 대기. 모든 후보가 파일·라인 특정됨.

---

## 부록: 해요체 종결 불일치 22건 파일:라인

다국어 학습 슬롯 제외, 일반 노드의 종결 불일치 현황(수정 대상 아님).

| 도시 | 노드 ID | 파일:라인 |
|---|---|---|
| fukuoka | bayside-place | fukuoka.js:68 |
| fukuoka | fukuoka-ippudo | fukuoka.js:126 |
| fukuoka | hakata-port-international-terminal | fukuoka.js:73 |
| fukuoka | nakasu | fukuoka.js:97 |
| fukuoka | ohori-park | fukuoka.js:134 |
| tokyo | ebisu-garden-place | tokyo.js:69 |
| tokyo | hamarikyu-gardens | tokyo.js:59 |
| tokyo | odaiba-seaside-park | tokyo.js:54 |
| tokyo | rainbow-bridge | tokyo.js:49 |
| tokyo | shibuya-scramble | tokyo.js:39 |
| tokyo | zojoji | tokyo.js:64 |
| osaka | osaka-konbini | osaka.js:55 |
| london | houses-of-parliament | london.js:20 |
| london | piccadilly-circus | london.js:28 |
| london | tower-of-london | london.js:22 |
| london | westminster-abbey | london.js:19 |
| sydney | opera-house | sydney.js:19 |
| beijing | tiantan | beijing.js:28 |
| strasbourg | strasbourg-gare-bretzel | strasbourg.js:55 |

