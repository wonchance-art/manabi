-- New profiles start as students. Existing rows and UPDATE role controls stay intact.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  BEGIN
    INSERT INTO public.profiles (id, display_name, role, streak_count, last_login_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', '새로운 학습자'),
      'student',
      1,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- 프로필 생성 실패해도 회원가입은 통과
    RETURN NEW;
  END;
  $function$;

CREATE POLICY profiles_insert_student_only ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (role = 'student');

