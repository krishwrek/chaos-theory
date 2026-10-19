import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  channel: z.string(),
  userIds: z.array(z.string()),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | { lastSeen: Record<string, number> }
  | { error: string };

export const postRealtimeLastseen = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/_realtime/lastseen`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return superjson.parse<OutputType>(await result.text());
};
   28