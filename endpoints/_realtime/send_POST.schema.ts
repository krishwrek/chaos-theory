import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  channel: z.string(),
  data: z.unknown(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { ok: true; delivered: number } | { error: string };

export const postRealtimeSend = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/_realtime/send`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return superjson.parse<OutputType>(await result.text());
};
   26