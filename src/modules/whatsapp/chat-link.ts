export interface WhatsAppChatTarget {
  phone?: string | null;
  contactName?: string | null;
}

export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits || null;
}

export function buildWhatsAppChatLink({ phone, contactName }: WhatsAppChatTarget) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const params = new URLSearchParams({
    phone: normalizedPhone,
  });

  const normalizedName = contactName?.trim();

  if (normalizedName) {
    params.set("name", normalizedName);
  }

  return `/whatsapp?${params.toString()}`;
}
