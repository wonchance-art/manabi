// asset 경로 전용 — 다른 모듈에서 import하면 교재 폴더 전체(mp3·PDF·글꼴)가 그 함수에 실린다.
// 파일명이 요청마다 달라 파일 추적기가 폴더 전체를 싣는 것을 피할 수 없으므로 이 모듈로 가둔다.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {checkedAsset,textbookError} from './server';
// 판본 파일은 배포 단위로 고정이다 — 한 번 해시가 맞은 `판본:파일`은 인스턴스 안에서 다시 해시하지 않는다(음성 2.5MB · 본문
// 1.4MB를 요청마다 sha256 하던 것). 기억하는 것은 검증에 쓴 기대 해시뿐이고 바이트는 매번 읽는다(판본 폴더 85MB를 메모리에
// 올리지 않는다). 기대 해시가 바뀌면(다른 bundle) 다시 검증한다. 실패는 기억하지 않는다 — 다음 요청이 다시 검증한다.
const verifiedFiles=new Map();
export async function verifiedAsset(bundle,file) {
 const artifact=bundle.assets&&Object.hasOwn(bundle.assets,file)?bundle.assets[file]:null;if(!artifact||!/^[-a-zA-Z0-9_./]+$/.test(file)||file.includes('..'))throw textbookError(404,'파일을 찾을 수 없어요.');
 const bytes=await readFile(path.join(process.cwd(),'src/content/textbookEditions',bundle.editionId,file));
 const key=`${bundle.editionId}:${file}`;
 if(verifiedFiles.get(key)===artifact.sha256)return {bytes,type:artifact.type};
 const checked=checkedAsset(bundle,file,bytes);
 verifiedFiles.set(key,artifact.sha256);
 return checked;
}
