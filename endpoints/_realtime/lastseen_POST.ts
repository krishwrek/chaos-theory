import { lastSeen } from "@floot/realtime";
import { schema } from "./lastseen_POST.schema";
import superjson from "superjson";

// The browser POSTs { channel, userIds } and gets back { lastSeen: { userId: ts } }
// for the offline users it's rendering. Fetch on demand for a bounded set and cache
// it (last-seen changes slowly). An absent userId means online now, or last seen
// beyond the retention window.
//
// Security: last-seen reveals who was active when, so only return it to a user who
// may see this channel's roster. Ships disabled — add your check, then set
// AUTH_IMPLEMENTED to true.
const AUTH_IMPLEMENTED = false;

const json = (data: unknown, status = 200) =>
  new Response(superjson.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function handle(request: Request) {
  const { channel, userIds } = schema.parse(superjson.parse(await request.text()));

  // const session = await getServerSession(request);
  // if (!session || !userMaySeeChannel(session, channel)) return json({ error: "Unauthorized" }, 401);
  if (!AUTH_IMPLEMENTED) {
    return json(
      { error: "realtime last-seen is disabled until you add an auth check in _realtime/lastseen (see the comment)" },
      501,
    );
  }

  const result = await lastSeen(channel, userIds);
  if (!result.ok) {
    return json({ error: result.error.message }, 500);
  }
  return json({ lastSeen: result.lastSeen });
}
   39