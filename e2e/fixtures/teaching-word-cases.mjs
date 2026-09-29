// Constructed layout inputs, not dictionary translations. Deliberately invalid
// readings are regression probes and must never be published as study content.
const ja=[
 ['今日','きょう','group'],['明日','あした','group'],['大人','おとな','group'],['一人','ひとり','group'],['二人','ふたり','group'],['東京','とうきょう','group'],['学校','がっこう','group'],['学習','がくしゅう','group'],['勉強','べんきょう','group'],
 ['食べる','たべる','anchored'],['飲む','のむ','anchored'],['読み方','よみかた','anchored'],['取り出す','とりだす','anchored'],['引っ張る','ひっぱる','anchored'],['お祝い','おいわい','anchored'],['お金','おかね','anchored'],['待ち合わせる','まちあわせる','anchored'],
 ['きょう','きょう','plain'],['コーヒー','コーヒー','plain'],['スーパー','スーパー','plain'],['𠮷野','よしの','group'],['食べる','くう','group'],['日本語を勉強する','にほんごをべんきょうする','anchored'],['学校','','empty'],
];
const zh=[
 ['学习','xué xí','aligned'],['學習','xué xí','aligned'],['练习','liàn xí','aligned'],['复习','fù xí','aligned'],['东道主','dōng dào zhǔ','aligned'],['换位思考','huàn wèi sī kǎo','aligned'],['我','wǒ','aligned'],['女','nǚ','aligned'],['嗯','ǹ','aligned'],['银行','yín háng','aligned'],['行走','xíng zǒu','aligned'],['长大','zhǎng dà','aligned'],['长短','cháng duǎn','aligned'],['音乐','yīn yuè','aligned'],['快乐','kuài lè','aligned'],['的','de','aligned'],
 ['T恤','T xù','group'],['3个','sān gè','group'],['你好！','nǐ hǎo','group'],['学习','xuéxí','group'],['学习','xué','group'],['一边学习一边复习','yī biān xué xí yī biān fù xí','aligned'],['𠮷','jí','aligned'],['学习','','empty'],
];
const latin=[['English','book'],['English','take a break'],['English',"don't forget"],['English','twenty-one'],['English','café'],['English','a long expression with several words'],['French','bonjour'],['French',"l’apprentissage"],['French','être'],['French','œuvre'],['French','aujourd’hui'],['French','une longue expression à plusieurs mots']];
export const teachingWordCases=[...ja.map(([text,reading,mode],i)=>({id:`ja-${i+1}`,language:'Japanese',text,reading,mode})),...zh.map(([text,reading,mode],i)=>({id:`zh-${i+1}`,language:'Chinese',text,reading,mode})),...latin.map(([language,text],i)=>({id:`latin-${i+1}`,language,text,reading:'ignored',mode:'plain'}))].map(entry=>({...entry,meaning:'수업에서 확인한 뜻\n덧붙인 설명',layoutVersion:2}));
export const highRiskWordCases=['ja-1','ja-14','ja-21','ja-22','ja-23','zh-5','zh-6','zh-17','zh-20','latin-12'].map(id=>teachingWordCases.find(entry=>entry.id===id));
