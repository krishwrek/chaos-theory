# Roadmap

## P0 — Reliability and QA
- [ ] Inspect desktop, tablet, and mobile layouts.
- [ ] Test full four-player and eight-player matches on separate browsers/devices.
- [ ] Test duplicate, malformed, unauthorized, and late submissions.
- [ ] Test refresh/reconnect, host disconnect, and player departure.
- [ ] Verify production URL, security boundaries, and secrets handling.

## P1 — Complete the game loop
- [ ] Implement challenge-specific scoring and correct-answer semantics.
- [ ] Ensure every role and round objective is achievable and clearly scored.
- [ ] Add explicit chaos-event announcements and score breakdowns.
- [ ] Decide whether chat remains ephemeral or persist message history.
- [ ] Add a background scheduler for deadlines when all players disconnect.

## P2 — Product polish
- [ ] Add clear reveal and score-summary animations.
- [ ] Check keyboard navigation, focus states, contrast, and reduced motion.
- [ ] Improve reconnect messaging, host transfer, and room cleanup.
- [ ] Balance points and match duration for 4–8 players.

## P3 — Developer experience
- [ ] Document environment variables and database setup without exposing secrets.
- [ ] Create a reproducible local setup/test workflow.
- [ ] Add CI for type checks and tests.
- [ ] Keep build notes and roadmap current with each meaningful change.
