export type Role = "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt?: Date;
}

export interface Session {
  id: string;
  userId?: string;
  channel: "web" | "telegram";
  telegramChatId?: number;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
}

export interface Lead {
  id?: string;
  sessionId?: string;
  userId?: string;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  source: "web" | "telegram";
}

export interface UserMemoryFact {
  userId: string;
  key: string;
  value: string;
}

export interface ServiceInfo {
  id: string;
  category: string;
  title: string;
  description?: string;
  data: Record<string, unknown>;
}
