import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { ArrowRight, Check, Copy, Crown, Flame, Gamepad2, Ghost, LockKeyhole, MessageCircle, Plus, Shield, Sparkles, Swords, Timer, Trophy, Users, Zap } from "lucide-react";
import styles from "./_index.module.css";
import { postRoom, type OutputType } from "../endpoints/room_POST.schema";
import { useRealtimeChannel, useRealtimeClient } from "../components/FlootRealtimeProvider";

const palette = ["#a58bff", "#70ded8", "#ff9d7b", "#f0d477", "#8fb5ff", "#f28bc3", "#8fe0a2", "#ffbd68"];
type Player = { id: string; name: string; color: string; ready: boolean; score: number; me?: boolean; isHost?: boolean };
const basePlayers: Player[] = [
  { id: "p1", name: "you", color: palette[0], ready: true, score: 280, me: true },
  { id: "p2", name: "pixelghost", color: palette[1], ready: true, score: 340 },
  { id: "p3", name: "noodle.exe", color: palette[2], ready: true, score: 190 },
  { id: "p4", name: "suspiciously", color: palette[3], ready: false, score: 240 },
];
const rounds = [
  { label: "ROUND 01 · PREDICTION", title: "The Majority Trap", prompt: "Which number will the group choose most?", options: ["1", "2", "3", "4", "5"], hint: "Predict the crowd. Think like your friends, not like yourself." },
  { label: "ROUND 02 · BLUFF OR TRUTH", title: "Trust Issues", prompt: "A player claims they chose the safest option. Do you believe them?", options: ["They're telling the truth", "That's a bluff"], hint: "A confident answer isn't always an honest one." },
  { label: "ROUND 03 · CHAOS EVENT", title: "Reverse Psychology", prompt: "Plot twist: the least popular answer gets the bonus.", options: ["Play it safe", "Go against the crowd", "Make a wild guess"], hint: "Rules changed. Your instincts still matter." },
  { label: "FINAL SHOWDOWN", title: "Double or Nothing", prompt: "Pick your final move. A bold prediction can change the leaderboard.", options: ["Safe play · +50", "Risk it · +150", "Chaos mode · secret"], hint: "You can still turn it around. Choose your risk." },
];
function Avatar({ player, small = false }: { player: Player; small?: boolean }) {
  return <span className={small ? styles.avatarSmall : styles.avatar} style={{ "--avatar-color": player.color } as React.CSSProperties}>{player.name.slice(0, 1).toUpperCase()}</span>;
}
export default function HomePage() {
  const realtimeClient = useRealtimeClient();
  const [phase, setPhase] = useState("home");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState("K7Q-2PX");
  const [players, setPlayers] = useState<Player[]>(basePlayers);
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState("");
  const [round, setRound] = useState(0);
  const [chat, setChat] = useState([{ name: "pixelghost", text: "okay but who picked 4 last time 👀", color: palette[1] }, { name: "noodle.exe", text: "no evidence, no case.", color: palette[2] }]);
  const [chatDraft, setChatDraft] = useState("");
  const [ready, setReady] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [secretRole, setSecretRole] = useState("The Detective");
  const [secretObjective, setSecretObjective] = useState("Predict the majority");
  const [deadlineAt, setDeadlineAt] = useState<Date | string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [showJoin, setShowJoin] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const challenge = rounds[round % rounds.length];
  useEffect(() => {
    const invitedRoom = new URLSearchParams(window.location.search).get("room");
    if (invitedRoom) { setRoomCode(invitedRoom.toUpperCase()); setShowJoin(true); }
  }, []);
  function applyRoom(result: Extract<OutputType, { ok: true }>) {
    if (result.room.roundIndex !== round) setSubmitted(false);
    setRound(result.room.roundIndex);
    setRoom(result.room.code);
    setDeadlineAt(result.room.deadlineAt);
    setSecretRole(result.me.secretRole);
    setSecretObjective(result.me.secretObjective);
    setPlayers(result.players.map((p, i) => ({ id: p.sessionId, name: p.nickname, color: palette[i % palette.length], ready: p.isReady, score: p.score, me: p.sessionId === result.sessionId, isHost: p.isHost })));
    setReady(result.players.find(p => p.sessionId === result.sessionId)?.isReady ?? true);
    if (result.room.phase === "game") setPhase("game");
    else if (result.room.phase === "results") setPhase("results");
    else if (phase !== "results") setPhase("lobby");
  }
  useRealtimeChannel(phase === "lobby" || phase === "game" ? "room:" + room : null, async (event: any) => {
    if (event?.type === "chat") {
      setChat(prev => [...prev.slice(-5), { name: String(event.nickname || "guest"), text: String(event.message || "").slice(0, 180), color: palette[1] }]);
      return;
    }
    try {
      const result = await postRoom({ action: "state", roomCode: room });
      if ("ok" in result && result.ok) applyRoom(result);
    } catch { notify("Connection interrupted · trying to resync"); }
  });
  useEffect(() => {
    if (phase !== "game" || !deadlineAt) return;
    let resolving = false;
    const tick = () => {
      setClockNow(Date.now());
      if (!resolving && new Date(deadlineAt).getTime() <= Date.now()) {
        resolving = true;
        postRoom({ action: "state", roomCode: room }).then(result => {
          if ("ok" in result && result.ok) applyRoom(result);
          else if ("error" in result) notify(result.error);
        }).catch(() => notify("Round timer expired · reconnecting"));
      }
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
  }, [phase, deadlineAt, room]);
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  async function createRoom() {
    try {
      const result = await postRoom({ action: "create", nickname: nickname.trim() || "guest" });
      if ("error" in result) { notify(result.error || "Could not create room"); return; }
      localStorage.setItem("ct_room", result.room.code);
      applyRoom(result);
      await realtimeClient.connect();
      notify("Room created · invite your crew");
    } catch { notify("Couldn't reach the game server. Try again."); }
  }
  async function joinRoom() {
    if (roomCode.trim().replace(/[^A-Z0-9]/gi, "").length < 4) { notify("Enter a valid room code"); return; }
    try {
      const result = await postRoom({ action: "join", roomCode: roomCode.trim().toUpperCase(), nickname: nickname.trim() || "guest" });
      if ("error" in result) { notify(result.error || "Could not join room"); return; }
      localStorage.setItem("ct_room", result.room.code);
      applyRoom(result);
      await realtimeClient.connect();
      notify("You're in. Keep your secrets close.");
    } catch { notify("Couldn't reach the game server. Try again."); }
  }
  async function copyInvite() {
    // Preserve preview/deployment query parameters (for example Floot's ptoken).
    // Replacing the whole query string with `?room=...` makes preview invites
    // unusable for anyone who opens the link on another device.
    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.set("room", room);
    inviteUrl.hash = "";
    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      notify("Invite link copied · friends can join with this link");
    } catch {
      // Clipboard APIs may be blocked outside secure contexts. Keep a usable
      // fallback visible instead of silently failing.
      notify("Copy blocked · share room code: " + room);
    }
  }
  async function submitAnswer() {
    if (!selected) { notify("Choose an answer first"); return; }
    if (submitted) { notify("Your answer is already locked"); return; }
    try {
      const result = await postRoom({ action: "submit", roomCode: room, answer: selected });
      if ("error" in result) { notify(result.error); return; }
      const nextRound = result.room.roundIndex;
      applyRoom(result);
      setSubmitted(nextRound === round);
      setSelected("");
      notify(nextRound === round ? "Answer locked · waiting for the crew" : "Round resolved · next challenge");
    } catch { notify("Couldn't submit your answer"); }
  }
  async function sendChat(e: React.FormEvent) {
    e.preventDefault(); const message = chatDraft.trim().slice(0, 180); if (!message) return;
    try {
      const result = await postRoom({ action: "chat", roomCode: room, message });
      if ("error" in result) { notify(result.error); return; }
      setChatDraft("");
    } catch { notify("Message could not be sent"); }
  }
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  return <><Helmet><title>Chaos Theory — Trust nobody. Outsmart everybody.</title><meta name="description" content="A quick party game of bluffing, predictions, secret objectives and controlled chaos." /></Helmet>
  <main className={styles.app}>
    <header className={styles.topbar}>
      <button className={styles.brand} onClick={() => setPhase("home")}><span className={styles.brandMark}><Swords size={19}/></span><span>CHAOS<span className={styles.brandAccent}> THEORY</span><small>THE PARTY GAME</small></span></button>
      <div className={styles.topRight}><span className={styles.status}><i/> ALL SYSTEMS CURIOUS</span><button className={styles.helpButton} onClick={() => setShowRules(true)}>? <span>How to play</span></button><span className={styles.profilePill}><i>K</i> Guest player</span></div>
    </header>
    {phase === "home" && <section className={styles.heroWrap}>
      <div className={styles.heroCopy}><div className={styles.eyebrow}><Sparkles size={13}/> YOUR FRIEND GROUP, UNHINGED <i/></div><h1>Trust nobody.<br/><span>Outsmart</span> everybody.</h1><p className={styles.heroText}>A tiny bit of strategy. A little bit of lying. And just enough chaos to ruin the group chat.</p>
        <div className={styles.heroActions}><button className={styles.primaryButton} onClick={createRoom}><Plus size={18}/> Create a room <ArrowRight size={17}/></button><button className={styles.secondaryButton} onClick={() => setShowJoin(!showJoin)}><Users size={17}/> Join with code</button></div>
        {showJoin && <div className={styles.joinInline}><input value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="ROOM CODE" aria-label="Room code" maxLength={12} onKeyDown={e => e.key === "Enter" && joinRoom()}/><button onClick={joinRoom}>Join <ArrowRight size={15}/></button></div>}
        <div className={styles.nicknameLine}><label htmlFor="nickname">PLAY AS</label><input id="nickname" value={nickname} onChange={e => setNickname(e.target.value.slice(0,18))} placeholder="choose your alias" maxLength={18}/><span>{nickname.length}/18</span></div>
        <div className={styles.trustRow}><span><Users size={15}/> 4–8 players</span><span><Timer size={15}/> 5–8 minutes</span><span><LockKeyhole size={14}/> No account needed</span></div>
      </div>
      <div className={styles.heroArt}><div className={styles.orbitOne}/><div className={styles.orbitTwo}/><div className={styles.floatTag}><i/> ROUND IN PROGRESS <b>04:32</b></div>
        <div className={styles.gameCard}><div className={styles.cardTop}><span>CHAOS EVENT <b>✳</b></span><small>01 / 04</small></div><div className={styles.cardIcon}><Ghost size={32}/></div><h2>The Majority<br/>Trap<span>?</span></h2><p>Which number will the group choose most?</p><div className={styles.answerGrid}><span>01</span><span>02</span><span className={styles.answerHot}>03 <i>POPULAR</i></span><span>04</span><span>05</span></div><div className={styles.cardFooter}><span><i/> 6 players choosing</span><span><Timer size={13}/> 00:18</span></div></div>
        <div className={styles.floatingScore}><span className={styles.scoreIcon}><Zap size={16}/></span><span><small>CHAOS BONUS</small><b>+150 <em>pts</em></b></span><strong>↗</strong></div><div className={styles.floatingPlayer}><span className={styles.stackAvatars}><i>J</i><i>M</i><i>A</i><i>+</i></span><span><b>your people</b><small>are plotting something</small></span><strong>•••</strong></div><div className={styles.sparkleOne}>✳</div><div className={styles.sparkleTwo}>✦</div>
      </div><div className={styles.bottomNote}><i/> NO DOWNLOAD. NO DRAMA. JUST BETRAYAL. <i/></div>
    </section>}
    {phase === "lobby" && <section className={styles.playArea}><div className={styles.playHeader}><div><div className={styles.eyebrow}>ROOM LOBBY <i/></div><h1>The plot <span>thickens.</span></h1><p>Get your people in here. Trust is optional.</p></div><div className={styles.roomCodeBox}><small>ROOM CODE</small><strong>{room}</strong><button onClick={copyInvite}><Copy size={14}/> Invite friends</button></div></div>
      <div className={styles.lobbyGrid}><section className={styles.panel}><div className={styles.panelHeading}><div><small>THE CREW</small><h2>Players <span>{players.length}/8</span></h2></div><label><i/> WAITING ROOM</label></div><div className={styles.playerList}>{players.map((p,i)=><div className={styles.playerRow} key={p.id}><Avatar player={p}/><div className={styles.playerInfo}><b>{p.me ? nickname.trim() || "you" : p.name}{p.me && <em>YOU</em>}</b><small>{p.isHost || i===0 ? "Room creator" : p.ready ? "Ready to cause trouble" : "Not ready yet"}</small></div>{p.isHost && <Crown size={16} className={styles.crown}/>}<span className={p.ready ? styles.isReady : styles.notReady}><i/>{p.ready ? "READY" : "NOT READY"}</span></div>)}</div><button className={styles.addPlayerButton} onClick={copyInvite}><Copy size={16}/> Copy invitation link <span>Invite 3–7 friends</span></button><div className={styles.lobbyActions}><button className={styles.secondaryButton} onClick={async()=>{try{const result=await postRoom({action:"ready",roomCode:room,ready:!ready});if("ok" in result&&result.ok){applyRoom(result);}}catch{notify("Couldn't update readiness");}}}>{ready ? "Mark not ready" : "I'm ready"} <Check size={16}/></button><button className={styles.primaryButton} disabled={players.length<4 || starting} onClick={async()=>{if(starting)return;setStarting(true);try{const result=await postRoom({action:"start",roomCode:room});if("ok" in result&&result.ok){applyRoom(result);setPhase("game");setRound(0);setSelected("");notify("Chaos started · good luck");}else if("error" in result)notify(result.error || "The match could not start");}catch{notify("Couldn't start the match · check your connection and try again");}finally{setStarting(false);}}}><Zap size={17}/> {starting ? "Starting..." : "Start chaos"} <ArrowRight size={16}/></button></div><p className={styles.microCopy}><LockKeyhole size={13}/> {players.length<4 ? `Need ${4-players.length} more player${4-players.length===1?"":"s"} to start.` : players.every(p=>p.ready) ? "Everyone is ready. Start the match when you’re set." : `${players.filter(p=>!p.ready).length} player${players.filter(p=>!p.ready).length===1?" is":"s are"} not ready yet — start will explain if anyone needs to ready up.`}</p></section>
        <aside className={styles.sideStack}><div className={styles.panel}><small className={styles.panelLabel}>YOUR LOADOUT</small><div className={styles.secretRole}><span><Shield size={23}/></span><div><small>SECRET ROLE</small><h3>{secretRole}</h3><p>Private to your player session.</p></div><em><LockKeyhole size={12}/> SECRET</em></div><div className={styles.objective}><Sparkles size={16}/><div><small>ROUND OBJECTIVE</small><b>{secretObjective}</b><p>Complete it for a bonus when supported by the round.</p></div></div></div><div className={styles.panel}><small className={styles.panelLabel}>THE HOUSE RULES</small>{["No eliminations. Everyone plays to the end.","Skill wins points. Chaos changes the odds.","Secrets are yours. Your friends are not."].map((r,i)=><div className={styles.ruleLine} key={r}><span>0{i+1}</span>{r}</div>)}<button className={styles.textButton} onClick={()=>setShowRules(true)}>How to play ↗</button></div></aside></div>
    </section>}
    {phase === "game" && <section className={styles.playArea}><div className={styles.gameTopline}><span><i/> LIVE MATCH</span><small>ROUND {round+1} OF {rounds.length}</small><b><Timer size={15}/> 00:{String(deadlineAt ? Math.max(0,Math.ceil((new Date(deadlineAt).getTime()-clockNow)/1000)) : 0).padStart(2,"0")}</b></div><div className={styles.challengeLayout}><section className={styles.challengeMain}><div className={styles.eyebrow}>{challenge.label} <i/></div><h1>{challenge.title}<span>.</span></h1><p className={styles.challengePrompt}>{challenge.prompt}</p><div className={styles.optionGrid}>{challenge.options.map((opt,i)=><button key={opt} disabled={submitted} className={selected===opt ? styles.optionSelected : styles.optionCard} onClick={()=>setSelected(opt)}><span>{String.fromCharCode(65+i)}</span><b>{opt}</b>{selected===opt && <Check size={18}/>}</button>)}</div><div className={styles.challengeFoot}><span><LockKeyhole size={14}/> {submitted ? "Answer locked · waiting for other players" : "Your answer stays secret until reveal"}</span><button className={styles.primaryButton} disabled={submitted} onClick={submitAnswer}>{submitted ? "Answer locked" : round===rounds.length-1 ? "Reveal results" : "Lock answer"} <ArrowRight size={16}/></button></div><div className={styles.challengeNote}><Flame size={16}/>{challenge.hint}</div></section><aside className={styles.sideStack}><div className={styles.panel}><div className={styles.panelHeading}><div><small>LIVE STANDINGS</small><h2>Scoreboard ↗</h2></div><Trophy size={19} className={styles.crown}/></div>{sortedPlayers.map((p,i)=><div className={styles.scoreRow} key={p.id}><span>{String(i+1).padStart(2,"0")}</span><Avatar player={p} small/><b>{p.me ? nickname.trim() || "you" : p.name}</b><strong>{p.score}</strong></div>)}</div><div className={styles.panel}><div className={styles.panelHeading}><div><small>THE BACKCHANNEL</small><h2>Chat <MessageCircle size={15}/></h2></div><span className={styles.chatCount}>{chat.length} msgs</span></div><div className={styles.chatMessages}>{chat.map((m,i)=><div key={i}><b style={{color:m.color}}>{m.name}</b><p>{m.text}</p></div>)}</div><form className={styles.chatForm} onSubmit={sendChat}><input value={chatDraft} onChange={e=>setChatDraft(e.target.value)} placeholder="Say something suspicious..." maxLength={180}/><button aria-label="Send message"><ArrowRight size={16}/></button></form></div></aside></div></section>}
    {phase === "results" && <section className={styles.resultsWrap}><div className={styles.eyebrow}><Sparkles size={14}/> MATCH COMPLETE <i/></div><div className={styles.trophyBig}><Trophy size={35}/></div><h1>Beautifully <span>untrustworthy.</span></h1><p>The chaos has settled. The group chat will not.</p><div className={styles.winnerCard}><Crown size={18}/><Avatar player={sortedPlayers[0]}/><div><small>CHAOS CHAMPION</small><h2>{sortedPlayers[0]?.name}</h2><span>Master of the mind games</span></div><strong>{sortedPlayers[0]?.score}<small>PTS</small></strong></div><div className={styles.finalScores}>{sortedPlayers.map((p,i)=><div key={p.id}><span>{String(i+1).padStart(2,"0")}</span><Avatar player={p} small/><b>{p.me ? nickname.trim() || "you" : p.name}</b><strong>{p.score}</strong></div>)}</div><div className={styles.resultsActions}><button className={styles.primaryButton} onClick={()=>{setPhase("lobby");setPlayers(p=>p.map(x=>({...x,score:0,ready:true})));setRound(0);notify("Rematch lobby ready");}}><Swords size={17}/> Run it back <ArrowRight size={16}/></button><button className={styles.secondaryButton} onClick={()=>setPhase("home")}>Back to home</button></div></section>}
    <footer className={styles.footer}><span>✳ CHAOS THEORY <i>/ MADE FOR FRIEND GROUPS</i></span><span><label><i/> PREVIEW BUILD</label> v0.1.0</span></footer>
    {toast && <div className={styles.toast}><Check size={16}/>{toast}</div>}
    {showRules && <div className={styles.modalBackdrop} onClick={()=>setShowRules(false)}><section className={styles.modal} onClick={e=>e.stopPropagation()}><button className={styles.modalClose} onClick={()=>setShowRules(false)}>×</button><div className={styles.modalIcon}><Gamepad2 size={22}/></div><small>THE QUICK BRIEF</small><h2>How to cause chaos.</h2><p>Each round gives you a challenge and a secret objective. Predict your friends, spot a bluff, and choose when to take a risk. Chaos events can change scoring—but the rules are shown before you lock an answer.</p>{["Play the challenge — pick before the timer runs out.","Keep your secrets — your role and objective are yours alone.","Stay until the end — no eliminations; final score takes the crown."].map((r,i)=><div className={styles.modalRule} key={r}><span>0{i+1}</span>{r}</div>)}<button className={styles.primaryButton} onClick={()=>setShowRules(false)}>Got it <ArrowRight size={16}/></button></section></div>}
  </main></>;
}