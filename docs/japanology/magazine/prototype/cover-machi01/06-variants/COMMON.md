# 표지 여러 안 — 공통 지시 (2026-10-15 KST, 편집장)

오너 요청 「표지 여러개 내봐」. 『となり』 一つの町 01 富士吉田 표지를 **주인공이 다른** 여러 안으로 낸다. 각 디자이너는 자기 안 하나만 끝까지 만든다.

## 반드시 읽을 것
- 규격: /home/user/manabi/docs/japanology/magazine/cover-spec.md — 특히 §0 v1 '주인공은 하나'(틀 없음·재단까지·요소 7개 이하·부제는 가리키는 곳 곁·전용 제호·대비 미달 색은 비글자 전용·활자 두 계열)
- 현행 1안과 제작 기록: /home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/ (README.md, 05-compose/v2/cover.html — HTML 구조·폰트 로딩·--mm 단위·제호 삽입 방식을 그대로 참고), fujiyoshida-cover.png
- 제호 SVG: 위 폴더 03-mast/mast-light.svg(밝은 바탕), mast-dark.svg(어두운 바탕). 높이 16mm, (13,13). 수정 금지.
- 원고: /home/user/manabi/docs/japanology/magazine/ja/machi-fujiyoshida.md (본문 (2)·출처표). 취재: ../issues/machi-01-fujiyoshida/research-a.md, research-b.md
- 팩트 검수: /home/user/manabi/docs/japanology/magazine/prototype/cover-machi01/04-factcheck.md

## 고정
- 호 표기 「一つの町　01」, 제목 「富士吉田」, 크레딧 「『となり』編集部」 + 쓴 자료의 출처(OSM이면 「© OpenStreetMap contributors（ODbL） openstreetmap.org/copyright」, 略図면 「略図」 명기). 크레딧은 .credit 클래스.
- 부제: 기본 「今の金鳥居は、もとの場所より30メートルほど山に近い。」. 자기 안의 주인공에 더 맞는 부제가 있으면 **원고 본문에 있는 사실 문장만** 바탕으로 15–30자, 「。」 하나, 구체물 1개 이상으로 새로 쓸 수 있다(원고 문장과 출처 행 번호를 NOTES에 명기). 가공·과장 금지.
- 색: 바탕 + 2색. 토큰 --night #151b2c, --vermilion #d4462a, --snow #eef0f4 (주홍은 글자 금지). 다른 색을 쓰려면 주제 근거 1줄.
- A4 210×297, `.cover{--mm:calc(100cqw / 210); --cover-bg:<바탕>}`, cqi 금지. 표지 요소 class="cover".
- 표지 글자 15pt(5.4mm) 이상, 크레딧만 예외 3.2mm 이상. 대비 4.5:1(큰 글자 3:1).
- IP: 로고·마크·캐릭터 재현 금지, 타 잡지 로고/상징 모방 금지, 저작물 본문 인용 금지. 사실 아닌 도형은 「略図」·「模式」로 크레딧에 밝힌다. 숫자·개수를 그림으로 보이면 원고의 숫자와 일치해야 한다.
- 시각은 KST.

## 산출(자기 폴더 06-variants/<안이름>/ 에만, 리포 파일 수정 금지)
- build.mjs(결정적 생성) → cover.html
- `export PATH=/opt/node24/bin:$PATH; node /home/user/manabi/docs/japanology/magazine/prototype/check-cover.cjs cover.html` 통과
- 스크린샷: node <scratchpad>/shotfull.cjs cover.html cover-390.png 422 그리고 폭 900 → cover-large.png. **Read로 직접 보고** 일류 잡지(BRUTUS·暮しの手帖·Kinfolk 급) 기준으로 최소 2회 다듬는다.
- NOTES.md: 한 줄 콘셉트, 주인공의 사실 근거(원고 문장·출처 행), 다듬은 내용, check 결과.
최종 응답: 콘셉트 한 줄 + check 결과 + 스스로 본 약점 1개, 5줄 이내.
