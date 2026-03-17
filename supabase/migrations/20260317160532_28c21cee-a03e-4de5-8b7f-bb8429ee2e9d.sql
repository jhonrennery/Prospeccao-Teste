
-- PARTE 1: Tabelas principais

create table if not exists public.wa_sessions (
  session_key text primary key,
  phone_number text,
  status text not null,
  connected_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_contacts (
  contact_jid text primary key,
  phone_number text,
  display_name text,
  push_name text,
  verified_name text,
  profile_photo_url text,
  profile_photo_fetched_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_chats (
  chat_jid text primary key,
  session_key text not null references public.wa_sessions(session_key) on delete cascade,
  contact_jid text references public.wa_contacts(contact_jid) on delete set null,
  chat_type text not null,
  title text,
  avatar_url text,
  last_message_id text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count integer not null default 0,
  archived boolean not null default false,
  pinned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_messages (
  id bigserial primary key,
  chat_jid text not null references public.wa_chats(chat_jid) on delete cascade,
  session_key text not null references public.wa_sessions(session_key) on delete cascade,
  message_id text not null,
  sender_jid text,
  recipient_jid text,
  participant_jid text,
  from_me boolean not null default false,
  message_type text,
  text_body text,
  quoted_message_id text,
  status text not null default 'received',
  sent_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_jid, message_id)
);

create index if not exists wa_chats_last_message_at_idx
on public.wa_chats (last_message_at desc nulls last);

create index if not exists wa_messages_chat_jid_sent_at_idx
on public.wa_messages (chat_jid, sent_at desc, id desc);

create table if not exists public.wa_media (
  id bigserial primary key,
  message_pk bigint not null references public.wa_messages(id) on delete cascade,
  chat_jid text not null references public.wa_chats(chat_jid) on delete cascade,
  message_id text not null,
  media_kind text not null,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds integer,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_pk),
  unique (chat_jid, message_id, media_kind)
);

create index if not exists wa_media_chat_jid_idx
on public.wa_media (chat_jid, created_at desc);

-- PARTE 2: Labels

create table if not exists public.wa_labels (
  id text primary key,
  session_key text not null default 'primary' references public.wa_sessions(session_key) on delete cascade,
  source text not null default 'whatsapp',
  name text not null,
  color integer not null default 0,
  deleted boolean not null default false,
  predefined_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wa_labels_session_source_idx
on public.wa_labels (session_key, source, deleted, name);

create table if not exists public.wa_chat_labels (
  chat_jid text not null references public.wa_chats(chat_jid) on delete cascade,
  label_id text not null references public.wa_labels(id) on delete cascade,
  session_key text not null references public.wa_sessions(session_key) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chat_jid, label_id)
);

create index if not exists wa_chat_labels_label_id_idx
on public.wa_chat_labels (label_id, created_at desc);

-- PARTE 3: Triggers

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists update_wa_sessions_updated_at on public.wa_sessions;
create trigger update_wa_sessions_updated_at
before update on public.wa_sessions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_wa_contacts_updated_at on public.wa_contacts;
create trigger update_wa_contacts_updated_at
before update on public.wa_contacts
for each row execute function public.update_updated_at_column();

drop trigger if exists update_wa_chats_updated_at on public.wa_chats;
create trigger update_wa_chats_updated_at
before update on public.wa_chats
for each row execute function public.update_updated_at_column();

drop trigger if exists update_wa_messages_updated_at on public.wa_messages;
create trigger update_wa_messages_updated_at
before update on public.wa_messages
for each row execute function public.update_updated_at_column();

drop trigger if exists update_wa_media_updated_at on public.wa_media;
create trigger update_wa_media_updated_at
before update on public.wa_media
for each row execute function public.update_updated_at_column();

drop trigger if exists update_wa_labels_updated_at on public.wa_labels;
create trigger update_wa_labels_updated_at
before update on public.wa_labels
for each row execute function public.update_updated_at_column();

drop trigger if exists update_wa_chat_labels_updated_at on public.wa_chat_labels;
create trigger update_wa_chat_labels_updated_at
before update on public.wa_chat_labels
for each row execute function public.update_updated_at_column();

-- RLS
alter table public.wa_sessions enable row level security;
alter table public.wa_contacts enable row level security;
alter table public.wa_chats enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_media enable row level security;
alter table public.wa_labels enable row level security;
alter table public.wa_chat_labels enable row level security;
