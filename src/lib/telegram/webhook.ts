export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number };
    text?: string;
  };
}

export function parseUpdate(body: unknown): TelegramUpdate | null {
  const u = body as TelegramUpdate;
  if (!u?.update_id) return null;
  return u;
}
