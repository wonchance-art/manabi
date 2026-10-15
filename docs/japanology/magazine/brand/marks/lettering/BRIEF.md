# 레터링 실험 — 공통 지시 (2026-10-15 KST, 편집장)

오너 피드백: 「쟤네들(BRUTUS·&Premium·Casa·POPEYE)은 폰트 디자인을 따로 예술적으로 나타냈는데 우린 그냥 폰트에 글만 쓴 느낌」.
→ 이번 라운드는 **서체 윤곽 사용 금지**. 이 단어만을 위한 **구성 규칙 하나**에서 글자를 처음부터 그린다(작도 코드 + 손 조정 파라미터). 서체는 비례 참고용으로만 볼 수 있다.

## 단어와 역할
TONARI(국제·우산) / となり(일본 시리즈) / トナリ(하이브리드). 세 마크가 같은 구성 규칙으로 한 가족.

## 좋은 로고의 기준(편집장이 본 참고 잡지들의 공통점)
- 단어 전체가 하나의 형태(실루엣)로 기억된다 — 글자 나열이 아님
- 이 단어에만 있는 '서명' 디테일 1–2개
- 장식이 글자 밖에 붙지 않고 글자 구조 안에 있다
- 작은 크기(웹 헤더 24px)에서도 실루엣이 남는다

## 규칙
- 다른 로고 모방 금지(BRUTUS·&Premium·Casa BRUTUS·POPEYE 등). 참고 이미지는 스크래치패드 /tmp/claude-0/-home-user-manabi/0206ac3f-d009-52b8-9c9c-c828c4ca53fe/scratchpad/mast-refs/img/ — 비교만, 리포 반입 금지. 닮으면 버린다.
- 읽힘: 일본어 원어민이 となり·トナリ로, 누구나 TONARI로 읽어야 한다(ナ→テ, り→リ 혼동 점검).
- 색: 밤 #151b2c, 눈 #eef0f4, 주홍 #d4462a(악센트 하나).
- 결과는 아웃라인 SVG, 결정적 생성(build 스크립트), NOTES.md(구성 규칙·서명 디테일·버린 시도).
- 스스로 최소 3회 그려 보고 고친다(각 회차 스크린샷을 iterations/에 남겨 변화 과정을 보이게).

## 산출(자기 폴더 lettering/<이름>/ 에만, 커밋은 편집장)
- svg/(light/dark), build, NOTES.md, iterations/, card.html → card.png(폭 1500: 세 마크 큰 크기 명/암 + 24px + 표지 제호 크기)
- 스크린샷: export PATH=/opt/node24/bin:$PATH; node /tmp/claude-0/-home-user-manabi/0206ac3f-d009-52b8-9c9c-c828c4ca53fe/scratchpad/shotfull.cjs card.html card.png 1500
최종 응답: 구성 규칙 한 줄 + 서명 디테일 + 스스로 본 약점, 4줄 이내.
