# Xyphir Trials

A cooperative, top-down dungeon combat game built with Phaser 4, TypeScript and Vite.

This repository currently contains the local co-op movement and HUD milestone: two keyboard-controlled players inside a walled arena, with independent movement, persistent facing directions, a co-op camera and a screen-space HUD.

## Requirements

- Node.js 22.12+ (Vite 8 requirement)
- npm 10+

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Controls

Both players share the same keyboard. No mouse is required.

| Player | Movement | Fireball | Shield |
| --- | --- | --- | --- |
| P1 | `W` `A` `S` `D` | `F` | `G` |
| P2 | Arrow keys | Numpad `1` | Numpad `2` |

| Input | Action |
| --- | --- |
| `` ` `` | Toggle debug overlay |

Fireball and shield are not implemented yet; their keys are already registered and reserved by the central control map.

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
    scenes/               ArenaScene (orchestration), HudScene (screen-space UI)
    entities/             Player entity
    components/           MovementComponent, FacingComponent
    systems/              InputSystem, CoopCamera
    world/                Arena construction and wall bodies
    resources/            Generated placeholder textures
    ui/                   HUD model, player panels, boss bar, debug overlay
```

### Architectural notes

- Gameplay is composed from small components. `Player` is a thin Arcade sprite that owns a `MovementComponent` and a `FacingComponent`; it does not contain input, camera or world logic.
- Facing follows the last non-zero movement direction and persists when the player stops.
- All key bindings live in `config/controls.ts` so both players share one input map.
- `InputSystem` reads both players once per frame and exposes normalized intent to the scene.
- `HudScene` renders in parallel with its own camera, so gameplay camera zoom never distorts the HUD or debug overlay.
- `CoopCamera` follows the players' midpoint and zooms out just enough to keep both on screen.
- `Arena` owns the floor, grid and static wall bodies, keeping world construction out of the scene.
- `ArenaScene` only wires the pieces together and updates them in order.
- Placeholder art is generated at runtime as textures, so there are no binary assets yet.
- The arena (1920 × 1280) is larger than the 1280 × 720 viewport so camera follow is visible.
