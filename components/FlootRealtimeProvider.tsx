import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  RealtimeClient,
  RealtimeStatus,
  type PresenceRoster,
} from "../helpers/RealtimeClient";
import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

const RealtimeContext = createContext<RealtimeClient | null>(null);

export const FlootRealtimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const clientRef = useRef<RealtimeClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = new RealtimeClient();
  }
  useEffect(() => {
    const client = clientRef.current!;
    client.connect();
    return () => client.close();
  }, []);
  return (
    <RealtimeContext.Provider value={clientRef.current}>
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtimeClient(): RealtimeClient {
  const client = useContext(RealtimeContext);
  if (!client) {
    throw new Error("useRealtimeClient must be used within <FlootRealtimeProvider>");
  }
  return client;
}

/** Subscribe a component to a channel for its lifetime. */
export function useRealtimeChannel(
  channel: string | null,
  onMessage: (data: any) => void,
) {
  const client = useRealtimeClient();
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  useEffect(() => {
    if (!channel) return;
    const unsub = client.subscribe(channel, (data) => handlerRef.current(data));
    return unsub;
  }, [client, channel]);
}

/** Re-run a callback after every (re)connect — refetch state lost while down. */
export function useRealtimeReconnect(onReconnect: () => void) {
  const client = useRealtimeClient();
  const cbRef = useRef(onReconnect);
  cbRef.current = onReconnect;
  useEffect(() => client.onReconnect(() => cbRef.current()), [client]);
}

export function useRealtimeConnectionStatus(): RealtimeStatus {
  const client = useRealtimeClient();
  const [status, setStatus] = useState<RealtimeStatus>(client.getStatus());
  useEffect(() => client.onStatus(setStatus), [client]);
  return status;
}

const NO_MEMBERS: string[] = [];

function usePresenceRoster(channel: string | null): PresenceRoster | null {
  const client = useRealtimeClient();
  const [roster, setRoster] = useState<PresenceRoster | null>(null);
  useEffect(() => {
    setRoster(null); // reset when the channel changes
    if (!channel) return;
    return client.subscribePresence(channel, setRoster);
  }, [client, channel]);
  return roster;
}

/**
 * Presence roster for a channel — the userIds currently online. Pass a
 * channels.presence(id) channel (the "__presence:" prefix is what enables presence
 * on the server), an observer channel channels.presenceOf(id), or its batched
 * form channels.presenceBatchOf(id); grant it in _realtime/token like any other
 * channel. The server sends a full snapshot on (re)subscribe, then either every
 * join/leave as it happens (presence / presenceOf) or one net update about every
 * 30 seconds (presenceBatchOf). No polling; resyncs automatically on reconnect.
 * Each member's userId is whatever your token endpoint set as the connection's
 * userId — map it to a name/avatar from your own data.
 *
 *   const online = useRealtimePresence(channels.presence(roomId));
 *   // -> ["u_alice", "u_bob"]
 */
export function useRealtimePresence(channel: string | null): string[] {
  return usePresenceRoster(channel)?.members ?? NO_MEMBERS;
}

/**
 * How many are online on a presence channel. On channels.presenceBatchOf(id) this
 * is the server's count, refreshed with each update; elsewhere it is the roster's
 * size. 0 until the first snapshot arrives.
 *
 *   const visitors = useRealtimePresenceCount(channels.presenceBatchOf("visitors"));
 */
export function useRealtimePresenceCount(channel: string | null): number {
  return usePresenceRoster(channel)?.count ?? 0;
}

/**
 * Announce this client as present in a channel WITHOUT receiving any presence
 * traffic — the subject side of asymmetric presence. Subscribe to
 * channels.presenceIn(id); observers watching channels.presenceOf(id) see this
 * client join and leave, but this client receives nothing (no roster, no deltas).
 * Costs one membership row; presence is released on unmount or socket drop. Grant
 * the presenceIn(id) channel in _realtime/token. Use this for "let staff see who's
 * online" without every user paying the roster firehose.
 */
export function useRealtimePresenceAnnounce(channel: string | null): void {
  const client = useRealtimeClient();
  useEffect(() => {
    if (!channel) return;
    // __presence_in: channels never deliver to the subject, so this no-op handler
    // only registers membership; the returned unsub releases presence.
    const unsub = client.subscribe(channel, () => {});
    return unsub;
  }, [client, channel]);
}

// ── React Query integration ──────────────────────────────────────────────────
// Bridge realtime messages into the React Query cache. Pair with
// useQuery({ queryKey, queryFn, staleTime: Infinity }) so RQ's stale timer doesn't
// ALSO refetch. Pattern for streams/chat: PATCH each message in as it arrives
// (useRealtimeCache, no network), then a SINGLE reconcile fetch when the response
// completes (stream done / reply finished / convo switch) — that's good +
// encouraged. Just don't refetch per message.

// Debounced signal -> refetch. The right tool for a bare "something changed"
// message that carries no data (or when you need server-recomputed fields). For
// data-carrying streams, patch with useRealtimeCache + one reconcile fetch at the
// end instead — don't refetch per message.
export function useRealtimeInvalidation(
  channel: string | null,
  queryKey: QueryKey,
  debounceMs: number = 250,
) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeChannel(channel, () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      qc.invalidateQueries({ queryKey });
    }, debounceMs);
  });
}

// PATCH the cache with the message's data — no network. apply() merges the message
// in (append a chat/stream token, merge a row, bump a count). Instant; keep apply
// idempotent so a re-delivered message doesn't double-apply. For streams/chat:
// patch each token, then ONE reconcile fetch (invalidateQueries) when the response
// finishes — that end fetch is encouraged.
export function useRealtimeCache<TData = unknown, TMsg = any>(
  channel: string | null,
  queryKey: QueryKey,
  apply: (prev: TData | undefined, msg: TMsg) => TData,
) {
  const qc = useQueryClient();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useRealtimeChannel(channel, (msg: TMsg) => {
    qc.setQueryData<TData>(queryKey, (prev) => applyRef.current(prev, msg));
  });
}

// RECONNECT -> resync. Realtime is at-most-once, so messages sent while the socket
// was down are lost; invalidate queryKeys on (re)connect to catch up. Pair with
// useRealtimeInvalidation / useRealtimeCache.
//
// Two guards make this safe at scale (don't remove them):
//  - DEBOUNCE: at most one resync per minIntervalMs, so a flaky network or rapid
//    tab-flicks (each a reconnect) collapse into ONE refetch instead of hammering
//    the backend — this is also what keeps it under the dev "backend called too
//    frequently" guard (which trips at ~20 calls to one endpoint in 5s).
//  - JITTER: the refetch is delayed a random 0..jitterMs, so a fleet-wide reconnect
//    (a deploy / CDN blip drops everyone at once) doesn't stampede your backend
//    synchronously — each client refetches at a slightly different moment.
export function useRealtimeResync(
  queryKeys: QueryKey[],
  opts: { minIntervalMs?: number; jitterMs?: number } = {},
) {
  const { minIntervalMs = 10_000, jitterMs = 3_000 } = opts;
  const qc = useQueryClient();
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;
  const lastAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeReconnect(() => {
    const now = Date.now();
    if (now - lastAtRef.current < minIntervalMs) return; // coalesce rapid reconnects
    lastAtRef.current = now;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      for (const key of keysRef.current) qc.invalidateQueries({ queryKey: key });
    }, Math.floor(Math.random() * jitterMs));
  });
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
}

// One call for a query kept live by a realtime channel — it bundles the useQuery and
// the subscription, so you can't forget to subscribe.
//
// - apply:       patch the cache from each message (preferred — no network). prev is
//                the loaded query data, never undefined; a message that beats the
//                first fetch refetches instead, so nothing is lost.
// - reconcileOn: when a message matches, refetch the authoritative state once
//                (debounced). Combine them for an AI agent chat — stream token
//                deltas through apply, then send { type: "done" } and reconcileOn
//                the canonical copy (final formatting, persisted message/tool ids).
// Omit both and every message triggers a debounced refetch.
export function useRealtimeQuery<TData = unknown, TMsg = any>(
  opts: {
    queryKey: QueryKey;
    queryFn: () => Promise<TData>;
    channel: string | null;
    apply?: (prev: TData, msg: TMsg) => TData;
    reconcileOn?: (msg: TMsg) => boolean;
  } & Omit<UseQueryOptions<TData, Error, TData>, "queryKey" | "queryFn">,
): UseQueryResult<TData, Error> {
  const { queryKey, queryFn, channel, apply, reconcileOn, ...rest } = opts;
  const qc = useQueryClient();
  const query = useQuery<TData, Error, TData>({
    queryKey,
    queryFn,
    staleTime: Infinity, // realtime is the freshness mechanism, not RQ's stale timer
    // Catch up on remount: while unmounted, this query's subscription is torn down,
    // so messages sent in that window are missed. staleTime:Infinity won't refetch
    // on remount, and useRealtimeResync only fires on socket reconnect (not a
    // navigate-away-and-back where the socket stayed up) — so force a refetch.
    refetchOnMount: "always",
    ...rest,
  });

  const applyRef = useRef(apply);
  applyRef.current = apply;
  const reconcileRef = useRef(reconcileOn);
  reconcileRef.current = reconcileOn;
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefetch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => qc.invalidateQueries({ queryKey: keyRef.current }),
      250,
    );
  };

  useRealtimeChannel(channel, (msg: TMsg) => {
    if (applyRef.current) {
      const prev = qc.getQueryData<TData>(keyRef.current);
      if (prev === undefined) {
        // Message beat the initial fetch — no base state to patch. Refetch so the
        // change isn't lost to the load race (rather than dropping it).
        scheduleRefetch();
      } else {
        qc.setQueryData<TData>(keyRef.current, applyRef.current(prev, msg));
      }
    }
    // Reconcile when reconcileOn matches; with no reconcileOn, keep the default
    // (refetch per message only when there's no apply to patch with).
    const wantRefetch = reconcileRef.current
      ? reconcileRef.current(msg)
      : !applyRef.current;
    if (wantRefetch) scheduleRefetch();
  });
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );
  // Catch up on messages missed while the socket was down.
  useRealtimeResync([queryKey]);
  return query;
}
  305