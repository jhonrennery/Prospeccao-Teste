
ALTER TABLE wa_messages
  DROP CONSTRAINT IF EXISTS wa_messages_chat_jid_fkey;

ALTER TABLE wa_media
  DROP CONSTRAINT IF EXISTS wa_media_chat_jid_fkey;

ALTER TABLE wa_chat_labels
  DROP CONSTRAINT IF EXISTS wa_chat_labels_chat_jid_fkey;

ALTER TABLE wa_chat_labels
  DROP CONSTRAINT IF EXISTS wa_chat_labels_label_id_fkey;

ALTER TABLE wa_chats
  DROP CONSTRAINT wa_chats_pkey;

ALTER TABLE wa_chats
  ADD PRIMARY KEY (chat_jid, session_key);

CREATE INDEX IF NOT EXISTS wa_chats_session_key_idx
  ON wa_chats (session_key);

DROP INDEX IF EXISTS wa_chats_last_message_at_idx;

CREATE INDEX IF NOT EXISTS wa_chats_last_message_at_idx
  ON wa_chats (session_key, last_message_at DESC NULLS LAST);

ALTER TABLE wa_messages
  DROP CONSTRAINT IF EXISTS wa_messages_chat_jid_message_id_key;

ALTER TABLE wa_messages
  ADD CONSTRAINT wa_messages_session_chat_message_key
  UNIQUE (session_key, chat_jid, message_id);

DROP INDEX IF EXISTS wa_messages_chat_jid_sent_at_idx;

CREATE INDEX IF NOT EXISTS wa_messages_session_chat_sent_idx
  ON wa_messages (session_key, chat_jid, sent_at DESC, id DESC);

ALTER TABLE wa_messages
  ADD CONSTRAINT wa_messages_chat_fkey
  FOREIGN KEY (chat_jid, session_key)
  REFERENCES wa_chats(chat_jid, session_key)
  ON DELETE CASCADE;

ALTER TABLE wa_media
  ADD COLUMN IF NOT EXISTS session_key text NOT NULL DEFAULT 'primary';

UPDATE wa_media wm
  SET session_key = msg.session_key
  FROM wa_messages msg
  WHERE msg.id = wm.message_pk;

ALTER TABLE wa_media
  ADD CONSTRAINT wa_media_chat_fkey
  FOREIGN KEY (chat_jid, session_key)
  REFERENCES wa_chats(chat_jid, session_key)
  ON DELETE CASCADE;

DROP INDEX IF EXISTS wa_media_chat_jid_idx;

CREATE INDEX IF NOT EXISTS wa_media_session_chat_idx
  ON wa_media (session_key, chat_jid, created_at DESC);

ALTER TABLE wa_media
  DROP CONSTRAINT IF EXISTS wa_media_chat_jid_message_id_media_kind_key;

ALTER TABLE wa_media
  ADD CONSTRAINT wa_media_session_chat_message_kind_key
  UNIQUE (session_key, chat_jid, message_id, media_kind);

ALTER TABLE wa_labels
  DROP CONSTRAINT wa_labels_pkey;

ALTER TABLE wa_labels
  ADD PRIMARY KEY (id, session_key);

ALTER TABLE wa_chat_labels
  DROP CONSTRAINT wa_chat_labels_pkey;

ALTER TABLE wa_chat_labels
  ADD PRIMARY KEY (chat_jid, label_id, session_key);

ALTER TABLE wa_chat_labels
  ADD CONSTRAINT wa_chat_labels_chat_fkey
  FOREIGN KEY (chat_jid, session_key)
  REFERENCES wa_chats(chat_jid, session_key)
  ON DELETE CASCADE;

ALTER TABLE wa_chat_labels
  ADD CONSTRAINT wa_chat_labels_label_fkey
  FOREIGN KEY (label_id, session_key)
  REFERENCES wa_labels(id, session_key)
  ON DELETE CASCADE;

DROP INDEX IF EXISTS wa_chat_labels_label_id_idx;

CREATE INDEX IF NOT EXISTS wa_chat_labels_label_session_idx
  ON wa_chat_labels (session_key, label_id, created_at DESC);
