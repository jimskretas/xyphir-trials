# Xyphir Trials

A cooperative, top-down dungeon combat game built with Phaser 4, TypeScript and Vite.

This repository currently contains the complete local co-op MVP: a title screen leads into a run where two keyboard-controlled players fight a grunt wave before the Xyphir Warden boss, using fireballs and directional shields to survive and reflect projectiles. Victory, defeat, restart and return-to-title are all in place.

## Requirements

- Node.js 22.12+ (Vite 8 requirement)
- npm 10+

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Press `Enter` or `Space` on the title screen to begin.

## Objective

Clear the opening grunt wave, then defeat the Xyphir Warden. The boss alternates an aimed three-bolt burst with a radial nova and becomes more aggressive below half health. Survive with both players to win; the run ends in defeat when both players are down.

## Controls

Both players share the same keyboard. No mouse is required.

| Player | Movement | Fireball | Shield | Dash | Auto fire | Skill |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | `W` `A` `S` `D` | `F` | `G` | `Space` | `Q` | `E` (Turret) |
| P2 | Arrow keys | Numpad `1` | Numpad `2` | Numpad `0` | Numpad `5` | — |

| Input | Action |
| --- | --- |
| `Enter` / `Space` | Start the run from the title screen |
| `R` | Restart after victory or defeat |
| `Esc` | Return to the title after victory or defeat |
| `` ` `` | Toggle debug overlay |

Both abilities and the dash are implemented. Facing follows the last movement direction; fireballs and shields both use that facing. Dash uses the held movement direction, or the current facing when standing still.

While dashing, a player is invulnerable and passes through projectiles, enemies and the other player. Projectiles are not consumed on contact; arena walls still stop the dash.

Auto fire is a per-player toggle. While it is on, that player keeps firing in their current facing direction whenever the fireball cooldown is ready, so you can concentrate on movement, shields or the other player. The HUD shows `AUTO FIRE` with an `ON`/`OFF` state for each player.

P1 also has the Turret skill on `E`. It deploys a turret in front of the player that lasts 10 seconds, fires at the nearest enemy in range every 0.6 seconds, and has a 5 second cooldown. Casting again while the cooldown is ready destroys the previous turret and places a new one, so P1 can only have one turret active at a time. The HUD shows the turret's `READY`/`ACTIVE`/`COOL` state and remaining duration.

## Debugging

In development builds the debug overlay is visible by default and `` ` `` toggles it.

| Input | Action |
| --- | --- |
| `H` | Deal 25 test damage to P1 |
| Numpad `3` | Deal 25 test damage to P2 |

Test damage keys are compiled out of production behavior by the `DEBUG.enabled` check.

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
  game/
    config/               Game config, gameplay tuning, controls, scene keys, palette
    scenes/               StartScene (title), ArenaScene (orchestration), HudScene (screen-space UI)
    entities/             Player, Projectile, EnemyBase, Grunt, Boss, Turret
    components/           Movement, Facing, Health, Cooldown, Shield, Dash
    abilities/            FireballAbility
    skills/               Skill base class, modifiers and TurretSkill
    systems/              InputSystem, CoopCamera, ProjectileSystem, EncounterSystem, SfxSystem
    types/                Combat and projectile types
    world/                Arena construction and wall bodies
    resources/            Generated placeholder textures
    ui/                   HUD model, panels, boss bar, result overlay, debug tools
```

### Architectural notes

- `StartScene` is the boot scene. It explains the controls and starts `ArenaScene`; the arena launches `HudScene` in parallel and stops it on shutdown.
- Result input lives in `ArenaScene`: `R` restarts the scene and `Esc` returns to `StartScene`, so normal scene shutdown does all gameplay cleanup.
- Gameplay is composed from small components. `Player` is a thin Arcade sprite that owns a `MovementComponent` and a `FacingComponent`; it does not contain input, camera or world logic.
- Facing follows the last non-zero movement direction and persists when the player stops.
- All key bindings live in `config/controls.ts` so both players share one input map.
- `InputSystem` reads both players once per frame and exposes normalized intent to the scene.
- `HudScene` renders in parallel with its own camera, so gameplay camera zoom never distorts the HUD or debug overlay.
- `CoopCamera` follows the players' midpoint and zooms out just enough to keep both on screen.
- Projectiles carry team, current owner and original source IDs. The projectile system handles spawning and cleanup; abilities only supply spawn parameters, so shield reflection can reuse the same path.
- `ShieldComponent` owns activation duration, cooldown, arc check and flash state; `Player` only draws the arc and forwards activation. Reflection requires an active shield, a projectile inside the frontal cone, and a projectile still moving toward the player.
- `DashComponent` owns dash duration, cooldown and fixed velocity. `Player` decides the dash direction and damage immunity; `ArenaScene` skips player and projectile collisions while the dash is active.
- Auto fire is a boolean on `Player`. `ArenaScene` toggles it from the player's key and calls the same `tryFire()` path as manual fire each frame while enabled, so both share the fireball cooldown.
- Skills are separate from `Player` and live in `ArenaScene`'s per-player skill list. `Skill` owns cooldown, cast gating and a multiplicative `SkillModifiers` record; concrete skills such as `TurretSkill` consume those modifiers when they create their entities. This keeps future buffs, elemental variants and upgraded turrets out of the player and scene code.
- A reflected projectile keeps its original source, switches team/owner to the reflector, takes the reflector's facing direction, applies the ally or enemy reflection multiplier, and is repositioned outside the reflector with a short reflection lock.
- Enemy behaviour lives behind `EnemyBase` and `EncounterSystem`. `EnemyBase` provides shared health, targeting, steering and death handling; `Grunt` and `Boss` supply only their AI behaviour.
- `EncounterSystem` owns the phase flow, boss spawn telegraph and dead-enemy cleanup. Bullet damage is tuned per team in `config/combatTuning.ts`.
- `SfxSystem` synthesises all sound effects with Web Audio oscillators and noise. The audio context is created and resumed only when the player starts a run, satisfying browser autoplay rules.
- Projectile damage rules live in the scene: player-team projectiles hit enemies, enemy-team projectiles hit players, and same-team hits are ignored.
- `Arena` owns the floor, grid and static wall bodies, keeping world construction out of the scene.
- `ArenaScene` only wires the pieces together and updates them in order.
- Placeholder art is generated at runtime as textures, so there are no binary assets yet.
- The arena (1920 × 1280) is larger than the 1280 × 720 viewport so camera follow is visible.
