import {
  getChat,
  upsertChat,
  upsertContact,
} from '../../../../../lib/inbox-store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizePhoneDigits = (value) => String(value ?? '').replace(/\D/g, '');

const buildDirectChatJid = (phoneDigits) => `${phoneDigits}@s.whatsapp.net`;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneDigits = normalizePhoneDigits(searchParams.get('phone'));
    const contactName = String(searchParams.get('name') ?? '').trim();

    if (!phoneDigits) {
      return Response.json(
        { error: 'Numero de telefone invalido para abrir a conversa.' },
        { status: 400 },
      );
    }

    const chatJid = buildDirectChatJid(phoneDigits);

    await upsertContact({
      id: chatJid,
      name: contactName || undefined,
      notify: contactName || undefined,
      source: 'lead-shortcut',
    });

    await upsertChat({
      chatJid,
      title: contactName || null,
      metadata: {
        source: 'lead-shortcut',
        bootstrap: true,
      },
    });

    const chat = await getChat(chatJid);

    return Response.json({ chat });
  } catch (error) {
    console.error('Failed to resolve WhatsApp chat launch target.', error);

    return Response.json(
      { error: 'Nao foi possivel abrir a conversa deste contato.' },
      { status: 500 },
    );
  }
}
