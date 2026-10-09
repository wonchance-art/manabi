// asset 경로 전용 — 다른 모듈에서 import하면 교재 폴더 전체(mp3·PDF·글꼴)가 그 함수에 실린다.
// 파일명이 요청마다 달라 파일 추적기가 폴더 전체를 싣는 것을 피할 수 없으므로 이 모듈로 가둔다.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {checkedAsset,textbookError} from './server';
export async function verifiedAsset(bundle,file) {
 const artifact=bundle.assets?.[file];if(!artifact||!/^[-a-zA-Z0-9_./]+$/.test(file)||file.includes('..'))throw textbookError(404,'파일을 찾을 수 없어요.');
 const bytes=await readFile(path.join(process.cwd(),'src/content/textbookEditions',bundle.editionId,file));
 return checkedAsset(bundle,file,bytes);
}
