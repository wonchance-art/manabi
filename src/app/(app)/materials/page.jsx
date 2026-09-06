import Link from 'next/link';
import MaterialsPage from '@/views/MaterialsPage';

export const metadata = {
  title: '자료실',
  description: '일본어·영어 텍스트를 올려 형태소 단위로 해부해 읽는 보관함. 기사·이야기·PDF.',
};

export default function Page() {
  return <><div className="manabi-return-strip"><span>읽기와 교재를 함께 이어가요.</span><Link href="/books/japanese-n5/materials">일본어 N5 · 문화 읽기</Link><Link href="/lessons">책장으로 →</Link></div><MaterialsPage /></>;
}
