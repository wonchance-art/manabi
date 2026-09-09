import Link from 'next/link';
import {requireAdmin} from '@/lib/supabaseServer';
import BookEditor from '@/components/books/BookEditor';
export const dynamic='force-dynamic';
export const metadata={title:'일본어 N5 한 권 편집 | manabi',robots:{index:false,follow:false}};
export default async function Page(){const auth=await requireAdmin();if(auth.error)return <div className="page-container"><h1>관리자 전용 페이지</h1><p>{auth.error}</p><Link href="/lessons">교재 목록</Link></div>;return <BookEditor />;}
