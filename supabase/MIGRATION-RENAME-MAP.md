# 마이그레이션 개명 매핑 (RENAME-MAP)

생성: 2026-07-12. Supabase CLI 요구 형식 `YYYYMMDDHHMMSS_name.sql`(14자리 고유 타임스탬프)로 전 파일 개명.

규칙: 기존 파일명의 사전식(lexicographic) 순서를 정확히 보존. 같은 날짜(YYYYMMDD) 그룹은 `HHMMSS`를 `000100, 000200, …`로 순번 부여하고, 문자 접미(b~g) 파일은 그 순번 뒤에 이어 붙였다. 이름 부분(`_name`)은 그대로 유지.

총 64개 파일 개명.

| 구 파일명 | 신 파일명 |
| --- | --- |
| `20260327_daily_suggestions.sql` | `20260327000100_daily_suggestions.sql` |
| `20260327_likes_rpc.sql` | `20260327000200_likes_rpc.sql` |
| `20260328_content_sources.sql` | `20260328000100_content_sources.sql` |
| `20260329_admin_rls.sql` | `20260329000100_admin_rls.sql` |
| `20260329_forum.sql` | `20260329000200_forum.sql` |
| `20260329_notifications.sql` | `20260329000300_notifications.sql` |
| `20260329_onboarding_columns.sql` | `20260329000400_onboarding_columns.sql` |
| `20260329_reading_progress.sql` | `20260329000500_reading_progress.sql` |
| `20260329_reading_progress_scroll.sql` | `20260329000600_reading_progress_scroll.sql` |
| `20260329_streak.sql` | `20260329000700_streak.sql` |
| `20260329_suggestion_material_id.sql` | `20260329000800_suggestion_material_id.sql` |
| `20260329_vocab_source_sentence.sql` | `20260329000900_vocab_source_sentence.sql` |
| `20260330_achievements.sql` | `20260330000100_achievements.sql` |
| `20260330_xp_system.sql` | `20260330000200_xp_system.sql` |
| `20260405_daily_goals.sql` | `20260405000100_daily_goals.sql` |
| `20260405_materials_delete_policy.sql` | `20260405000200_materials_delete_policy.sql` |
| `20260405_notifications_expand.sql` | `20260405000300_notifications_expand.sql` |
| `20260405_social.sql` | `20260405000400_social.sql` |
| `20260405_suggestions_insert_policy.sql` | `20260405000500_suggestions_insert_policy.sql` |
| `20260406_materials_update_policy.sql` | `20260406000100_materials_update_policy.sql` |
| `20260408_streak_freeze.sql` | `20260408000100_streak_freeze.sql` |
| `20260414_grammar_notes_srs.sql` | `20260414000100_grammar_notes_srs.sql` |
| `20260414_pdf_storage_bucket.sql` | `20260414000200_pdf_storage_bucket.sql` |
| `20260414_token_corrections.sql` | `20260414000300_token_corrections.sql` |
| `20260414_uploaded_pdfs.sql` | `20260414000400_uploaded_pdfs.sql` |
| `20260414_uploaded_pdfs_thumbnail.sql` | `20260414000500_uploaded_pdfs_thumbnail.sql` |
| `20260414_vocab_decks_source.sql` | `20260414000600_vocab_decks_source.sql` |
| `20260414_writing_practice.sql` | `20260414000700_writing_practice.sql` |
| `20260415_force_pdf_bucket.sql` | `20260415000100_force_pdf_bucket.sql` |
| `20260415_morpheme_dictionary.sql` | `20260415000200_morpheme_dictionary.sql` |
| `20260415_vocab_base_form.sql` | `20260415000300_vocab_base_form.sql` |
| `20260416_content_reports.sql` | `20260416000100_content_reports.sql` |
| `20260417_morpheme_detail.sql` | `20260417000100_morpheme_detail.sql` |
| `20260428_vocab_ipa_backfill.sql` | `20260428000100_vocab_ipa_backfill.sql` |
| `20260429_cleanup_old_seeds.sql` | `20260429000100_cleanup_old_seeds.sql` |
| `20260501_lesson_explanations.sql` | `20260501000100_lesson_explanations.sql` |
| `20260504_merge_phrases_into_grammar.sql` | `20260504000100_merge_phrases_into_grammar.sql` |
| `20260504b_n5_phrases_to_conversation.sql` | `20260504000200_n5_phrases_to_conversation.sql` |
| `20260509c_n5_reorder_and_rewrite.sql` | `20260509000100_n5_reorder_and_rewrite.sql` |
| `20260509d_n5_explanations_seed_v2.sql` | `20260509000200_n5_explanations_seed_v2.sql` |
| `20260511_n5_lesson1_redesign.sql` | `20260511000100_n5_lesson1_redesign.sql` |
| `20260511b_n5_lesson1_unify.sql` | `20260511000200_n5_lesson1_unify.sql` |
| `20260612_user_ref_progress.sql` | `20260612000100_user_ref_progress.sql` |
| `20260613_cohorts.sql` | `20260613000100_cohorts.sql` |
| `20260613_dday.sql` | `20260613000200_dday.sql` |
| `20260618_study_plan_progress.sql` | `20260618000100_study_plan_progress.sql` |
| `20260619_ref_progress_add_chinese.sql` | `20260619000100_ref_progress_add_chinese.sql` |
| `20260623_vocab_etym_hanja.sql` | `20260623000100_vocab_etym_hanja.sql` |
| `20260623_vocab_source_ref.sql` | `20260623000200_vocab_source_ref.sql` |
| `20260701_grammar_review.sql` | `20260701000100_grammar_review.sql` |
| `20260702_writing_studio.sql` | `20260702000100_writing_studio.sql` |
| `20260703_streak_freeze_earn.sql` | `20260703000100_streak_freeze_earn.sql` |
| `20260703_study_paragraphs.sql` | `20260703000200_study_paragraphs.sql` |
| `20260708_admin_metrics_rpc.sql` | `20260708000100_admin_metrics_rpc.sql` |
| `20260708_push_subscriptions.sql` | `20260708000200_push_subscriptions.sql` |
| `20260709_world_realtime_rls.sql` | `20260709000100_world_realtime_rls.sql` |
| `20260710_world_sessions.sql` | `20260710000100_world_sessions.sql` |
| `20260712_content_overrides.sql` | `20260712000100_content_overrides.sql` |
| `20260712b_harden_admin_fns.sql` | `20260712000200_harden_admin_fns.sql` |
| `20260712c_world_multiplayer.sql` | `20260712000300_world_multiplayer.sql` |
| `20260712d_world_open_all_users.sql` | `20260712000400_world_open_all_users.sql` |
| `20260712e_world_chat_rls.sql` | `20260712000500_world_chat_rls.sql` |
| `20260712f_world_stamps.sql` | `20260712000600_world_stamps.sql` |
| `20260712g_world_reports.sql` | `20260712000700_world_reports.sql` |
