export type ChapterId = '1-1' | '1-2' | '1-3' | '2-1' | '2-2' | '2-3' | '3-1' | '3-2' | '3-3';

export interface SubChapter {
    id: ChapterId;
    title: string;
    description: string;
}

export interface ChapterGroup {
    id: string;
    title: string;
    subChapters: SubChapter[];
}

export const chaptersData: ChapterGroup[] = [
    {
        id: '1',
        title: '1과. 인사와 히라가나',
        subChapters: [
            { id: '1-1', title: '1-1. 기본 인사말', description: 'Interactive greeting flip cards' },
            { id: '1-2', title: '1-2. 히라가나', description: 'Clickable Hiragana chart with romaji' },
            { id: '1-3', title: '1-3. 자기소개', description: 'Fill-in-the-blank profile intro' }
        ]
    },
    {
        id: '2',
        title: '2과. 숫자와 시간',
        subChapters: [
            { id: '2-1', title: '2-1. 숫자 읽기', description: 'Interactive number counter' },
            { id: '2-2', title: '2-2. 시간 말하기', description: 'Interactive clock UI' },
            { id: '2-3', title: '2-3. 요일과 날짜', description: 'Interactive weekly calendar' }
        ]
    },
    {
        id: '3',
        title: '3과. 기초 문법',
        subChapters: [
            { id: '3-1', title: '3-1. 명사문 (A는 B입니다)', description: 'Sentence builder diagram' },
            { id: '3-2', title: '3-2. 의문사 정복', description: 'Question words matching UI' },
            { id: '3-3', title: '3-3. 지시대명사 (코레/소레/아레)', description: 'Visual distance representation' }
        ]
    }
];
