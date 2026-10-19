import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  action: z.enum(["create", "join", "state", "ready", "start", "chat", "submit"]),
  nickname: z.string().trim().min(1).max(18).optional(),
  roomCode: z.string().trim().min(4).max(12).optional(),
  ready: z.boolean().optional(),
  message: z.string().trim().min(1).max(180).optional(),
  answer: z.string().trim().min(1).max(100).optional(),
});
export type InputType = z.infer<typeof schema>;
export type PlayerDto = { sessionId: string; nickname: string; isHost: boolean; isReady: boolean; score: number };
export type OutputType = { ok: true; room: { code: string; phase: string; roundIndex: number; hostSession: string; deadlineAt: Date | string | null }; players: PlayerDto[]; sessionId: string; me: { secretRole: string; secretObjective: string } } | { error: string };
export const postRoom = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch("/_api/room", { method: "POST", body: superjson.stringify(validated), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  return superjson.parse<OutputType>(await result.text());
};