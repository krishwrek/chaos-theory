# Chaos Theory — Build Notes

Last updated: 2026-10-19

## Product
- Browser party game for 4–8 players, guest-first.
- Tagline: “Trust nobody. Outsmart everybody.”
- Controlled Chaos visual style: ink navy, electric violet, cyan, coral, Bricolage Grotesque, and DM Sans.
- Target match duration: 5–8 minutes.
- No early player elimination.

## Implemented in the Floot prototype
- Landing page, nickname field, create/join room flows, room-code invitation link.
- Floot-managed Postgres tables for rooms, players, and round submissions.
- Guest session cookie, room membership checks, and 8-player room limit.
- Server-side readiness, host checks, submissions, score resolution, round deadline, and results phase.
- Secret roles/objectives returned for the requesting player's session rather than the public roster.
- Room-scoped realtime tokens and realtime text chat.
- Lobby, challenges, standings, rules, toast feedback, and results/rematch UI.
- Responsive styles and reduced-motion support.

## Validation recorded during implementation
- TypeScript check passed on the latest completed check before repository sync.
- Existing automated tests: one spec file passed, zero failed; two hook specs were excluded by the default runner.
- API smoke test succeeded for room creation, three joins, readiness, host start, realtime token generation, four submissions, score updates, and next-round transition.
- Full browser screenshot inspection and physical multi-device QA have not been completed.

## Known gaps
- This is an early playable vertical slice, not a balanced production release.
- Challenges currently share a generic majority/tie resolution rule. Role and round-objective bonuses exist, but challenge-specific correctness and balance still need work.
- Round deadlines resolve when an active client requests state after expiry; no independent scheduler advances rooms when all clients are offline.
- Chat messages are realtime but not persisted as history.
- Adversarial multi-device/browser QA, responsive visual inspection, and production URL verification remain.
- Floot runtime dependencies and services are not fully represented by a standalone package/deployment setup in this repository.
