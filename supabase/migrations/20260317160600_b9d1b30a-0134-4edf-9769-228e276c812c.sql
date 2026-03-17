
-- RLS policies for wa_* tables (allow all authenticated users full access)
-- These tables don't have user_id, so access is scoped by authenticated status

CREATE POLICY "Authenticated users can select wa_sessions" ON public.wa_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_sessions" ON public.wa_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_sessions" ON public.wa_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_sessions" ON public.wa_sessions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select wa_contacts" ON public.wa_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_contacts" ON public.wa_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_contacts" ON public.wa_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_contacts" ON public.wa_contacts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select wa_chats" ON public.wa_chats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_chats" ON public.wa_chats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_chats" ON public.wa_chats FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_chats" ON public.wa_chats FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select wa_messages" ON public.wa_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_messages" ON public.wa_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_messages" ON public.wa_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_messages" ON public.wa_messages FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select wa_media" ON public.wa_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_media" ON public.wa_media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_media" ON public.wa_media FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_media" ON public.wa_media FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select wa_labels" ON public.wa_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_labels" ON public.wa_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_labels" ON public.wa_labels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_labels" ON public.wa_labels FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select wa_chat_labels" ON public.wa_chat_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_chat_labels" ON public.wa_chat_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_chat_labels" ON public.wa_chat_labels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete wa_chat_labels" ON public.wa_chat_labels FOR DELETE TO authenticated USING (true);
