-- ── C1: 자료별 댓글 ─────────────────────────────
CREATE TABLE IF NOT EXISTS material_comments (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  material_id bigint NOT NULL REFERENCES reading_materials(id) ON DELETE CASCADE,
  user_id     uuid   NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text   NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE material_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read material comments"
  ON material_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can post comments"
  ON material_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can delete own comment"
  ON material_comments FOR DELETE USING (auth.uid() = user_id);

-- ── C2: 단어장 공유 덱 ──────────────────────────
CREATE TABLE IF NOT EXISTS vocab_decks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  language   text NOT NULL DEFAULT 'Japanese',
  word_count int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vocab_deck_words (
  deck_id   uuid NOT NULL REFERENCES vocab_decks(id) ON DELETE CASCADE,
  word_text text NOT NULL,
  furigana  text,
  meaning   text,
  pos       text,
  PRIMARY KEY (deck_id, word_text)
);

ALTER TABLE vocab_decks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_deck_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read decks"
  ON vocab_decks FOR SELECT USING (true);
CREATE POLICY "Owner can insert deck"
  ON vocab_decks FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can delete deck"
  ON vocab_decks FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can read deck words"
  ON vocab_deck_words FOR SELECT USING (true);
CREATE POLICY "Owner can insert deck words"
  ON vocab_deck_words FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM vocab_decks WHERE id = deck_id AND owner_id = auth.uid())
  );
CREATE POLICY "Owner can delete deck words"
  ON vocab_deck_words FOR DELETE USING (
    EXISTS (SELECT 1 FROM vocab_decks WHERE id = deck_id AND owner_id = auth.uid())
  );
