// SINGLE SOURCE OF TRUTH for realtime channel names. Import this on BOTH the
// publish side (backend) and the subscribe side (frontend/backend) so names can
// never drift
//
// Convention: "<topic>:<id>" (and ":<sub>" for sub-topics). Using this shape
// lets your _realtime/token grants use a segment wildcard like "room:*" to cover
// every room. Keep each channel aligned with its React Query key, e.g.
//   channels.room(id)   <->   queryKey ["room", id]
export const channels = {
  room: (id: string | number) => "room:" + id,
  user: (userId: string) => "user:" + userId,
  // Presence channel — subscribers get a live roster (who's online). The reserved
  // "__presence:" prefix is what opts the channel into presence tracking on the
  // server; read it with useRealtimePresence(channels.presence(roomId)). Grant it
  // in _realtime/token like any channel (e.g. "__presence:*" or "__presence:" + room).
  // NOTE: a "__presence:" channel broadcasts its member roster (every subscriber's
  // userId) to all its subscribers — only name a channel this way when you want
  // that. Plain channels never expose who's connected.
  presence: (id: string | number) => "__presence:" + id,
  // Asymmetric presence — a large set of subjects watched by a few observers, where
  // subjects receive NO presence traffic (unlike the symmetric __presence: above,
  // where every subscriber gets the firehose). Paired by id:
  //   presenceIn(id) — a subject announces "I'm present in <id>" (announce-only;
  //                    receives nothing). Mount with useRealtimePresenceAnnounce.
  //   presenceOf(id) — an observer watches who's present in <id> (snapshot + live
  //                    join/leave; invisible to the roster). Read with
  //                    useRealtimePresence(channels.presenceOf(id)).
  // Grant presenceIn(...) to subjects and presenceOf(...) ONLY to observers in
  // _realtime/token — never grant presenceOf to a subject (it would let them read the
  // roster). Good fit: a support agent watching every customer online in a queue.
  presenceIn: (id: string | number) => "__presence_in:" + id,
  presenceOf: (id: string | number) => "__presence_of:" + id,
  // Batched observer — the same roster as presenceOf(id), but after the snapshot
  // the server sends at most one update about every 30 seconds (net joins/leaves +
  // a fresh count), only when something changed. Use it when "good enough" is
  // fine: an "N online" badge, online dots in a list. A presenceOf(id) grant in
  // _realtime/token also covers presenceBatchOf(id). Read with
  // useRealtimePresence / useRealtimePresenceCount(channels.presenceBatchOf(id)).
  presenceBatchOf: (id: string | number) => "__presence_batch_of:" + id,
  // Control channel for cancelling/steering a queueTask run (signal-only, no query):
  taskControl: (jobId: string) => "task:" + jobId + ":control",
  // Server -> client token/data stream for a queueTask run:
  stream: (jobId: string) => "stream:" + jobId,
};
   45