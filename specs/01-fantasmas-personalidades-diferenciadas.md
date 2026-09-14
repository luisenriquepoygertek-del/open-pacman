# SPEC 01 — Fantasmas con personalidades diferenciadas

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-09-11
> **Objective:** Dotar al juego de 4 fantasmas con personalidades distintas —uno cazador agresivo que persigue a PacMan— cada uno con color y velocidad propios y salida libre desde la casa.

## Scope

**In:**

- Ampliar de 2 a 4 fantasmas, cada uno con `kind` distinto y comportamiento propio en `decideGhost`.
- Hunter (`blinky`/`hunter`) agresivo: en cada intersección elige la dirección no-reversa que minimiza distancia Manhattan a PacMan (lógica actual, mantenida).
- Ambush (`pinky`): target = PacMan + 4 celdas en dirección de PacMan, con bug original si `dir === 'up'` entonces target = PacMan + 4 arriba + 4 izquierda; el hunter luego minimiza Manhattan hacia ese target.
- Unpredictable (`inky` simplificado): en cada intersección 50% persigue como hunter hacia PacMan y 50% elige aleatorio entre opciones no-reversa.
- Patrol (`clyde`): si distancia Manhattan a PacMan < 8, target = esquina inferior-izquierda `(1,30)` (celda transitable más cercana a `(0,30)`); si >= 8 persigue como hunter.
- Posiciones iniciales mixtas: 2 dentro de la pen + 2 fuera en pasillo; salida libre por puerta `3` desde frame 0 sin timers.
- Velocidades diferenciadas por `kind` (`hunter 0.11`, `pinky 0.10`, `inky 0.10`, `clyde 0.09` celdas/frame; PacMan sigue `0.125`).
- Colores fijos por `kind` en `render.js` (`rojo #ff0000 hunter`, `rosa #ffb8ff pinky`, `cian #00ffff inky`, `naranja #ffb852 clyde`).
- Respetar `aligned()`, `canMove`/`isWall`, `wrapTunnel` solo en `TUNNEL_ROW=14`, y no mutar `MAZE` (copia por `MAZE.map(r=>r.slice())`).

**Out of scope (para futuros specs):**

- Modo frightened / fantasmas comestibles y `power pellets`.
- Timers scatter/chase globales y modo `scatter` temporizado (cada fantasma decide por su regla en cada intersección).
- Salida escalonada de la casa por tiempo o por dots comidos.
- BFS / A* para hunter (se mantiene Manhattan).
- Persistencia, scoring extra por comer fantasmas, niveles, sonidos o animaciones nuevas.
- Cambios a `MAZE_STR`/geometría del laberinto.

## Data model

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter' },  // dentro pen — rojo, agresivo
  { x: 14, y: 14, kind: 'pinky'  },  // dentro pen — rosa, emboscada
  { x: 11, y: 11, kind: 'inky'   },  // fuera pen, pasillo izq
  { x: 16, y: 11, kind: 'clyde'  },  // fuera pen, pasillo der
];
// kind: 'hunter' | 'pinky' | 'inky' | 'clyde'

// src/js/game.js — ghost extendido
// ghosts: { x, y, dir, speed, kind }[]
// speed proviene de GHOST_SPEEDS[kind] en createGame()

const GHOST_SPEEDS = {
  hunter: 0.11,
  pinky:  0.10,
  inky:   0.10,
  clyde:  0.09,
};

// src/js/render.js — color por kind (no por índice)
const GHOST_COLOR_BY_KIND = {
  hunter: '#ff0000',
  pinky:  '#ffb8ff',
  inky:   '#00ffff',
  clyde:  '#ffb852',
};
```

Convenciones:

- Coordenadas celda `(x,y)` origen arriba-izquierda, `TILE=20`, `TUNNEL_ROW=14`.
- Decisión de dirección solo si `aligned(g.x) && aligned(g.y)`; se redondea a entero antes de evaluar.
- Regla base: no revertir (`OPPOSITE`) salvo callejón sin otra opción.
- Wrap túnel solo si `Math.round(y) === TUNNEL_ROW`.

> Esta feature introduce nuevas estructuras (`GHOST_STARTS` ampliado, `GHOST_SPEEDS`, `GHOST_COLOR_BY_KIND`) y amplía `decideGhost`. Reusa `DIRS`, `OPPOSITE`, `TUNNEL_ROW`, `PACMAN_START`.

## Implementation plan

1. Ampliar `GHOST_STARTS` en `src/js/maze.js` a 4 entradas con posiciones mixtas y `kind` (`hunter`, `pinky`, `inky`, `clyde`). Verificación: `createGame().ghosts.length === 4` en consola, sin errores al cargar `src/index.html`.
2. Añadir `GHOST_SPEEDS` en `src/js/game.js` y asignar `speed: GHOST_SPEEDS[g.kind]` en `createGame()` al mapear `GHOST_STARTS`. Verificación: cada `ghost.speed` refleja su `kind` (`hunter 0.11`, `clyde 0.09`).
3. Extraer helper `chooseHunterDir(game, g, targetX, targetY, choices)` que minimiza `|nx-targetX|+|ny-targetY|` entre `choices` (lógica actual de hunter generalizada). Refactorizar `decideGhost` para que `hunter` llame a este helper con `target = PacMan`. Verificación: hunter sigue persiguiendo como antes con 4 fantasmas en pantalla.
4. Implementar `pinky` en `decideGhost`: calcular `target` = `pacman + 4*DIRS[pacman.dir]` y si `pacman.dir === 'up'` entonces `target.x -= 4` (bug arcade); luego delegar a `chooseHunterDir` hacia `target`. Verificación: colocar PacMan mirando arriba en pasillo central y observar que pinky se dirige 4+4 a la izq del target esperado.
5. Implementar `inky` simplificado en `decideGhost`: `Math.random() < 0.5 ? chooseHunterDir(hacia PacMan) : aleatorio entre choices`. Verificación: en 10 intersecciones el inky alterna visiblemente entre perseguir y girar aleatorio.
6. Implementar `clyde` en `decideGhost`: si `manhattan(g, pacman) < 8` entonces target `(1,30)` (esquina transitable) vía `chooseHunterDir`, si no perseguir como hunter. Verificación: acercar PacMan a <8 celdas de clyde y ver que se aleja hacia esquina inferior-izquierda; alejarse y ver que vuelve a perseguir.
7. Actualizar `src/js/render.js`: reemplazar `GHOST_COLORS[i]` por `GHOST_COLOR_BY_KIND[g.kind]` en `draw()`; mantener fallback `'#ff0000'`. Verificación: 4 fantasmas con 4 colores fijos distinguibles (rojo, rosa, cian, naranja) desde el primer frame.
8. Verificación integral manual: abrir `src/index.html` sin errores de consola, `wrapTunnel` en fila 14 para los 4, `+10`/dot, colisión resta `lives`, `dotsRemaining===0 -> won`, `lives===0 -> lost`, `resetPositions` recoloca a los 4 en sus `GHOST_STARTS`.

## Acceptance criteria

- [ ] Al cargar `src/index.html` se ven 4 fantasmas simultáneamente con 4 colores fijos: rojo hunter, rosa pinky, cian inky, naranja clyde.
- [ ] `createGame().ghosts` tiene longitud 4 y cada uno tiene `kind` en `{'hunter','pinky','inky','clyde'}` y `speed` según `GHOST_SPEEDS` (`hunter 0.11`, `clyde 0.09`).
- [ ] Hunter en cada intersección (aligned) elige entre direcciones no-reversa la que minimiza Manhattan a PacMan; nunca invierte salvo callejón.
- [ ] Pinky en cada intersección persigue `target = PacMan + 4*dir`, y si `pacman.dir === 'up'` entonces `target = target + (-4, -4)` (bug arcade) — verificable colocando PacMan en `(13,15)` mirando arriba y observando dirección elegida hacia `(9,11)`.
- [ ] Inky en cada intersección elige aleatoriamente con ~50% hunter (hacia PacMan) y ~50% aleatorio puro (no-reversa) — verificable por inspección de código y por comportamiento no determinista entre recargas.
- [ ] Clyde a distancia Manhattan < 8 de PacMan persigue `(1,30)` y a >= 8 persigue a PacMan como hunter — verificable acercando/alejando PacMan en modo `start`/`playing`.
- [ ] Los 4 fantasmas pueden cruzar celda puerta `3` y salir de la pen desde frame 0 sin bloquearse; PacMan sigue bloqueado por `3`.
- [ ] Movimiento y giros solo si `aligned()`; `wrapTunnel` funciona para los 4 en `TUNNEL_ROW=14`; no se muta `MAZE` (tras comer dots `MAZE` sigue con `2` y `game.grid` con `0`).
- [ ] Colisión `collides <0.5` resta 1 vida y recoloca a los 4 en sus `GHOST_STARTS`; `dotsRemaining===0 -> state won`, `lives===0 -> state lost`.
- [ ] `draw(ctx,game,frame)` no lee `MAZE` sino `game.grid`; HUD y muros se dibujan sin regresión.
- [ ] No hay errores en consola y el loop `requestAnimationFrame` mantiene 60fps aproximados sin tirones atribuibles a la nueva lógica (Manhattan O(1) por fantasma).

## Decisions

- **Sí:** 4 personalidades clásicas simplificadas (hunter/pinky/inky/clyde) — cubre "cada uno propio + uno agresivo" y es reconocible para el jugador.
- **No:** BFS/A* para hunter — Manhattan es O(1), suficiente y ya implementado; BFS añadiría coste y dificultad excesiva.
- **Sí:** `pinky` con bug arcade `up = up+left` — fidelidad al original, decisión explícita del usuario; alternativa descartada "4 exactas sin bug".
- **No:** `inky` fiel con vector `2*(PacMan+2*dir)-Blinky` — acopla fantasmas y es difícil de testear; se eligió 50/50 aleatorio por simplicidad y variedad (recomendado).
- **Sí:** `clyde` con umbral 8 hacia `(1,30)` — simple, determinista, evita patrulla horaria que ignora a PacMan.
- **No:** Patrulla horaria fija — descartada porque no interactúa con PacMan.
- **Sí:** Inicio mixto 2 dentro + 2 fuera — da acción inmediata sin esperar salida de casa; 4 dentro sería cuello de botella.
- **No:** Salida escalonada por timer/dots — descartada por usuario; salida libre desde frame 0.
- **Sí:** Velocidades diferenciadas `hunter 0.11 > pinky/inky 0.10 > clyde 0.09` — hunter más amenazante sin romper balance; `0.125` de PacMan sigue siendo mayor.
- **No:** Misma velocidad para todos — descartada, no transmite personalidad.
- **Sí:** Colores fijos por `kind` en `render.js` — coherencia visual y accesibilidad básica (cada kind siempre mismo color).
- **No:** Colores por índice o aleatorios — rompería identidad.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Pinky target cae fuera del laberinto o en muro y hunter elige dirección inesperada | `chooseHunterDir` minimiza Manhattan aunque el target sea inalcanzable; no se hace clamp, el fantasma se aproxima lo más posible — comportamiento aceptado y fiel. |
| Inky 50/50 puede parecer totalmente aleatorio en partidas cortas | Documentado como simplificación intencional; si se percibe poco distinto, ajustar semilla o ratio en futuro spec sin cambiar interfaz. |
| Clyde atrapado rebotando entre esquina y pared si `(1,30)` es muro en variantes futuras de `MAZE` | Se usa `(1,30)` transitable verificada en `MAZE_STR` fila 29; si `MAZE` cambia, elegir celda transitable más cercana a `(0,30)`. |
| 4 fantasmas aumentan colisiones y dificultad percibida (más vidas perdidas) | Velocidades diferenciadas y salida libre compensan; si resulta muy difícil, futuro spec puede ajustar `GHOST_SPEEDS` o añadir delay de salida sin tocar este spec. |
| `MAZE` mutado por accidente al ampliar `GHOST_STARTS` | Mantener copia `MAZE.map(r=>r.slice())` en `createGame`; no leer/escribir `MAZE` fuera de `maze.js`. |

## What is **not** in this spec

- Modo frightened / fantasmas comestibles, `power pellets` o puntuación por comer fantasmas.
- Sistema global scatter/chase temporizado.
- Salida de casa con retardo, por dots o por nivel.
- Pathfinding BFS/A* o cualquier algoritmo distinto de Manhattan/aleatorio.
- Cambios a `MAZE_STR`, `TILE`, `PACMAN_SPEED`, `DIRS`/`OPPOSITE` o persistencia entre sesiones.
- Sonidos, animaciones nuevas o UI adicional.
