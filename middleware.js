import { NextResponse } from 'next/server';

// 미들웨어는 정적 파일만 제외하고 통과
// 실제 auth 보호는 각 클라이언트 컴포넌트와 AuthContext에서 처리
export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
