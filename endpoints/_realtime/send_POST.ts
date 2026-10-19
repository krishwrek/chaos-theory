import { publish } from "@floot/realtime";
import { schema } from "./send_POST.schema";
import superjson from "superjson";

// The browser POSTs here and you publish server-side after authorizing the user.
//
// Security: this can publish to any of your app's channels, so authenticate the
// user and check they may publish to the channel before enabling. Ships disabled —
// add your check, then set AUTH_IMPLEMENTED to true.
const AUTH_IMPLEMENTED = false;

const json = (data: unknown, status = 200) =>
  new Response(superjson.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function handle(request: Request) {
  const { channel, data } = schema.parse(superjson.parse(await request.text()));

  // const session = await getServerSession(request);
  // if (!session || !userMayPublishTo(session, channel)) return json({ error: "Unauthorized" }, 401);
  if (!AUTH_IMPLEMENTED) {
    return json(
      { error: "realtime send is disabled until you add an auth check in _realtime/send (see the comment)" },
      501,
    );
  }

  const result = await publish(channel, data);
  if (!result.ok) {
    return json({ error: result.error.message }, 500);
  }
  return json({ ok: true, delivered: result.delivered });
}
   36