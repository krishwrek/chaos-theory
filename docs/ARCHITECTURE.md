# Architecture

## Frontend
- React + TypeScript single-page game interface.
- `pages/_index.tsx` owns landing, lobby, gameplay, results, chat, and notifications.
- `pages/_index.module.css` contains the responsive Controlled Chaos design.
- `base.css` defines global design tokens and typography.
- `components/FlootRealtimeProvider.tsx` integrates the Floot realtime client.

## Backend
- `endpoints/room_POST.ts` handles room creation/joining, state, readiness, host start, chat, and submissions.
- `endpoints/_realtime/token_POST.ts` issues room-scoped realtime access.
- Realtime send and last-seen support routes ship disabled unless explicit authorization is implemented.

## Data model
- `ct_rooms`: room code, host session, phase, round index, deadline, timestamps.
- `ct_players`: session, nickname, readiness, score, secret role, secret objective.
- `ct_submissions`: one answer per player per room round.

The TypeScript model is in `helpers/schema.tsx`; database access is initialized in `helpers/db.tsx`. Floot provisions database/runtime configuration externally.

## Trust boundaries
- Backend checks room membership and host-only actions.
- Scores are calculated server-side; clients send answers, not scores.
- Secret role/objective fields are returned only for the requesting session.
- Submissions are keyed by room, round, and session to prevent duplicate submissions.
- Realtime tokens should grant access only to rooms the current session belongs to.

## Current limitations
- Challenge scoring is generic and needs challenge-specific rules.
- No independent scheduler resolves expired rounds when every client is offline.
- Chat is broadcast in realtime but not persisted as history.
- Runtime dependencies/configuration are not yet fully represented by a standalone package manifest and local deployment workflow.
