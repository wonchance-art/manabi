# vendor/google-fonts — 배포 빌드용 Google Fonts 사본

`next/font/google`이 빌드할 때 Google에서 받던 CSS와 woff2를 그대로 저장해 둔 것이다. 배포 빌드(`npm run build`
→ `scripts/next-build.mjs`)는 네트워크 대신 이 사본을 읽는다(`responses.cjs`).

- **왜:** 10개 글꼴 패밀리의 CSS 11개와 woff2 조각 약 950개(약 41MB)를 빌드마다 받았다. 하나만 실패해도 배포가
  ERROR가 됐다(2026-10-10 #1402, 2026-10-13 #1419 Preview).
- **무엇이 그대로인가:** layout의 `next/font/google` 호출, 글꼴 바이트, Google CSS 본문. next/font가 만드는
  결과물(`.next/static/media` 파일 이름, @font-face, 대체 글꼴 보정, preload)도 네트워크 빌드와 같다.
- **e2e 빌드는 별개다:** `e2e/fixtures/google-fonts-mock.cjs` 대역을 쓴다.

## 구성
| 경로 | 내용 |
|---|---|
| `manifest.json` | 요청 URL → CSS 파일, 글꼴 파일 → sha256 |
| `css/` | Google이 돌려준 CSS 원문(next와 같은 User-Agent로 요청) |
| `files/` | `fonts.gstatic.com/s/` 아래 경로 그대로 저장한 woff2 |
| `licenses/` | 패밀리별 SIL Open Font License 1.1 원문(google/fonts 저장소) |

## 갱신
네트워크가 되는 곳에서 실행하고 `git diff`로 확인한 뒤 커밋한다.
```
node scripts/fonts/vendor-google-fonts.mjs '<css2 URL>'   # 글꼴 호출을 추가하거나 weight를 바꿨을 때
node scripts/fonts/vendor-google-fonts.mjs --refresh       # 전체를 다시 받기(글꼴 판 갱신) + 쓰이지 않는 파일 정리
```
- 사본에 없는 호출이 있으면 빌드가 해당 URL과 명령을 출력하고 멈춘다.
- `scripts/next-build.test.js`도 CI에서 src의 모든 호출이 사본에 있는지 검사한다.

## 라이선스
Inter, Manrope, Noto Sans, Noto Sans KR/JP/SC/TC, Noto Serif KR/JP/SC는 모두 SIL Open Font License 1.1이다.
수정 없이 재배포하며, 패밀리별 저작권 표기와 라이선스 원문은 `licenses/`에 있다.
