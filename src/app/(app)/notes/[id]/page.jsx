import {Suspense} from 'react';
import StudyNotePage from '@/components/notes/StudyNotePage';
export const metadata={title:'내 학습 노트',robots:{index:false,follow:false}};
export default async function Page({params}) { return <Suspense><StudyNotePage id={(await params).id}/></Suspense>; }
