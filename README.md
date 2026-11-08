# Xyphir Trials

A cooperative, top-down dungeon combat game built with Phaser 4, TypeScript and Vite.

This repository currently contains the first playable milestone: a combat sandbox with a moving, mouse-aimed player inside a walled arena.

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

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Aim / face direction |
| `` ` `` | Toggle debug overlay |
| `F2` | Toggle Arcade Physics body outlines |

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
  style.css               Page/canvas layout and cursor
  game/
    config/               Game config, gameplay tuning, palette
    scenes/               ArenaScene: orchestration only
    entities/             Player entity
    components/           MovementComponent, AimComponent
    systems/              InputSystem
    world/                Arena construction and wall bodies
    resources/            Generated placeholder textures
    ui/                   Debug overlay and controls hint
```

### Architectural notes

- Gameplay is composed from small components. `Player` is a thin Arcade sprite that owns a `MovementComponent` and an `AimComponent`; it does not contain input, camera or world logic.
- `InputSystem` isolates raw keyboard/pointer access and exposes normalized intent to the scene.
- `Arena` owns the floor, grid and static wall bodies, keeping world construction out of the scene.
- `ArenaScene` only wires the pieces together and updates them in order.
- Placeholder art is generated at runtime as a texture, so there are no binary assets yet.
- The arena (1920 × 1280) is larger than the 1280 × 720 viewport so camera follow is visible.
