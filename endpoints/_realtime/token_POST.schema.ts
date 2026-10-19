import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ roomCode: z.string().trim().min(4).max(12).optional() });

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | { token: string; wssEndpoint: string; userId: string }
  | { error: string };

export const postRealtimeToken = async (
  body: InputType = {},
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/_realtime/token`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return superjson.parse<OutputType>(await result.text());
};
   25