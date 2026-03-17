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

alter table public.wa_labels
  add column if not exists session_key text not null default 'primary';

alter table public.wa_labels
  add column if not exists source text not null default 'whatsapp';

update public.wa_labels
set session_key = 'primary'
where session_key is null;

update public.wa_labels
set source = 'whatsapp'
where source is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wa_labels_session_key_fkey'
  ) then
    alter table public.wa_labels
      add constraint wa_labels_session_key_fkey
      foreign key (session_key)
      references public.wa_sessions(session_key)
      on delete cascade;
  end if;
end $$;

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
