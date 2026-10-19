import { db } from "../helpers/db";
import { channels } from "../helpers/realtimeChannels";
import { publish } from "@floot/realtime";
import { nanoid } from "nanoid";
import superjson from "superjson";
import { schema } from "./room_POST.schema";

const roles = [
  { name: "The Detective" },
  { name: "The Manipulator" },
  { name: "The Opportunist" },
  { name: "The Strategist" },
  { name: "The Double Agent" },
];
const objectivePools = [
  ["Predict the majority", "Choose against the crowd", "Pick the middle number (3)", "Choose the lowest number (1)", "Choose the highest number (5)"],
  ["Predict the majority", "Choose against the crowd", "Call the bluff", "Trust the claim"],
  ["Predict the majority", "Choose against the crowd", "Play it safe", "Make a wild guess"],
  ["Predict the majority", "Choose against the crowd", "Take a calculated risk", "Choose the chaos option"],
];
function secretAssignment(roundIndex = 0) {
  const role = roles[Math.floor(Math.random() * roles.length)];
  const pool = objectivePools[roundIndex] || objectivePools[0];
  return { name: role.name, objective: pool[Math.floor(Math.random() * pool.length)] };
}
const response = (data: unknown, status = 200, sessionId?: string) => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (sessionId) headers.append("Set-Cookie", "ct_session=" + sessionId + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure");
  return new Response(superjson.stringify(data), { status, headers });
};
function cookie(request: Request, name: string) {
  return (request.headers.get("cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(name + "="))?.slice(name.length + 1);
}
function safeName(value: string | undefined) { return (value || "guest").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 18) || "guest"; }
async function snapshot(code: string) {
  const room = await db.selectFrom("ctRooms").selectAll().where("code", "=", code).executeTakeFirst();
  if (!room) return null;
  const players = await db.selectFrom("ctPlayers").select(["sessionId", "nickname", "isHost", "isReady", "score"]).where("roomCode", "=", code).orderBy("joinedAt", "asc").execute();
  return { room, players };
}
async function broadcast(code: string, type: string) {
  await publish(channels.room(code), { type, at: Date.now() });
}
async function resolveRound(code: string, roundIndex: number, force: boolean) {
  const roster = await db.selectFrom("ctPlayers").select("sessionId").where("roomCode", "=", code).execute();
  const submissions = await db.selectFrom("ctSubmissions").select(["sessionId", "answer"]).where("roomCode", "=", code).where("roundIndex", "=", roundIndex).execute();
  if (!force && submissions.length < roster.length) return false;
  const claim = await db.updateTable("ctRooms").set({ phase: "resolving", updatedAt: new Date() }).where("code", "=", code).where("phase", "=", "game").where("roundIndex", "=", roundIndex).executeTakeFirst();
  if (Number(claim.numUpdatedRows) !== 1) return false;
  if (submissions.length) {
    const counts = new Map<string, number>();
    for (const item of submissions) counts.set(item.answer, (counts.get(item.answer) || 0) + 1);
    const maxCount = Math.max(...counts.values());
    const winners = new Set([...counts.entries()].filter(([, count]) => count === maxCount).map(([answer]) => answer));
    const playerSecrets = await db.selectFrom("ctPlayers").select(["sessionId", "secretRole", "secretObjective"]).where("roomCode", "=", code).execute();
    const secretByPlayer = new Map(playerSecrets.map(player => [player.sessionId, player]));
    const previous = roundIndex > 0 ? await db.selectFrom("ctSubmissions").select(["sessionId", "answer"]).where("roomCode", "=", code).where("roundIndex", "=", roundIndex - 1).execute() : [];
    const previousByPlayer = new Map(previous.map(item => [item.sessionId, item.answer]));
    for (const item of submissions) {
      const isMajority = winners.has(item.answer);
      const player = secretByPlayer.get(item.sessionId);
      let points = isMajority ? 100 : 25;
      const objective = player?.secretObjective || "";
      const objectiveMet =
        (objective === "Predict the majority" && isMajority) ||
        (objective === "Choose against the crowd" && !isMajority) ||
        (objective === "Pick the middle number (3)" && item.answer === "3") ||
        (objective === "Choose the lowest number (1)" && item.answer === "1") ||
        (objective === "Choose the highest number (5)" && item.answer === "5") ||
        (objective === "Call the bluff" && item.answer === "That's a bluff") ||
        (objective === "Trust the claim" && item.answer === "They're telling the truth") ||
        (objective === "Play it safe" && item.answer === "Play it safe") ||
        (objective === "Make a wild guess" && item.answer === "Make a wild guess") ||
        (objective === "Take a calculated risk" && item.answer.startsWith("Risk it")) ||
        (objective === "Choose the chaos option" && item.answer.startsWith("Chaos mode"));
      if (objectiveMet) points += 50;
      if (player?.secretRole === "The Detective" && isMajority) points += 25;
      if (player?.secretRole === "The Manipulator" && !isMajority) points += 25;
      if (player?.secretRole === "The Opportunist" && /risk|wild|chaos/i.test(item.answer)) points += 25;
      if (player?.secretRole === "The Strategist" && previousByPlayer.get(item.sessionId) === item.answer) points += 25;
      if (player?.secretRole === "The Double Agent" && !isMajority) points += 25;
      await db.updateTable("ctPlayers").set(eb => ({ score: eb("score", "+", points) })).where("roomCode", "=", code).where("sessionId", "=", item.sessionId).execute();
    }
  }
  if (roundIndex >= 3) {
    await db.updateTable("ctRooms").set({ phase: "results", deadlineAt: null, updatedAt: new Date() }).where("code", "=", code).execute();
  } else {
    await db.updateTable("ctRooms").set({ phase: "game", roundIndex: roundIndex + 1, deadlineAt: new Date(Date.now() + 45_000), updatedAt: new Date() }).where("code", "=", code).execute();
    const pool = objectivePools[roundIndex + 1] || objectivePools[0];
    const players = await db.selectFrom("ctPlayers").select("sessionId").where("roomCode", "=", code).execute();
    for (const player of players) {
      const hash = [...player.sessionId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const objective = pool[(hash + roundIndex + 1) % pool.length];
      await db.updateTable("ctPlayers").set({ secretObjective: objective }).where("roomCode", "=", code).where("sessionId", "=", player.sessionId).execute();
    }
  }
  return true;
}
export async function handle(request: Request) {
  let sessionId = cookie(request, "ct_session");
  let setCookie = false;
  if (!sessionId || !/^[a-zA-Z0-9_-]{12,80}$/.test(sessionId)) { sessionId = crypto.randomUUID().replace(/-/g, ""); setCookie = true; }
  let didResolve = false;
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    const nickname = safeName(input.nickname);
    let code = (input.roomCode || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (input.action === "create") {
      let exists = true;
      for (let i = 0; i < 5 && exists; i++) {
        code = nanoid(6).toUpperCase();
        exists = !!(await db.selectFrom("ctRooms").select("code").where("code", "=", code).executeTakeFirst());
      }
      if (exists) return response({ error: "Could not create a unique room. Please try again." }, 503, setCookie ? sessionId : undefined);
      const secret = secretAssignment();
      await db.transaction().execute(async trx => {
        await trx.insertInto("ctRooms").values({ code, hostSession: sessionId!, phase: "lobby", roundIndex: 0 }).execute();
        await trx.insertInto("ctPlayers").values({ sessionId: sessionId!, roomCode: code, nickname, isHost: true, isReady: true, score: 0, secretRole: secret.name, secretObjective: secret.objective }).execute();
      });
    } else {
      if (!code) return response({ error: "Enter a room code." }, 400, setCookie ? sessionId : undefined);
      const found = await db.selectFrom("ctRooms").selectAll().where("code", "=", code).executeTakeFirst();
      if (!found) return response({ error: "Room not found. Check the code and try again." }, 404, setCookie ? sessionId : undefined);
      if (input.action === "join") {
        const existing = await db.selectFrom("ctPlayers").selectAll().where("roomCode", "=", code).where("sessionId", "=", sessionId).executeTakeFirst();
        const count = await db.selectFrom("ctPlayers").select(({ fn }) => fn.countAll<number>().as("count")).where("roomCode", "=", code).executeTakeFirstOrThrow();
        if (!existing && found.phase !== "lobby") return response({ error: "This match has already started." }, 409, setCookie ? sessionId : undefined);
        if (!existing && Number(count.count) >= 8) return response({ error: "This room is full (8 players max)." }, 409, setCookie ? sessionId : undefined);
        if (existing) await db.updateTable("ctPlayers").set({ nickname }).where("roomCode", "=", code).where("sessionId", "=", sessionId).execute();
        else {
          const secret = secretAssignment();
          await db.insertInto("ctPlayers").values({ sessionId, roomCode: code, nickname, isHost: false, isReady: false, score: 0, secretRole: secret.name, secretObjective: secret.objective }).execute();
        }
      } else {
        const member = await db.selectFrom("ctPlayers").selectAll().where("roomCode", "=", code).where("sessionId", "=", sessionId).executeTakeFirst();
        if (!member) return response({ error: "You are not a member of this room. Join it first." }, 403, setCookie ? sessionId : undefined);
        if (input.action === "chat") {
          const message = (input.message || "").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 180);
          if (!message) return response({ error: "Write a message first." }, 400);
          await publish(channels.room(code), { type: "chat", nickname: member.nickname, message, sessionId, at: Date.now() });
        }
        if (input.action === "state" && found.phase === "game" && found.deadlineAt && new Date(found.deadlineAt).getTime() <= Date.now()) {
          didResolve = await resolveRound(code, found.roundIndex, true);
        }
        if (input.action === "ready") {
          await db.updateTable("ctPlayers").set({ isReady: !!input.ready }).where("roomCode", "=", code).where("sessionId", "=", sessionId).execute();
        }
        if (input.action === "submit") {
          if (found.phase !== "game") return response({ error: "This room is not accepting answers right now." }, 409);
          if (!input.answer) return response({ error: "Choose an answer first." }, 400);
          const alreadySubmitted = await db.selectFrom("ctSubmissions").select("sessionId").where("roomCode", "=", code).where("roundIndex", "=", found.roundIndex).where("sessionId", "=", sessionId).executeTakeFirst();
          if (alreadySubmitted) return response({ error: "Your answer is already locked for this round." }, 409);
          await db.insertInto("ctSubmissions").values({ roomCode: code, roundIndex: found.roundIndex, sessionId, answer: input.answer.slice(0, 100) }).execute();
          didResolve = await resolveRound(code, found.roundIndex, false);
        }
        if (input.action === "start") {
          if (!member.isHost) return response({ error: "Only the host can start the match." }, 403);
          const roster = await db.selectFrom("ctPlayers").select(["sessionId", "isReady"]).where("roomCode", "=", code).execute();
          if (roster.length < 4) return response({ error: "At least 4 players are needed to start." }, 409);
          if (roster.some(player => !player.isReady)) return response({ error: "Everyone needs to be ready before the match starts." }, 409);
          await db.updateTable("ctRooms").set({ phase: "game", roundIndex: 0, deadlineAt: new Date(Date.now() + 45_000), updatedAt: new Date() }).where("code", "=", code).execute();
        }
      }
    }
    const data = await snapshot(code);
    if (!data) return response({ error: "Room could not be loaded." }, 500, setCookie ? sessionId : undefined);
    const me = await db.selectFrom("ctPlayers").select(["secretRole", "secretObjective"]).where("roomCode", "=", code).where("sessionId", "=", sessionId).executeTakeFirst();
    if (!me) return response({ error: "Your player session could not be restored. Rejoin the room." }, 403, setCookie ? sessionId : undefined);
    if ((input.action !== "state" || didResolve) && input.action !== "chat") await broadcast(code, input.action === "submit" || didResolve ? "round.updated" : "room.updated");
    return response({ ok: true, room: { code: data.room.code, phase: data.room.phase, roundIndex: data.room.roundIndex, hostSession: data.room.hostSession, deadlineAt: data.room.deadlineAt }, players: data.players, sessionId, me }, 200, setCookie ? sessionId : undefined);
  } catch (error) {
    console.error("room endpoint failed", error);
    return response({ error: "Something went wrong while updating the room. Please try again." }, 400, setCookie ? sessionId : undefined);
  }
}