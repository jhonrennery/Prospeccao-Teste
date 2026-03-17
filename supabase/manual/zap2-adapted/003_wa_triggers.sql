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
