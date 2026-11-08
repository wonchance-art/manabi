-- VOA Learning English 자료실 글 26편을 공개 영어 시드로 넣는다(EN-SOURCE-001 ⓒ 1차 — 오케스트레이터 04:42 · 04:47 KST 11/9 승인 27편 중 26편).
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- ⚠ 병합 선행 조건: 출처 줄(metadata.source kind 'web' · 호스트 허용 목록) 표시 코드가 운영에 먼저 들어가야 한다.
--   VOA 사용 조건이 「with credit」이라 공개 노출 = 출처 표시 동시 조건이다(오케스트레이터 04:47 KST). 표시는 Design 목업 → 오너 승인 → WEB.
-- 왜: 공급 중단된 VOA 피드(2025-03 이후 새 글 없음 · 요약만)로는 수집기가 긷지 못한다 — 자료실 글을 한 번 반입한다.
-- 권리: VOA는 미국 정부 저작물(퍼블릭 도메인). AP · Reuters · AFP 기사, 제3자 저작물 인용(가사 · 영화 대사 · 시)이 든 글은 고르지 않았다
--   (하드리밋 ② — #5 · #10 · #18 · #21 · Academic Writing Part Three · Four 등 제외). 정치 · 국제 서술 글 없음(③④).
--   승인 목록의 「WHO Launches New Cancer Drug Plan for Children」은 AFP 기사 각색(원문 기자 줄 「reported on this story for Agence France-Presse」)이라 뺐다.
-- 본문: 기사 본문 문단만(사진 설명 · 「Words in This Story」 낱말 풀이 · 맺음 인사 · 기자 줄 · 주소 제거), 문단 = 줄. 원문 표현은 고치지 않았다.
-- 제목: parseTitle 형식 — 단편은 「[A2] 제목」 · 「[B1] 제목」(Flesch-Kincaid 7.5 미만 A2), Academic Writing 두 편만 시리즈 「[B1 writing #1·#2]」.
-- 출처 칸(processed_json.metadata.source): {kind 'web', site 'voa_le', channel 'VOA Learning English', url(learningenglish.voanews.com HTTPS),
--   license 'public-domain', section(VOA 분류), credit(원문 기자 줄), feed_date(피드에 실린 날 — 첫 게재일이 아닐 수 있다)}.
-- 권리 거름: 기자 줄이 없거나 통신사(AP · Reuters · AFP)가 나오면 사전 검사에서 멈춘다(생성기 scripts/voa-seed.mjs도 같은 규칙으로 뺀다).
-- VALUES는 생성기가 다시 쓴다: node scripts/voa-seed.mjs <글 JSON> <이 파일>(voa-seed:begin ~ end 사이).
-- 경로 = 기존 공개 시드와 같다(20261107040000 선례): 시드 작업(kind starter)의 주인 소유 · 공개 · 분석 전(idle) · direction read로 넣고,
--   작업 material_ids 끝에 붙인다. 작업이 done이면 running으로 다시 연다(20261106230000 선례 — attempts · chapters_done · llm_usage 그대로).
--   분석 → 뜻 채움 → 난이도(metadata.difficulty)는 기존 하루 한 번 예약 실행이 잇고, 은퇴 표식(retired_series)은 달지 않는다.
-- 멱등: 같은 주인 · 같은 제목이 있으면 그 편은 넣지 않는다. 다른 자료 · 정책 · 함수 · 학습 계약 지문 넷 무변경(사후 검사).
-- 백업: 바꾸기 전 작업 한 줄(status · material_ids · current_key · failure_streak · last_error · lease_until)을 backup_private.voa_import_job_20261109에.
-- 복원: docs/sql/voa-import-20261109-rollback.sql(오너 확인 뒤에만 — 학습 기록이 붙기 전에만 깨끗하다).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.canonical_analysis_jobs') IS NULL OR to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.canonical_analysis_jobs does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE vi_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.vi_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.vi_pins SELECT * FROM pg_temp.vi_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.voa_import_job_20261109 (
  job_id bigint PRIMARY KEY,
  status text NOT NULL,
  material_ids bigint[],
  current_key text,
  failure_streak int NOT NULL,
  last_error text,
  lease_until timestamptz,
  added_ids bigint[] NOT NULL DEFAULT '{}',
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.voa_import_job_20261109 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.voa_import_job_20261109 FROM PUBLIC, anon, authenticated;

CREATE TEMP TABLE vi_seed (title text PRIMARY KEY, level text NOT NULL, source jsonb NOT NULL, body text NOT NULL) ON COMMIT DROP;
INSERT INTO pg_temp.vi_seed (title, level, source, body) VALUES
-- voa-seed:begin
    ('[A2] ''Watching the Grass Grow'' Is Not Fun', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/watching-the-grass-grow-is-not-fun/8003108.html","license":"public-domain","section":"Words and Their Stories","credit":"Anna Matteo wrote this story for VOA Learning English.","feed_date":"2025-03-15"}'::jsonb, $voa$And now Words and Their Stories from VOA Learning English.
Springtime is a time of renewal and growth. Many plants end their long winter sleep and form new buds and shoots. Beautiful flowers will soon be showing their bright colors. And the grass will grow thicker and greener again.
Some flowers bloom in a very noticeable way but that is not the case with grass. Imagine you are sitting in a grassy field. And you have only one job – to watch the grass grow. That does not sound very interesting. In fact, it sounds really boring.
That idea is what gives us the expression “like watching grass grow.” We use this expression to describe an experience that is uninteresting. Another good word to describe it is tedious.
We use this expression in many situations. Let’s hear a few examples:
After the politician won his campaign, he gave a two-hour long acceptance speech. Two hours! It was as much fun as watching grass grow.
I really don’t like watching long sports games. It’s like watching grass grow.
Now, grass grows on the ground all the time. And usually, we don’t give it much thought. If you stand in one place for a long time, the grass will continue to grow under your feet.
For people who are always active, always moving, always on-the-go, we can say they don't let grass grow under their feet. We can also say beneath their feet. And sometimes we use this expression as a command.
Let’s hear some examples:
Don’t let the grass grow beneath your feet. Get back to work.
She certainly doesn’t let the grass grow under her feet. She’s been traveling non-stop for over a year.$voa$),
    ('[A2] Adverb and Adjective Choices in Conversation', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/adverbs-and-adjectives/3702382.html","license":"public-domain","section":"Everyday Grammar","credit":"John Russell wrote this story for Learning English. Caty Weaver was the editor.","feed_date":"2025-03-06"}'::jsonb, $voa$From VOA Learning English, this is Everyday Grammar.
Imagine two American students are talking outside of their school. Let’s listen to the imaginary conversation:
A: Today is going slow.
B: Yeah. I guess we should study for our grammar test.
A: That sounds like a terrible idea.
B: Yeah, but if we don't study, we won't do good on the test.
A: Fine. Let's go study our notes quick. Then we can play video games.
These bad students may hate grammar, but they just taught you some common grammatical structures in conversational American English.
In today's report, we will study how conversational grammar differs from written and formal grammatical structures.
We will show you how some Americans use adjectives and adverbs in casual conversation.
Adjectives and Adverbs
Adjectives are words that give information about nouns. They generally appear before nouns, although they also appear after linking verbs.
Here are two examples:
You are a good student.
Learning English is fun.
In the two example sentences, the words "good" and "fun" are adjectives. They are telling you something about a noun.
Adverbs are often used to modify adjectives or verbs. They give information about reason, manner, time, and so on.
For example, the adverb loudly appears in this sentence:
We sang loudly.
The adverb loudly modifies the past tense verb, sang. It tells about the way in which the subject, we, sang. Adverbs often have an –ly ending, but there are many that do not. You can read more about adverbs in past Everyday Grammar stories.
Conversation:
Let's think back to the conversation we heard at the beginning of the story:
A: Today is going slow.
B: Yeah. I guess we should study for our grammar test.
A: That sounds like a terrible idea.
B: Yeah, but if we don't study, we won't do good on the test.
A: Fine. Let's go study our notes quick. Then we can play videogames.
Notice that the words are used differently from what might be taught in an English class.
In casual conversation, Americans often use adjective forms in place of adverbs. They may use adjective forms to modify verbs.
For example, the students use good – a word that is normally an adjective - as an adverb. One student says "we won't do good on the test."
In writing and in formal conversation, Americans generally do not use the word "good" this way. Instead, they use the word well. In formal writing or speaking, you would be more likely to see or hear the sentence "we won't do well on the test."
Americans also may use an adverb but choose not to say an –ly ending.
For example, the student says "today is going slow," instead of "today is going slowly." You would be more likely to read "slowly" in academic writing, write Susan Conrad and Douglas Biber, two English grammar experts.
Not necessarily slang, not necessarily impolite
These grammatical structures are not necessarily slang. They are not necessarily impolite, either. You might hear some of these structures in a restaurant, at a job fair, or even at work.
For example, a boss might tell an employee "We need to do this quick," about a project that must be completed quickly.
This is the same pattern that the students used in their conversation.
Conrad and Biber say that in formal speech and writing, adjective forms are almost never used to modify verbs. In addition, adverbs with –ly endings are more common in writing – particularly in academic and news writing.*
What can you do?
The good news is this: we are not asking you to memorize any of the patterns we have talked about today.
What we hope to do is show you that the grammatical patterns in conversation do not always match the patterns used in formal writing or speech. There is more flexibility in casual speech.
Understanding this idea will help you understand Americans when they speak, and it will help you sound more natural when you speak to Americans.
You might also be pleased to know that Americans will not judge you severely if you use an adjective in place of an adverb. In fact, they probably would do the same!
*Please see Conrad and Biber "Real Grammar: A Corpus-Based Approach to English" pgs. 73-75$voa$),
    ('[A2] Chicken Little', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/american-stories-chicken-little/6947104.html","license":"public-domain","section":"American Stories","credit":"Mario Ritter, Jr. adapted this story for VOA Learning English from stories in the public domain.","feed_date":"2024-12-13"}'::jsonb, $voa$And now an American Children’s Story from VOA Learning English.
Today’s story probably had its start long before it was published in Europe long ago.
It might have first been known as “Henny Penny.” But the story has been told to American children at least since the mid-1800s under a title similar to “Chicken Little.”
Generations have heard and thought about the lessons of the little chicken who causes big problems for a group of well-meaning but not-so-thoughtful birds.
Today’s version is based on two examples of the story. One is called Remarkable Story of Chicken Little. John Green Chandler had it published in the city of Boston, Massachusetts in 1842. Katharine Pyle published her 1918 version in Mother’s Nursery Tales.
The story has taken on its own American qualities and is a little like a parable, a story that teaches a moral lesson. Later retellings including a few movie versions have made changes to some of the characters or aimed to teach different ideas.
Here is the story Chicken Little in VOA Learning English.
One day, Chicken Little fell asleep under some flowers.
Cow wandered by, reached over the fence and bit off some flowers.
The noise wakened Chicken Little just as a flower petal fell on her tail.
"Squawk! Squawk!” cried Chicken Little, frightened by the petal’s landing.
“The sky is falling,” she continued, her call rising louder with her terror. “Squawk! Squawk!”
And, she jumped up and began to run, moving as fast as her two legs would carry her. She did not stop running until she came to the barnyard. There, she found Henny Penny scratching in the dirt of the barnyard.
“Oh, Henny Penny, do not scratch—run!” cried Chicken Little. “The sky is falling.”
The scratching stopped. Then Hen called out: “How do you know that, Chicken Little?”
“I saw it with my eyes, I heard it with my ears, and part of it fell on my tail. Let us run, until we get some place.”
“Squawk! Squawk,” cried Hen in return, a look of shock on her face. Then, run she did, speeding away from the barnyard.
Chicken Little followed close behind.
They almost ran right past the little lake, just as Ducky Lucky was going in for a swim.
“Oh, Ducky Lucky! Ducky Lucky! Do not try to swim,” cried Henny Penny. “The sky is falling.”
“Seriously, Henny Penny? Why do you think that?” asked Ducky Lucky.
“Chicken Little told me.”
“How do you know the sky is falling, Chicken Little?”
“I saw it with my eyes, I heard it with my ears, and part of it fell on my tail. Oh, let us run until we get some place.”
Ducky Lucky was persuaded.
“Yes, we had better run,” he yelled.
And the three took off, Ducky Lucky waddling faster than he ever had before. The birds ran and ran until they came to a green meadow, and there was Goosey Loose eating the green grass.
“Oh, Goosey Lucy, Goosey Lucy, do not eat; run,” cried Ducky Lucky.
“Why should I run?” asked Goosey Lucy.
“Because the sky is falling.”
“How do you know that, Ducky Lucky?”
“Henny Penny told me.”
“How do you know that, Henny Penny?”
“Chicken Little told me.”
“How do you know that, Chicken Little?”
“Because I saw it with my eyes, and heard it with my ears, and part of it fell on my tail. Oh, let us run some place.”
“Yes, we had better run,” cried Goosey Lucy.
Away they all ran, Goosey Lucy in the lead, and they ran and ran until they came to the turkey yard, and there was Turkey Lurkey strutting and gobbling.
“Oh, Turkey Lurkey! Do not strut!” cried Goosey Lucy.
“Why should I not strut?” asked Turkey Lurkey.
“Because the sky is falling.”
“How do you know it is?”
“Ducky Lucky told me!”
“How do you know, Ducky Lucky?”
“Henny Penny told me!”
“How do you know, Henny Penny?”
“Chicken Little told me!”
“Chicken Little, how do you know this for a fact?”
“I could not help knowing! I saw it with my eyes, I heard it with my ears, and a part of it fell on my tail. Oh, let us run until we get some place.”
“Yes, it would be best to run,” said Turkey Lurkey, so away they all ran, first Turkey Lurkey, and then Goosey Lucy, and then Ducky Lucky, and then Henny Penny and then Chicken Little.
They ran and ran until they came to Foxy Loxy’s house.
Foxy Loxy was resting, spread out across the doorway. She kept yawning, opening her mouth wide so that all her sharp teeth showed. But, her mouth snapped shut at the sudden arrival of the frightened birds, Turkey Lurkey and Goosey Lucy and Ducky Lucky and Henny Penny and Chicken Little.
Her eyes softened and her ears stood up. She was so very happy to see them all and smiled sweetly.
“Well, well,” the fox said, “what brings you all here?”
“Foxy Loxy, prevent yourself from yawning,” cried old Turkey Lurkey, “Indeed, the sky is falling.”
“How do you know that, Turkey Lurkey?” asked the fox.
“Goosey Lucy informed me.”
“How do you know that, Goosey Lucy?”
“Ducky Lucky told me.”
“How do you know that, Ducky Lucky?”
“Henny Penny told me.”
“How do you know that, Henny Penny?”
“Chicken Little.”
“How do you know that, Chicken Little?”
“I could not help knowing, for I saw it with my eyes, and I heard it with my ears, and part of it fell on my tail. Oh, where shall we run? We ought to go someplace.”
“Well,” said the Fox, “you come right into my house, and I will protect you and take such good care of you that, even if the sky falls, you will not know anything about it.”
So, in ran Turkey Lurkey and Goosey Lucy and Ducky Lucky and Henny Penny and — Chicken Little.
Foxy Loxy waited for a while and then shut the door firmly behind her. She would not let the falling sky threaten her guests, you see. She was going to take special care of them all.
And, maybe she did. But no one ever saw Chicken Little or her friends again.$voa$),
    ('[A2] Grammar for Making New Year’s Resolutions', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/grammar-for-making-new-year-s-resolutions/5226829.html","license":"public-domain","section":"Everyday Grammar","credit":"Alice Bryant wrote this lesson for Learning English.","feed_date":"2024-12-26"}'::jsonb, $voa$The New Year can come on different dates for different cultures. Most of the Western world, for example, celebrates it on January 1st.
But one thing many cultures have in common is the idea of New Year’s resolutions. A New Year’s resolution is a personal goal to change unwanted behavior, make a life improvement or try something new.
Popular New Year’s resolutions in the United States, for example, include losing weight, improving your finances, volunteering for a charity and spending less time on social media.
On today’s Everyday Grammar, we will show you how to talk about resolutions in English.
Asking a question
First, let’s learn how to ask people about their resolutions.
Listen to a short conversation:
Hey there, Jill. Happy New Year! Great to see you.
Hi, Jonathan. Happy New Year to you too! How was yours?
It was crazy! We went to New York and watched the ball drop in Times Square. Really crowded and loud – but still really fun.
Sweet! Do you have any New Year’s resolutions?
Jill asked Jonathan about resolutions simply by saying, “Do you have any New Year’s resolutions?”
You can also say, “What are your New Year’s resolutions?” to ask about more than one or “What is your New Year’s resolution?” to ask about one.
Now, let’s find out how to answer the question.
Using phrasal verbs
When we make statements about our resolutions, we often use phrasal verbs.
We can use the phrasal verb “take up” to say that we will start a new activity as a hobby.
Listen to Jill and Jonathan continue their conversation:
Sweet! Do you have any New Year’s resolutions?
Yes, I do. I plan to take up kickboxing starting next week. I’m excited to finally do it rather than just talk about it! How about you?
Another phrasal verb for resolutions is “give up,” which is to stop doing or using something. We can use this verb to talk about ending bad habits or changing a behavior for a time.
Let’s hear Jill respond using the verb “give up”:
How about you?
I am giving up sugar for the month of January. Then, for the rest of the year, I’m avoiding soft drinks.
Impressive! I wish I could join you but kickboxing class starts soon. I’ll probably want a sweet snack after class!
Another phrasal verb, “cut out,” has the same basic meaning as “give up.” For example, Jill could say, “I am cutting out sugar for the month of January.”
But in many situations, we do not need phrasal verbs to talk about resolutions, as you will soon see.
Using future forms
Next, let’s talk about verb tenses and forms. Jonathan talked about his new kickboxing hobby using the verb “plan” followed by the infinitive verb form and Jill talked about giving up sugar using the present continuous verb tense, also called “BE + ing.”
We can also use the simple future tenses: one with “will” and the other with “going to.” These tenses are especially useful when the New Year has not come yet.
Imagine it’s the last week of the year and a few people are talking to each other about resolutions: Here are some things you might hear:
In 2020, I’m going to visit my parents every month.
By January 1, I will end a few unhealthy friendships.
In the new year, I’m going to walk 10,000 steps every day.
When we use simple future tenses to talk about resolutions, we’re expressing that we are making a promise to or plan for ourselves. The noun “resolution” comes from the verb “resolve,” which means to make a serious decision to do something.
Infinitives and gerunds
You may have noticed that the statements so far today did not actually use the word “resolution.” That is because the subject was already known by the listeners. But it is still perfectly normal to start your statements with, “My New Year’s resolution is…” or “My New Year’s resolutions are…” An infinitive verb or a gerund must come after these phrases. Here is an example:
My New Year’s resolution is to call my sister on video chat every week.
The infinitive verb here is “to call.”
You can also use a gerund, like this:
My New Year’s resolution is calling my sister on video chat every week.
Well, that’s all for today’s program. Tell us about your New Year’s resolutions in the comments below.
Happy New Year!$voa$),
    ('[A2] Grammar Games at Home: Jeopardy', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/grammar-games-at-home-part-1-jeopardy/5345471.html","license":"public-domain","section":"Everyday Grammar","credit":"Alice Bryant wrote this story for Learning English. George Grow was the editor.","feed_date":"2025-03-20"}'::jsonb, $voa$Hi, everyone!
You might be reading or listening to this Everyday Grammar program from your living room or bedroom. In fact, you might be even wearing pajamas, no matter the time of day.
If you are like us here in Washington, D.C. and many other places, health officials have asked you to stay at home for now.
And with so many people at home for long periods, people are looking for activities to keep their minds occupied. Too much time on social media can be a problem. Even binge-watching movies and television shows loses its appeal after a while.
With this in mind, we will be offering ideas for games that you can play with your family or housemates in the coming weeks to practice your English.
What is Jeopardy?
On today’s program we will talk about Jeopardy, a favorite game of English learning classrooms.
The idea comes from the American television game show in which players give their answers in the form of a question. You may have even seen the show in your country.
In Jeopardy, players choose from categories and try to win money, like this:
(Player) I’ll take Countries for $100.
(Host) This Asian country is famous for its high-quality motorcycles
(Player) What is Japan?
(Host) That is correct!
Notice that the answer came in the form of a question: “What is Japan?”
You will also note the host read a fact in statement form. We will call those facts clues.
Playing Jeopardy at home is a good way to get experience forming questions in English. It also can improve your speaking and listening skills, and help expand your vocabulary.
Now, let’s talk about how to play the game. You will need three or more English learners – one person to serve as host and the others to play.*
There are two ways to play the game: the traditional way (with answers in question form) and the easier way, which you can find on our website at learningenglish.voanews.com.
How to play - traditional
Here is how to play the traditional way.
The first step is to decide who the host will be. His or her job is to gather clues for the game. The host also reads clues to the players, and keeps a record of points won.
To play the game, you will need five separate categories. For example, you might choose: Countries, Animals, Foods, Sports and Actors. For each category, choose six clues, from easy ($100) to difficult ($600).
The host will need to keep the clues on a computer screen or write or print them on a small piece of paper.
To set up the game, you will need a board or large piece of paper. (If using paper, put it on a wall for all the players to see.) On the large paper or board, make a grid like the simple design shown on our website.
Write the categories on the left of the grid and the money amounts across the top.
For the full directions on how to play the game, to see how to make the grid, and for links to clues that are already prepared, go to our website.
And join us again soon for more grammar games you can play at home.
For Jeopardy game directions, click here.
*If you are the only English speaker in your home, you can play the game in your native language.$voa$),
    ('[A2] Green Means Spring and Other Things', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/words-and-their-stories-green-idioim-expressions-garden-jealousy/2688277.html","license":"public-domain","section":"Words and Their Stories","credit":"Marilyn Christiano wrote this program.","feed_date":"2025-03-08"}'::jsonb, $voa$Now, the VOA Learning English program Words and Their Stories.
Today we talk about a color found all throughout nature – green!
Green is also very common in American English. Let’s hear Warren Scheer read a story about these colorful expressions!
Green is an important color in nature. It is the color of grass and the leaves on trees. It is also the color of most growing plants.
Sometimes, the word green means young, fresh and growing. Sometimes, it describes something that is not yet ripe or finished.
For example, a greenhorn is someone who has no experience, who is new to a situation. In the fifteenth century, a greenhorn was a young cow or ox whose horns had not yet developed. A century or so later, a greenhorn was a soldier who had not yet had any experience in battle. By the eighteenth century, a greenhorn had the meaning it has today - a person who is new in a job.
About one hundred years ago, greenhorn was a popular expression in the American west. Old-timers used it to describe a man who had just arrived from one of the big cities back east. The greenhorn lacked the skills he would need to live in the hard, rough country.
Someone who has the ability to grow plants well is said to have a green thumb. The expression comes from the early 1900s.
A person with a green thumb seems to have a magic touch that makes plants grow quickly and well. You might say that the woman next door has a green thumb if her garden continues to grow long after your plants have died.
The Green Revolution is the name given some years ago to the development of new kinds of rice and other grains. The new plants produced much larger crops. The Green Revolution was the result of hard work by agricultural scientists who had green thumbs.
Green is also the color used to describe the powerful emotion, jealousy. The green-eyed monster is not a frightening creature from outer space. It is an expression used about four hundred years ago by British writer William Shakespeare in his play "Othello."
It describes the unpleasant feeling a person has when someone has something he wants. A young man may suffer from the green-eyed monster if his girlfriend begins going out with someone else. Or, that green-eyed monster may affect your friend if you get a pay raise and she does not.
In most places in the world, a green light is a sign to move ahead. A green light on a traffic signal means your car can continue on. In everyday speech, a green light means approval to continue with a project. We want you to know we have a green light to continue this series next week.
Don't forget to tune in again for another story about American English expressions.$voa$),
    ('[A2] How to ''Dish Up'' Something Good', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/how-to-dish-up-something-good/7980848.html","license":"public-domain","section":"Words and Their Stories","credit":"Anna Matteo wrote this story for VOA Learning English.","feed_date":"2025-03-01"}'::jsonb, $voa$And now, Words and Their Stories, from VOA Learning English.
Food is a popular subject with many people around the world. It is fun to talk about our favorite dishes. It is even more fun to share a favorite dish with others.
Today we talk about the word “dish.” A dish can be the object on which you serve food. But, a dish can also mean a specially prepared food.
Do you have a signature dish? Our signature is how we sign our names. So, a signature dish is a dish we are known for making well. In a way, it identifies us.
My signature dish is sweet potato rosemary dinner rolls. I am often asked to make them, especially for holiday parties. In my circle of friends, I am known for this dish. When the rolls are on the table, people know that I made them.
A tasty dish is something that makes a table look good and inviting. Sometimes the same can be said about a person. Someone who is good-looking can be called a dish. While this usage might be a bit dated, it is still used.
Now, let’s talk about the verb “dish.”
“To dish” can mean to talk about private or personal information. It might be gossip. But I can also dish about myself. For example, a friend may ask me to dish about my new job.
I could also use a phrasal verb form and say my friend want me to dish out all the interesting details.
Now, to dish up something means to put food on a dish for someone to eat. However, it can also mean sharing personal details, our own and others.
We can also dish out things, like jokes or even insults.
Some people like to tease or insult. They can dish out jokes and insults all day long. But sometimes these same people do not like it if you do the same to them.
We have a saying for just such people. We say, “They can dish it out, but they can’t take it.” They are able and willing to share harsh thoughts, criticisms, or insults about others, but they do not think they, themselves, deserve such treatment.$voa$),
    ('[A2] Knee Jerk and Gut Reactions: When We Are Not in Control', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/knee-jerk-when-you-are-not-in-control-/7937763.html","license":"public-domain","section":"Words and Their Stories","credit":"Anna Matteo wrote this story for VOA Learning English.","feed_date":"2025-01-18"}'::jsonb, $voa$And now, Words and Their Stories, from VOA Learning English.
In life, some of our decisions and actions are well thought out. They involve research, examination, and time for thought. And other decisions and actions are not well thought out. We make them quickly, without thinking, almost like a pure physical reaction.
We can call these decisions, actions or reactions knee-jerk.
This term comes from a medical process. Meriam Webster defines the noun "knee jerk" as “an involuntary forward kick produced by a light blow on the tendon below the kneecap.” It is an involuntary action. It's automatic.
The words “involuntary” and “automatic” are important when understanding the term “knee jerk” and when to use it. Knee-jerk reactions seem to happen automatically without a decision-making process.
We often use “knee jerk” as an adjective.
Like hitting your kneecap to move your leg, knee-jerk reactions or statements also seem like an involuntary reflex.
"Knee jerk" also describes predictable behavior. Again, hit the knee, the leg will kick every time. So "knee jerk" describes someone who always reacts quickly and without enough thought.
For example, let’s say you are on a team with someone who never faces responsibility for their mistakes in the game. If brought to account, the player always blames the dropped ball on other teammates. You can say that player is having a knee-jerk reaction to criticism. They have a go-to response. It’s like a reflex they can’t control.
We often use knee-jerk in a criticizing or negative way.
Now, a gut reaction also happens without thinking. But it is a bit different than a knee-jerk response. A gut reaction is a feeling. When we have a gut reaction, our instincts are telling us that something may not be right. Gut reactions are instinctual warnings.
So, we also use this expression a bit differently than "knee jerk." We usually talk about our own gut reactions or impulses, not others.
Here is an example:
One day, I was hiking on a mountain in California. I had hiked for about two hours and was near the top. The view, I was told, was truly beautiful. I couldn’t wait to see it! Then, suddenly, I had a strange feeling. Something just didn’t feel right. I can’t explain why, but my gut instinct was to turn around and head back down the mountain. I later found out that a dangerous bear had been sighted in the same area that I had fled. I am so thankful I listened to my gut instinct.$voa$),
    ('[A2] Learn Prefixes, Suffixes to Expand Your Vocabulary', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/learn-prefixes-and-suffixes-to-expand-your-vocabulary/4140658.html","license":"public-domain","section":"Education","credit":"Alice Bryant wrote this story for Learning English. George Grow was the editor.","feed_date":"2025-02-25"}'::jsonb, $voa$On a recent program, we explained that knowing just a few root words in English can help you understand the meaning of hundreds more words.
To refresh your memory, a root word is the simplest form of a word. For example, two forms of the root for the word “see” are vis- and vid- such as in the words "television" and "video."
Today, we will tell you about prefixes and suffixes – groups of letters that appear at the beginnings and endings of words.
Learning the meanings of common prefixes and suffixes can help you understand unknown English words you come across. It can also help you become better at spelling words.
Prefixes
Let's start with prefixes.
A prefix is a letter or a group of letters that we add to the beginning of a word. Prefixes change the meanings of words. For example, the prefix un- (or u-n) can mean "not," "remove," or "opposite." Adding un- to the word "happy" gives you the word "unhappy," which means not happy.
U-n and r-e (or re-) are the two most common prefixes in the English language. Re- means "again" or "back," such as in the words "rethink" "redo" and "repay."
Here are a few things to remember when learning prefixes:
Suffixes
Now, let's turn to suffixes.
A suffix is a letter or group of letters added to the end of a word. Suffixes are commonly used to show the part of speech of a word. For example, adding "ion" to the verb "act" gives us "action," the noun form of the word. Suffixes also tell us the verb tense of words or whether the words are plural or singular.
Some common suffixes are -er, -s, -es, -ed, -ing and -ly.
Here are a few things to remember when learning suffixes:
There are additional suffix rules, but they deal with spelling and can be learned with time and practice.
A thing to keep in mind about both prefixes and suffixes is that some are only used with some words. For example, we add the suffix -ful to some nouns to mean "full of," such as in the words "beautiful" or "helpful." But, we cannot add -ful to just any noun. You could not, for example, say "loveful" to mean full of love.
So, what are some ways that you can practice common prefixes and suffixes?
One way is to use online flashcards from websites like Quizlet. You can choose sets of cards that are already made or create and use your own sets. Or, you can make your own flashcards with pieces of paper.
Once you've spent time practicing, take a news story or page in a book and look for words that have the prefixes and suffixes you learned. Then, use what you know about the meaning of the root words to guess the meanings of those words.
Learning prefixes and suffixes will not only build your vocabulary but can make unfamiliar English words a lot less frightening.$voa$),
    ('[A2] Lincoln''s Cottage: a Country House for the President', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/lincoln-s-cottage-a-country-house-for-the-president-/7990415.html","license":"public-domain","section":"All About America","credit":"Nancy Steinbach wrote this story for VOA Learning English. John Russell adapted it.","feed_date":"2025-03-16"}'::jsonb, $voa$About five kilometers from the White House in Washington, D.C., stands an historic building closely linked to one of America’s most famous presidents: Abraham Lincoln.
The building, known as President Lincoln's Cottage, is where Lincoln spent about one-fourth of his time while in office. And he made some very important decisions while there.
Summertime can get very hot in Washington, D.C. So, President Lincoln used a country house to escape the worst of the heat. Each morning and evening, Lincoln rode between the two houses on horseback, unguarded.
The trip took about thirty minutes.
The large house he rode to was on the grounds of the Soldiers’ Home. The house stood on much higher ground than the White House, so the wind kept it cooler. It was also quiet -- a place to think.
Lincoln spent much of his time there writing. That work included early versions of what would become one of the most important documents in American history: The Emancipation Proclamation.
The Emancipation Proclamation came during the Civil War in the United States. The proclamation declared people held as slaves in the rebellious states were free.
The Civil War lasted from 1861 to 1865. Troops remained at the Soldiers' Home to protect President Lincoln during the war. At first, Lincoln did not welcome the soldiers. He did not think he needed their protection. But he began to enjoy talking to them. In fact, much of what historians know about the president's time at the house is from stories told by those soldiers.
One night in 1864, President Lincoln survived a murder attempt. He was alone and on horseback near the country house when someone shot at him. His tall hat flew off his head. Soldiers found the hat and saw that a bullet had torn through it. The president was not injured in the attack.
After that, the War Department increased protection for Lincoln. But it was not enough to save his life.
Records show that he visited his country house for the last time on April 13, 1865. The next day, John Wilkes Booth, an actor and supporter of the defeated Confederacy, shot President Lincoln at Ford's Theatre in Washington.
President Lincoln’s Cottage opened to the public in 2008.$voa$),
    ('[A2] Mary Kay: A Leader in the Beauty Product Industry', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/mary-kay-a-leader-in-the-beauty-product-industry/7972740.html","license":"public-domain","section":"Arts & Culture","credit":"Nancy Steinbach wrote this story for VOA Special English. Anna Matteo adapted it for VOA Learning English.","feed_date":"2025-02-18"}'::jsonb, $voa$Mary Kay Cosmetics is an international company that sells beauty products.
One woman started the business in the 1960s with an investment of $5,000.
Mary Kathlyn Wagner was born in the state of Texas in 1918. For much of her childhood, she cared for her sick father while her mother worked long hours at a restaurant.
Mary Kay married Ben Rogers when she was 17 years old. They had three children before he left home to serve in World War Two. When he returned, their marriage ended. Mary Kay looked for a job so she could support her children.
She began selling different kinds of products. One night, Mary Kay was showing products at the home of Ova Heath Spoonemore. Ms. Spoonemore began giving her guests some homemade skin care products. The products were developed by her father, J.W. Heath, in Arkansas. Mary Kay tried the skin care products and liked them.
She bought the rights to Heath’s skin care products and started her own company. She paid $500 for the legal rights to the products. And in 1963, The Mary Kay Cosmetics company began operating in Dallas, Texas.
The idea was to sell skin care products through demonstrations in homes and offices. Independent sales representatives bought beauty products from the company and sold them at higher prices.
Mary Kay decided that each representative who brought other saleswomen into the company would receive part of the new person’s earnings. That way, experienced sales representatives would be willing to train new ones.
By 1965, the company was selling almost one million dollars in products.
Mary Kay Cosmetics became one of the most successful direct sellers of skin care products in America. It continues to have sales offices and representatives in many different countries.
Mary Kay aimed to grow sales based on the idea that it is best to compete against yourself. That means every individual is trying to beat their own sales records. Prizes for high sales marks included special paid holidays and jewelry. Until a few years ago, a pink Cadillac was a top prize.
After her third husband, Mel Ash, died of cancer in 1980, she wanted to help find a cure for the disease. At first, she helped organizations raise money for research.
Later, she started the Mary Kay Ash Charitable Foundation, a nonprofit group that provides money to support research on cancers affecting women. In 2001, the company and foundation expanded their goals to help prevent violence against women.
Mary Kay Ash also wrote three books. She worked in her business until she suffered a stroke in 1996. She died in 2001.
Sales representatives say Mary Kay developed a way for women to earn money and still spend time with their families.$voa$),
    ('[A2] Questions, Answers about Holiday Activities', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/questions-answers-about-holiday-activities/6904240.html","license":"public-domain","section":"Everyday Grammar","credit":"John Russell wrote this lesson for VOA Learning English.","feed_date":"2025-01-02"}'::jsonb, $voa$Imagine you are talking to an American. You are curious to know about what they did during the holidays of Christmas and New Year’s. How can you ask about these or other holidays? How can you build a discussion about the holiday season?
In this Everyday Grammar, we will explore how you can form common questions and answers about the holidays.
Let’s start with some important terms and ideas.
Holidays
The Christmas and New Year’s holidays are important in the United States. Common good wishes during the season include “Merry Christmas” and “Happy New Year!”
But how do you build a discussion around the subject of such holidays?
You can start with yes or no questions, which involve the helping verb “do.” The structure is generally:
Do+ subject + celebrate + the holiday.
For example, you might ask
Do you celebrate Christmas?
Or
Do you celebrate New Year’s Eve?
The person you ask these questions to might answer with a yes or a no.
Both answers can lead to interesting discussions. But for the sake of today’s report, let’s assume the answer is “yes.”
Open-ended questions
You can follow up with more detailed questions about what the person did for Christmas and New Year’s.
You might need to ask open-ended questions – questions that are not asking for a yes or no answer.
The word “what” is often commonly used to ask open-ended questions about basic actions. We combine “what” with the helping verb “do” to form the following structure:
What + do + subject + do + rest of the sentence
Notice that the verb “do” appears twice in the structure. Here is how one might use this structure to ask about holiday activities:
What did you do for Christmas?
or
What did you do on New Year’s Eve?
Note that the first example of “do” is in its past tense form – “what did...” This is because we are asking about an event in the past.
Answers
You could hear answers that go in a few different directions. One of the most common answers will involve the simple past forms of the verbs go, see, or visit.
For example, a person might say “I went to my grandparent’s house,” or “We saw our cousins,” or “We visited my brother.”
Note that the person could be speaking for themselves and use the subject pronoun “I,” or they could be speaking for their family and use the subject pronoun “we.”
Practice
Now let’s work with these ideas.
Ask a yes or no question about the holiday Hanukkah. It is a Jewish holiday around the end of the year.
Pause the audio to consider your answer.
Here is one possible answer:
Do you celebrate Hanukkah?
For this next question, imagine that you celebrated New Year’s Eve in New York City’s Times Square. How would you use the verb “see” if someone asked you about what you did?
Pause the audio to consider your answer.
Here are a few possible answers:
I saw crowds and decorations.
Or,
I saw the ball drop.
There are, of course, other answers. What is important is that you use the past form “saw,” as in “I saw...”
The next time you hear Americans discuss the holiday season, pay careful attention to the kinds of questions and answers that they give. Such questions and answers are not only useful for talking about holidays but for many other activities as well!$voa$),
    ('[A2] Reviewing Your Birthday Message', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/reviewing-your-birthday-message/6724744.html","license":"public-domain","section":"Everyday Grammar","credit":"Faith Pirlo wrote this lesson for VOA Learning English.","feed_date":"2025-02-27"}'::jsonb, $voa$Recently, our readers and listeners wrote many lovely messages about their birthdays. We have been reading all of them. Most messages are happy. You wrote about gifts you received, the people who celebrated with you, or where and how you celebrated.
Some messages seemed sad. Some of you do not get to celebrate your birthdays. Other messages were a mix of sad and happy.
In this week's Everyday Grammar, we are looking at Farhana’s message about her birthday. She wrote:
A message from Farhana
My birthday was on last 23 march. This was my 27th birthday. In my birthday no one wished me except my younger sister. And actually there was no devise for this day. I spent my whole day as like it is a normal day. Sometimes i felt sad and sometimes i wasn't.
Review of Farhana’s message
Let us start at the beginning. Farhana writes:
My birthday was on last 23 march.
We suggest changing this sentence to the present tense to say when your birthday is.
My birthday is March 23.
In American English, the usual order for dates is month, day, year. So instead of “23 March,” Americans usually say “March 23.”
You used the past tense in this sentence:
This was my 27th birthday.
Another way we can say how old we are, is to use the past tense of the verb “turn.”
I turned 27 this year.
Here, “turn” means to reach or pass into a new age.
Next Farhana wrote this:
In my birthday no one wished me except my younger sister.
We can change the word order of this sentence to make it clearer.
No one wished me happy birthday, except my younger sister.
Instead of a prepositional phrase, “In my birthday,” we can just start the sentence with “No one.” “No one” is an indefinite pronoun meaning "no person." You could also use the pronoun “nobody.”
Onto the next sentence:
And actually there was no devise for this day.
“To devise” is a verb meaning to plan or think up something. You were close! But in this sentence we need a noun. And we find it in the definition of devise: plan.
Actually, there was no plan for the day.
If you wanted to use the word devise, however, you could! It would come right after “plan” in the sentence.
Actually, there was no plan devised for the day.
Farhana’s next sentence is:
I spent my whole day as like it is a normal day.
We should make a few changes to this sentence.
“As” and “like” are both used to make comparisons between nouns.
“As” is an adverb, and “like” is a preposition. We only need one of these to make the comparison.
We can say:
I spent my whole day like it was a normal day.
Let us look now at Farhana’s last sentence:
Sometimes i felt sad and sometimes i wasn't.
We suggest changing this sentence to:
Sometimes I felt sad, but other times I didn’t.
Now the two parts of the sentence agree in verb use.
Also, We always capitalize the pronoun “I” in sentences. We used the conjunction “but” with “other times” only to create more contrast. It is also correct to write:
Sometimes I felt sad and sometimes I didn’t.
Closing thoughts
Now, let's hear the revised message about Farhana's birthday:
My birthday is March 23. I turned 27 this year. No one wished me happy birthday except my younger sister. Actually, there was no plan for the day. I spent my whole day like it was a normal day. Sometimes I felt sad, but other times, I didn't.
Thank you Farhana for your message. We would like to wish you a happy birthday, early, for next year.$voa$),
    ('[A2] Skyscrapers, Made in America', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/skyscrapers-made-in-america-/7988815.html","license":"public-domain","section":"All About America","credit":"Jerilyn Watson reported this story for VOA Learning English. Jill Robbins adapted it for VOA Learning English with additional materials.","feed_date":"2025-03-03"}'::jsonb, $voa$Skyscrapers were invented in the United States.
Two new technological developments made very tall buildings possible in the late 1800s. One development was the mechanical elevator. It meant that people would not have to climb many steps to reach the upper floors of tall buildings. It saved time and effort.
The second was good quality steel that could carry the heavy load of a tall structure. These two developments helped make the skyscraper possible.
Many experts consider the Home Insurance Building in Chicago, Illinois to be the first skyscraper. It was completed in 1885 and later increased to a height of 55 meters. Today, this would not be considered tall. But at the time, this height was striking.
What was different about the Home Insurance Building was its structure. It was built using a steel frame.
This frame carried the weight of the building rather than the walls. The method was known as “skeleton construction” at the time. Before this technology, a tall building required thick stone walls to support its weight. Thick walls are extremely heavy and take up a big area that could be used for floor space or windows.
William Jenney was the engineer who helped build the Home Insurance Building. He understood the possibilities that steel frames could offer. Some people consider him the father of the skyscraper.
Soon after the building was finished, builders in Chicago and New York City began copying and improving on the idea of building upwards. Builders in these cities and others would also begin competing for the title of “tallest building.”
Popular tall buildings
The Empire State building in New York City was completed in 1931. It was the tallest building in the world for more than 40 years. It is still one of the most popular. Millions of visitors have seen New York from observation areas in this building.
Chicago became home to the world’s tallest building in 1973 when the Sears Tower was completed. It is 442 meters tall. The Sears Tower, which is now called Willis Tower, was the tallest building in the world for 23 years. Then, in 1996, two taller buildings were completed. They are the Petronas Towers in Kuala Lumpur, Malaysia. They are about 452 meters tall.
Who decides on the tallest buildings?
The Council on Tall Buildings and Urban Habitat (CTBUH) is a nonprofit organization based in Chicago that studies tall buildings and their place in the design of cities. CTBUH supports tall buildings as a way to create more sustainable cities to live in. The group publishes a list of the world’s tallest buildings. Today, the Burj Khalifa in Dubai is considered the tallest building at 828 meters.
The tallest building in the United States and North America is One World Trade Center in New York, which replaced the two towers of the World Trade Center destroyed in the terrorist attacks against the United States in 2001. One World Trade Center stands at 541 meters.$voa$),
    ('[A2] Sometimes We ''Spread Ourself Too Thin''', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/sometimes-we-spread-ourself-too-thin-/7940837.html","license":"public-domain","section":"Words and Their Stories","credit":"Anna Matteo wrote this story for VOA Learning English.","feed_date":"2025-01-25"}'::jsonb, $voa$And now, Words and Their Stories, from VOA Learning English.
Today we talk about our busy lives. Many people have family and work responsibilities. We might have religious or community activities. Taking care of our health is also important. And let’s not forget about our personal projects, our interests, and our friendships.
With everything on our plate, it is easy to feel overwhelmed, overextended, and overcommitted.
However, if we try to do too much, we may spread ourselves too thin. This expression means we have taken on too much. We are pushed to the limit.
People who are spread too thin, take on too many jobs, projects, or goals. The heavy load requires more energy or attention than they possess.
If we work on many projects simultaneously, or at the same time, it is possible that none will get done well, if they get done at all. And it is possible such multitasking could stress us out.
Being spread too thin can also be described as biting off more than we can chew. When we bite off more than we can chew, we attempt to do more than is possible.
Here is a VOA Learning English English in a Minute video explaining the idiom "to bite off more than you can chew."
Now, let’s hear these some of these terms and expressions used in a conversation.
A: So, how are your classes going?
B: Not great. Many of my best students are failing my course. They all missed an important deadline for a project.
A: That's strange. What else do they have going on?
B: A lot! They are all performing in the same play. So, they have had rehearsals every night for the past month. And many have part-time jobs as well.
A: Sounds like they’ve spread themselves too thin. They’ve got too much going on.
B: I think you’re right.
A: So, what are you going to do?
B: Well, first I’ll extend the deadline. And then I’m going to warn them about biting off more than they can chew.$voa$),
    ('[A2] Teachers Use Games for More Enjoyable Learning', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/teachers-use-games-for-more-enjoyable-learning/6474764.html","license":"public-domain","section":"Education","credit":"Jill Robbins wrote this lesson for Learning English.","feed_date":"2025-02-11"}'::jsonb, $voa$Wordle has become one of the most popular online games in the United States since it came out last October.
Players get six chances to guess and learn a five-letter word for the day. Many are sharing their game results on social media, adding more interest in the game.
Gamifying the classroom
Creative teachers have long found games could make their classes more enjoyable for students. During the pandemic, many have looked for new ways or games to help their students learn. It is part of a learning theory called “gamification” to keep students’ interest.
Beyond Wordle, here are other games that help learners with different subjects.
Mathematics
British data scientist Richard Mann of London was talking with his daughter about the popularity of Wordle. He thought there should be a game for people who like mathematics and developed Nerdle. It is a daily game in which a player has six tries to guess a math solution.
Does it sound familiar? Math teachers note that a Nerdle player uses logic, a careful way of thinking about something, to solve a math problem. It is similar to how a Wordle player applies logic to guess a word.
Geography
Do not confuse Wordle with Worldle. There is an extra letter ‘l” in Worldle. French video game developer Antoine Teuf said he invented Worldle in honor of that word game, Wordle.
Players guess a country based on its shape. They get six tries to guess a country based on information about the country. Teuf first shared the game on January 22. He said there are two million visits a day to the game’s page a month later.
Other games, online services
Teachers of English see word games as a way for students to learn new words. Other word games include Blooket and Flippity.
Teachers create quizzes in Blooket similar to the kinds of games students play on mobile devices. They can look at results and see areas that students can improve.
In Flippity, teachers can create flash cards, rewards, spelling quizzes, memory games and word searches from a simple Google spreadsheet. It is also a good tool for students to create their own projects.
There are several online services that teachers could use to “gamify” learning. They include Kahoot!, Quizlet, Quizziz and Nearpod. All of them “gamify” learning by creating competition among learners while reviewing the content presented by teachers.
Teaching without a computer?
In many places, teachers and students do not have a computer. So, English language teacher Larry Ferlazzo asked them to share their language-learning games. Ferlazzo wrote about them in his blog. Here are two of the games that teachers suggested:
Danielle Horne teaches at Helena College in Glen Forrest, Western Australia. She said one of the games that her students love playing is “hot or cold.”
In “hot or cold,” students hide something in the classroom while a student, or searcher, is waiting outside. The students then say a word, phrase, or sentence. They get louder when the searcher gets nearer to the object and softer when the searcher is more distant. Horne said to be prepared for quite a bit of noise though!
Eva Pors is a Danish high school teacher. Her students play “questions and answers” to learn new words or vocabulary.
Pors write words or phrases on small pieces of paper and divides students into groups of four. Within a group, student A picks a piece of paper with a word or phrase on it and asks questions that will make student B say the exact word or phrase on the paper.
For example, with the word “milk,” Student A would ask, “What do you put on your cereal in the morning?” Student B has one minute to try to answer as many words or phrases as possible. The other two students in the group will then take over for one minute. And the team with the most correct guesses wins the game.$voa$),
    ('[A2] The Importance of Being ‘Dialed In’', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/the-importance-of-being-dialed-in-/7979814.html","license":"public-domain","section":"Words and Their Stories","credit":"Anna Matteo wrote this story for VOA Learning English.","feed_date":"2025-02-22"}'::jsonb, $voa$And now, Words and Their Stories, from VOA Learning English.
Technology is always progressing. Today, many modern devices can be controlled by touch or voice. This has led to some traditional electronic controls – such as dials and switches – being replaced with new technologies.
Digital displays have also become increasingly common. For example, digital number readouts have long replaced the hands on many clocks.
Many other devices also now operate purely with digital tools instead of mechanical systems.
But some expressions and idioms used by English speakers still describe older technologies.
First, let’s talk about dials. These controls are used for changing settings on a piece of equipment, like a radio or old television. We use the dial to tune in to a specific channel.
That’s where the expressions dialed in and tuned in come from. If we are dialed in or tuned in to a radio or television program, we can hear it clearly. There is no noise or static.
The same can be said when using these terms in personal conversations. For example, if you are dialed in to a project or problem, you know exactly what needs to be done. You are thinking clearly about it and remain very focused.
And when you are tuned in, you understand clearly what is going on around you.
“Don’t touch that dial” and “stay tuned” are two ways to tell someone to keep watching or listening to a program.
Now, let’s talk about switches.
These are built to either be off or on. There are no in-between settings like with a dial. So, when we flip the switch, we make something happen quickly and easily. It can also mean that we suddenly change something.
Let’s listen to an example.
The restaurant’s change to all organic food happened slowly over time. It wasn’t a matter of flipping a switch.
Now, for our last expression -- to move the needle.
Needles on measuring devices like a scale move to show a desired level has been reached. So, when something moves the needle, it causes a noticeable change in something, usually for the good.$voa$),
    ('[A2] Wilbur and Orville Wright: The First Airplane', 'A2 초급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html","license":"public-domain","section":"Science & Technology","credit":"Marilyn Rice Christiano wrote this story for VOA Learning English. John Russell adapted it.","feed_date":"2025-03-17"}'::jsonb, $voa$Wilbur and Orville Wright are the American inventors who made a small engine-powered flying machine. They proved that flight without the aid of gas-filled balloons was possible.
Wilbur Wright was born in 1867 near Melville, Indiana. His brother Orville was born four years later in Dayton, Ohio.
As they grew up, the Wright brothers experimented with mechanical things. Later, the Wright brothers began to design their own flying machine. They used ideas they had developed from earlier experiments with a toy helicopter, kites, the printing machine and bicycles.
Soon, they needed a place to test their ideas about flight. The best place with the best wind conditions seemed to be a piece of sandy land in North Carolina along the coast of the Atlantic Ocean. It was called Kill Devil Hill, near the town of Kitty Hawk.
The Wright brothers did many tests with gliders at Kitty Hawk. With these tests, they learned how to solve many problems.
By the autumn of 1903, Wilbur and Orville had designed and built an airplane powered by a gasoline engine. The plane had wings 12 meters across. It weighed about 340 kilograms, including the pilot.
On December 17th, 1903, they made the world's first flight in a machine that was heavier than air and powered by an engine. Orville flew the plane 36 meters. He was in the air for 12 seconds. The two brothers made three more flights that day.
Four other men watched the Wright brothers' first flights. One of the men took pictures. Few newspapers, however, noted the event.
It was almost five years before the Wright brothers became famous. In 1908, Wilbur went to France. He gave demonstration flights at heights of 90 meters. A French company agreed to begin making the Wright brothers' flying machine.
Orville made successful flights in the United States at the time Wilbur was in France. The United States War Department agreed to buy a Wright brothers' plane. Wilbur and Orville suddenly became world heroes. But the brothers were not seeking fame. They returned to Dayton where they continued to improve their airplanes. They taught many others how to fly.
Wilbur Wright died of typhoid fever in 1912. Orville Wright continued designing and inventing until he died many years later, in 1948.
Today, the Wright brothers' first airplane is in the Air and Space Museum in Washington, D.C. Visitors to the museum can look at the Wright brothers' small plane. Then they can walk to another area and see space vehicles and a rock collected from the moon. The world has changed a lot since Wilbur and Orville Wright began the modern age of flight over one hundred years ago.$voa$),
    ('[B1 writing #1] Academic Writing: Common Sentence Patterns, Part One', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/everyday-grammar-common-patterns/3988378.html","license":"public-domain","section":"Everyday Grammar","credit":"John Russell wrote this story for Learning English. George Grow was the editor.","feed_date":"2025-01-23"}'::jsonb, $voa$The new school year is beginning in communities across the United States.
Many students are busy at work in their new classes. Some are already thinking about all the homework they will face in the weeks to come.
Schools often require students to read academic articles -- short or long reports about a class-related subject. Teachers also ask students to write book reports and research papers.
Today on Everyday Grammar, we will explore two grammatical structures that you will see often in academic writing.
We will show you how to use these structures. We also will show you when not to use them.
#1 Evaluating an idea
If you are writing or reading for academic purposes, you will likely see the following structure: It + is + an adjective + that-clause.
This is a common way to express an attitude, opinion or position. It is often used when considering an idea, note grammar experts Susan Conrad and Douglas Biber.
Here is an example:
"It is clear that the evidence is inconsistent."
Here is how you can understand the sentence. The subject in our example is the word it. Then comes the verb is. After is, there is an adjective: the word clear.
After clear, there is a that-clause. A that-clause is a group of words, beginning with the word that. It has a subject and a predicate. A predicate is the part of a sentence that expresses what is said about the subject.
The that-clause has the idea that the writer is considering. In the example we gave you, the idea under consideration is the following statement: "the evidence is inconsistent."
The adjective clear suggests the writer's judgment.
By saying "it is clear," the writer is saying that he or she agrees the evidence appears to be conflicting with other information.
Note that the writer did not write, "I think that the evidence is inconsistent," even if it has the same meaning as the example sentence. Why? We will explore that issue later in the report.
Academic writers often use it + is + an adjective + that-clause to raise questions, note possibility, and express importance.
For example, you might read the following sentence:
"It is unlikely that the results will be conclusive."
Or,
"It is likely that the information was incomplete."
In the former case, the writer is using the adjective unlikely to raise questions. In the latter one, the writer is using the adjective likely to express possibility.
#2 Evaluating an action
A second common structure, it + is + an adjective + an infinitive phrase, is often used to judge an action. The infinitive phrase describes the action. The adjective shows the writer's evaluation.
Consider this example:
"It is difficult to define these ideas."
In this example, the infinitive to define relates to an action, while the adjective difficult shows the writer's evaluation.
Writers often use it + is + an adjective + an infinitive phrase to show possibility, difficulty, importance, and so on.
So, for example, you might read the following sentences: "It is hard to understand these effects," or "It is necessary to carry out further research."
In the former example, the writer is expressing difficulty, while in the latter the writer is expressing necessity.
Other ways to express the same ideas
The two structures we have discussed are common in academic writing.
You should try using them with your own adjectives, that-clauses, infinitive phrases, and so on.
There is one point to keep in mind, however. You should know that sometimes you might not want to use these structures – especially if you are writing for business or even artistic reasons.
In those situations, it might be better to use more direct language.
Consider the first example we gave you, "It is clear that the evidence is inconsistent."
This is a common, acceptable way to write a sentence for academic purposes. It is grammatically correct.
However, the statement uses indirect language to express an evaluation. The writer is expressing an opinion without specifically writing "I think...," for example.
However, if you are writing for other purposes other than college professors, you could simplify your language. You could give a very direct evaluation by writing "I think the evidence is inconsistent," or simply "The evidence is inconsistent."
The structure that you choose to use depends on what kind of writing you are doing.
It is difficult to improve your writing. But with practice, you can do it!$voa$),
    ('[B1 writing #2] Academic Writing: Common Sentence Patterns, Part Two', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/academic-writing-common-patterns-part-two-everyday-grammar/3997498.html","license":"public-domain","section":"Everyday Grammar","credit":"John Russell adapted it for Learning English. Caty Weaver was the editor.","feed_date":"2025-01-30"}'::jsonb, $voa$The Everyday Grammar team often receives questions about academic writing. Students around the world want to improve their academic writing so that they can gain admission – and succeed – in a college or a university.
In this week's report, we are going to explore one pattern that is commonly used in academic writing.
You will learn to recognize this pattern, and you will learn how you can use it in your own writing.
In addition, you will learn about the times you might not want to use it.
Common Structure: noun+that-clause
The structure we are exploring is this: noun + a that clause. The structure is often used to evaluate, or judge, a topic or idea.
A that-clause is a group of words beginning with the word that. A clause has both a subject and a predicate. The predicate shows what is said about the subject.
The noun might come at the beginning or middle of the sentence. Consider the following examples:
"The fact that the theory of evolution has been so contentious in public debates deserves some explanation."
"This essay is written in the belief that modern historians need to radically change the way they think."
In the first example, the that-clause follows the noun fact at the beginning of the sentence.
In the second example, the that-clause follows the noun belief at the middle of the sentence.
In both cases, the noun plays an important part in showing how a writer evaluates an idea.
In other words, the noun helps show how the writer is taking a position and making a claim about something.
Let's study these sentences in greater detail.
#1 Showing Certainty
Think back to the first example sentence we gave you, "The fact that the theory of evolution has been so contentious in public debates deserves some explanation."
Academic writers often use the noun + a that clause structure to express certainty.
In the sentence, the noun fact plays an important role. When the writer uses the word fact, he or she is showing certainty. It shows that the writer does not consider the point to be a subject of debate.
The that-clause contains the idea that the writer is certain about – the theory of evolution has been a contentious topic.
Susan Conrad and Douglas Biber are grammar experts. They note that academic writers often use nouns or noun phrases such as conclusion, fact, little doubt, and no doubt to express certainty.
The that-clause can have any number of words or ideas. The important point is that it has a subject and a predicate.
#2 Showing Possibility
A second common use of noun + a that clause is to express possibility. Consider our second example, "This essay is written in the belief that modern historians need to radically change the way they think."
Here, the noun belief suggests possibility – it is possible for historians to change the way they think. Whether this is correct or not depends on the reader's opinion – and the persuasiveness of the author's argument.
Conrad and Biber note that other nouns commonly used to show possibility include claim and assumption. Sometimes writers will use the noun possibility itself.
What can you do?
The structures we have discussed today are common in academic writing. If you are writing for other purposes, you might want to use more direct language.
Take our example, "The fact that the theory of evolution has been so contentious in public debates deserves some explanation."
You might read this in an academic publication. This structure might not be the best choice for other situations – writing an opinion piece in the newspaper or an email to your supervisor, for example.
In those cases, it might be better to use more direct language. For example, you could write, "Here are the reasons why the theory of evolution has been a contentious topic…" Or simply, "People have long debated the theory of evolution."
Remember: you have many choices to make when you write a sentence. Learning when to use certain structures can be a long, difficult process.
But, we bring this lesson to a close with the belief that you will succeed!$voa$),
    ('[B1] Common Adverbs in Conversation: Amplifiers, Downtoners', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/amplifiers-downtoners/3714862.html","license":"public-domain","section":"Everyday Grammar","credit":"John Russell wrote this story for Learning English. George Grow was the editor.","feed_date":"2025-03-13"}'::jsonb, $voa$From VOA Learning English, this is Everyday Grammar.
Imagine you are at a business meeting.
You have just presented a plan to your business partners. They want to give suggestions for how to make your plan better.
The conversation might sound like this:
A: I really like your plan!
B: Yes, it's pretty good … but it needs a little revising.
A: Of course, you did a very good job. But you might need to consider a few more points.
B: Yes, it will probably be more effective if you highlight the staffing requirements and expand on the budget.
Whether you like business or not, this conversation gives you important grammar information that you can use in just about any situation.
In particular, the exchange offers examples of some of the most important adverbs that you will hear in everyday speech.
This week, we will explore special adverbs that increase or decrease the force of a statement. These adverbs are sometimes called amplifiers or downtoners.*
What are adverbs? What are amplifiers?
Adverbs are words that modify, or change, the meaning of adjectives, verbs, and sometimes entire sentences. They are often used to show time, a way of doing something, place, or degree – a measure of something.
Some kinds of adverbs act as amplifiers. The word amplify means to make something stronger. So these amplifiers make the meaning of an adjective or sentence stronger.
In American English, amplifiers have three common uses: increasing intensity, expressing certainty and showing precision. This information comes from Susan Conrad and Douglas Biber, two experts on English grammar.
Words such as really and very are among the most common that increase the intensity of a statement. They usually modify an adjective.
Take the adjective good, for example. Imagine you are trying some food that your friends cooked.
Perhaps you want to tell them, "This food is good."
You could increase the intensity of your statement by using the word very:
"This food is very good."
You could express certainty by using an amplifier such as definitely:
"This is definitely the best food I've ever had."
Or you could use an amplifier to show precision:
"At exactly 5:13 p.m. on February 6th, I ate the best food I've ever had in my life!"
What are downtoners?
Other kinds of adverbs act as downtoners. Downtoners are the opposite of amplifiers. They reduce the force of a statement or express doubt. In other words, they set the tone of a statement. You can remember the term 'downtoner' by thinking about what it does: toning down a statement.
Downtoners have three common functions: reducing intensity, expressing doubt or showing imprecision. Three common downtoners in conversational English are pretty, maybe and probably, say Conrad and Biber.
How can you use downtoners to change the meaning of the statement?
Take our earlier example: "This food is good."
If you wanted to reduce the intensity of your statement, you could say:
"This food is pretty good."
You could show doubt, even raise questions, by saying:
"This is maybe the best food I've ever had."
Or,
"This is probably the best food I've ever had."
These statements express someone’s opinion about the food. But they are not as strong as the example sentences that use amplifiers. In other words, saying "This food is pretty good" is not as forceful as saying, "This food is really good."
Amplifiers and downtoners in a conversation
So what does this discussion of food have to do with the exchange we heard at the beginning of this report?
Let's think back to the business conversation:
A: I really like your plan!
B: Yes, it's pretty good … but it needs a little revising.
A: Of course, you did a very good job, but you might need to consider a few more points.
B: Yes, it will probably be more effective if you highlight the staffing requirements and expand on the budget.
You might notice that one of the speakers uses amplifiers such as really and very. She is using these words to give more force to her statement. She is probably more excited about the business plan.
The second speaker uses downtoners – the words pretty and probably, for example. So you might suspect that he is more guarded about the plan. Maybe he has doubts that the new plan will be better.
The amplifiers and downtoners they use are also among the most common ones that you will hear in American English. These words are useful in a number of settings. They are polite and acceptable in almost any situation.
Amplifiers and downtoners in writing
Remember this: the amplifiers and downtoners we have discussed today are common in conversation.
Different amplifiers and downtoners are more common in writing. For example, you are more likely to read words such as indeed, certainly, or approximately than you are to hear them in everyday conversation.
If you use these amplifiers and downtoners in conversation, your speech will take on a very official sound. While that might be a good idea in a formal presentation or speech, it might not be the best choice for an everyday conversation.
Amplifiers and downtoners are not always necessary to use in a sentence. But when you see or hear them, you are getting information about the thoughts and feelings of another person. You are learning about how strongly they feel about something.
And that's the end of this really long report!
*These are also often called qualifiers.$voa$),
    ('[B1] Grow Your Vocabulary by Learning Root Words', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/grow-your-vocabulary-by-learning-root-words/4113426.html","license":"public-domain","section":"Education","credit":"Alice Bryant wrote this story for Learning English. Caty Weaver was the editor.","feed_date":"2025-03-04"}'::jsonb, $voa$English has been called one the most difficult languages for non-native speakers to learn. One reason is that English has so many rules – and almost as many exceptions of those rules!
Sometimes, this leaves learners confused. For example, the order of words in a sentence can be tricky.
Another reason English is hard to learn is that the pronunciation of its words cannot always be predicted by their spelling. For example, there are at least six ways to pronounce the group of letters spelled o-u-g-h. And, maybe the worst thing of all is that there are many idioms, or expressions, in English. You could say we use idioms like they're going out of style.
So, it is comforting to know that learning root words can help a non-native speaker use English. A root word is the most basic form of a word.
Root words can help you to break down large, new words into smaller units to discover their meanings.
Learning just one root word can help you understand several words in English. So, by learning just 20 or 30 root words, you can expand your English vocabulary to include hundreds of new words.
A root can be any part of a word that carries meaning: the beginning, middle or end. Prefixes, bases, and suffixes are types of roots. The prefix appears at the beginning of a word, the base in the middle and the suffix at the end.
Most English root words came from the Greek and Latin languages.
Building vocabulary through root words
One useful method for building vocabulary through root words is to first look at a base word and then look for familiar prefixes and suffixes that go with that base.
Let's try an example: the base word “struct-.” It comes from the Latin word meaning “build.” Any English word you hear containing “struct-”* will relate to building, developing or creating something. By itself, “struct” is not a word, but it is the basis for more than 30 words in English.
For example, the word “construct” is a verb that means “to build.” The prefix “con” means “together” or “with.” So, "construct" means to put things together to build or create something.
Adding suffixes to “struct-” creates additional words.
For example, adding “-ion” in English makes verbs into nouns. When we add "-ion" to “construct," we get "construction," which means the process, or act, of building something.
Adding the suffix “-ing” to “construct” makes “constructing.” That is the gerund form and has a similar meaning as the noun "construction."
Adding the suffix “-ive” to make “constructive” gives us the adjective form, and means helpful in developing or improving something.
Now, let's build onto “constructive." Adding the suffix “ly” to "constructive" gives us the word “constructively” and produces an adverb. It means doing something in a way that is helpful.
There are many other words that the base word “struct” produces. For instance, “destruction” is the opposite of “construction.”
"Destruction" is the act of taking apart or damaging something that was built. "Instruction" means the act of building knowledge and has a similar meaning to the gerund "teaching."
And, just like with "construct," you can add many suffixes to "destruct" or "instruct" to get several more words. The suffixes may include -ion, -ing, -ive, ing+ly or -ive+ly.
So, you see, by knowing just one root word – “struct-” – you can get a better idea of the meaning of at least 15 words in English.
A few other common root words include “bio" meaning life, “auto” meaning self, “pro” meaning before or in favor of, and “tele” meaning distance.
Surely, you recognize some of these roots. So, choose one or two and write in the comments section all of the words you can think of that come from them.
Join us again soon when we will discuss suffixes and prefixes. Learning common roots, prefixes and suffixes will help you become an expert in deconstructing the meanings of English words and constructing a strong vocabulary.***$voa$),
    ('[B1] Improve Your Pronunciation By ''Shadowing'' Others', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/improve-your-english-pronunciation-shadowing-others/3339007.html","license":"public-domain","section":"Education","credit":"John Russell wrote this lesson for VOA Learning English. George Grow and Kelly Jean Kelly were the editors.","feed_date":"2024-11-26"}'::jsonb, $voa$Many English learners can improve their pronunciation by listening carefully to native English speakers and trying to match the up-and-down movement of their sentences.
That is the opinion of Marla Yoshida, an English as a Foreign Language teacher at the University of California, Irvine.
Yoshida wants English learners to look for details that are important to native speakers. These details are not only sounds, she notes. Native speakers also communicate by using pauses, and by saying some words more forcefully than others.
As a result, native speakers might not understand an English learner even if the learner pronounces sounds correctly.
The problem with 'listening and repeating'
Yoshida says that English learners often study pronunciation by listening and repeating something from a recording.
Yoshida says that English learners need to do more than listen and repeat in order to improve their pronunciation:
“I've gradually gotten really interested in pronunciation because it's something that students have trouble with, but they don't always get a lot of really good instruction in it. They just have someone say 'Listen to this recording and repeat … and now, aren't you better?' No! You're not necessarily better. It takes more than that.”
The problem with listen and repeat, says Yoshida, is that when people repeat, they are often not trying to sound like the other person.
“You think that when students are repeating after the teacher, or whatever, they're trying to sound exactly like that person, but they're not.
The sounds that you hear go into your brain … and your brain interprets them or filters them through the sound system of your own language, and what your brain ends up understanding is not everything – it's not what the speaker intended…
You have to try to get past that filter and hear all of the details that are important to someone else.
So you have to try to duplicate what the person is saying."
What details should you try to copy when you listen to an English speaker? Among others, the important details include pauses or breaths, which words to emphasize -- or give special attention to, and intonation – the up and down movement of your voice as you speak.
English speakers, in particular, use a broad range of up and down movements in their voices. These movements can be difficult for English learners to recognize and understand.
Native English speakers might have difficulty understanding English learners when learners use a narrow range of their voice. In other words, native speakers have fewer vocal restrictions when they are speaking. English learners also may use intonation patterns that are different from those in Standard English.
Studying how native speakers use intonation will help English learners better understand what native speakers do with their voices.
Practical tips:
If English learners want to start improving their pronunciation, Yoshida suggests that they do an activity called shadowing.
“Shadowing means finding a short audio or video clip that you like… that's maybe 30 seconds long, one minute long, at most two minutes long, and listen to it. Listen to it a couple of times to get the meaning, and to hear where the speaker pauses, and what they emphasize … and what the intonation sounds like – because those are really important things too – not just the sounds. Pronunciation is much more than saying each sound correctly because you can say each sound correctly and still sound really hard to understand…
So, find a short clip, listen to it, mark things that you notice, then listen a few more times just to sort of let those sounds become a part of your brain, and then start imitating. And imitate trying to sound exactly like that person.”
What does shadowing look like?
Here is a short example of what a shadowing activity could look like.
The example comes from Martha Kolln's book Rhetorical Grammar*:
"One of the most important aspects of your expertise with sentences is your sense of rhythm."
Listen to the sentence several times.
Then try to mark the intonation of the voice. Listen for emphasized words.
In the sentence, you can hear that some syllables are emphasized, while others are not. Overall, the voice falls after important syllables, notably at the end of the sentence.
English sentences often emphasize words at the end of a sentence – the place where you usually find new information. The next time you are reading and listening to a story, try to mark the patterns of intonation that you hear.
Remember, all our stories have audio, so you can print the story and do a shadowing exercise while listening to the story. Give shadowing a try, and let us know how it works for you!
Tim Murphey, a teacher in Japan, has a video of students doing shadowing and summarizing. You can watch it on YouTube here:
*Kolln, Martha. Rhetorical Grammar, 3rd Edition. Allyn and Bacon,1999. pg. 24$voa$),
    ('[B1] Learning How to Ask Questions', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/education-tips-improve-critical-thinking-ask-questions/3303557.html","license":"public-domain","section":"Education","credit":"John Russell wrote this lesson for Learning English. Hai Do was the editor.","feed_date":"2024-12-10"}'::jsonb, $voa$In the Education Tips series, education experts in the United States give you tips about how to improve your English skills. This week, Suzanne Meyer, the assistant director at the English Language Institute at the University of Tennessee, Knoxville, discusses question-asking and the development of critical thinking skills.
For VOA Learning English, this is the Education Report.
Suzanne Meyer, the assistant director of the English Language Institute at the University of Tennessee, Knoxville, says that many students need to develop critical thinking skills.
In other words, students need to learn how to collect information, and then evaluate the information and apply it to a new context.
She says:
"We need to get students actively engaged in inquiry, from the beginning levels on, into those levels where they really are close to professional and university contexts."
One way to develop critical thinking skills, Meyer says, is to teach students to be creative about the types of questions that they ask.
Benefits of question-asking for English learners
Meyer says that there are many benefits to using question-asking activities with English learners. Question-asking activities help students to become better language learners.
She says:
"Question-asking overall helps students be better language learners. Not for the obvious, because you ask a question you get an answer. Often, questions are the first point of contact. And so if my question is not good, then that's going to direct the level of our conversation."
Meyer also says that question-asking may help develop critical thinking skills by allowing for more interactions:
"People who can ask questions are very confident. And when you are confident, you can have more interaction. That extra interaction might lead to critical thinking. Because you are more likely to actually integrate in some fashion into a new setting if you are in an ESL scenario. So, I think overall, just the whole question-asking idea has so many benefits."
How can you practice asking questions?
There are many strategies to improve question-asking and develop critical thinking skills. One possible strategy, says Meyer, is to use question-asking patterns that start with concrete questions and move to abstract questions.
So, for example, if students were reading a new text, they would design a series of questions using three different steps.
If students follow these three steps, they have not only practiced creative ways to ask questions, they have also started practicing critical thinking.
Example of a question-asking activity
Meyer gave an example of what this activity could look like:
In the activity, students read part of a story. In this case, the story is about how different foods affect a person.
These questions, and other questions listed in the table, are examples of how to develop questions. You should, of course, create your own questions!
Practical tips:
Meyer says that when teachers tell students which questions to answer, students are less likely to be creative about the types of questions that they ask.
So, practice developing your own questions! Try making a list of questions that go from concrete to abstract, like the steps outlined above. Check with your teacher to make sure that your grammar is correct, and try to practice in the classroom.
You can also write us your questions about this story in the comments section, or on our Facebook page. Give question-asking a try, and let us know how it works for you!$voa$),
    ('[B1] Philadelphia: a City Famous for its History', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/philadelphia-a-city-famous-for-its-history-/7983180.html","license":"public-domain","section":"All About America","credit":"Nancy Steinbach wrote this story for VOA Learning English. John Russell adapted it.","feed_date":"2025-03-09"}'::jsonb, $voa$Philadelphia, also sometimes called Philly, is a big city on the Delaware River in the northeastern state of Pennsylvania. It has about 1.5 million people, estimates from the United States Census Bureau show.
William Penn, an Englishman and member of the Christian group known as Quakers, founded Pennsylvania in the sixteen eighties. He also designed the city. Penn chose the name Philadelphia - a term he interpreted to mean "city of brotherly love" in Greek.
Philadelphia is famous for holding an important place in American history. It served as the nation's capital from 1785 to 1790. Earlier, it was the capital of the American colonies during most of the Revolutionary War against Britain.
Philadelphia became the central meeting place for the "Founding Fathers" who created the United States government. The buildings where they worked can be seen today in an area called the Old City, or Independence National Historical Park.
The main building is Independence Hall. That was where colonial leaders declared independence and later debated the creation of a government.
The National Park Service says more than 2.6 million people visited Independence National Historical Park last year.
Close to the park is the National Liberty Museum. It holds a collection of more than ninety paintings and sculptures. They represent the idea that liberty is a freedom that is easily violated.
Several blocks away lies the National Constitution Center. This privately operated nonprofit museum opened its doors in Philadelphia on July 4, 2003. It was created to increase public recognition of the Constitution, its history, and its importance today. Visitors are presented with the idea that the most important part of American constitutional democracy is the individual citizen.
Rich with tradition, Philadelphia offers plenty for visitors who are less concerned about history and more concerned about their stomachs. There are many food choices for hungry visitors. Reading Terminal Market, for example, is one of the nation’s largest public markets.
At Reading Terminal Market, visitors can find all kinds of foods -- including, of course, Philly cheesesteak. The city is known for these sandwiches. They are made of thin pieces of meat covered with cheese. A cheesesteak is offered with onions and other toppings and served on a long roll.
And where might a visitor find the best Philly cheesesteak? That question is the subject of much debate.$voa$),
    ('[B1] Start New Year by Setting Reasonable Learning Goals', 'B1 중급', '{"kind":"web","site":"voa_le","channel":"VOA Learning English","url":"https://learningenglish.voanews.com/a/start-the-new-year-by-setting-reasonable-learning-goals-/3637982.html","license":"public-domain","section":"Education","credit":"John Russell wrote this lesson for Learning English. George Grow was the editor.","feed_date":"2024-12-31"}'::jsonb, $voa$In the Education Tips series, education experts in the United States give you ideas about how you can improve your English skills. This week, Eli Hinkel, a professor at Seattle Pacific University, and Marla Yoshida, a Teaching English as a Foreign Language Teacher at the University of California, Irvine, talk about accents and pronunciation.
For VOA Learning English, this is the Education Report.
Learning a new language is a long, difficult process.
This process can become easier if you set goals. Goals help guide language learners and give them reasons to continue studying a language.
However, if you set unreasonable goals, then you will probably become discouraged.
Many English learners set difficult, even unreasonable goals. For example, here at VOA Learning English, we often read emails with comments like: "My goal is to sound like a native speaker..." or "My goal is to lose my accent."
The problem with the goal of sounding like a native speaker is that it is not a reasonable goal for many people.
Why it is difficult to sound like a native speaker
When English learners begin studying English after a certain age, they are not able to sound exactly like a native English speaker. That is the opinion of Eli Hinkel, a professor at Seattle Pacific University.
She says that people who have not reached puberty still have enough muscle and brain plasticity to allow their brain to control their mouth muscles. Puberty is the period of life when a child becomes an adult.
After your physical growth has stopped, the brain loses some of its ability to change the way it controls the muscles of the mouth. This is what results in an accent, according to Hinkel.
In other words, having an accent is a natural part of the aging process of the brain.
It's OK to have an accent
Just because you might not sound like a native speaker does not mean that you should give up trying to improve your pronunciation.
And just because you have an accent does not mean that your language skills are poor.
Hinkel suggested that English learners should not be too disheartened about their accents.
"So, there is really no connection between the quality of one's language and the accent."
She adds that there are even benefits to having an accent.
Eli Hinkel is a native Russian speaker. But she works as a professor in a Teaching English as a Second Language (TESL) program. She believes her accent helps her when she is teaching students.
"I teach MA TESL courses …So, my students think that I really, really know what I'm talking about…accent goes a great deal toward that."
Practical tips
Another teacher says sounding like a native speaker is not necessary.
Marla Yoshida is a Teaching English as a Foreign Language Teacher at the University of California, Irvine. She says that improving your pronunciation is definitely possible – if you choose a reasonable goal.
"You can reach a stage where your pronunciation is easy for people to understand, where it never causes a problem... you go into Starbucks and say your name, and they understand … you give your order and they understand. So, that's a reasonable goal: being understood easily. Where sounding like a native speaker is wonderful if you can do it… it's not necessary."
So, what can English learners do to improve their pronunciation?
Marla Yoshida says that, like when you decide to diet, you are more likely to have success if you set reasonable goals. She suggests working on specific areas of pronunciation that you can improve, instead of trying to sound like a native speaker.
"Work consciously, if you are an adult, to change the way you pronounce. It's kind of like a diet. If you set a more reasonable goal... then, the diet might succeed. In the same way, pronunciation … if you have a more reasonable goal, like… 'I have trouble with the r and l sounds, so first I'm going try those. And then, when I'm comfortable with those, then I'll move on to some other sound that causes problems.' It takes time, but it is possible."
Yoshida added that English learners should understand that improving their pronunciation can take a long time. She said that learners should not be tricked by people who claim to be able to help people get rid of their accents:
"It is good to realize that it [improving pronunciation] is not a fast process. Everyone has been speaking their native language for years and years and years. And it's hard to change. Habits of how you move your mouth are really hard to change. So, don't expect miracles. Sometimes, people see advertisements for software or courses that say 'get rid of your accent in only five lessons'—or something... It's not going to happen! There are no miracles."
So, what can you do?
Start by setting a reasonable goal. Choose one or two sounds that are difficult for you to pronounce. Then, work to improve those sounds. When you have improved, study other sounds. Progress might be slow for you, but don't give up!
Next week, we will give you examples of exercises that you can do to start improving your pronunciation.$voa$)
-- voa-seed:end
;

CREATE TEMP TABLE vi_state (go boolean NOT NULL, job_id bigint, owner_id uuid, others_md5 text) ON COMMIT DROP;
DO $pre$
DECLARE n int; j public.canonical_analysis_jobs%rowtype; n_backup int; n_present int; n_seed int;
BEGIN
  SELECT count(*) INTO n_seed FROM pg_temp.vi_seed;
  IF n_seed <> 26 THEN RAISE EXCEPTION 'voa import: expected 26 seed rows, found %', n_seed; END IF;
  -- 권리 거름(scripts/voa-seed.mjs와 같은 규칙): 기자 줄이 없거나 통신사(AP · Reuters · AFP)가 나오면 하나도 넣지 않는다 — 재반입 · 추가분 공통.
  IF EXISTS (SELECT 1 FROM pg_temp.vi_seed WHERE coalesce(source->>'credit', '') !~* '\m(wrote|reported|adapted)\M'
             OR source->>'credit' ~* '(associated press|reuters|agence france)' OR source->>'credit' ~ '\m(AP|AFP)\M'
             OR source->>'url' !~ '^https://learningenglish\.voanews\.com/a/[A-Za-z0-9_-]+/[0-9]+\.html$'
             OR source->>'kind' IS DISTINCT FROM 'web' OR source->>'license' IS DISTINCT FROM 'public-domain') THEN
    RAISE EXCEPTION 'voa import: a seed row has an agency or missing credit, or a bad source — stop';
  END IF;
  SELECT count(*) INTO n_backup FROM backup_private.voa_import_job_20261109;
  SELECT count(*) INTO n FROM public.canonical_analysis_jobs WHERE kind = 'starter';
  IF n_backup > 0 OR n <> 1 THEN
    INSERT INTO pg_temp.vi_state (go) VALUES (false);
    RAISE NOTICE 'voa import: nothing to do (backup %, starter jobs %)', n_backup, n;
    RETURN;
  END IF;
  SELECT * INTO j FROM public.canonical_analysis_jobs WHERE kind = 'starter' FOR UPDATE;
  SELECT count(*) INTO n_present FROM public.reading_materials m JOIN pg_temp.vi_seed s ON s.title = m.title WHERE m.owner_id = j.owner_id;
  IF n_present > 0 THEN
    RAISE EXCEPTION 'voa import: % of the titles already exist for the starter owner — stop', n_present;
  END IF;
  IF j.status NOT IN ('running', 'paused', 'done') THEN
    RAISE EXCEPTION 'voa import: starter job % is %, expected running/paused/done — stop', j.id, j.status;
  END IF;
  IF j.status = 'done' AND EXISTS (SELECT 1 FROM public.canonical_analysis_jobs r WHERE r.owner_id = j.owner_id AND r.status = 'running') THEN
    RAISE EXCEPTION 'voa import: starter owner already has a running job — stop';
  END IF;
  IF coalesce(cardinality(j.material_ids), 0) + n_seed > 200 THEN
    RAISE EXCEPTION 'voa import: starter job would exceed 200 materials';
  END IF;
  INSERT INTO backup_private.voa_import_job_20261109 (job_id, status, material_ids, current_key, failure_streak, last_error, lease_until)
  VALUES (j.id, j.status, j.material_ids, j.current_key, j.failure_streak, j.last_error, j.lease_until);
  INSERT INTO pg_temp.vi_state (go, job_id, owner_id, others_md5)
  SELECT true, j.id, j.owner_id, md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m;
END $pre$;

DO $import$
DECLARE st pg_temp.vi_state%rowtype; added bigint[]; old_status text;
BEGIN
  SELECT * INTO st FROM pg_temp.vi_state;
  IF NOT st.go THEN RETURN; END IF;
  WITH ins AS (
    INSERT INTO public.reading_materials (title, raw_text, processed_json, visibility, owner_id, direction)
    SELECT s.title, s.body,
           jsonb_build_object('status', 'idle', 'sequence', '[]'::jsonb, 'dictionary', '{}'::jsonb,
             'metadata', jsonb_build_object('language', 'English', 'level', s.level, 'source', s.source)),
           'public', st.owner_id, 'read'
      FROM pg_temp.vi_seed s ORDER BY s.level, s.title
    RETURNING id
  )
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO added FROM ins;
  SELECT status INTO old_status FROM public.canonical_analysis_jobs WHERE id = st.job_id;
  UPDATE public.canonical_analysis_jobs
     SET material_ids = coalesce(material_ids, '{}') || added,
         status = CASE WHEN status = 'done' THEN 'running' ELSE status END,
         current_key = CASE WHEN status = 'done' THEN NULL ELSE current_key END,
         failure_streak = CASE WHEN status = 'done' THEN 0 ELSE failure_streak END,
         last_error = CASE WHEN status = 'done' THEN NULL ELSE last_error END,
         lease_until = CASE WHEN status = 'done' THEN NULL ELSE lease_until END,
         updated_at = now()
   WHERE id = st.job_id;
  UPDATE backup_private.voa_import_job_20261109 SET added_ids = added WHERE job_id = st.job_id;
  RAISE NOTICE 'voa import: inserted % materials %, starter job % % -> %', cardinality(added), added, st.job_id, old_status,
    (SELECT status FROM public.canonical_analysis_jobs WHERE id = st.job_id);
END $import$;

DO $post$
DECLARE st pg_temp.vi_state%rowtype; b backup_private.voa_import_job_20261109%rowtype; j public.canonical_analysis_jobs%rowtype;
BEGIN
  SELECT * INTO st FROM pg_temp.vi_state;
  IF NOT st.go THEN RETURN; END IF;
  SELECT * INTO b FROM backup_private.voa_import_job_20261109 WHERE job_id = st.job_id;
  SELECT * INTO j FROM public.canonical_analysis_jobs WHERE id = st.job_id;
  IF cardinality(b.added_ids) <> 26
     OR (SELECT count(*) FROM public.reading_materials m JOIN pg_temp.vi_seed s ON s.title = m.title
         WHERE m.id = ANY (b.added_ids) AND m.owner_id = st.owner_id AND m.visibility = 'public' AND m.direction = 'read'
           AND m.raw_text = s.body AND m.processed_json->>'status' = 'idle'
           AND m.processed_json->'metadata' = jsonb_build_object('language', 'English', 'level', s.level, 'source', s.source)) <> 26 THEN
    RAISE EXCEPTION 'voa import: inserted rows differ from the seed';
  END IF;
  IF j.material_ids IS DISTINCT FROM coalesce(b.material_ids, '{}') || b.added_ids
     OR j.status <> (CASE WHEN b.status = 'done' THEN 'running' ELSE b.status END) THEN
    RAISE EXCEPTION 'voa import: starter job not in the expected state';
  END IF;
  IF (SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m WHERE NOT (m.id = ANY (b.added_ids)))
     IS DISTINCT FROM st.others_md5 THEN
    RAISE EXCEPTION 'voa import: other materials changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.vi_pins p FULL JOIN pg_temp.vi_measure() a USING (k) WHERE a.v IS DISTINCT FROM p.v) THEN
    RAISE EXCEPTION 'voa import: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.vi_measure();
