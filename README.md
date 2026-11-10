# Xyphir Trials

A cooperative, top-down dungeon combat game built with Phaser 4, TypeScript and Vite. It runs entirely in the browser and supports online two-player co-op through a free Supabase Realtime room relay, so it can be hosted on GitHub Pages with no game server of its own.

A lobby lets you create a room and share a 5-character code, join a friend's room, or start a solo run. Once the host starts, both players fight a grunt wave and then the Xyphir Warden boss using fireballs, directional shields, dashes, a deployable turret and a conjured wall.

## Requirements

- Node.js 22.12+ (Vite 8 requirement)
- npm 10+
- A free Supabase project for online play (optional for local development)

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

### Local two-tab testing without Supabase

When no Supabase credentials are present, **development builds automatically use a same-browser `BroadcastChannel` transport**. Open two tabs on the same machine, create a room in one, and join the code in the other. This exercises the real lobby, handshake, input and snapshot paths without a project or account.

You can force the local transport even when credentials exist by adding `?transport=local` to the URL.

Production builds always require Supabase credentials; the local transport is never bundled as a production fallback in practice, and the lobby will explain that multiplayer is not configured.

## Controls

Online, each player uses the same keyboard layout on their own machine. Keyboard only; no mouse is required.

| Input | Action |
| --- | --- |
| Arrow keys | Move |
| `C` | Fireball |
| `Q` | Shield (face a projectile to reflect it) |
| `Space` | Dash |
| `W` | Deploy turret |
| `E` | Conjure wall |
| `R` | Restart after a result (guest requests a restart) |
| `Esc` | Leave the room / return to the lobby |
| `` ` `` | Toggle debug overlay in development |

`R` is reserved for a future active skill and still restarts from the result screen.

Both players have the turret and wall skills. A turret lasts 10 seconds, fires at the nearest enemy in range every 0.6 seconds, and has a 5 second cooldown. A wall appears 72 pixels in front of the caster, lasts 5 seconds, and has a 10 second cooldown. It blocks every projectile that touches it, including fireballs, turret bolts, reflected shots and enemy bolts. Casting either skill again while it is ready replaces the previous instance, so each player can only have one of each active at a time.

Facing follows the last movement direction. Dash uses the held movement direction, or the current facing when standing still. While dashing, a player is invulnerable and passes through projectiles, enemies and the other player. Reflection requires an active shield, a projectile inside the frontal cone, and a projectile still moving toward the player.

## Objective

Clear the opening grunt wave, then defeat the Xyphir Warden. The boss alternates an aimed three-bolt burst with a radial nova and becomes more aggressive below half health. The run ends in victory when the boss falls, and in defeat when every player is down.

## Online architecture

- **Transport:** Supabase Realtime Broadcast on a public channel named `xyphir-room-<code>`. There are no database tables, no auth and no edge functions.
- **Host-authoritative:** the host simulates players, enemies, projectiles, skills and outcomes. The guest sends input and renders snapshots. The guest never runs gameplay physics.
- **Rates:** the host broadcasts snapshots at 20 Hz; the guest sends input at about 15 Hz. The guest interpolates between snapshots with a ~90 ms delay.
- **Lobby-only:** players must join before the run starts. There is no mid-run join. Starting solo closes the room and starts a P1-only run.
- **Disconnects:** if the guest leaves mid-run, the host returns to the lobby with the room still open. If the host leaves, the guest returns to the lobby with a message.
- **Security:** the room code is the only access control. Public broadcast channels are intentionally unauthenticated; every incoming message is validated as untrusted input.

### Supabase free-tier notes

The free plan is enough for a two-player room:

| Limit | Free tier |
| --- | --- |
| Concurrent connections | 200 |
| Messages | 2 million per month |
| Messages per second | 100 |
| Payload size | 256 KB |

A run uses roughly 70–80 events per second, well inside the per-second limit and far below the monthly message budget for casual play. Supabase pauses free projects after **7 days of inactivity**; open the dashboard or play a round to wake it if the room refuses to connect.

## Deploy to GitHub Pages

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the project URL and the `anon` public key.
3. In the GitHub repository, add two Actions secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In **Settings → Pages**, set **Source** to **GitHub Actions**.
5. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds with those secrets and publishes `dist/`.

`vite.config.ts` uses a relative `base`, so the same build works at `https://<user>.github.io/<repo>/` without editing the repository name.

For local production testing:

```bash
cp .env.example .env
# fill in the two values
npm run build
npm run preview
```

The Supabase anon key is designed to be public in client code. Access control for this game does not depend on keeping it secret; it only identifies the project.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Source layout

```text
src/
  main.ts                 Game bootstrap (Phaser.Game + Vite HMR cleanup)
  style.css               Page/canvas layout
  net/
    config.ts             Supabase env reading and dev local fallback
    createRoom.ts         Transport/session factories for host and guest
    LocalTransport.ts     BroadcastChannel transport for two-tab dev testing
    roomCode.ts           Room-code and peer-ID generation
    RoomSession.ts        Lobby handshake, routing, restart and disconnect logic
    session.ts            Active room-session singleton
    SupabaseTransport.ts  Realtime Broadcast + Presence transport
    types.ts              Wire messages, input frames and snapshots
    wire.ts               Untrusted envelope validation
  game/
    config/               Game config, tuning, controls, scene keys, palette
    scenes/               LobbyScene, ArenaScene (host), GuestArenaScene, HudScene
    entities/             Player, Projectile, EnemyBase, Grunt, Boss, Turret, Wall
    components/           Movement, Facing, Health, Cooldown, Shield, Dash
    abilities/            FireballAbility
    skills/               Skill base class, modifiers, TurretSkill and WallSkill
    systems/              InputSystem, CoopCamera, ProjectileSystem, EncounterSystem, SfxSystem
    types/                Combat and projectile types
    world/                Arena construction and wall bodies
    resources/            Generated placeholder textures
    ui/                   HUD model, panels, boss bar, result overlay, debug tools
```

### Architectural notes

- `LobbyScene` is the boot scene. It creates or joins a room through `createRoom.ts`, then starts `ArenaScene` for the host or `GuestArenaScene` for the guest.
- `ArenaScene` owns the authoritative simulation on the host. It accepts remote input for P2, applies local input for P1, and broadcasts compact snapshots of players, enemies, projectiles, turrets, walls, boss state and the telegraph.
- `GuestArenaScene` has no gameplay physics. It sends local input, buffers snapshots, interpolates entity transforms, and drives the same HUD and result overlay as the host.
- `RoomSession` is transport-agnostic. It handles join retries, welcome/rejection, start/restart messages, presence, disconnects, and SFX forwarding. `SupabaseTransport` and `LocalTransport` share one small interface.
- Scene restarts during a run preserve the room session. Only explicit leave/cancel closes it, so asking for a rematch does not drop the connection.
- Gameplay is composed from small components. `Player` is a thin Arcade sprite that owns movement and facing components and exposes ability state; it does not contain input, camera or world logic.
- All key bindings live in `config/controls.ts`. Online sessions use the same profile for both players because each player has their own keyboard.
- `HudScene` renders in parallel with its own camera, so gameplay camera zoom never distorts the HUD or debug overlay.
- `CoopCamera` follows the players' midpoint and zooms out just enough to keep both on screen.
- Projectiles carry team, current owner and original source IDs. The projectile system assigns stable net IDs and handles spawning and cleanup; abilities only supply spawn parameters, so shield reflection can reuse the same path.
- Conjured walls are oriented rectangles tested against projectile positions each frame. Arcade bodies are axis-aligned, so they cannot express a rotated barrier; walls intentionally block projectiles only and never players or enemies.
- `EncounterSystem` owns the phase flow, boss spawn telegraph and dead-enemy cleanup, and exposes telegraph render state for snapshots. Bullet damage is tuned per team in `config/combatTuning.ts`.
- `SfxSystem` synthesises all sound effects with Web Audio oscillators and noise. The audio context is created and resumed on the first lobby keypress, satisfying browser autoplay rules. The host forwards sound events to the guest.
- `Arena` owns the floor, grid and static wall bodies, keeping world construction out of the scene.
- Placeholder art is generated at runtime as textures, so there are no binary assets.
- The arena (1920 × 1280) is larger than the 1280 × 720 viewport so camera follow is visible.

## Debugging

In development builds the debug overlay is visible by default and `` ` `` toggles it.

| Input | Action |
| --- | --- |
| `1` | Toggle auto-fire |
| `2` | Deal 25 test damage to P1 |
| `3` | Deal 25 test damage to P2 |

Auto-fire is available in all builds; the test damage keys are gated by the `DEBUG.enabled` check.
