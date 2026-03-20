import { randomUUID } from "node:crypto";
import { cacheGetJson, cacheSetJson } from "../cache/redisCache.ts";

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const CONVERSATION_KEY_PREFIX = process.env.CONVERSATION_KEY_PREFIX ?? "conversation";
const CONVERSATION_TTL_SEC = envPositiveInt(
  process.env.CONVERSATION_TTL_SEC,
  14 * 24 * 60 * 60
);
const CONVERSATION_MAX_TURNS = envPositiveInt(process.env.CONVERSATION_MAX_TURNS, 40);
const CONVERSATION_PROMPT_TURNS = envPositiveInt(
  process.env.CONVERSATION_PROMPT_TURNS,
  12
);

function envPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function conversationKey(conversationId: string): string {
  return `${CONVERSATION_KEY_PREFIX}:${conversationId}:turns`;
}

function normalizeTurn(turn: ConversationTurn): ConversationTurn {
  return {
    role: turn.role,
    content: turn.content.trim(),
  };
}

function isConversationTurn(value: unknown): value is ConversationTurn {
  if (!value || typeof value !== "object") return false;
  const role = (value as Record<string, unknown>).role;
  const content = (value as Record<string, unknown>).content;
  return (
    (role === "user" || role === "assistant") &&
    typeof content === "string" &&
    content.trim() !== ""
  );
}

function sanitizeTurns(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];

  const turns = value
    .filter(isConversationTurn)
    .map((turn) => normalizeTurn(turn))
    .filter((turn) => turn.content !== "");

  const deduped: ConversationTurn[] = [];
  for (const turn of turns) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === turn.role && prev.content === turn.content) continue;
    deduped.push(turn);
  }

  if (deduped.length > CONVERSATION_MAX_TURNS) {
    return deduped.slice(-CONVERSATION_MAX_TURNS);
  }

  return deduped;
}

export function parseConversationId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 128) return undefined;
  if (!/^[a-zA-Z0-9:_-]+$/.test(normalized)) return undefined;
  return normalized;
}

export function ensureConversationId(value: unknown): string {
  return parseConversationId(value) ?? randomUUID();
}

export async function getConversationTurns(
  conversationId: string
): Promise<ConversationTurn[]> {
  const key = conversationKey(conversationId);
  const cached = await cacheGetJson<unknown>(key);
  return sanitizeTurns(cached);
}

export async function getConversationPromptHistory(
  conversationId: string
): Promise<ConversationTurn[]> {
  const turns = await getConversationTurns(conversationId);
  if (turns.length <= CONVERSATION_PROMPT_TURNS) return turns;
  return turns.slice(-CONVERSATION_PROMPT_TURNS);
}

export async function appendConversationTurns(args: {
  conversationId: string;
  turns: ConversationTurn[];
}): Promise<ConversationTurn[]> {
  const existing = await getConversationTurns(args.conversationId);
  const appended = sanitizeTurns([...existing, ...args.turns]);
  await cacheSetJson(
    conversationKey(args.conversationId),
    appended,
    CONVERSATION_TTL_SEC
  );
  return appended;
}

export function mergePromptHistory(args: {
  stored: ConversationTurn[];
  request?: ConversationTurn[];
}): ConversationTurn[] {
  if (args.stored.length > 0) {
    return args.stored;
  }
  return sanitizeTurns(args.request ?? []);
}
