# SyncJam — Technical spec & task list (for Claude Code)

**Contesto rapido**

* Deploy: web app personale, non commerciale.
* Requisiti chiave scelti: host obbligatorio con Spotify Premium (Web Playback SDK). Guests Spotify login opzionale (possono collegare account non-Premium solo per accedere alla loro library). Trasmissione stato e (opzionale) audio-forwarding via WebRTC. Uso privato, poche stanze concorrenti (target ~100 utenti max).

---

## Obiettivo del documento

Fornire a Claude Code un set di specifiche tecniche, schema dati e una lista di task (issue) pronta da tradurre in codice/repo. Contiene: componenti, flow OAuth, messaggi Realtime, schema DB, API endpoints e backlog organizzato in epics e tasks.

---

## Architettura proposta (alto livello)

* Frontend: React (Vite) o Next.js (static + client). UI minimal, inglese.
* Realtime / persistence: **Supabase** (Realtime + Postgres) — signaling WebRTC + stato stanza + chat ephemeral.
* Serverless: Vercel Functions per OAuth Spotify (exchange/refresh token) e per operations che richiedono secret (client_secret). Tokens refresh salvati nel DB (Postgres) cifrati.
* Media: Web Playback SDK sul device degli utenti Premium; WebRTC (host→guests) per audio-forwarding *solo* come optional POC (non per pubblicazione).
* Hosting: frontend su Vercel, Supabase per DB e realtime.

---

## High-level flows

### 1) Creazione stanza (host)

* Host clicca "Create room" → redirect OAuth Spotify (Vercel Function) → ottiene access_token + refresh_token.
* Vercel function salva refresh_token cifrato su DB, restituisce session token (JWT) per host UI.
* Host apre la stanza: POST /rooms -> room row in Postgres (id, name, host_user_id, state).
* Host abilita Web Playback SDK locale usando access_token; l'app invia aggiornamenti stato via Supabase (room:currentTrack, position, playState, startedAt).

### 2) Join (guest)

* Guest entra tramite link: se non autenticato con Spotify, può scegliere nickname e join anonimo.
* Se si autentica con Spotify, segue OAuth flow ma con scope ridotti (read-only su playlist e saved tracks).
* Guest riceve stato stanza e sottoscrive gli eventi realtime.

### 3) Sincronizzazione playback

* Quando host preme PLAY: client host calcola startedAt = serverNow + playOffset e scrive {trackId, startedAt, isPlaying:true} in Supabase.
* Tutti i client si sincronizzano: localTime = startedAt + (now - serverNow). Se client è Spotify-Premium e ha Web Playback SDK, esegue `seekTo(localTime)` e `play()`.
* Heartbeat: host invia heartbeat (every 5s) con position; clients correggono drift quando delta > 700ms.

### 4) Coda e voting

* Coda salvata in tabella `queue_items` (id, room_id, track_uri, added_by, votes_up, votes_down, created_at, metadata json).
* Upvote/downvote: mutation incrementale con row-level locking o optimistic concurrency.
* Host può reorder bypassando voti (API `POST /rooms/:id/reorder`).

### 5) Chat ephemeral

* Messaggi scritti salvati in table `chat_messages` ma indicati come ephemeral (TTL) — drop on room close or cron cleanup.
* Quando un brano inizia, frontend scrive un system message in chat con timestamp ("Now playing: track — 00:01").

---

## Schema DB (essenziale)

* users: id (uuid), display_name, spotify_user_id (nullable), spotify_refresh_token_enc, created_at
* rooms: id (uuid), code (6 chars), name, host_user_id (fk users), created_at, is_active
* participants: id, room_id, user_id (nullable for anon), nickname (if anon), joined_at, is_host
* queue_items: id, room_id, track_uri, added_by (participant_id), position (int), votes_up (int), votes_down (int), metadata json, created_at
* playback_state: room_id, current_track_uri, is_playing, started_at (timestamp), last_update
* chat_messages: id, room_id, sender_id (nullable for system), text, type (user|system|gif), created_at

---

## API endpoints (serverless handlers)

* `GET /health`
* `POST /auth/spotify/callback` (Vercel) — get token, store refresh token
* `POST /rooms` — create room (auth host)
* `GET /rooms/:id` — get room data + queue + participants
* `POST /rooms/:id/join` — join as guest (with optional spotify token)
* `POST /rooms/:id/queue` — add item
* `POST /rooms/:id/queue/:qid/vote` — vote up/down
* `POST /rooms/:id/host/action` — play/pause/seek (host only) — this writes playback_state
* `POST /rooms/:id/reorder` — reorder queue (host)
* `POST /rooms/:id/chat` — send message (ephemeral)

Realtime via Supabase: subscribe a channel `room:<id>` for updates on `playback_state`, `queue_items`, `participants`, `chat_messages`.

---

## WebRTC signalling & audio-forwarding (optional POC)

* Signaling via Supabase: clients exchange SDP offers/answers and ICE candidates in a `webrtc_signals` table or dedicated channel.
* Topology: **host → SFU → guests** preferred. For POC you can do host→many peer connections but it'll blow up for many peers.
* Recommend testing with a small SFU (mediasoup or Jitsi) locally or using a hosted SFU for limited tests.
* IMPORTANT: audio-forwarding can violate Spotify TOS; use only for private testing and warn users.

---

## UX / UI screens (wireframe notes)

1. Homepage: Choose Host / Join, short FAQ (who needs Premium), Create room button.
2. OAuth screen (host): redirect to Spotify — show scopes requested.
3. Room view: left: participants list + host badge; center: queue (with votes + remove button); right: chat (ephemeral). Top bar: room code + copy link.
4. Player control (host only visible buttons to control); guests see play/pause disabled unless they are host or unless they have Premium and enabled local playback.

---

## Security & privacy

* Store spotify refresh tokens encrypted (use env var key). Limit scopes to minimal.
* Room codes random (6 chars) non-sequential. No public index of rooms.
* Rate-limit chat and queue operations.

---

## Backlog / Task list (epics + tasks) — consegnare a Claude Code

### Epic A — Foundation (Auth, infra, DB)

A1. Create repo skeleton (frontend, functions, infra)
A2. Provision Supabase project + Postgres schema migrations (create tables above)
A3. Implement Vercel function for Spotify OAuth callback (exchange code -> access_token + refresh_token, save refresh_token encrypted)
A4. Implement user model + login flow (host + guest optional auth)

### Epic B — Rooms & Realtime

B1. Implement `POST /rooms` and room creation UI
B2. Implement join flow, participants table and presence subscribe (Supabase Realtime)
B3. Implement playback_state row and Supabase publish on updates
B4. Implement host controls UI that calls `POST /rooms/:id/host/action`

### Epic C — Queue & Voting

C1. Implement queue add/remove endpoints and UI
C2. Implement vote up/down with optimistic UI + server reconciliation
C3. Implement host reorder endpoint and UI override

### Epic D — Chat & session messages

D1. Implement ephemeral chat table + UI
D2. Implement system message generation when track starts
D3. Implement TTL cleanup job (DB cron or function) to drop chat after room closes

### Epic E — Spotify integrations

E1. Implement Spotify search API wrapper (serverless) and UI search
E2. Implement ability to fetch user playlists/saved tracks when guest connects (if they linked Spotify)
E3. Integrate Web Playback SDK init flow for Premium users (host mandatory)

### Epic F — WebRTC POC (optional)

F1. Implement basic signaling via Supabase
F2. Create a minimal SFU (mediasoup) local POC or use Jitsi instance
F3. Implement host audio capture (`getDisplayMedia`/audio) + forward to SFU
F4. Implement guest receive + playback

### Epic G — Polish & deploy

G1. UI polish, mobile responsiveness
G2. Add FAQ/Help modal (who needs Premium etc.)
G3. Deploy frontend to Vercel, functions to Vercel, connect Supabase
G4. Add monitoring (Sentry/logs) and basic tests

---

## Output format per task (how Claude Code should return results)

* For each task, return: Title, Description, Files to create (path + minimal content), Env vars required, DB migrations (SQL), and a test plan (manual steps). Prefer small atomic commits.

---

## Note finale

Questo documento è pensato per essere consegnato a un agente di automazione (Claude Code). Se vuoi, genero ora: (1) uno ZIP con skeleton code (package.json, minimal React app, Vercel function stub, SQL migrations) oppure (2) singoli task in formato JSON pronto per essere importato in un issue tracker/GitHub Projects. Dimmi quale preferisci e procedo.

---

## Clarifications requested by the user

**Mobile‑first requirement**

* The app must be designed and built *mobile‑first*: all UI/UX, components and interactions should prioritize the mobile experience (touch-friendly controls, compact vertical layout, bottom persistent player, large tap targets, offline/low‑bandwidth considerations). Desktop should be supported responsively but is secondary.

**Is there a backend?**

* Yes — the architecture uses **managed services + lightweight backend**. Concretely:

  * **Supabase** provides the realtime layer and Postgres persistence (presence, queue, chat, signaling). It is not a full replacement for any server that needs secrets.
  * **Serverless functions (Vercel)** act as the secure backend for sensitive operations: Spotify OAuth callback, token refresh, any calls that require the `client_secret`, and a proxy/wrapper for Spotify Web API where appropriate. These functions are the minimal "backend" and are necessary for security and for accessing Spotify endpoints that cannot be called directly from the browser.
  * The frontend remains a primarily client-side React app that talks to Supabase and to the serverless endpoints.

**How guests (including anonymous) search and add tracks**

* Two modes for searching Spotify:

  1. **Public search proxy (recommended for anonymous guests):** implement a serverless endpoint `GET /spotify/search?q=...` that uses the **Client Credentials flow** server-side to call Spotify Search. This allows anonymous guests to search the Spotify catalog without exposing secrets and without needing to authenticate. Results include `track_uri` which can be stored in the queue.
  2. **User-specific endpoints (playlists / saved tracks):** require the guest to authenticate via OAuth. Only with an OAuth token for that user can the app list their playlists or saved tracks. Note: Client Credentials cannot access private user data.

**Queue and playback implications**

* Guests (anonymous or authenticated non‑Premium) can add tracks (store `spotify:track:<id>` in queue). The host controls playback: when the host starts a track, the host’s Web Playback SDK plays that URI locally. If guests have Premium and enable the Web Playback SDK locally, they can also play the same track on their device in sync (using the playback_state messages). If guests do not have Premium, they will not be able to play the Spotify stream locally via the SDK; they can still follow the session (see queue, vote, chat).

**Tasks added to backlog (mobile & spotify search proxy)**

* M1. Design mobile-first component library and create a pattern library (buttons, list items, bottom player bar).
* M2. Implement responsive breakpoints and accessibility checks.
* S1. Implement serverless `GET /spotify/search` using Client Credentials and add caching + rate-limit handling.
* S2. Document and implement `GET /spotify/user/playlists` that requires user OAuth (used only when guest links Spotify account).

---
