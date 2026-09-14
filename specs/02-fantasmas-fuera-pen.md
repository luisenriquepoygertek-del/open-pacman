# SPEC 02 — Fantasmas fuera del pen (corrección salida)

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-14
> **Objective:** Reubicar los 2 fantasmas que arrancan dentro del pen a celdas transitables del mapa y normalizar sus velocidades para que alineen y nunca queden atrapados al iniciar el movimiento.

## Scope

**In:**

- Cambiar `GHOST_STARTS` en `src/js/maze.js` para que los 4 fantasmas arranquen fuera del pen en celdas transitables del mapa (ninguno en `y=13-15, x=11-16` interior).
- Normalizar `GHOST_SPEEDS` en `src/js/game.js` a valores divisores de `1` (alineables con `aligned()`) para que `hunter` y `clyde` giren en intersecciones desde el primer movimiento.
- Mantener distribución por `kind` (`hunter`, `pinky`, `inky`, `clyde`), colores por `GHOST_COLOR_BY_KIND` en `src/js/render.js` y lógica de `decideGhost`/`chooseHunterDir` sin cambios (dependencia SPEC 01 intacta).
- Garantizar que `resetPositions()` recoloca a los 4 en las nuevas `GHOST_STARTS`.
- Respetar `MAZE` pristino (`MAZE.map(r=>r.slice())`), `TILE=20`, `TUNNEL_ROW=14`, `isWall`/`canMove`/`wrapTunnel` y orden de carga `maze.js -> game.js -> render.js -> main.js`.

**Out of scope (para futuros specs):**

- Animación de salida escalonada o por timer/dots desde dentro del pen (Opción 2 descartada en esta iteración).
- Lógica forzada `isInsidePen -> dir up` hacia la puerta `3`.
- Pathfinding BFS/A*, modo frightened / power pellets, scatter/chase temporizado.
- Cambios a `MAZE_STR`/geometría, `TILE`, `PACMAN_SPEED`, `DIRS`/`OPPOSITE`, persistencia, sonidos o UI nueva.

## Data model

```js
// src/js/maze.js — nuevas posiciones iniciales (todas fuera del pen, verificadas transitables)
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'hunter' }, // encima de la puerta, pasillo superior
  { x: 14, y: 11, kind: 'pinky' },  // adyacente a hunter
  { x: 11, y: 11, kind: 'inky' },   // pasillo izq (ya fuera)
  { x: 16, y: 11, kind: 'clyde' },  // pasillo der (ya fuera)
];
// Alternativa válida si se quiere más separación: hunter (12,11), pinky (15,11)
// Coordenadas (x,y) origen arriba-izquierda; todas con MAZE[y][x] !== 1

// src/js/game.js — velocidades normalizadas (todas alineables con aligned() <1e-3)
const GHOST_SPEEDS = {
  hunter: 0.125, // 1/8 celda/frame = alinea cada 8 frames, igual que PacMan
  pinky:  0.10,  // 1/10 celda/frame = alinea cada 10 frames
  inky:   0.10,
  clyde:  0.10,
};
// fallback GHOST_SPEED = 0.1; PACMAN_SPEED = 0.125 se mantiene

// src/js/game.js — ghost mantiene forma
// ghosts: { x, y, dir, speed, kind }[]  speed = GHOST_SPEEDS[kind]
```

Convenciones:

- `aligned(v) = Math.abs(v - Math.round(v)) < 1e-3` solo si `v` avanza en pasos divisores de `1`.
- Decisión solo si `aligned(g.x) && aligned(g.y)`; se redondea a entero antes de evaluar.
- `wrapTunnel` solo si `Math.round(y) === TUNNEL_ROW`.

> Esta feature no introduce nuevas estructuras; reutiliza `GHOST_STARTS`, `GHOST_SPEEDS` y `GHOST_COLOR_BY_KIND` de SPEC 01 con valores corregidos.

## Implementation plan

1. Editar `src/js/maze.js:54-59` — Reemplazar `GHOST_STARTS` con las 4 posiciones `y=11` (`13,11 / 14,11 / 11,11 / 16,11`). Verificación: `createGame().ghosts` longitud 4, cada `MAZE[y][x] !==1` en consola, `src/index.html` sin errores.
2. Editar `src/js/game.js:15-20` — Cambiar `GHOST_SPEEDS` a `hunter 0.125, pinky 0.10, inky 0.10, clyde 0.10`. Verificación: `createGame().ghosts.forEach(g=>log g.kind,g.speed)` muestra valores nuevos y todos alineables (hunter 0.125, resto 0.10).
3. Verificar `src/js/game.js:197-208` `resetPositions()` — Confirmar que recoloca a las nuevas `GHOST_STARTS` con `dir='up'`. Verificación: provocar colisión (`collides <0.5` resta `lives`) y observar que los 4 reaparecen en `y=11`.
4. Verificación visual `src/js/render.js:101-169` — Abrir `src/index.html`, frame 0 ya se ven 4 fantasmas con colores `GHOST_COLOR_BY_KIND` fuera del pen, ninguno dentro de paredes `x=10,17` o puerta `3`. Verificación: captura inicial y tras 2 segundos todos se han desplazado <1s.
5. Verificación integral manual — `npx serve src` o `python -m http.server --directory src`, sin errores consola, `aligned()` dispara cada 8/10 frames, `canMove`/`isWall` y `wrapTunnel` en `TUNNEL_ROW=14` sin regresión, `+10`/dot, `dotsRemaining===0 -> won`, `lives===0 -> lost`, `game.grid` copia no muta `MAZE`.

## Acceptance criteria

- [ ] Al cargar `src/index.html` se ven 4 fantasmas simultáneamente fuera del pen en `y=11` (`x=11,13,14,16`) con colores fijos `hunter #ff0000`, `pinky #ffb8ff`, `inky #00ffff`, `clyde #ffb852`.
- [ ] `createGame().ghosts` longitud 4; ninguno con `y in [13,15] && x in [11,16]` ni en puerta `y=12, x=13-14` en estado `start`.
- [ ] `GHOST_SPEEDS` en `src/js/game.js` son todos divisores de `1` (`0.125` o `0.10`); `hunter` ya no es `0.11` ni `clyde` `0.09`.
- [ ] Cada fantasma al moverse alinea cada 8 o 10 frames y cambia de dirección en intersecciones desde el primer pasillo (no requiere 100 frames).
- [ ] Ningún fantasma queda atrapado, inmóvil o atravesando muros `1` al iniciar `state: playing`; todos abandonan su celda inicial en <1 segundo.
- [ ] `resetPositions()` tras colisión recoloca a los 4 en las nuevas `GHOST_STARTS` (`y=11`).
- [ ] `isWall`/`canMove` siguen bloqueando `1` para ghost y `1`+`3` para pacman; `wrapTunnel` solo en `TUNNEL_ROW=14`.
- [ ] `MAZE` pristino no mutado tras comer dots (`MAZE` conserva `2`, `game.grid` pone `0`).
- [ ] No hay errores en consola y `requestAnimationFrame` mantiene movimiento fluido sin tirones.
- [ ] `draw(ctx,game,frame)` sigue leyendo `game.grid` y HUD/muros sin regresión.

## Decisions

- **Sí:** Opción 1 — mover starts fuera del pen (`y=11, x=11,13,14,16`) — es lo pedido explícitamente ("ponerlos en el mapa"). Mínimo cambio, 1 línea en `maze.js` + 1 en `game.js`. Confirmado en Fase 2.
- **No:** Opción 2 — mantener dentro y forzar `dir up` con `isInsidePen` — descartada por usuario; quedaría para futuro spec si se quiere animación fiel de salida escalonada.
- **Sí:** Normalizar velocidades a `0.125`/`0.10` — corrige `aligned()` para `hunter`/`clyde` sin reescribir `aligned()`. Alternativa parchear `aligned()` a `v*100` se descartó por añadir complejidad. Confirmado.
- **No:** Mantener `hunter 0.11` / `clyde 0.09` — descartado porque no alinean y causan el atrapamiento reportado.
- **Sí:** Posiciones `y=11, x=11-16` — fila superior del pen es `..........` transitable verificada en `MAZE_STR` fila 11; adyacente a puerta pero fuera, garantiza movimiento inmediato.
- **No:** Reubicar en túnel `y=14, x<10` — descartado porque activaría `wrapTunnel` y dificultaría visualización.
- **Sí:** Mantener `inky`/`clyde` en `11,11`/`16,11` si ya estaban fuera — minimiza diff y respeta SPEC 01.
- **No:** Cambiar `MAZE_STR` o `TILE` — fuera de scope, rompería simetría.
- **Sí:** Verificación visual + consola — recomendada por usuario para validar `MAZE[y][x]`, velocidades y `resetPositions`.
- **Sí:** Mantener `decideGhost`/`chooseHunterDir`/`GHOST_COLOR_BY_KIND` intactos — dependencia SPEC 01 confirmada; personalidades no se tocan.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Nueva `GHOST_STARTS` cae en muro si `MAZE_STR` cambia en futuro | Validar `MAZE[y][x] !==1` en `createGame()` con assert en consola; elegir siempre `y=11` que es pasillo `..........` estable. |
| Velocidades iguales hacen fantasmas indistinguibles en agresividad | Se mantiene `hunter 0.125 > 0.10` levemente más rápido; si se percibe poco, ajustar en futuro spec sin tocar posiciones. |
| `resetPositions` desincronizado si `GHOST_STARTS` y `ghosts` desalineados por índice | `resetPositions` itera por índice `GHOST_STARTS[i]`; mantener orden `hunter,pinky,inky,clyde` consistente entre `maze.js` y `game.js`. |
| Regresión visual: 4 fantasmas solapados en `y=11` parecen uno | Separación mínima 1 celda (`11,13,14,16`); si se observa solape, cambiar a `11,12,15,16`. |

## What is **not** in this spec

- Salida del pen animada, timers, o lógica `isInsidePen` forzando `up` hacia puerta `3`.
- BFS/A*, modo frightened, power pellets, scoring extra por comer fantasmas.
- Scatter/chase global, niveles, persistencia, sonidos o animaciones nuevas.
- Cambios a `MAZE_STR`, `TILE`, `PACMAN_SPEED`, `DIRS`/`OPPOSITE` o a `render.js`/`main.js` salvo lo imprescindible.

> Cada uno de esos, si llega, va en su propio spec.
