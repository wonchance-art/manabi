# E2E 실행 계약

E2E 테스트는 저장소 루트에서 실행한다. 테스트가 `next start`를 직접 띄우므로
3100 포트에 다른 서버가 없어야 한다.

## 인증 흐름은 먼저 같은 공개 환경으로 빌드

`NEXT_PUBLIC_*` 값은 `next build` 때 브라우저 번들에 인라인된다.
`playwright.config.mjs`가 `next start`에 넘기는 런타임 환경만 설정해서는 이미 만들어진
번들을 바꿀 수 없다. 그 상태에서는 게스트 테스트가 통과하더라도 클라이언트 인증만
사용자 없이 조용히 실패할 수 있다.

인증이 필요한 E2E를 실행하기 전에는 운영 값이나 비밀키 대신 아래 테스트 전용 공개
값으로 반드시 다시 빌드한다.

```sh
NEXT_PUBLIC_SUPABASE_URL=https://e2e.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon-key \
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100 \
npm run build
```

빌드가 성공한 뒤 인증 학습 E2E를 실행한다.

```sh
node --test --test-concurrency=1 e2e/learning-flow.e2e.mjs
```

`.next`가 다른 `NEXT_PUBLIC_*` 값으로 만들어졌거나 빌드 환경을 알 수 없다면 인증 E2E
결과를 신뢰하지 말고 위 명령으로 먼저 다시 빌드한다.
