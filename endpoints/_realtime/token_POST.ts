import { createToken } from "@floot/realtime";
import { db } from "../../helpers/db";
import { channels } from "../../helpers/realtimeChannels";
import superjson from "superjson";

// Mints a realtime token for the current connection. Who the user is and which
// channels they may access are both yours to set.
//
// Identity (userId — what presence reports as online). Pick a source:
//  - logged-in: read your session, e.g.
//      const userId = (await getServerSession(request))?.user.id;
//  - anonymous: an id you generate (crypto.randomUUID()). To keep it stable across
//      reconnects, persist it — e.g. set + read a cookie here, or have the client
//      store it and send it (see the next option).
//  - from the client: add fields to the schema (token_POST.schema), read them off
//      the request body here, and pass them where RealtimeClient calls
//      postRealtimeToken().
const json = (data: unknown, status = 200) =>
  new Response(superjson.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function handle(request: Request) {
  const cookies = (request.headers.get("cookie") || "").split(";").map(v => v.trim());
  const cookieId = cookies.find(v => v.startsWith("ct_session="))?.slice("ct_session=".length);
  const userId = cookieId && /^[a-zA-Z0-9_-]{12,80}$/.test(cookieId) ? cookieId : "pre-room-" + crypto.randomUUID().replace(/-/g, "");
  let roomCode: string | undefined;
  try {
    const parsed = (await import("superjson")).default.parse(await request.text()) as { roomCode?: string };
    roomCode = parsed.roomCode;
  } catch {}
  const grants: string[] = [];
  if (cookieId && roomCode && /^[A-Z0-9-]{4,12}$/.test(roomCode)) {
    const member = await db.selectFrom("ctPlayers").select("sessionId").where("sessionId", "=", userId).where("roomCode", "=", roomCode).executeTakeFirst();
    if (member) grants.push(channels.room(roomCode), channels.presence(roomCode));
  }
  if (grants.length === 0) grants.push(channels.room("__lobby__"));

  const result = await createToken({ userId, channels: grants, ttlSeconds: 3600 });
  if (!result.ok) {
    return json({ error: result.error.message }, 500);
  }
  return json({ token: result.token, wssEndpoint: result.wssEndpoint, userId });
}
   46