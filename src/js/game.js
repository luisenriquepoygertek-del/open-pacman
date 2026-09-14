// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // fallback 1/10 celda/frame
const GHOST_SPEEDS = {
  hunter: 0.125,
  pinky:  0.10,
  inky:   0.10,
  clyde:  0.10,
};
const POWER_PELLET = 4;
const FRIGHTENED_DURATION = 360; // 6s a 60fps
const GHOST_FRIGHTENED_SPEED = 0.05; // 1/20 alinea cada 20
const GHOST_FRIGHTENED_COLOR = '#0000ff';
const POWER_PELLET_SCORE = 50;
const GHOST_EATEN_SCORE = 200;
window.POWER_PELLET = POWER_PELLET;
window.FRIGHTENED_DURATION = FRIGHTENED_DURATION;
window.GHOST_FRIGHTENED_SPEED = GHOST_FRIGHTENED_SPEED;
window.GHOST_FRIGHTENED_COLOR = GHOST_FRIGHTENED_COLOR;

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === POWER_PELLET ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightenedTimer: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEEDS[ g.kind ] ?? GHOST_SPEED,
      kind: g.kind,
      isFrightened: false,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Reversa inmediata 180° incluso entre celdas (fidelidad arcade).
  // Evita quedarse bloqueado contra pared si el jugador pulsa atrás a mitad de celda.
  if ( p.nextDir && OPPOSITE[ p.dir ] === p.nextDir ) {
    const rx = Math.round( p.x );
    const ry = Math.round( p.y );
    if ( canMove( grid, rx, ry, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
  }

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( grid[ p.y ][ p.x ] === POWER_PELLET ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_SCORE;
      game.dotsRemaining--;
      game.frightenedTimer = FRIGHTENED_DURATION;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function chooseHunterDir( g, targetX, targetY, choices ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - targetX ) + Math.abs( ny - targetY );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Frightened: huida aleatoria, ignora personalidad
  if ( game.frightenedTimer > 0 ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  if ( g.kind === 'hunter' ) {
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    g.dir = chooseHunterDir( g, px, py, choices );
  } else if ( g.kind === 'pinky' ) {
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    let tx = Math.round( p.x ) + d.x * 4;
    let ty = Math.round( p.y ) + d.y * 4;
    // Bug arcade: mirando arriba se desplaza 4 a la izquierda además.
    if ( p.dir === 'up' ) tx -= 4;
    g.dir = chooseHunterDir( g, tx, ty, choices );
  } else if ( g.kind === 'inky' ) {
    if ( Math.random() < 0.5 ) {
      const px = Math.round( p.x );
      const py = Math.round( p.y );
      g.dir = chooseHunterDir( g, px, py, choices );
    } else {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    }
  } else if ( g.kind === 'clyde' ) {
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    const gx = Math.round( g.x );
    const gy = Math.round( g.y );
    const dist = Math.abs( gx - px ) + Math.abs( gy - py );
    if ( dist < 8 ) {
      g.dir = chooseHunterDir( g, 1, 30, choices );
    } else {
      g.dir = chooseHunterDir( g, px, py, choices );
    }
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Actualizar estado frightened cada frame
  if ( game.frightenedTimer > 0 ) {
    g.isFrightened = true;
    g.speed = GHOST_FRIGHTENED_SPEED;
  } else {
    g.isFrightened = false;
    g.speed = GHOST_SPEEDS[ g.kind ] ?? GHOST_SPEED;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frightenedTimer = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.isFrightened = false;
    g.speed = GHOST_SPEEDS[ g.kind ] ?? GHOST_SPEED;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  if ( game.frightenedTimer > 0 ) game.frightenedTimer--;

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( let i = 0; i < game.ghosts.length; i++ ) {
    const g = game.ghosts[ i ];
    if ( collides( game.pacman, g ) ) {
      if ( game.frightenedTimer > 0 ) {
        game.score += GHOST_EATEN_SCORE;
        g.x = GHOST_STARTS[ i ].x;
        g.y = GHOST_STARTS[ i ].y;
        g.dir = 'up';
        g.isFrightened = true;
      } else {
        game.lives--;
        if ( game.lives <= 0 ) {
          game.state = 'lost';
          return;
        }
        resetPositions( game );
        break;
      }
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
