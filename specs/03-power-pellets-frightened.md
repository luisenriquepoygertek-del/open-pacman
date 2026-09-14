# SPEC 03 — Power pellets y modo frightened

> **Status:** Approved
> **Depends on:** SPEC 02
> **Date:** 2026-09-14
> **Objective:** Añadir 4 power pellets en las esquinas del laberinto que al ser comidos activan 6 segundos de modo frightened donde los fantasmas se vuelven azules, lentos y comestibles por +200 puntos.

## Scope

**In:**

- Añadir 4 power pellets en `src/js/maze.js` en esquinas clásicas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` con símbolo `o` → valor `4` en `MAZE` (`parseTile`), verificadas `MAZE[y][x] !==1` y transitables.
- Nuevo valor `4` power pellet en `MAZE`/`grid`: `isWall` lo trata como transitable (no `1` ni `3`), `canMove` lo permite.
- Lógica en `src/js/game.js`: `POWER_PELLET=4`, `FRIGHTENED_DURATION=360` frames (6s a 60fps), `GHOST_FRIGHTENED_SPEED=0.05`, `GHOST_FRIGHTENED_COLOR='#0000ff'`, `game.frightenedTimer` y `game.frightenedEatenCount` (para scoring fijo), comer pellet da `+50` puntos, activa/reinicia timer a `360`, pone `grid[y][x]=0`.
- Modo frightened en `decideGhost`/`moveGhost`: si `frightenedTimer>0` todos los `ghosts` ignoran `kind` y eligen dirección aleatoria no-reversa entre `choices` (huida), `speed = GHOST_FRIGHTENED_SPEED`, `isFrightened=true`.
- Colisión en `update()`: si `frightenedTimer>0` y `collides` → fantasma comido: `score+=200`, respawn instantáneo en su `GHOST_STARTS` (`x,y,dir='up'`), no resta `lives`; si `frightenedTimer===0` → comportamiento actual resta `lives` y `resetPositions()` (SPEC 02).
- Decremento de `frightenedTimer--` por frame en `update()`; al llegar a `0` los fantasmas recuperan `speed=GHOST_SPEEDS[kind]` y color por `kind`.
- Render en `src/js/render.js`: dibujar `grid===4` como pellet grande (radio 6, mismo `DOT_COLOR`), y `drawGhost` usa azul `#0000ff` si `g.isFrightened` (fallback), ojos mantienen dirección.
- Respetar `MAZE` prístino (`MAZE.map(r=>r.slice())`), `aligned()`, `wrapTunnel` solo `TUNNEL_ROW=14`, orden carga `maze.js->game.js->render.js->main.js`.

**Out of scope (para futuros specs):**

- Progresión de puntos 200/400/800/1600 o `eatenCount` incremental (esta spec fija +200).
- Parpadeo/flash de fantasmas últimos 60 frames o de pellets.
- Ojos viajando a casa con timer 120 frames (respawn es instantáneo).
- Fruta, niveles con reinicio de dots, scatter/chase global, BFS/A*.
- Sonidos, persistencia high-score/localStorage, pausa, UI extra.

## Data model

```js
// src/js/maze.js
const MAZE_STR = [
  '############################',
  '#o...........##............o#', // y=1 con pellets en (1,1)?? usar (1,3) real: fila 3
  // ... pellets en (1,3), (26,3), (1,23), (26,23) con 'o'
];
function parseTile(ch){
  if(ch==='#') return 1;
  if(ch==='.') return 2;
  if(ch==='-') return 3;
  if(ch==='o') return 4; // power pellet
  return 0;
}
const POWER_PELLET = 4;

// src/js/game.js
const POWER_PELLET = 4;
const FRIGHTENED_DURATION = 360; // frames
const GHOST_FRIGHTENED_SPEED = 0.05;
const GHOST_FRIGHTENED_COLOR = '#0000ff';
const POWER_PELLET_SCORE = 50;
const GHOST_EATEN_SCORE = 200;

function createGame(){
  return {
    state:'start', score:0, lives:3, dotsRemaining: dots+powerPellets,
    frightenedTimer:0,
    grid: MAZE.map(r=>r.slice()),
    pacman:{x,y,dir,nextDir,speed:PACMAN_SPEED},
    ghosts: GHOST_STARTS.map(g=>({x:g.x,y:g.y,dir:'up',speed:GHOST_SPEEDS[g.kind],kind:g.kind,isFrightened:false}))
  };
}
// ghosts: {x,y,dir,speed,kind,isFrightened}[]

// src/js/render.js
// grid===4 -> pellet grande radio 6
// drawGhost usa GHOST_FRIGHTENED_COLOR si g.isFrightened else GHOST_COLOR_BY_KIND[g.kind]
```

Convenciones:

- `aligned(v)` igual que SPEC 02 (`<1e-3` con pasos `0.125/0.10/0.05`).
- `frightenedTimer` se decrementa al inicio de `update()` si `>0`; `isFrightened = frightenedTimer>0`.
- Colisión `collides <0.5` igual que antes.

> Esta feature introduce `POWER_PELLET`, `FRIGHTENED_DURATION`, `frightenedTimer` y `isFrightened`; reutiliza `GHOST_STARTS`, `GHOST_SPEEDS`, `MAZE`.

## Implementation plan

1. Editar `src/js/maze.js:8-40` `MAZE_STR` — colocar `o` en 4 esquinas `(1,3) (26,3) (1,23) (26,23)` verificando `MAZE_STR[y][x]` era `'.'` y ahora `'o'`; ampliar `parseTile` para `'o'=>4`. Verificación: `MAZE[3][1]===4` en consola, `src/index.html` sin errores, 4 pellets visibles aún sin lógica.
2. Añadir constantes en `src/js/game.js:13-20` `POWER_PELLET=4`, `FRIGHTENED_DURATION=360`, `GHOST_FRIGHTENED_SPEED=0.05`, scores `50/200`. Verificación: `createGame()` expone `frightenedTimer===0`.
3. Extender `createGame()` en `src/js/game.js:24-52` para contar `powerPellets` en `dotsRemaining` (opcional) y añadir `frightenedTimer`, `frightenedEatenCount`, y `ghosts[].isFrightened`. Verificación: `createGame().ghosts.every(g=>!g.isFrightened)`.
4. Modificar `movePacman()` en `src/js/game.js:89-117` para detectar `grid[y][x]===4`: `grid[y][x]=0; score+=50; frightenedTimer=FRIGHTENED_DURATION; frightenedEatenCount=0;` además de `2=>10`. Verificación: mover PacMan a `(1,3)` come pellet, `score+50` y `frightenedTimer===360`.
5. Modificar `moveGhost()`/`decideGhost()` en `src/js/game.js:135-195` — si `game.frightenedTimer>0` entonces `g.isFrightened=true; g.speed=GHOST_FRIGHTENED_SPEED; g.dir = random choices` (no `chooseHunterDir`), si no `isFrightened=false; g.speed=GHOST_SPEEDS[kind]`. Verificación: activar pellet y observar que los 4 eligen aleatorio y se ralentizan a 0.05.
6. Reescribir colisión en `update()` `src/js/game.js:214-231` — iterar `ghosts`: si `collides` y `frightenedTimer>0` → `score+=200; g.x=GHOST_STARTS[i].x; g.y=GHOST_STARTS[i].y; g.dir='up'` (respawn instant, no `resetPositions()` global); si no → `lives--; resetPositions()` como antes. Decrementar `frightenedTimer--` cada frame. Verificación: en frightened tocar fantasma suma 200 y respawnea en `y=11`, sin frightened resta vida.
7. Editar `src/js/render.js:69-80` `drawDots()` y `drawGhost()` — dibujar `grid===4` con `arc(...,6)` y en `draw()` pasar `g.isFrightened ? GHOST_FRIGHTENED_COLOR : GHOST_COLOR_BY_KIND[g.kind]`. Verificación: pellets grandes visibles, fantasmas azules `#0000ff` durante 360 frames, luego vuelven a colores por kind.
8. Verificación integral manual — `npx serve src`, sin errores consola, `aligned()` cada 8/10/20 frames (0.05 alinea cada 20), `wrapTunnel` fila 14, `+10`/dot, `+50`/pellet, `+200`/fantasma azul, `won`/`lost` sin regresión, `MAZE` pristino tras comer pellets (`MAZE` conserva `4`, `grid` pone `0`).

## Acceptance criteria

- [ ] Al cargar `src/index.html` se ven 4 power pellets grandes (radio 6) en `(1,3) (26,3) (1,23) (26,23)` además de dots pequeños.
- [ ] `MAZE[3][1]===4` y `parseTile('o')===4`; `isWall` trata `4` como transitable para `pacman` y `ghost`.
- [ ] Comer power pellet (`grid 4`) pone `grid[y][x]=0`, suma `+50` a `score` y pone `game.frightenedTimer=360` (reinicia si ya estaba activo).
- [ ] Durante `frightenedTimer>0` los 4 fantasmas tienen `isFrightened=true`, `speed=0.05`, color `#0000ff` y eligen dirección aleatoria no-reversa en cada intersección `aligned()` (no persiguen).
- [ ] En frightened, colisión PacMan-fantasma suma `+200`, respawnea ese fantasma instantáneamente en su `GHOST_STARTS` (`y=11`) con `dir up`, no resta `lives` ni llama `resetPositions()` global.
- [ ] Sin frightened, colisión resta `lives` y `resetPositions()` recoloca a los 4 en `y=11` como SPEC 02.
- [ ] `frightenedTimer` decrementa 1 por `update()` y al llegar a 0 los fantasmas recuperan `speed=GHOST_SPEEDS[kind]` y colores por `kind`.
- [ ] `dotsRemaining` incluye dots+power pellets (o pellets separados) y `won` solo cuando `dotsRemaining===0` tras comer todo.
- [ ] No hay errores consola, `requestAnimationFrame` fluido, `wrapTunnel` solo fila 14, `MAZE` no mutado.
- [ ] `draw(ctx,game,frame)` lee `game.grid` (no `MAZE`) para dots/pellets y ghosts.

## Decisions

- **Sí:** 4 pellets esquinas clásicas — fiel arcade, balance probado; alternativa 2 o 6 descartada por desbalance.
- **Sí:** `FRIGHTENED_DURATION=360` (6s) — compromiso entre impacto y riesgo; 3s corto, 10s rompe dificultad.
- **Sí:** `Azul #0000ff + 0.05 + aleatorio` — simple, determinista, evita `chooseHunterDir`; alternativa reversa inmediata descartada por complejidad.
- **Sí:** `+200` fijo — minimal viable, evita contador progresivo `200/400/800/1600`; se puede escalar en futuro spec sin cambiar interfaz.
- **Sí:** Respawn instant en `GHOST_STARTS` — mínimo código, sin estado `eyes`; alternativa timer ojos descartada (otro spec si se quiere fidelidad).
- **Sí:** `+50` por pellet y reinicia timer — coherente con `+10`/dot y permite encadenar pellets; no reiniciar descartado porque penaliza al jugador.
- **Sí:** Pellet valor `4` — extensión natural de `1/2/3`; no reutilizar `2` para distinguir render y scoring.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Power pellet en muro si `MAZE_STR` cambia | Validar `MAZE[y][x]===4` solo en celdas `'.'` originales; test `MAZE[3][1]!==1` en `createGame()` |
| `0.05` desalineado si `aligned()` cambia tolerancia | `0.05=1/20` alinea cada 20 frames con `<1e-3`; documentado en convenciones |
| Fantasmas azules indistinguibles si todos respawnean juntos | Respawn instant mantiene distribución `11,13,14,16`; si se solapan, ajustar x a `12,15` como en SPEC 02 |
| `frightenedTimer` no decrementa en `state start` | Decrementar solo si `state==='playing'`; si `start` no corre `update()` |
| `MAZE` mutado al comer pellets | Mantener `MAZE.map(r=>r.slice())` en `createGame()` y asignar solo `grid[y][x]=0` |

## What is **not** in this spec

- Progresión de puntos por fantasma (200/400/800/1600) o contador `eatenCount` incremental.
- Parpadeo de fantasmas/pellets últimos frames.
- Estado ojos y viaje a casa temporizado (120 frames).
- Fruta, niveles, reinicio de laberinto, scatter/chase global, BFS/A*.
- Sonidos, vibración, persistencia high-score, pausa.
- Cambios a `TILE`, `PACMAN_SPEED`, `DIRS`/`OPPOSITE` o a `main.js` salvo lo imprescindible.

> Cada uno de esos, si llega, va en su propio spec.
