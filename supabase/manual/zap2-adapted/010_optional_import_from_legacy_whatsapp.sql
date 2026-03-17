-- Opcional.
-- Rode apenas se voce quiser semear as tabelas wa_* com dados basicos
-- vindos do dominio legado public.whatsapp_*.
--
-- Limitacoes conhecidas desta importacao:
-- 1. midias antigas nao sao reidratadas no storage do Zap2
-- 2. o schema wa_* usa chaves globais por contact_jid e chat_jid
-- 3. esta importacao foi pensada para ambiente com sessao unica ou baixa concorrencia

with session_map as (
  select
    ws.id as legacy_session_id,
    coalesce(
      nullif(regexp_replace(lower(ws.name), '[^a-z0-9]+', '_', 'g'), ''),
      'session_' || substr(replace(ws.id::text, '-', ''), 1, 12)
    ) as session_key
  from public.whatsapp_sessions ws
)
insert into public.wa_sessions (
  session_key,
  phone_number,
  status,
  connected_at,
  last_seen_at,
  metadata,
  created_at,
  updated_at
)
select
  sm.session_key,
  ws.phone_number,
  case ws.session_status::text
    when 'disconnected' then 'logged_out'
    else ws.session_status::text
  end,
  ws.last_connected_at,
  ws.last_seen_at,
  coalesce(ws.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_session_id', ws.id,
    'legacy_user_id', ws.user_id,
    'legacy_name', ws.name,
    'legacy_device_jid', ws.device_jid,
    'legacy_error_message', ws.error_message
  ),
  ws.created_at,
  ws.updated_at
from public.whatsapp_sessions ws
join session_map sm on sm.legacy_session_id = ws.id
on conflict (session_key) do update
set
  phone_number = excluded.phone_number,
  status = excluded.status,
  connected_at = excluded.connected_at,
  last_seen_at = excluded.last_seen_at,
  metadata = public.wa_sessions.metadata || excluded.metadata,
  updated_at = now();

insert into public.wa_contacts (
  contact_jid,
  phone_number,
  display_name,
  push_name,
  verified_name,
  profile_photo_url,
  metadata,
  created_at,
  updated_at
)
select
  wc.contact_jid,
  wc.phone_number,
  wc.full_name,
  wc.push_name,
  wc.profile_name,
  wc.avatar_url,
  coalesce(wc.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_contact_id', wc.id,
    'legacy_user_id', wc.user_id,
    'legacy_session_id', wc.session_id,
    'legacy_lid', wc.lid,
    'legacy_is_business', wc.is_business
  ),
  wc.created_at,
  wc.updated_at
from public.whatsapp_contacts wc
on conflict (contact_jid) do update
set
  phone_number = coalesce(excluded.phone_number, public.wa_contacts.phone_number),
  display_name = coalesce(excluded.display_name, public.wa_contacts.display_name),
  push_name = coalesce(excluded.push_name, public.wa_contacts.push_name),
  verified_name = coalesce(excluded.verified_name, public.wa_contacts.verified_name),
  profile_photo_url = coalesce(excluded.profile_photo_url, public.wa_contacts.profile_photo_url),
  metadata = public.wa_contacts.metadata || excluded.metadata,
  updated_at = now();

with session_map as (
  select
    ws.id as legacy_session_id,
    coalesce(
      nullif(regexp_replace(lower(ws.name), '[^a-z0-9]+', '_', 'g'), ''),
      'session_' || substr(replace(ws.id::text, '-', ''), 1, 12)
    ) as session_key
  from public.whatsapp_sessions ws
)
insert into public.wa_chats (
  chat_jid,
  session_key,
  contact_jid,
  chat_type,
  title,
  last_message_at,
  unread_count,
  archived,
  metadata,
  created_at,
  updated_at
)
select
  wc.chat_jid,
  sm.session_key,
  case when wc.is_group then null else wc.chat_jid end,
  case when wc.is_group then 'group' else 'direct' end,
  wc.subject,
  wc.last_message_at,
  wc.unread_count,
  wc.is_archived,
  coalesce(wc.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy_chat_id', wc.id,
    'legacy_user_id', wc.user_id,
    'legacy_session_id', wc.session_id
  ),
  wc.created_at,
  wc.updated_at
from public.whatsapp_chats wc
join session_map sm on sm.legacy_session_id = wc.session_id
on conflict (chat_jid) do update
set
  session_key = excluded.session_key,
  contact_jid = coalesce(excluded.contact_jid, public.wa_chats.contact_jid),
  chat_type = excluded.chat_type,
  title = coalesce(excluded.title, public.wa_chats.title),
  last_message_at = coalesce(excluded.last_message_at, public.wa_chats.last_message_at),
  unread_count = excluded.unread_count,
  archived = excluded.archived,
  metadata = public.wa_chats.metadata || excluded.metadata,
  updated_at = now();

with session_map as (
  select
    ws.id as legacy_session_id,
    coalesce(
      nullif(regexp_replace(lower(ws.name), '[^a-z0-9]+', '_', 'g'), ''),
      'session_' || substr(replace(ws.id::text, '-', ''), 1, 12)
    ) as session_key
  from public.whatsapp_sessions ws
)
insert into public.wa_messages (
  chat_jid,
  session_key,
  message_id,
  sender_jid,
  recipient_jid,
  from_me,
  message_type,
  text_body,
  quoted_message_id,
  status,
  sent_at,
  raw_payload,
  created_at,
  updated_at
)
select
  wm.chat_jid,
  sm.session_key,
  wm.baileys_message_id,
  wm.sender_jid,
  wm.recipient_jid,
  wm.message_direction = 'outbound',
  wm.message_type,
  wm.text_content,
  wm.quoted_message_id,
  case wm.message_status::text
    when 'queued' then 'pending'
    else wm.message_status::text
  end,
  coalesce(wm.sent_at, wm.created_at),
  coalesce(wm.raw_payload, '{}'::jsonb) || jsonb_build_object(
    'legacy_message_id', wm.id,
    'legacy_user_id', wm.user_id,
    'legacy_session_id', wm.session_id
  ),
  wm.created_at,
  coalesce(wm.created_at, now())
from public.whatsapp_messages wm
join session_map sm on sm.legacy_session_id = wm.session_id
where exists (
  select 1
  from public.wa_chats wc
  where wc.chat_jid = wm.chat_jid
)
on conflict (chat_jid, message_id) do update
set
  sender_jid = coalesce(excluded.sender_jid, public.wa_messages.sender_jid),
  recipient_jid = coalesce(excluded.recipient_jid, public.wa_messages.recipient_jid),
  from_me = excluded.from_me,
  message_type = coalesce(excluded.message_type, public.wa_messages.message_type),
  text_body = coalesce(excluded.text_body, public.wa_messages.text_body),
  quoted_message_id = coalesce(excluded.quoted_message_id, public.wa_messages.quoted_message_id),
  status = excluded.status,
  sent_at = excluded.sent_at,
  raw_payload = public.wa_messages.raw_payload || excluded.raw_payload,
  updated_at = now();
