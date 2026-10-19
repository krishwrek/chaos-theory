# Chaos Theory

**Trust nobody. Outsmart everybody.**

Chaos Theory is a guest-first browser multiplayer party game prototype for 4–8 players. It blends prediction challenges, secret roles, changing objectives, bluffing, and controlled chaos in short matches designed for friends playing on separate devices.

## Product direction

- **Visual identity:** Controlled Chaos — ink navy, electric violet, cyan, and coral accents.
- **Access:** Guest nicknames, room codes, and shareable invite links; no required account or installation.
- **Match:** Target 5–8 minutes, with no early elimination.
- **Gameplay:** Secret roles, rotating objectives, timed challenges, text chat, scoreboards, and results.
- **Design principle:** Skill should matter more than luck; randomness changes the situation rather than deciding the match.

## Current implementation

The initial playable version is running in Floot and includes:

- Room creation and joining, guest sessions, and server-backed room/player data.
- Lobby readiness and host-controlled start.
- Private role/objective assignment and round-specific objective bonuses.
- Server-side submissions, score resolution, round deadlines, and round transitions.
- Room-scoped realtime access and realtime text chat.
- Responsive game UI, leaderboard, rules, notifications, and results UI.

## Project status

**Early playable prototype — not production-ready yet.**

Known gaps include challenge-specific scoring and balancing, persisted chat history, a background deadline scheduler for rooms where every client disconnects, full multi-device QA, and a reproducible local deployment setup.

This repository is a source snapshot and project log. The app currently uses Floot-managed runtime services and database configuration; this is not yet a standalone one-command local deployment. See [Architecture](docs/ARCHITECTURE.md), [Build Notes](docs/BUILD_NOTES.md), and [Roadmap](docs/ROADMAP.md).

## Source layout

- `pages/` — primary game page and styles.
- `endpoints/` — room actions and realtime API routes.
- `helpers/` — database types and realtime channel names.
- `components/FlootRealtimeProvider.tsx` — realtime client integration.
- `base.css` — global design tokens.
- `docs/` — architecture, build status, and roadmap.

## Safety and configuration

Never commit database URLs, secrets, session cookies, or production credentials. Floot provisions some runtime services and environment configuration outside the source files in this repository.

## Roadmap

1. Complete desktop and mobile visual QA.
2. Test 4–8 clients across separate browsers/devices, including reconnect and malicious/duplicate actions.
3. Implement and balance challenge-specific scoring.
4. Persist chat history and define inactive-player/host-disconnect behavior.
5. Add independent deadline scheduling.
6. Document a reproducible development and deployment workflow.
7. Verify production deployment after QA.
