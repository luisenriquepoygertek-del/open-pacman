# AGENTS.md — 05-open-pacman

## Stack & Run
- Vanilla JS + HTML + CSS. Sin `package.json`, sin bundler, linter ni tests.
- Run: abrir `src/index.html` directo o `npx serve src` / `python -m http.server --directory src`.
- No hay `npm install`, `build` ni `typecheck`.

## Entrypoints & Orden de carga
- `src/index.html:19-22` carga `js/maze.js -> js/game.js -> js/render.js -> js/main.js` como **scripts globales** (`window.MAZE`, `window.createGame/update`, `window.draw`). Respetar orden; no migrar a ES modules sin actualizar el HTML.
- Canvas `560x620` = `28x31` celdas * `TILE=20` (`src/js/render.js:4`).

## Arquitectura
- `src/js/maze.js` — `MAZE_STR` (31 strings x 28) -> `MAZE[][]` con `1 muro / 2 dot / 0 vacío / 3 puerta`; `TUNNEL_ROW=14`, `PACMAN_START=(13,23)`, `GHOST_STARTS`. Es prístino — cada partida copia con `MAZE.map(r=>r.slice())` (`src/js/game.js:19`); no mutar `MAZE`.
- `src/js/game.js` — `createGame(): {state,score,lives,dotsRemaining,grid,pacman,ghosts}`, `update(game)`, `DIRS/OPPOSITE`, `isWall(grid,x,y,actor)` (pacman bloquea `1` y `3`, ghost solo `1`), `PACMAN_SPEED=0.125` / `GHOST_SPEED=0.1`, estados `start|playing|won|lost`, `aligned()` cada 8/10 frames.
- `src/js/render.js` — `draw(ctx,game,frame)` lee `game.grid` (no `MAZE`); dibuja muros/puerta/dots/pacman/fantasmas/HUD.
- `src/js/main.js` — loop `requestAnimationFrame`, flechas -> `pacman.nextDir`, overlay `#overlay`/`#action-btn` con `GANASTE`/`PERDISTE`.

## Spec Workflow
- Skills en `.agents/skills/spec/` (`/spec`) y `spec-impl` (`/spec-impl`); template `.agents/skills/spec/template.md`; `skills-lock.json` referencia `klerith/fernando-skills`.
- Specs van en `specs/NN-slug.md` (carpeta aún no existe). Estado `Draft` -> humano lo pasa a `Approved` antes de `/spec-impl` que crea rama `spec-NN-slug`. Config `specs/.spec-config.yml` ausente = `AutoCreateBranch:true` por defecto.

## Convenciones & Gotchas
- Idioma: UI y docs en español — mantenerlo en nuevos specs/comentarios.
- No mutar `MAZE`; celda inicial `grid[23][13]=0`; movimiento y giros solo si `aligned()`; `wrapTunnel` solo en fila 14.
- Verificación manual: abrir `src/index.html`, sin errores en consola, `+10`/dot, colisión resta `lives`, `dotsRemaining===0 -> won`, `lives===0 -> lost`.
