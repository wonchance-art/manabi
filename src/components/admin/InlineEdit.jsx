'use client';

/**
 * 인라인 편집 래퍼 — 관리자에게만 본문 오른쪽 여백에 작은 연필을 붙이고, 클릭하면 그 자리에서
 * children을 편집 폼으로 교체한다(창·오버레이 없음).
 *
 * 설계 규율:
 *  - 값은 props로 받지 않는다 — 편집 시작 시에만 GET /api/admin/chapter로 merged 챕터를 읽어
 *    path로 해석한다(일반 유저 RSC 페이로드에 챕터 원문 값이 실리지 않게).
 *  - 무거운 편집 폼(InlineEditForm)은 첫 연필 클릭 시에만 dynamic import → 챕터 페이지 First Load JS 보호.
 *  - 비관리자·비로그인: 추가 DOM 없이 children만 렌더(semantic 래퍼는 li 등 콘텐츠 자체일 때만 유지).
 *  - 관리자 여부가 바뀌어도 children은 같은 자리에 그대로 둔다(ADMIN-EDIT-STABLE-001). 예전에는 관리자면
 *    children을 div.admin-edit로 감쌌는데, 프로필이 늦게 와 isAdmin이 false → true로 바뀌는 순간 같은 자리의
 *    요소 종류가 Fragment → div로 달라져 그 아래(스토리 문항 등)가 새로 마운트되며 입력이 사라졌다(smoke 「관리자
 *    보관함 N5 챕터 · 조립」 「확정」 비활성, 수정 전후 약 1/10). 이제 연필은 children 앞의 형제(높이 0 기준점)다.
 *
 * props:
 *  - lang, slug: 대상 챕터
 *  - path: 편집 경로 규약(chapterPath 참고). kind='text'는 콤마로 다중 스칼라 경로 지원.
 *  - kind: 'text' | 'example' | 'json'
 *  - tag: 래퍼 태그. 기본 'div'(장식 래퍼 — 렌더하지 않는다). 'li' 등이면 콘텐츠 자체로 항상 렌더.
 *  - className, style: semantic 태그에 그대로 전달.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '../../lib/AuthContext';

// 편집 폼은 연필 클릭 전까지 번들에 포함되지 않는다(ssr:false — 서버·초기 렌더에 없음).
const InlineEditForm = dynamic(() => import('./InlineEditForm'), { ssr: false });

export default function InlineEdit({
  lang,
  slug,
  path,
  kind = 'text',
  tag = 'div',
  className,
  style,
  children,
}) {
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const Tag = tag;
  const semantic = tag !== 'div'; // li 등 — 래퍼가 곧 콘텐츠라 비관리자에도 항상 렌더
  const editingNow = isAdmin && editing;

  // 첫 칸 = 관리자 연필(비관리자는 null), 둘째 칸 = 내용. 칸 순서가 늘 같아 isAdmin이 바뀌어도 내용은 다시 마운트되지 않는다.
  const control = isAdmin && !editingNow ? (
    <span className="admin-edit__anchor">
      <button
        type="button"
        className="admin-edit__pencil"
        title="이 부분 편집"
        aria-label="이 부분 편집"
        onClick={() => setEditing(true)}
      >
        ✎
      </button>
    </span>
  ) : null;
  const body = editingNow ? (
    <div className="admin-edit admin-edit--editing">
      <InlineEditForm
        lang={lang}
        slug={slug}
        path={path}
        kind={kind}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    </div>
  ) : children;

  if (semantic) return <Tag className={className} style={style}>{control}{body}</Tag>;
  return <>{control}{body}</>;
}
