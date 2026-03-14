
create extension if not exists pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_session_status') THEN
    CREATE TYPE public.whatsapp_session_status AS ENUM ('disconnected','connecting','qr_ready','connected','reconnecting','error');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_direction') THEN
    CREATE TYPE public.whatsapp_message_direction AS ENUM ('inbound','outbound');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_status') THEN
    CREATE TYPE public.whatsapp_message_status AS ENUM ('queued','sent','server_ack','delivered','read','received','failed');
  END IF;
END $$;

create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Sessao principal',
  phone_number text,
  device_jid text,
  session_status public.whatsapp_session_status not null default 'disconnected',
  qr_payload text,
  qr_expires_at timestamptz,
  last_connected_at timestamptz,
  last_seen_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_sessions_user_name_key on public.whatsapp_sessions(user_id, name);

create table if not exists public.whatsapp_session_auth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  auth_group text not null,
  auth_key text not null,
  auth_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, auth_group, auth_key)
);

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  contact_jid text not null,
  lid text,
  phone_number text,
  push_name text,
  full_name text,
  profile_name text,
  is_business boolean not null default false,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, contact_jid)
);

create table if not exists public.whatsapp_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  chat_jid text not null,
  subject text,
  is_group boolean not null default false,
  is_archived boolean not null default false,
  unread_count integer not null default 0,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, chat_jid)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  chat_id uuid references public.whatsapp_chats(id) on delete set null,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  baileys_message_id text not null,
  chat_jid text not null,
  sender_jid text,
  recipient_jid text,
  push_name text,
  message_direction public.whatsapp_message_direction not null,
  message_type text not null default 'text',
  message_status public.whatsapp_message_status not null default 'queued',
  text_content text,
  media_url text,
  media_mime_type text,
  media_caption text,
  quoted_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, baileys_message_id)
);

create index if not exists whatsapp_messages_session_chat_created_idx on public.whatsapp_messages(session_id, chat_jid, created_at desc);

create table if not exists public.whatsapp_message_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  message_id uuid not null references public.whatsapp_messages(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_sessions enable row level security;
alter table public.whatsapp_session_auth enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_chats enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_message_events enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_sessions' AND policyname = 'Users can view own whatsapp_sessions') THEN
    CREATE POLICY "Users can view own whatsapp_sessions" ON public.whatsapp_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_sessions' AND policyname = 'Users can create own whatsapp_sessions') THEN
    CREATE POLICY "Users can create own whatsapp_sessions" ON public.whatsapp_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_sessions' AND policyname = 'Users can update own whatsapp_sessions') THEN
    CREATE POLICY "Users can update own whatsapp_sessions" ON public.whatsapp_sessions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_sessions' AND policyname = 'Users can delete own whatsapp_sessions') THEN
    CREATE POLICY "Users can delete own whatsapp_sessions" ON public.whatsapp_sessions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_session_auth' AND policyname = 'Users can view own whatsapp_session_auth') THEN
    CREATE POLICY "Users can view own whatsapp_session_auth" ON public.whatsapp_session_auth FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_session_auth' AND policyname = 'Users can create own whatsapp_session_auth') THEN
    CREATE POLICY "Users can create own whatsapp_session_auth" ON public.whatsapp_session_auth FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_session_auth' AND policyname = 'Users can update own whatsapp_session_auth') THEN
    CREATE POLICY "Users can update own whatsapp_session_auth" ON public.whatsapp_session_auth FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_session_auth' AND policyname = 'Users can delete own whatsapp_session_auth') THEN
    CREATE POLICY "Users can delete own whatsapp_session_auth" ON public.whatsapp_session_auth FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_contacts' AND policyname = 'Users can view own whatsapp_contacts') THEN
    CREATE POLICY "Users can view own whatsapp_contacts" ON public.whatsapp_contacts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_contacts' AND policyname = 'Users can create own whatsapp_contacts') THEN
    CREATE POLICY "Users can create own whatsapp_contacts" ON public.whatsapp_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_contacts' AND policyname = 'Users can update own whatsapp_contacts') THEN
    CREATE POLICY "Users can update own whatsapp_contacts" ON public.whatsapp_contacts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_contacts' AND policyname = 'Users can delete own whatsapp_contacts') THEN
    CREATE POLICY "Users can delete own whatsapp_contacts" ON public.whatsapp_contacts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_chats' AND policyname = 'Users can view own whatsapp_chats') THEN
    CREATE POLICY "Users can view own whatsapp_chats" ON public.whatsapp_chats FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_chats' AND policyname = 'Users can create own whatsapp_chats') THEN
    CREATE POLICY "Users can create own whatsapp_chats" ON public.whatsapp_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_chats' AND policyname = 'Users can update own whatsapp_chats') THEN
    CREATE POLICY "Users can update own whatsapp_chats" ON public.whatsapp_chats FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_chats' AND policyname = 'Users can delete own whatsapp_chats') THEN
    CREATE POLICY "Users can delete own whatsapp_chats" ON public.whatsapp_chats FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can view own whatsapp_messages') THEN
    CREATE POLICY "Users can view own whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can create own whatsapp_messages') THEN
    CREATE POLICY "Users can create own whatsapp_messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can update own whatsapp_messages') THEN
    CREATE POLICY "Users can update own whatsapp_messages" ON public.whatsapp_messages FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can delete own whatsapp_messages') THEN
    CREATE POLICY "Users can delete own whatsapp_messages" ON public.whatsapp_messages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_message_events' AND policyname = 'Users can view own whatsapp_message_events') THEN
    CREATE POLICY "Users can view own whatsapp_message_events" ON public.whatsapp_message_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_message_events' AND policyname = 'Users can create own whatsapp_message_events') THEN
    CREATE POLICY "Users can create own whatsapp_message_events" ON public.whatsapp_message_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists update_whatsapp_sessions_updated_at on public.whatsapp_sessions;
create trigger update_whatsapp_sessions_updated_at before update on public.whatsapp_sessions for each row execute function public.update_updated_at_column();

drop trigger if exists update_whatsapp_session_auth_updated_at on public.whatsapp_session_auth;
create trigger update_whatsapp_session_auth_updated_at before update on public.whatsapp_session_auth for each row execute function public.update_updated_at_column();

drop trigger if exists update_whatsapp_contacts_updated_at on public.whatsapp_contacts;
create trigger update_whatsapp_contacts_updated_at before update on public.whatsapp_contacts for each row execute function public.update_updated_at_column();

drop trigger if exists update_whatsapp_chats_updated_at on public.whatsapp_chats;
create trigger update_whatsapp_chats_updated_at before update on public.whatsapp_chats for each row execute function public.update_updated_at_column();
