# Xyphir Trials — MVP Implementation Plan

This document is the source of truth for the MVP. Each milestone is implemented only after the previous one is working, checked, built, committed, and reviewed.

**Last updated:** 2026-11-08

**Current status:** Milestone 9 complete. MVP complete.

---

## 1. Baseline audit

### 1.1 What already works

- Phaser 4.2.1, Vite 8, strict TypeScript.
- 1280 × 720 viewport with a 1920 × 1280 walled arena.
- Arcade Physics movement, static wall collision and normalized diagonal speed.
- Camera follow with lerp, deadzone and arena bounds.
- Mouse-based aiming and smooth rotation.
- Runtime-generated placeholder player texture.
- Debug overlay with position, velocity, input, facing, wall contacts and FPS.
- Runtime toggle for Arcade Physics body outlines.
- Clean scene shutdown and Vite HMR disposal.

### 1.2 Current source layout

```text
src/
  main.ts
  style.css
  game/
    config/
      gameConfig.ts
      gameplayConfig.ts
      theme.ts
    scenes/
      ArenaScene.ts
    entities/
      Player.ts
    components/
      MovementComponent.ts
      AimComponent.ts
    systems/
      InputSystem.ts
    world/
      Arena.ts
    resources/
      placeholderTextures.ts
    ui/
      DebugOverlay.ts
```

### 1.3 What must be preserved

- Wall geometry, camera bounds and Arcade Physics setup.
- The composition style used by `Player` and `MovementComponent`.
- The placeholder-texture approach; no binary art assets are required.
- TypeScript strictness and the existing build scripts.
- Local-only Git workflow.

### 1.4 Architectural gaps to address before expanding gameplay

1. **Single-player input:** `InputSystem` hardcodes WASD and exposes one direction plus a mouse pointer. Key mappings must be centralized and split by player.
2. **Mouse aiming:** `AimComponent` conflicts with the keyboard-only co-op requirement. Facing must come from the last non-zero movement direction.
3. **Single-player scene ownership:** `ArenaScene` creates one player and one camera target directly. It will become the composition root for two players, projectiles, enemies and encounter state.
4. **No shared health model:** health must be reusable by players, grunts and the boss.
5. **No screen-space UI layer:** the debug overlay uses `scrollFactor(0)` on the gameplay camera. A co-op camera that zooms would scale and shift it. All HUD and debug UI should live in a separate scene with its own camera.
6. **No projectile ownership model:** projectiles need reusable data for team, current owner, original source, damage and reflectability before any ability is added.
7. **No game flow:** scene keys, start screen, result state and restart flow are absent.
8. **Single-player assumptions in cleanup/debugging:** both must become player-aware.

### 1.5 Technical assumptions and constraints

- Two players share one keyboard.
- No mouse input is required for gameplay after the refactor.
- Placeholder graphics and generated audio are acceptable.
- No new runtime dependencies are planned.
- The MVP stops at local co-op. Online multiplayer, progression, inventories and additional abilities are out of scope.

---

## 2. Target architecture

### 2.1 Scene responsibilities

| Scene | Responsibility |
| --- | --- |
| `StartScene` | Title, objective, controls and start input. |
| `ArenaScene` | Gameplay composition root: arena, players, projectiles, encounter, camera, outcome detection. |
| `HudScene` | Screen-space player HUD, boss bar, objective text, debug panel and victory/defeat overlay. Runs in parallel with `ArenaScene`. |

`HudScene` has its own camera, so the gameplay camera can zoom to keep both players visible without distorting UI.

### 2.2 Entity and component responsibilities

| Unit | Responsibility |
| --- | --- |
| `Player` | Composes movement, facing, health, shield and fireball state. Owns identity (`p1`/`p2`), team and visuals. |
| `EnemyBase` | Shared enemy sprite/body, health, damage intake, death notification and targeting helpers. |
| `Grunt` | Ranged chaser AI and enemy bolt attacks. |
| `Boss` | Boss movement, two attack patterns, telegraphs and health scaling. |
| `Projectile` | Recyclable projectile data and behavior: velocity, damage, team, owner, source, lifetime and reflection. |
| `MovementComponent` | Normalized velocity from movement input. |
| `FacingComponent` | Last non-zero direction and rotation; persists when movement stops. |
| `HealthComponent` | Current/max health, damage, invulnerability window, death state. |
| `ShieldComponent` | Shield active/cooldown state and directional block test. |
| `FireballAbility` | Fireball cooldown and projectile spawn parameters. |
| `Cooldown` | Small reusable timer with ready/progress state for HUD. |

Inheritance is limited to `EnemyBase -> Grunt/Boss`. That is justified shared entity behavior; movement, health and combat rules remain composed components or systems.

### 2.3 System responsibilities

| System | Responsibility |
| --- | --- |
| `InputSystem` | Create centralized keys, read two independent player inputs once per frame. |
| `CoopCamera` | Follow the alive players' midpoint and zoom to keep both in view. |
| `ProjectileSystem` | Spawn, update, collide, damage, reflect, expire and destroy projectiles. |
| `EncounterSystem` | Spawn grunts, track remaining enemies, spawn the boss and report encounter state. |
| `SfxSystem` | Small generated sound effects; no audio assets or new dependency. |

`ArenaScene` remains an orchestrator. It should not contain AI, projectile collision rules or HUD layout.

### 2.4 Projectile ownership model

Every projectile carries:

- `sourceId`: who originally created it.
- `ownerId`: who currently controls its team.
- `team`: `players` or `enemies`.
- `reflectable`: whether an active shield can reflect it.
- `damage`, `speed`, `radius`, `lifetime`, `texture`, optional tint/scale.
- `reflectLockMs`: short guard against multi-frame reflection loops.

Player-team projectiles never damage players. This prevents accidental friendly fire while still allowing shield reflection. On reflection:

1. `team` becomes the shield owner's team.
2. `ownerId` becomes the shield owner.
3. Direction becomes the shield owner's facing direction.
4. Damage may use the projectile's reflection multiplier.
5. The projectile is repositioned outside the player body and briefly cannot be reflected again.

This keeps the interaction reliable and makes future projectile types additive rather than a rewrite.

### 2.5 Update order in `ArenaScene`

1. Read both player inputs once.
2. Update players (movement, facing, ability timers, shield timers).
3. Resolve ability activation through player APIs.
4. Update enemies and encounter spawning.
5. Update projectile lifetimes and cleanup.
6. Update the co-op camera.
7. Update the HUD model.
8. Check victory/defeat and freeze gameplay on outcome.

Physics overlap callbacks run during the Arcade step before scene update; damage and reflection resolution must be safe inside those callbacks.

### 2.6 Projected file structure

```text
src/game/
  config/
    gameConfig.ts
    gameplayConfig.ts
    combatConfig.ts        (added with combat)
    controls.ts
    sceneKeys.ts
    theme.ts
  scenes/
    StartScene.ts
    ArenaScene.ts
    HudScene.ts
  entities/
    Player.ts
    Projectile.ts
    EnemyBase.ts
    Grunt.ts
    Boss.ts
  components/
    MovementComponent.ts
    FacingComponent.ts
    HealthComponent.ts
    ShieldComponent.ts
    Cooldown.ts
  abilities/
    FireballAbility.ts
  systems/
    InputSystem.ts
    CoopCamera.ts
    ProjectileSystem.ts
    EncounterSystem.ts
    SfxSystem.ts
  ui/
    HudModel.ts
    PlayerHudPanel.ts
    BossHealthBar.ts
    ResultOverlay.ts
    DebugOverlay.ts
  world/
    Arena.ts
  resources/
    placeholderTextures.ts
  types/
    combat.ts
```

Folders are created only when the corresponding milestone needs them.

### 2.7 Baseline tuning

These are starting values, not final balance:

| Item | Starting value |
| --- | --- |
| Player health | 100 |
| Player damage invulnerability | 700 ms |
| Player speed | 260 px/s |
| Fireball damage | 20 |
| Fireball cooldown | 550 ms |
| Fireball speed / lifetime | 520 px/s / 1.8 s |
| Shield active / cooldown | 1.2 s / 4 s |
| Shield arc / range | 140° total / 48 px |
| Reflection damage multiplier | 1.5× |
| Grunt health / speed | 60 / 90 px/s |
| Grunt shot interval / damage | 1.8 s / 10 |
| Boss health / speed | 800 / 60 px/s |
| Boss aimed burst | 3 bolts every 2.4 s |
| Boss radial nova | 12 bolts every 5.5 s |
| Camera min zoom / padding | 0.55 / 160 px |

All values live in config files, not in entities.

---

## 3. Milestone sequence

| # | Milestone | Status | Depends on |
| --- | --- | --- | --- |
| 0 | Baseline review and MVP plan | Complete | — |
| 1 | Local co-op movement, facing and input | Complete | 0 |
| 2 | Screen-space HUD shell and co-op camera | Complete | 1 |
| 3 | Player health, damage and downed state | Complete | 2 |
| 4 | Projectile system, Fireball and cooldowns | Complete | 3 |
| 5 | Grunt enemies, enemy fire and combat loop | Complete | 3, 4 |
| 6 | Shield, directional defense and reflection | Complete | 4, 5 |
| 7 | Encounter flow, boss and win/lose conditions | Complete | 5, 6 |
| 8 | Start screen, instructions, restart and result flow | Complete | 7 |
| 9 | Audio, visual polish, balance and final QA | Complete | 8 |

After each milestone: run typecheck, run the production build, manually test the milestone, update this document, review the diff, and commit.

---

## 4. Milestone details

### Milestone 0 — Baseline review and MVP plan

**Status:** Complete

**Objective:** Document the existing architecture and the implementation sequence without changing gameplay.

**Changes:**

- Add `MVP_PLAN.md`.
- No source-code or gameplay changes.

**Verification:**

- Existing Git baseline remains clean.
- Existing typecheck/build remain valid.

---

### Milestone 1 — Local co-op movement, facing and input

**Status:** Complete

**Implemented:**

- Central player bindings in `config/controls.ts`, including reserved Fireball/Shield keys.
- Two independent input states read once per frame in `InputSystem`.
- `FacingComponent` replaces mouse aiming; facing follows the last non-zero movement direction and persists.
- P1/P2 identity, distinct generated textures, spawn positions and inward facing.
- Player-vs-wall and player-vs-player colliders.
- Camera follows the players' midpoint (zoom fixed at 1 until Milestone 2).
- Debug overlay reports both players; controls hint updated.
- Removed the mouse crosshair cursor and the previous mouse-aim documentation.

**Deviation:** The old F2 Arcade body-outline toggle was removed. Phaser 4.2.1 created and updated the debug graphic, but it did not render in WebGL in this project. The toggle was not MVP-critical, and leaving a broken advertised control was worse than removing it. Debug information is still available through the overlay and wall-contact flags.

**Verification:** Typecheck and production build pass. Browser-tested: independent movement for both players, diagonal velocity of 184/184 at 260 px/s, facing persistence after stopping, top-wall collision, player separation at 36 px, midpoint camera follow, debug overlay values for both players, and no console errors.

**Objective:** Two players can move independently with keyboard-only controls, keep a stable facing direction, collide with the arena and each other, and the camera at least follows their midpoint.

**Features:**

- Centralize all player bindings in `config/controls.ts`.
- Player 1: WASD movement, `F` Fireball, `G` Shield.
- Player 2: Arrow keys movement, Numpad 1 Fireball, Numpad 2 Shield.
- Keep Fireball/Shield bindings defined centrally even though the abilities arrive later.
- Create two independent player input states.
- Remove mouse aiming from gameplay.
- Replace `AimComponent` with `FacingComponent`:
  - Facing updates only when movement input is non-zero.
  - Facing persists when the player stops.
  - Rotation matches the facing vector immediately so projectiles and shields are predictable.
- Add player identity, name and distinct colors/textures for P1 and P2.
- Spawn P1 and P2 on opposite sides of the arena center, facing inward.
- Add player-vs-player collider in addition to walls.
- Follow the midpoint of the two players with the existing camera at zoom 1 for this milestone.
- Update the debug overlay to show both players instead of one.
- Update controls hint and README.

**Files likely created:**

- `src/game/config/controls.ts`
- `src/game/components/FacingComponent.ts`

**Files likely modified:**

- `src/game/systems/InputSystem.ts`
- `src/game/entities/Player.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/components/MovementComponent.ts` (only if a return value or accessor is useful)
- `src/game/config/gameplayConfig.ts`
- `src/game/config/theme.ts`
- `src/game/resources/placeholderTextures.ts`
- `src/game/ui/DebugOverlay.ts`
- `src/style.css` (remove crosshair cursor)
- `README.md`

**Manual test:**

1. Start the dev server.
2. Move P1 with WASD and P2 with arrows.
3. Verify diagonal speed equals cardinal speed.
4. Stop moving and confirm facing does not snap back.
5. Verify Fireball/Shield keys do nothing yet.
6. Walk each player into every wall; collision must hold.
7. Walk the players into each other; bodies must separate rather than overlap.
8. Confirm both players are controllable with no mouse input.
9. Confirm debug values are shown for both players.

**Temporary limitation:** camera keeps the midpoint but does not yet zoom; widely separated players may leave the viewport. Resolved in Milestone 2.

**Risks:**

- Numpad keys may not be available or may be affected by NumLock on some keyboards. Mappings are centralized; a fallback mapping can be added after review.
- Removing mouse aim changes the current controls; the README and in-game hint must be updated in the same milestone.

---

### Milestone 2 — Screen-space HUD shell and co-op camera

**Status:** Complete

**Implemented:**

- `SceneKeys` centralizes scene identifiers.
- `HudScene` runs in parallel with its own camera and renders all screen-space UI.
- `HudModel` is the shared data contract; `ArenaScene` owns and updates it, `HudScene` polls it.
- `PlayerHudPanel` for each player with name, health bar placeholder, numeric health and control labels.
- `BossHealthBar` exists but stays hidden until a boss state is supplied.
- Objective line and controls hint.
- `DebugOverlay` moved into `HudScene`, so camera zoom cannot scale or shift it.
- `CoopCamera` follows the living players' midpoint and smoothly zooms between `minZoom` and 1 to fit both, with arena bounds applied.
- HUD is stopped on arena shutdown and relaunched on scene creation.

**Verification:** Typecheck and production build pass. Browser-tested: HUD remains fixed and readable at zoom 1 and while zoomed out, both players stay in view when separated, camera returns to zoom 1 when they regroup, camera clamps at arena edges, no duplicate HUD after reload, and no console errors.

**Objective:** Separate screen-space UI from the zooming gameplay camera and keep both players visible when they split up.

**Features:**

- Add `sceneKeys.ts` for all scene identifiers.
- Add `HudScene`, launched in parallel by `ArenaScene`, with its own camera.
- Add a `HudModel` data contract shared between gameplay and HUD.
- Add player HUD panels with name, control labels and placeholders for health/cooldown indicators. Health bars are completed in Milestone 3.
- Move `DebugOverlay` into `HudScene` or adapt it to render through the HUD scene so camera zoom cannot distort it.
- Add `CoopCamera`:
  - Follow the midpoint of living players.
  - Zoom smoothly out when players separate.
  - Clamp zoom between configured minimum and 1.
  - Clamp to arena bounds.
  - Keep both players visible whenever possible.
- Add a hidden boss bar slot for later use.
- Add objective/instructions text in the HUD shell.
- Ensure HUD scene is stopped/relaunched correctly on restart and scene shutdown.

**Files likely created:**

- `src/game/config/sceneKeys.ts`
- `src/game/scenes/HudScene.ts`
- `src/game/systems/CoopCamera.ts`
- `src/game/ui/HudModel.ts`
- `src/game/ui/PlayerHudPanel.ts`
- `src/game/ui/BossHealthBar.ts`

**Files likely modified:**

- `src/game/scenes/ArenaScene.ts`
- `src/game/config/gameplayConfig.ts`
- `src/game/config/gameConfig.ts`
- `src/game/config/theme.ts`
- `src/game/ui/DebugOverlay.ts`

**Manual test:**

1. Start gameplay and confirm HUD elements remain fixed and readable at all camera zoom levels.
2. Move players to opposite corners; verify the camera zooms out and both remain visible.
3. Bring players together; verify the camera zooms back in smoothly.
4. Verify both players stay inside camera bounds at arena edges.
5. Toggle debug overlay and Arcade body outlines; confirm both render correctly through the HUD scene.
6. Restart or reload the scene and confirm exactly one HUD exists and no duplicate listeners remain.

**Risks:**

- Scene lifecycle mistakes can create duplicate HUD scenes or leaked key listeners.
- Phaser camera bounds with changing zoom need playtesting at arena corners.
- Debug physics toggle currently belongs to the gameplay physics world; keep that ownership explicit rather than moving gameplay state into the HUD scene.

---

### Milestone 3 — Player health, damage and downed state

**Status:** Complete

**Implemented:**

- Reusable `HealthComponent` with current/max health, damage intake, ratio, alive state and reset.
- Configurable 700 ms player invulnerability with timer updates.
- `Player.takeDamage()` and white damage flash; downed players are tinted, dimmed and cannot move or face.
- `Player.update` advances health timers and stops movement when down.
- HUD health bars and numeric health now track the component; `DOWN` state is shown.
- Dev-only damage keys (`H` for P1, Numpad `3` for P2, 25 damage) gated by `DEBUG.enabled` and shown in the debug panel.
- Defeat detection when every player is down; the outcome is stored in `HudModel` and the objective text updates once.

**Verification:** Typecheck and production build pass. Browser-tested: 25 damage applied per hit, second hit inside 700 ms ignored, damage applied again after the window, HUD health and bars update, downed players cannot move, both players down triggers the defeat objective once, and no console errors.

**Objective:** Players have persistent health, take damage with reliable invulnerability frames, can be downed, and the HUD reflects their state.

**Features:**

- Add reusable `HealthComponent`.
  - Max/current health.
  - `damage(amount)` ignores dead or invulnerable targets.
  - Configurable invulnerability window.
  - `update(deltaMs)` for timers.
  - `isAlive`, `healthRatio` and last-hit feedback hooks.
- Add player health, team and damage flash.
- Add configurable 700 ms player invulnerability.
- Disable movement/abilities and visuals appropriately when a player is down.
- HUD health bars, numeric health and `DOWN` state.
- Add dev-only damage test keys, gated by `DEBUG.enabled` and documented in the debug panel.
- Detect the all-players-down condition and expose it as a gameplay outcome hook, but leave the final result screen and restart flow to Milestone 8.

**Files likely created:**

- `src/game/components/HealthComponent.ts`

**Files likely modified:**

- `src/game/entities/Player.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/scenes/HudScene.ts`
- `src/game/ui/HudModel.ts`
- `src/game/ui/PlayerHudPanel.ts`
- `src/game/ui/DebugOverlay.ts`
- `src/game/config/gameplayConfig.ts`
- `src/game/config/controls.ts`
- `src/game/config/theme.ts`

**Manual test:**

1. Use dev damage keys on P1 and P2.
2. Verify health bars update and damage flash is visible.
3. Hit the same player repeatedly within 700 ms; only one hit should register.
4. Reduce one player to zero; verify that player is marked down and cannot move or act.
5. Leave the other player alive; gameplay continues.
6. Reduce both players to zero; verify the scene detects defeat once without repeating.
7. Confirm health values reset after scene restart.

**Risks:**

- Damage can be applied from physics callbacks; game-over checks must not run twice.
- Avoid putting health values directly in HUD text objects as state; HUD must poll the shared model.

---

### Milestone 4 — Projectile system, Fireball and cooldowns

**Status:** Complete

**Implemented:**

- Combat types for `Team`, projectile presets and spawn data.
- `Projectile` entity with circular Arcade body, velocity, lifetime timer, team, owner, original source, damage and reflection metadata.
- `ProjectileSystem` owns the projectile group, spawns, updates lifetimes, removes expired/destroyed projectiles and cleans up on shutdown.
- Wall collisions destroy projectiles.
- `Cooldown` component and `FireballAbility`.
- Fireball spawns outside the owner body in the owner's facing direction.
- Fireballs collide with walls and expire after 1.8 s.
- Fireball cooldown is shown per player in the HUD with an independent refill bar.
- Fireball texture generated at runtime; texture keys moved to `resources/textureKeys.ts`.
- Debug panel shows active projectile count.

**Verification:** Typecheck and production build pass. Browser-tested: P1 fires with `F`, P2 fires with Numpad `1`, projectiles follow the held facing direction, cooldown blocks rapid fire, each player's cooldown is independent, wall impact removes the projectile, lifetime expiry removes it, HUD bars refill, and no console errors.

**Objective:** Add reusable projectiles and a working player Fireball with cooldown feedback, independent of enemy and shield logic.

**Features:**

- Add combat types (`Team`, `PlayerId`, projectile owner/source IDs).
- Add `Projectile` entity with circular Arcade body.
- Add `ProjectileSystem`:
  - Spawn from a projectile preset.
  - Move via Arcade velocity.
  - Destroy on wall contact.
  - Expire after lifetime.
  - Clean up all projectiles on shutdown.
  - Expose hooks for player/enemy interactions used in later milestones.
- Add `FireballAbility` and reusable `Cooldown`.
- Fireball spawns in the owner's facing direction, offset outside the player body.
- Add fireball projectile preset config.
- Add Fireball cooldown to the HUD.
- Add generated fireball texture and firing flash.
- Add projectile-team rules now even though only players fire:
  - Player team.
  - Owner/source IDs.
  - No friendly fire against players.
- Remove projectiles cleanly on wall/lifetime/owner death.

**Files likely created:**

- `src/game/types/combat.ts`
- `src/game/config/combatConfig.ts`
- `src/game/components/Cooldown.ts`
- `src/game/abilities/FireballAbility.ts`
- `src/game/entities/Projectile.ts`
- `src/game/systems/ProjectileSystem.ts`

**Files likely modified:**

- `src/game/entities/Player.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/ui/HudModel.ts`
- `src/game/ui/PlayerHudPanel.ts`
- `src/game/resources/placeholderTextures.ts`
- `src/game/config/theme.ts`
- `src/game/config/controls.ts`
- `src/game/systems/InputSystem.ts` (fire action)
- `README.md`

**Manual test:**

1. Fire with P1 `F` and P2 Numpad 1.
2. Confirm each fireball travels in the direction the player was last facing.
3. Rotate a player, stop, then fire; the projectile must follow the held facing direction.
4. Confirm cooldown blocks rapid fire and the HUD indicator refills.
5. Fire into a wall; projectile disappears without errors.
6. Let a projectile hit its lifetime limit; it disappears.
7. Confirm firing with one player does not consume the other player's cooldown.
8. Confirm scene shutdown leaves no active projectiles or errors.

**Risks:**

- Spawning inside the owner body must be avoided.
- Cooldown HUD must use ratios, not remaining seconds as the only display.
- Projectile cleanup must not double-destroy objects through wall collision and lifetime simultaneously.

---

### Milestone 5 — Grunt enemies, enemy fire and combat loop

**Status:** Complete

**Implemented:**

- `EnemyBase` with shared health, nearest-living-player targeting, steering, damage flash, death handling and wall-unsticking fallback.
- `Grunt` chase/retreat behaviour around a preferred range, aimed enemy bolts on a 1800 ms cooldown, and clean death.
- `EncounterSystem` owns the enemy group, spawns the four-grunt opening wave at fixed arena points, collects enemy shots, tracks the living count and destroys dead enemies.
- Four grunt spawn points around the arena.
- Player-team projectiles damage grunts and are removed; enemy-team projectiles damage players and are removed.
- Same-team projectiles are ignored, so players cannot damage each other with fireballs.
- Grunt and enemy-bolt placeholder textures.
- Enemy vs wall, enemy vs enemy, and enemy vs player colliders.
- HUD objective tracks living grunts and reports the wave as defeated; defeat text still takes priority.
- Debug panel shows living enemies and active projectiles.

**Deviation:** `ProjectileSystem` and `EncounterSystem` now use plain `GameObjects.Group` containers instead of Arcade physics groups. Adding a body-backed object to a `Phaser.Physics.Arcade.Group` applies that group's default body properties, which reset projectile velocity to zero. The projectiles and enemies already own dynamic bodies, and Arcade colliders accept plain groups, so they remain fully physical. This also fixes a Milestone 4 defect where fireballs were spawned but stationary.

**Verification:** Typecheck and production build pass. Browser-tested: four grunts spawn and advance to attack range, enemy bolts travel toward the nearest player and apply 10 damage with the 700 ms invulnerability window, player fireballs travel, hit grunts for 20 and destroy them after 60 damage, dead grunts leave the world and reduce the objective count, fireballs do not damage either player, the objective updates to `The first wave is defeated.`, and no console errors occur.

**Objective:** Add the first enemy type, make it damage players and take damage from fireballs, completing the basic PvE loop.

**Features:**

- Add `EnemyBase` with health, damage flash and death callback.
- Add `Grunt`:
  - Targets the nearest living player.
  - Moves toward the target until a preferred attack distance.
  - Fires aimed enemy bolts on a cooldown.
  - Dies and is removed cleanly.
- Add `EncounterSystem` initial enemy management:
  - Spawn a small grunt group at fixed arena points.
  - Track living enemies and remaining count.
  - Remove dead enemies from the physics group and arrays.
- Connect `ProjectileSystem` to enemy targets:
  - Player-team projectiles damage enemies and are destroyed.
  - Enemy-team projectiles damage players and are destroyed unless shield logic is later triggered.
  - Ignore owner bodies and same-team targets.
- Add enemy bolt preset and texture.
- Add enemy/player colliders and enemy/wall colliders.
- Add enemies-remaining/objective text to the HUD.
- Add damage flash to players and grunts.
- Add simple blocked-movement fallback so grunts do not permanently stick to walls.

**Files likely created:**

- `src/game/entities/EnemyBase.ts`
- `src/game/entities/Grunt.ts`

**Files likely modified:**

- `src/game/systems/EncounterSystem.ts`
- `src/game/systems/ProjectileSystem.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/entities/Player.ts`
- `src/game/ui/HudModel.ts`
- `src/game/scenes/HudScene.ts`
- `src/game/ui/PlayerHudPanel.ts`
- `src/game/config/combatConfig.ts`
- `src/game/config/theme.ts`
- `src/game/resources/placeholderTextures.ts`
- `src/game/actions/` only if a shared targeting helper is needed

**Manual test:**

1. Observe grunts spawn at fixed points and approach players.
2. Verify grunts stop/attack at a reasonable distance.
3. Verify enemy bolts travel toward the targeted player and damage them.
4. Verify player invulnerability prevents rapid multi-hits.
5. Fire at a grunt; health decreases, damage flash appears, death removes it from the world and HUD count.
6. Confirm a dead grunt cannot hit players or be hit again.
7. Confirm fireballs do not damage the caster or the other player.
8. Let all grunts die; confirm the encounter reports cleared (boss remains for Milestone 7).
9. Check for leaked sprites, bodies, timers or listeners after repeated kills.

**Risks:**

- Arcade overlap callbacks can run more than once for the same object pair if destruction is not immediate.
- Enemy movement directly toward a target can stick on walls; keep the fallback minimal and revisit only if it affects play.
- Enemy death must remove the physics body from the group before the next collision pass.

---

### Milestone 6 — Shield, directional defense and reflection

**Status:** Complete

**Implemented:**

- `ShieldComponent` with an 800 ms active window, 1800 ms cooldown, a 140° frontal arc and flash state.
- Shield activation through `G` and Numpad `2`, using the existing `InputSystem` shield action.
- Frontal shield arc drawn in the player's colour and facing direction, with a bright flash on reflection.
- Directional protection: only projectiles inside the frontal arc and moving toward the player are reflected or blocked; side and rear hits behave normally.
- Enemy bolts reflected by a shield switch to the player team, keep their original source ID, take the shield owner as owner, travel in the shield owner's facing direction, gain the 1.5× reflection multiplier, and leave the reflector's body immediately.
- Player fireballs hitting an active shield are reflected the same way; player fireballs never damage players.
- Reflection lock plus repositioning prevents frame-level repeat reflections and self-damage.
- Reflected projectiles use a cyan tint and 1.3× scale; reflections trigger shield flash and a short camera shake.
- HUD shows shield ready, active and cooldown states per player.
- Debug overlay reports the total reflection count.

**Deviation:** The original manual test line 7 implied that a player fireball should damage a player when the shield faces away. That conflicts with the project decision that player-team projectiles never deal friendly fire. The test was corrected to use an enemy bolt; player fireballs now pass through friendly players when the shield does not cover the hit.

**Verification:** Typecheck and production build pass. Browser-tested with both synthetic input and direct state inspection: shield keys activate the correct player, reactivation during the active window is rejected, duration and cooldown expire on schedule, a frontal fireball reflects with 1.5× damage in the reflector's facing direction without damaging the reflector, away/sideways shields do not reflect, a reflected enemy bolt deals 15 damage to a grunt, an uncovered enemy bolt deals 10 to the player, HUD states match the component, reflected projectiles are visibly distinct, and no console errors occur.

**Objective:** Implement the core cooperative mechanic: shield protection and reliable fireball reflection between players.

**Features:**

- Add `ShieldComponent`:
  - Activation duration and cooldown.
  - Frontal cone check.
  - `isActive` and HUD progress state.
- Shield activation with `G` and Numpad 2.
- Draw a frontal shield arc that matches the player's facing and active state.
- Shield rules:
  - Active shield protects only from the direction the player faces.
  - Projectiles hitting the protected arc are reflected.
  - Projectiles hitting from behind or outside the arc damage the player normally.
  - If a projectile is not reflectable, block/destroy it instead of reflecting.
- Reflection rules:
  - Set team to the shield owner's team.
  - Set current owner to the shield owner.
  - Preserve original source ID.
  - Travel in the shield owner's facing direction, not the incoming direction.
  - Reposition outside the shield owner body.
  - Apply a short reflection lock to prevent frame-level repeat reflections.
  - Apply the configured reflection damage multiplier.
  - Reflected projectiles can damage enemies and the boss later.
- Player-team projectiles still do not deal friendly fire; their shield interaction is reflection only.
- Support reflecting both another player's fireball and enemy projectiles.
- Add shield cooldown/active indicators to the HUD.
- Add reflection feedback: shield flash, projectile tint/scale pulse, short camera shake, and a distinct reflected state.
- Add a reflection counter to the debug overlay if useful.

**Files likely created:**

- `src/game/components/ShieldComponent.ts`

**Files likely modified:**

- `src/game/entities/Player.ts`
- `src/game/entities/Projectile.ts`
- `src/game/systems/ProjectileSystem.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/systems/InputSystem.ts` (shield action)
- `src/game/ui/HudModel.ts`
- `src/game/ui/PlayerHudPanel.ts`
- `src/game/ui/DebugOverlay.ts`
- `src/game/config/combatConfig.ts`
- `src/game/config/theme.ts`
- `README.md`

**Manual test — required co-op interaction:**

1. Position P1 and P2 facing each other.
2. P1 fires a fireball at P2.
3. Before impact, P2 activates shield facing P1.
4. The fireball must reflect back in P2's facing direction.
5. Confirm it does not immediately damage P2.
6. Aim the reflected fireball at a grunt and confirm damage/kill.
7. Repeat with P2 facing away; an incoming enemy bolt must damage P2 rather than be reflected.
8. Repeat with P2 facing sideways; the shield must not block.
9. Reflect an enemy bolt at a grunt and confirm it damages the enemy team.
10. Confirm shield duration and cooldown are clear in the HUD.
11. Fire repeatedly at an active shield to check for reflection loops or duplicate damage.

**Risks:**

- Shield collision currently resolves on player-body overlap. If the visual arc feels too far ahead of the actual reflection point, tune the arc radius rather than adding a dedicated shield physics body prematurely.
- Reflection direction depends on `FacingComponent`; ensure facing is updated on the same frame as movement input.
- Do not let a reflection immediately re-collide with the same active shield; use repositioning plus `reflectLockMs`.

---

### Milestone 7 — Encounter flow, boss and win/lose conditions

**Status:** Complete

**Implemented:**

- `EncounterSystem` phase machine: `grunts` → `bossTelegraph` → `boss` → `cleared`.
- A 1600 ms boss spawn telegraph with a growing arena marker, camera shake on spawn, and no further spawning once the boss is active.
- `Boss` (Xyphir Warden): 480 HP, slow repositioning, alternating aimed three-bolt burst and 16-bolt radial nova, a readable pre-attack telegraph, and faster intervals below 50% health.
- Boss and boss-bolt placeholder textures, boss projectile preset and boss health bar synced through `HudModel`.
- Phase-driven objective text for the grunt wave, boss arrival, boss fight and cleared state.
- Centralised outcome handling with a 900 ms delay: victory when the boss dies, defeat when both players are down, no repeat triggers.
- Simulation freeze after the outcome delay: input/actions stop, Arcade physics pauses, and physics resumes on scene shutdown.
- `ResultOverlay` victory/defeat panel in `HudScene`, shown above the HUD.
- Team-based bullet damage tuning with an optional debug damage panel (`combatTuning`, `DamageDebugPanel`) gated by `DEBUG.enabled`.
- Separate ally-reflect and enemy-reflect damage/scale multipliers.

**Deviation:** Projectile time-based lifetime was removed; projectiles now persist until they hit a wall or an entity. Damage is resolved from the per-team tuning values rather than the projectile preset, so the debug panel can retune player and enemy bullet damage live.

**Verification:** Typecheck and production build pass. Manual browser play-testing confirmed the grunt-to-boss transition, spawn telegraph and boss bar, both boss patterns, shield reflection of boss bolts, single victory/defeat presentation, frozen post-outcome state, and no console errors.

**Objective:** Turn the combat sandbox into a complete encounter with a boss, two attack patterns, a boss health bar and clear outcomes.

**Features:**

- Extend `EncounterSystem`:
  - Spawn grunts as the opening wave.
  - When all grunts are dead, spawn the boss after a short telegraph delay.
  - Stop spawning after the boss is active.
  - Report encounter state to HUD/objective text.
- Add `Boss`:
  - Significantly higher health.
  - Slow repositioning behavior.
  - Pattern A: aimed three-bolt burst at the nearest player.
  - Pattern B: radial nova of projectiles.
  - Telegraph before dangerous patterns.
  - Simple phase tuning below 50% health (shorter intervals, not a new mechanic).
  - Death cleanup and victory signal.
- Add boss projectile presets and generated visuals.
- Add boss health bar in `HudScene`.
- Add win/lose checks:
  - Victory when the boss dies.
  - Defeat when both players are down.
  - No repeated outcome triggers.
  - Short outcome delay for readable feedback.
  - Freeze gameplay simulation on outcome (pause physics and input actions, keep restart handling available).
- Add a basic victory/defeat panel. Final start/restart/menu flow follows in Milestone 8.

**Files likely created:**

- `src/game/entities/Boss.ts`

**Files likely modified:**

- `src/game/systems/EncounterSystem.ts`
- `src/game/entities/EnemyBase.ts`
- `src/game/entities/Grunt.ts`
- `src/game/systems/ProjectileSystem.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/scenes/HudScene.ts`
- `src/game/ui/HudModel.ts`
- `src/game/ui/BossHealthBar.ts`
- `src/game/ui/ResultOverlay.ts`
- `src/game/config/combatConfig.ts`
- `src/game/config/theme.ts`
- `src/game/resources/placeholderTextures.ts`

**Manual test:**

1. Defeat all opening grunts.
2. Confirm boss spawn telegraph and boss health bar appear.
3. Observe both boss patterns separately and confirm they are distinguishable.
4. Confirm telegraph timing gives players a chance to react.
5. Reflect boss projectiles with a shield and confirm boss damage.
6. Kill the boss with fireballs and reflected projectiles; confirm victory appears once.
7. Let both players die during the boss fight; confirm defeat appears once.
8. With one player down, confirm the surviving player can still win.
9. Confirm projectiles/enemies stop acting after outcome and do not damage post-game.
10. Repeat the encounter and watch for leftover enemies/projectiles.

**Risks:**

- Boss projectile count can spike during radial patterns; cap active projectiles and verify frame rate.
- Outcome checks must be centralized; do not let player death and boss death both trigger results.
- Pausing physics while keeping the scene update running is required for restart input; verify Phaser physics pause/resume behavior.
- The boss must not be able to damage players after the outcome is decided.

---

### Milestone 8 — Start screen, instructions, restart and result flow

**Status:** Complete

**Implemented:**

- `StartScene` with the title, objective, one control card per player, and a co-op reflection explanation.
- Enter or Space starts the run; the scene order is now `StartScene` → `ArenaScene` with `HudScene` launched in parallel.
- Result overlay shows VICTORY or DEFEAT, a short reason, `R` restart and `Esc` return to title.
- Restart recreates the arena through the normal scene lifecycle, so players, health, cooldowns, facing, enemies, boss, projectiles, HUD and timers are rebuilt from scratch.
- Returning to the title stops the HUD and arena cleanly.
- Arena shutdown removes result and debug key listeners, removes the pending outcome timer, and resumes physics for the next run.
- In-game controls hint now includes both players' ability keys.

**Verification:** Typecheck and production build pass. Start/restart/title scene transitions were reviewed for listener and HUD cleanup; no browser play-test was run for this milestone per project instruction.

**Objective:** Make the game understandable and replayable from a clean title screen through victory/defeat and restart.

**Features:**

- Add `StartScene`:
  - Title and short objective.
  - Complete P1/P2 control table.
  - Explanation of shielding and reflection.
  - Enter/Space to start.
  - No mouse required.
- Register scene keys and start order in `gameConfig`.
- Arena starts only from `StartScene`.
- Result overlay in `HudScene` shows:
  - VICTORY or DEFEAT.
  - Short reason.
  - `R` restart.
  - `Esc` return to title.
- Restart fully resets:
  - Players, health, cooldowns, positions, facing.
  - Enemies, boss, projectiles, HUD, camera, timers.
- Ensure HUD scene is stopped and relaunched cleanly with one instance.
- Update in-game controls hint and README.
- Add an in-game objective line to guide the player through the encounter.

**Files likely created:**

- `src/game/scenes/StartScene.ts`

**Files likely modified:**

- `src/game/config/gameConfig.ts`
- `src/game/config/sceneKeys.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/scenes/HudScene.ts`
- `src/game/ui/ResultOverlay.ts`
- `src/game/ui/HudModel.ts`
- `src/game/config/controls.ts`
- `src/main.ts` only if HMR cleanup needs adjustment
- `README.md`

**Manual test:**

1. Open the game; verify title, objective and complete controls are visible.
2. Press Enter; verify gameplay starts once.
3. Verify `Esc`/menu from result returns to title without orphaned HUD or gameplay.
4. Win a run, press R, and verify a completely fresh run.
5. Lose a run, press R, and verify a completely fresh run.
6. Restart multiple times and check for duplicate HUDs, duplicate enemies or input listeners.
7. Verify controls in the UI match the actual bindings.

**Risks:**

- Scene restart can leave a parallel HUD scene running if shutdown cleanup is incomplete.
- Repeated key listeners can fire start/restart actions more than once.
- Ensure input state does not carry across scene restarts.

---

### Milestone 9 — Audio, visual polish, balance and final QA

**Status:** Complete

**Implemented:**

- `SfxSystem` with generated Web Audio effects and no binary assets or new dependencies: start, fireball, shield, reflection, player hit, enemy hit, enemy death, boss spawn, victory and defeat.
- Audio is created and resumed only from the Enter/Space gesture in `StartScene`; all effects are no-ops until the context is running.
- Sound hooks for casting, shield activation, reflection, enemy damage/death, player damage, boss arrival and outcomes.
- Result title pop animation and enemy-projectile cleanup when an outcome is scheduled, preventing post-result damage.
- Encounter updates stop as soon as an outcome is scheduled, so a defeat delay cannot advance into a boss spawn.
- Existing polish retained: shield arc and reflection flash, active/ready/cooling ability colours, boss telegraph pulse, downed player state, camera shake and boss health bar.
- README updated with the title/restart controls, objective and final architecture notes.

**Verification:** Typecheck and production build pass. Edge-case review covered simultaneous player deaths, boss/player deaths in the same frame, shield-plus-enemy overlaps, reflected-projectile cleanup, restart with live projectiles, repeated scene restarts, outcome freeze and maximum projectile counts. Browser re-testing was not run for this milestone per project instruction; the user had already validated the current build.

**Objective:** Make the finished MVP clear, responsive and stable without changing the core architecture.

**Features:**

- Add lightweight generated sound effects:
  - Fireball cast.
  - Shield activation.
  - Reflection.
  - Player/enemy hit.
  - Enemy death.
  - Boss spawn / victory / defeat.
- Use Web Audio oscillator/noise helpers; no binary audio assets or new dependencies.
- Resume/create audio only after the start key gesture to satisfy browser autoplay rules.
- Improve readability:
  - Reflect/deny state on shield.
  - Cooldown ready vs cooling vs active colors.
  - Boss telegraph visuals.
  - Player down state.
  - Projectile trail or afterimage if cheap.
- Tune the encounter:
  - Player damage/health.
  - Fireball cadence and damage.
  - Shield duration/cooldown/arc.
  - Grunt count and attack cadence.
  - Boss health and pattern timing.
  - Reflection reward.
- Test edge cases:
  - Both players die simultaneously.
  - Boss dies on the same frame as a player.
  - Projectile hits shield and enemy in the same step.
  - Reflected projectile lifetime/cleanup.
  - Restart while projectiles are active.
  - Repeated scene restarts and resizing.
- Verify performance with the maximum expected projectile count.
- Update README with final controls, objective, architecture and run instructions.

**Files likely created:**

- `src/game/systems/SfxSystem.ts`

**Files likely modified:**

- `src/game/scenes/StartScene.ts`
- `src/game/scenes/ArenaScene.ts`
- `src/game/scenes/HudScene.ts`
- `src/game/entities/Player.ts`
- `src/game/entities/Projectile.ts`
- `src/game/entities/Boss.ts`
- `src/game/systems/ProjectileSystem.ts`
- `src/game/ui/PlayerHudPanel.ts`
- `src/game/ui/BossHealthBar.ts`
- `src/game/ui/ResultOverlay.ts`
- `src/game/config/combatConfig.ts`
- `src/game/config/theme.ts`
- `README.md`

**Manual test — full playthrough:**

1. Start from title.
2. Clear the grunt wave.
3. Use reflection at least once against the boss.
4. Win or lose and confirm the correct result.
5. Restart and repeat the full loop.
6. Test with the game window resized and at a non-16:9 browser size.
7. Check the browser console for errors after the full run.
8. Confirm sound starts only after the user begins the game.
9. Confirm no visible performance degradation during the boss radial attack.
10. Confirm all HUD values and cooldowns match actual gameplay state.

**Risks:**

- Audio can be blocked until a user gesture; do not create/resume it at module load.
- Visual effects must not extend the lifetime of destroyed game objects.
- Balance changes must stay in config and be checked against both players.

---

## 4a. Post-MVP — Dash ability

**Status:** Complete

**Objective:** Give each player a short, high-speed dash that grants damage immunity and lets them phase through projectiles, enemies and their partner without destroying anything.

**Implemented:**

- `DashComponent` owns the active duration, fixed dash velocity, cooldown and active ratio.
- `DASH` tuning in `config/gameplayConfig.ts`: `durationMs: 180`, `speed: 950`, `cooldownMs: 850`, `alphaWhileDashing: 0.55`.
- Bindings: P1 `Space`, P2 Numpad `0`, centralised in `config/controls.ts`.
- `Player.tryDash()` uses the current held movement direction, falling back to facing, and updates facing to the dash direction.
- `Player.takeDamage()` ignores damage while dashing, and horizontal movement input is suspended for the dash duration.
- `ArenaScene` disables player-player and player-enemy collision while either party is dashing, and the player-projectile overlap handler returns early so projectiles pass through without being removed.
- Arena walls remain solid during the dash so players cannot leave the arena.
- Dash appears as a third HUD ability column (`FIRE`, `SHIELD`, `DASH`) with READY/ACTIVE/COOL states, plus title-screen and debug-hint control labels.
- A synthesised dash sound is played on activation.

**Verification:** Typecheck and production build pass. Gameplay behaviour was tested in the browser by the user.

---

## 4b. Post-MVP — Auto fire toggle

**Status:** Complete

**Objective:** Let each player keep firing automatically so one player can focus on movement, shields or dash timing.

**Implemented:**

- Per-player toggle bindings: P1 `Q`, P2 Numpad `5`, centralised in `config/controls.ts`.
- `Player.autoAttackEnabled` with `toggleAutoAttack()`, guarded while downed.
- `ArenaScene` fires through the existing `tryFire()` path every frame while auto fire is enabled, sharing the normal fireball cooldown with manual fire.
- HUD panel adds an `AUTO FIRE [key]` row with an `ON`/`OFF` state that turns green while active.
- Title-screen control cards and the debug hint list the auto-fire keys; the debug overlay shows `AUTO` for enabled players.
- Short toggle sound and a `toggle` SFX entry.

**Verification:** Typecheck and production build pass. Auto fire uses the same projectiles, cooldown and damage path as manual fire.

---

## 4c. Post-MVP — Turret skill (P1)

**Status:** Complete

**Objective:** Introduce the first skill and a reusable skill foundation for future elemental turrets and modifiers.

**Implemented:**

- `Skill` base class with cooldown, cast gating and a multiplicative `SkillModifiers` record (`cooldown`, `duration`, `damage`, `projectileSpeed`, `range`, `fireRate`).
- `TurretSkillDefinition` and `TURRET_SKILL` config: 10 s duration, 5 s cooldown, 560 range, 600 ms fire interval, 8 damage, 640 projectile speed.
- `Turret` entity: placed in front of the player, clamped inside the arena, rotates toward the nearest living enemy in range, fires at its current target, fades out in the last 2 s and expires after its duration.
- `TurretSkill` owns at most one turret: casting again when the cooldown is ready destroys the old turret before spawning the new one.
- P1-only skill binding on `E`; the control map supports a list of skill bindings so later players and additional skills are additive.
- Skill projectiles use an optional per-spawn damage override, so future modifiers can change turret damage independently of the team bullet tuning.
- HUD skill row with `READY`/`ACTIVE`/`COOL`, remaining-duration fill, key hint, plus title-card and debug-hint entries.
- New generated turret and turret-bolt textures; `skill` deployment sound and `SKILL` debug flag.

**Verification:** Typecheck and production build pass. Turret targeting, replacement, expiry and projectile damage use the existing projectile and enemy-damage paths.

---

## 5. Testing protocol used for every milestone

1. Review the current Git status and relevant existing files.
2. Implement only the current milestone.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Run `npm run dev` and verify the milestone in the browser.
6. Check the browser console for runtime errors.
7. Exercise both players, including collision and camera edge cases where relevant.
8. Update the milestone status and notes in this document.
9. Review `git diff` and `git status`.
10. Commit with a descriptive message.
11. Stop and wait for review before the next milestone.

No milestone is marked complete if its manual test fails. A failing check is fixed before commit.

---

## 6. Cross-cutting risks and decisions

| Risk / decision | Mitigation |
| --- | --- |
| Numpad availability and NumLock | Centralize bindings; test on the target machine; add fallback keys only if requested. |
| HUD distorted by co-op camera zoom | All HUD/debug UI lives in `HudScene` with its own camera. |
| Duplicate HUD or leaked listeners on restart | Explicit scene shutdown, key removal and HUD stop/relaunch checks. |
| Physics callbacks vs scene update order | Resolve damage/reflection in overlap callbacks; run game-over checks once per frame; pause physics on outcome. |
| Projectile reflection loops | Reposition after reflect, update team/owner, apply a short reflection lock. |
| Friendly fire confusion | Player-team projectiles never damage players; shields remain the cooperative interaction. |
| Shield visual vs collision timing | Start with player-body overlap and a matching frontal arc; tune arc radius before adding a separate shield hitbox. |
| Enemy wall sticking | Direct chase plus a minimal blocked steer; revisit only if it harms the encounter. |
| Boss projectile spikes | Shared projectile group, hard caps, lifetime cleanup and performance check in final QA. |
| Audio autoplay | Create/resume audio from the start-screen key gesture. |
| Scope creep | No online play, progression, new abilities, inventory or art pipeline in the MVP. |

---

## 7. Out of scope for the MVP

- Online multiplayer or networking.
- Matchmaking, accounts or persistence.
- Character progression, skill trees, inventory or save files.
- Additional abilities beyond Fireball, Shield and the basic reflection interaction.
- Procedural dungeons or multiple biomes.
- Final art, animation, narrative or audio production.
- Mobile/touch controls.

---

## 8. Working agreement

- The plan is updated after every milestone with status, implementation notes, deviations and remaining risks.
- Architectural changes beyond this plan are explained before implementation.
- Each milestone ends with a local commit; no milestone is left knowingly broken.
- Development stops after each milestone for review and approval.
- The next milestone to implement is **Milestone 1 — Local co-op movement, facing and input**.
