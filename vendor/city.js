/* SPDX-License-Identifier: MIT
   CyberCity — original text-world walker.
   idea after @miguelcarino (miguelcarino/cybercity); clean-room implementation, no code copied. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const CW = 8;
  const CH = 12;
  const FOV = 0.66;
  const EYE = 0.52;
  const FOCAL = 0.7;

  function rgb(r, g, b) {
    return (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
  }
  function mix(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const s = 1 - t;
    const r = ((a & 255) * s + (b & 255) * t) | 0;
    const g = (((a >> 8) & 255) * s + ((b >> 8) & 255) * t) | 0;
    const bl = (((a >> 16) & 255) * s + ((b >> 16) & 255) * t) | 0;
    return (255 << 24) | (bl << 16) | (g << 8) | r;
  }
  function scale(a, k) {
    if (k < 0) k = 0;
    const r = Math.min(255, (a & 255) * k) | 0;
    const g = Math.min(255, ((a >> 8) & 255) * k) | 0;
    const b = Math.min(255, ((a >> 16) & 255) * k) | 0;
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(x, y) {
    let n = (x | 0) * 374761393 + (y | 0) * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function angDiff(a, b) {
    let d = a - b;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return d;
  }
  function blank(w, h, fill) {
    const g = [];
    for (let y = 0; y < h; y++) {
      const row = new Array(w);
      for (let x = 0; x < w; x++) row[x] = fill;
      g.push(row);
    }
    return g;
  }
  function set2(g, x, y, c) {
    if (y + 1 >= g.length || x + 1 >= g[0].length) return;
    g[y][x] = c;
    g[y][x + 1] = c;
    g[y + 1][x] = c;
    g[y + 1][x + 1] = c;
  }

  const BLOCK = { "#": 1, "=": 1, "+": 1, "^": 1, T: 1, Y: 1, L: 1, B: 1, "~": 1 };
  const WALL = { "#": 1, "=": 1, "+": 1, "^": 1, T: 1, Y: 1, L: 1, B: 1 };

  function makeCity() {
    const W = 24, H = 22;
    const g = blank(W, H, "#");
    for (let y = 1; y < H - 1; y++) for (let x = 10; x <= 12; x++) g[y][x] = ".";
    for (const y of [5, 11, 16]) for (let x = 1; x < W - 1; x++) g[y][x] = ".";
    for (const y of [3, 8, 14, 19]) {
      for (let x = 2; x <= 8; x++) g[y][x] = ".";
      for (let x = 14; x <= 21; x++) g[y][x] = ".";
    }
    for (let y = 1; y <= 3; y++) for (let x = 8; x <= 15; x++) g[y][x] = ".";
    for (let y = 1; y < H - 1; y++) {
      if (g[y][9] === "#") g[y][9] = "=";
      if (g[y][13] === "#") g[y][13] = "=";
    }
    for (const x of [10, 11, 12]) { g[5][x] = "c"; g[16][x] = "c"; }
    g[11][19] = "G";
    g[11][20] = "G";
    g[19][11] = "S";
    return g;
  }

  function makeDust() {
    const W = 32, H = 28;
    const g = blank(W, H, "o");
    for (let y = 6; y <= 22; y++) for (let x = 15; x <= 17; x++) g[y][x] = ".";
    for (let y = 8; y <= 20; y++) {
      if (y % 5 === 0) continue;
      g[y][13] = "+";
      g[y][14] = "+";
      g[y][18] = "+";
      g[y][19] = "+";
    }
    g[10][14] = "B";
    for (let y = 8; y <= 20; y += 4) {
      if (g[y][11] === "o") g[y][11] = "T";
      if (g[y][21] === "o") g[y][21] = "T";
    }
    set2(g, 4, 6, "^");
    set2(g, 7, 18, "^");
    set2(g, 26, 8, "^");
    set2(g, 27, 20, "^");
    set2(g, 8, 24, "^");
    g[12][5] = "Y";
    g[14][28] = "Y";
    g[20][6] = "Y";
    g[9][29] = "Y";
    for (const x of [15, 16, 17]) g[12][x] = "c";
    for (let x = 18; x <= 27; x++) g[14][x] = "o";
    g[14][26] = "G";
    g[14][27] = "G";
    g[21][16] = "S";
    return g;
  }

  function makeMoon() {
    const W = 40, H = 40;
    const g = blank(W, H, ".");
    function ring(cx, cy, r) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (Math.abs(d - r) < 0.65) g[y][x] = "^";
        }
      }
      for (let y = cy; y <= cy + r + 1 && y < H; y++) {
        g[y][cx] = ".";
        if (cx + 1 < W) g[y][cx + 1] = ".";
      }
    }
    ring(18, 14, 6);
    ring(27, 22, 4);
    const rocks = [[8, 10], [10, 30], [33, 12], [32, 30], [14, 34], [6, 20], [36, 18]];
    for (let i = 0; i < rocks.length; i++) g[rocks[i][1]][rocks[i][0]] = "^";
    g[16][22] = "L";
    g[20][18] = "G";
    g[20][19] = "G";
    g[30][18] = "S";
    return g;
  }

  function makeKeep() {
    const W = 24, H = 20;
    const g = blank(W, H, "#");
    for (let y = 1; y < H - 1; y++) for (let x = 10; x <= 13; x++) g[y][x] = ".";
    for (const y of [4, 10, 15]) {
      for (let x = 2; x < W - 2; x++) if (g[y][x] === "#") g[y][x] = ".";
    }
    for (const y of [7, 8, 9]) {
      for (let x = 2; x < W - 2; x++) g[y][x] = "~";
      for (let x = 10; x <= 13; x++) g[y][x] = ".";
    }
    for (let y = 1; y < H - 1; y += 2) {
      if (g[y][9] === "#") g[y][9] = "+";
      if (g[y][14] === "#") g[y][14] = "+";
    }
    g[3][11] = "G";
    g[3][12] = "G";
    g[16][11] = "S";
    return g;
  }

  function adopt(grid) {
    const h = grid.length;
    const w = grid[0].length;
    let sx = 1.5, sy = 1.5, gates = 0, spawn = 0;
    for (let y = 0; y < h; y++) {
      if (grid[y].length !== w) throw new Error("ragged map");
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === "S") {
          sx = x + 0.5;
          sy = y + 0.5;
          grid[y][x] = ".";
          spawn++;
        } else if (grid[y][x] === "G") gates++;
      }
    }
    if (spawn !== 1) throw new Error("spawn count " + spawn);
    if (gates < 1) throw new Error("no gate");
    return { grid: grid, sx: sx, sy: sy, gates: gates };
  }

  function makeWorld(id, name, grid, extra) {
    const m = adopt(grid);
    const w = {
      id: id,
      name: name,
      grid: m.grid,
      sx: m.sx,
      sy: m.sy,
      gates: m.gates,
      face: -Math.PI / 2,
      horizon: 0.36,
      weather: "rain",
      outside: ".",
      earth: false,
      earthAz: -Math.PI / 2,
      lampCount: 4,
      actors: ["person"],
      sky: { topN: rgb(0, 0, 0), horN: rgb(0, 0, 0), topD: rgb(180, 180, 180), horD: rgb(200, 200, 200) },
    };
    if (extra) {
      const keys = Object.keys(extra);
      for (let i = 0; i < keys.length; i++) w[keys[i]] = extra[keys[i]];
    }
    return w;
  }

  function buildWorlds() {
    return [
      makeWorld("city", "Rain City", makeCity(), {
        horizon: 0.46,
        weather: "rain",
        outside: "#",
        lampCount: 6,
        actors: ["person", "patrol", "cat"],
        sky: { topN: rgb(10, 12, 36), horN: rgb(92, 28, 96), topD: rgb(148, 188, 216), horD: rgb(214, 198, 176) },
      }),
      makeWorld("dust", "Dust Town", makeDust(), {
        horizon: 0.48,
        weather: "dust",
        outside: "o",
        lampCount: 4,
        actors: ["person", "horse", "person"],
        sky: { topN: rgb(22, 18, 48), horN: rgb(120, 52, 32), topD: rgb(126, 178, 216), horD: rgb(255, 168, 86) },
      }),
      makeWorld("moon", "Mare Glass", makeMoon(), {
        horizon: 0.52,
        weather: "motes",
        outside: ".",
        earth: true,
        lampCount: 0,
        actors: ["astro", "astro"],
        sky: { topN: rgb(0, 0, 0), horN: rgb(8, 10, 18), topD: rgb(0, 0, 0), horD: rgb(16, 18, 28) },
      }),
      makeWorld("keep", "Lantern Keep", makeKeep(), {
        horizon: 0.48,
        weather: "rain",
        outside: "#",
        lampCount: 6,
        actors: ["lantern", "person", "lantern"],
        sky: { topN: rgb(16, 12, 32), horN: rgb(72, 36, 64), topD: rgb(168, 174, 184), horD: rgb(150, 140, 132) },
      }),
    ];
  }

  function flood(g, sx, sy) {
    const h = g.length, w = g[0].length;
    const seen = new Uint8Array(w * h);
    const q = [sx, sy];
    seen[sy * w + sx] = 1;
    let gates = 0, cells = 0;
    function visit(x, y) {
      const k = y * w + x;
      if (seen[k] || BLOCK[g[y][x]]) return;
      seen[k] = 1;
      q.push(x, y);
    }
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1];
      cells++;
      if (g[y][x] === "G") gates++;
      if (x + 1 < w) visit(x + 1, y);
      if (x > 0) visit(x - 1, y);
      if (y + 1 < h) visit(x, y + 1);
      if (y > 0) visit(x, y - 1);
    }
    return { cells: cells, gates: gates };
  }

  const worlds = buildWorlds();

  if (typeof document === "undefined") {
    for (let i = 0; i < worlds.length; i++) {
      const w = worlds[i];
      const g = w.grid;
      const x = w.sx | 0, y = w.sy | 0;
      if (BLOCK[g[y][x]]) throw new Error(w.id + " spawn solid");
      const r = 0.2;
      const pts = [[w.sx - r, w.sy - r], [w.sx + r, w.sy - r], [w.sx - r, w.sy + r], [w.sx + r, w.sy + r]];
      for (let p = 0; p < pts.length; p++) {
        if (BLOCK[g[pts[p][1] | 0][pts[p][0] | 0]]) throw new Error(w.id + " spawn tight");
      }
      if (y - 1 < 0 || BLOCK[g[y - 1][x]]) throw new Error(w.id + " vista blocked");
      const reach = flood(g, x, y);
      if (reach.gates < 1) throw new Error(w.id + " gate unreachable");
      console.log(w.id, g[0].length + "x" + g.length, "open", reach.cells, "gates", reach.gates, "at", x, y);
    }
    console.log("MAPS OK");
    return;
  }

  const CYAN = rgb(70, 236, 255);
  const MAGENTA = rgb(255, 64, 196);
  const AMBER = rgb(255, 186, 64);
  const MINT = rgb(90, 255, 170);
  const WORDS = {
    city: ["VOLT", "DRIP", "HALO", "KILO", "NITE", "PLEX", "AERO", "MYRA"],
    dust: ["FEED", "POST", "BANK", "WELL", "OATS", "MILL", "DRY"],
    keep: ["LAMP", "SILK", "INK", "TEA", "RICE", "COIN", "YARD"],
  };
  const TINTS = [rgb(198, 216, 255), rgb(255, 176, 214), rgb(255, 214, 150), rgb(176, 255, 214)];

  function sprite(rows) {
    let w = 0;
    for (let i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      out.push(rows[i].length === w ? rows[i] : rows[i] + " ".repeat(w - rows[i].length));
    }
    return out;
  }
  const SPRITES = {
    person: sprite(["  o  ", " /|\\ ", "  |  ", " / \\ "]),
    patrol: sprite([" * * ", " /|\\ ", "  |  ", " / \\ "]),
    cat: sprite([" ^.^ ", " =.= "]),
    horse: sprite([" ,~  ", "/|\\~ ", " | | "]),
    astro: sprite([" (O) ", " /|\\ ", " / \\ "]),
    lantern: sprite(["  O  ", " /|\\ ", "  |  ", " / \\ "]),
    lamp: sprite([" O ", " | ", " | "]),
  };
  const SPRITE_INK = {
    person: rgb(214, 222, 236),
    patrol: rgb(232, 236, 244),
    cat: rgb(232, 190, 120),
    horse: rgb(156, 104, 62),
    astro: rgb(232, 236, 242),
    lantern: rgb(255, 214, 156),
    lamp: rgb(255, 206, 130),
  };

  function blocks(c, auto) {
    if (BLOCK[c]) return true;
    if (auto && c === "G") return true;
    return false;
  }
  function mulFor(id, tile) {
    if (tile === "#") return id === "city" ? 1.28 : id === "keep" ? 0.98 : 1;
    if (tile === "=") return 1.12;
    if (tile === "+") return 0.64;
    if (tile === "B") return 1.42;
    if (tile === "^") return id === "moon" ? 0.36 : 0.5;
    if (tile === "T") return 0.88;
    if (tile === "Y") return 0.46;
    if (tile === "L") return 1.02;
    return 1;
  }

  const canvas = document.getElementById("canvas");
  const gear = document.getElementById("gear");
  const sheet = document.getElementById("sheet");
  const whereEl = document.getElementById("where");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  let atlas = new Map();
  let spaceMask = new Uint8Array(CW * CH);
  function uniqueChars(s) {
    let o = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (o.indexOf(ch) < 0) o += ch;
    }
    return o;
  }
  function buildAtlas() {
    const chars = uniqueChars(" .'`^\",:;~-_=+*/\\|()[]{}<>#%MW&oOYABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    const c = document.createElement("canvas");
    c.width = CW * chars.length;
    c.height = CH;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "#fff";
    g.font = "bold 11px ui-monospace, Menlo, Consolas, monospace";
    g.textBaseline = "middle";
    g.textAlign = "center";
    for (let i = 0; i < chars.length; i++) g.fillText(chars.charAt(i), i * CW + CW / 2, CH / 2 + 0.5);
    const img = g.getImageData(0, 0, c.width, c.height);
    atlas = new Map();
    for (let i = 0; i < chars.length; i++) {
      const mask = new Uint8Array(CW * CH);
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          const a = img.data[((y * c.width + i * CW + x) << 2) + 3];
          mask[y * CW + x] = a > 48 ? 1 : 0;
        }
      }
      atlas.set(chars.charAt(i), mask);
    }
    spaceMask = atlas.get(" ") || spaceMask;
  }

  let cols = 0, rows = 0, bufW = 0, bufH = 0;
  let image = null, pix = null, zbuf = null;
  let skyRow = new Uint32Array(96);
  let wi = 0;
  let world = worlds[0];
  let px = world.sx, py = world.sy, angle = world.face;
  let clock = 0.02;
  let day = 0, elev = -1, sunX = 1, sunY = 0, hz = 0, haze = 0;
  let dirX = 0, dirY = -1, planeX = FOV, planeY = 0;
  let stepPhase = 0, stuckT = 0, portalHold = 0, moving = false, stepAcc = 0;
  let userUntil = 0;
  let actors = [];
  let lamps = [];
  let signs = [];
  const drops = [];
  const pointers = new Map();
  const bills = [];
  let billN = 0;
  let rng = 1;
  function reseed(n) { rng = (n | 0) || 1; }
  function rand() {
    rng = (rng * 16807) % 2147483647;
    return (rng & 2147483647) / 2147483647;
  }

  function tileAt(x, y) {
    const gx = x | 0, gy = y | 0;
    const g = world.grid;
    if (gy < 0 || gx < 0 || gy >= g.length || gx >= g[0].length) return "#";
    return g[gy][gx];
  }
  function groundAt(x, y) {
    const gx = x | 0, gy = y | 0;
    const g = world.grid;
    if (gy < 0 || gx < 0 || gy >= g.length || gx >= g[0].length) return world.outside;
    return g[gy][gx];
  }
  function glow(x, y) {
    let a = 0;
    for (let i = 0; i < lamps.length; i++) {
      const dx = x - lamps[i].x, dy = y - lamps[i].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 14) a += 1.35 / (1 + d2 * 0.5);
    }
    return a;
  }
  function neonFor(mx) {
    const w = world.grid[0].length;
    if (mx < w * 0.4) return MAGENTA;
    if (mx > w * 0.62) return CYAN;
    return (mx & 1) ? AMBER : MINT;
  }
  function wallLook(hit, u, v, now) {
    u -= Math.floor(u);
    if (u < 0) u += 1;
    v = clamp(v, 0, 1);
    const tile = hit.tile;
    const mx = hit.mapX, my = hit.mapY;
    let ch = "#";
    let ink = rgb(180, 180, 190);
    let bg = rgb(16, 18, 28);
    const neon = neonFor(mx);
    if (tile === "=" || (tile === "#" && world.id === "city")) {
      const col6 = (u * 6) | 0;
      const row8 = (v * 10) | 0;
      const pane = (col6 & 1) === 0 && (row8 % 3) !== 2;
      const mortar = row8 % 5 === 0;
      const on = hash(mx, my) > 0.55 || hash(mx + ((now / 420) | 0), my + row8) > 0.28;
      if (pane) {
        ch = on ? (hash(mx, row8) > 0.5 ? "=" : ":") : ".";
        ink = on && day < 0.62 ? neon : rgb(30, 38, 54);
        bg = rgb(8, 12, 26);
      } else {
        ch = mortar ? "-" : (tile === "=" ? "|" : "#");
        ink = rgb(170, 178, 200);
        bg = day > 0.45 ? rgb(120, 126, 138) : rgb(16, 24, 52);
      }
    } else if (tile === "+" || tile === "B") {
      const board = (v * 9) | 0;
      if (tile === "B" && v < 0.16 && Math.abs(u - 0.5) < 0.14) ch = "^";
      else ch = board & 1 ? "=" : "-";
      ink = rgb(198, 152, 98);
      bg = rgb(94, 60, 34);
    } else if (tile === "^") {
      ch = hash(mx + ((v * 4) | 0), my) > 0.55 ? "%" : "#";
      ink = world.id === "moon" ? rgb(226, 222, 214) : rgb(176, 124, 80);
      bg = world.id === "moon" ? rgb(72, 70, 68) : rgb(92, 60, 38);
    } else if (tile === "Y") {
      ch = v < 0.28 ? "Y" : "|";
      ink = rgb(124, 196, 84);
      bg = rgb(26, 64, 24);
    } else if (tile === "T") {
      ch = v < 0.16 ? "-" : "|";
      ink = rgb(154, 132, 102);
      bg = rgb(50, 38, 26);
    } else if (tile === "L") {
      const mid = Math.abs(u - 0.5);
      if (v < 0.22 && mid < 0.16) ch = "A";
      else if (v < 0.55 && mid < 0.28) ch = "H";
      else if (mid > 0.18 && mid < 0.4) ch = ((v * 6) | 0) & 1 ? "/" : "\\";
      else ch = ".";
      ink = rgb(236, 240, 244);
      bg = rgb(40, 44, 52);
    } else if (tile === "#") {
      const brick = ((v * 8) | 0) & 1;
      const mortar = Math.abs(((u + (brick ? 0.5 : 0)) * 4) % 1) < 0.08 || Math.abs((v * 8) % 1) < 0.1;
      ch = mortar ? "." : "#";
      ink = rgb(188, 182, 172);
      bg = rgb(78, 74, 70);
    }
    let light;
    if (world.id === "moon") {
      const nx = hit.side === 0 ? (hit.rayX > 0 ? -1 : 1) : 0;
      const ny = hit.side === 1 ? (hit.rayY > 0 ? -1 : 1) : 0;
      light = nx * sunX + ny * sunY > 0.08 ? 1.08 : 0.48;
    } else {
      light = (0.42 + day * 0.62) * (hit.side ? 0.8 : 1);
      light *= 0.62 + 0.38 / (1 + hit.dist * 0.08);
      if (tile === "=" || (world.id === "city" && (ch === "=" || ch === ":"))) light = Math.max(light, 1.02);
      light += glow(mx + 0.5, my + 0.5) * (1 - day * 0.65);
    }
    light = clamp(light, 0, 1.45);
    ink = scale(ink, light);
    bg = scale(bg, light * 0.85);
    const fog = hit.dist < 1 ? 0 : 1 - Math.exp(-hit.dist * 0.09);
    ink = mix(ink, haze, fog);
    bg = mix(bg, haze, fog);
    if (world.id !== "moon") {
      const g = glow(mx + 0.5, my + 0.5);
      if (g > 0.05 && day < 0.75) ink = mix(ink, rgb(255, 196, 120), Math.min(0.55, g * 0.28));
    }
    return { ch: ch, ink: ink, bg: bg };
  }

  function floorLook(cell, fx, fy, dist, col, row, now, refl) {
    let ch = " ";
    let ink = rgb(150, 156, 170);
    let bg = rgb(12, 14, 22);
    if (cell === "G") {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006 + fx);
      ch = ((col + row) & 1) ? "O" : "+";
      ink = mix(rgb(80, 255, 220), rgb(255, 220, 120), pulse);
      bg = rgb(8, 22, 26);
    } else if (cell === "~") {
      ch = Math.sin(now * 0.004 + fx * 1.7 + fy) > 0 ? "~" : "-";
      ink = rgb(156, 206, 238);
      bg = rgb(8, 30, 54);
    } else if (cell === "c") {
      ch = ((fx * 2) | 0) & 1 ? "=" : "-";
      ink = rgb(214, 216, 224);
      bg = rgb(22, 24, 32);
    } else if (cell === "^" || cell === "Y" || cell === "L" || cell === "T" || cell === "B" || cell === "+" || cell === "#" || cell === "=") {
      ch = ".";
      ink = rgb(48, 44, 40);
      bg = rgb(18, 16, 16);
    } else if (cell === "o" || (world.id === "moon" && cell === ".")) {
      const h = hash((fx * 2) | 0, (fy * 2) | 0);
      ch = h > 0.92 ? (h > 0.97 ? "*" : ".") : h > 0.8 ? "'" : " ";
      if (world.id === "moon") {
        ink = rgb(214, 210, 202);
        bg = rgb(96, 94, 90);
      } else {
        ink = rgb(198, 154, 92);
        bg = rgb(124, 86, 48);
      }
    } else if (world.id === "dust") {
      const h = hash((fx * 2) | 0, (fy * 2) | 0);
      ch = h > 0.9 ? "." : h > 0.72 ? "_" : " ";
      ink = rgb(186, 142, 82);
      bg = rgb(132, 88, 48);
    } else {
      const h = hash((fx * 2) | 0, (fy * 2) | 0);
      ch = h > 0.86 ? "." : h > 0.7 ? "_" : " ";
      ink = rgb(176, 190, 214);
      bg = world.id === "keep" ? rgb(54, 44, 72) : rgb(46, 56, 98);
    }
    let light;
    if (world.id === "moon") {
      const grad = Math.sin(fx * 0.65) * Math.cos(fy * 0.5);
      light = grad + elev * 0.85 > -0.15 ? 1.05 : 0.62;
    } else {
      light = (0.55 + day * 0.45) * (0.7 + 0.3 / (1 + dist * 0.1));
      light += glow(fx, fy) * (1 - day * 0.6);
      if (world.id === "city") light = Math.max(light, 0.82);
      else if (world.id === "keep") light = Math.max(light, 0.7);
    }
    if (cell === "G") light = Math.max(light, 0.95);
    light = clamp(light, 0, 1.4);
    ink = scale(ink, light);
    bg = scale(bg, light * 0.9);
    const fog = dist < 0.4 ? 0 : 1 - Math.exp(-dist * 0.085);
    ink = mix(ink, haze, fog);
    bg = mix(bg, haze, fog);
    if ((world.id === "city" || world.id === "keep") && day < 0.72 && (cell === "." || cell === "c" || cell === "~")) {
      const lane = world.id === "city" && cell !== "~" && Math.abs(fx - 11.5) < 0.14 && ((row + ((now / 70) | 0)) % 6) < 2;
      if (lane) {
        ch = "=";
        ink = rgb(230, 238, 255);
      } else if (((col * 3 + row * 5 + ((now / 90) | 0)) % 19) === 0) {
        ch = cell === "~" ? "~" : "-";
        ink = (col & 4) ? rgb(255, 120, 200) : rgb(150, 230, 255);
      }
      if (cell !== "~" && (WALL[tileAt(fx + 0.48, fy)] || WALL[tileAt(fx - 0.48, fy)])) {
        bg = mix(bg, (fx | 0) < 11 ? rgb(90, 20, 70) : rgb(14, 54, 96), 0.35);
      }
    }
    if (world.id !== "moon") {
      const g = glow(fx, fy);
      if (g > 0.08 && day < 0.8) {
        ink = mix(ink, rgb(255, 190, 110), Math.min(0.5, g * 0.22));
        bg = mix(bg, rgb(80, 48, 20), Math.min(0.4, g * 0.15));
      }
    }
    return { ch: ch, ink: ink, bg: bg };
  }

  function skyColor(row) {
    const top = mix(world.sky.topN, world.sky.topD, day);
    let hor = mix(world.sky.horN, world.sky.horD, day);
    if (world.id === "dust") {
      const warm = Math.max(0, 1 - Math.abs(elev) * 1.15);
      hor = mix(hor, rgb(255, 132, 54), warm * (0.4 + day * 0.45));
    }
    const t = hz <= 1 ? 1 : clamp(row / hz, 0, 1);
    const s = t * t * (3 - 2 * t);
    return mix(top, hor, s);
  }
  function earthAt(rayAng, row) {
    if (!world.earth) return 0;
    const dx = angDiff(rayAng, world.earthAz) * cols * 0.52;
    const dy = row - rows * 0.2;
    const rad = Math.max(6.5, rows * 0.11);
    const r2 = dx * dx + dy * dy;
    if (r2 > rad * rad) return 0;
    if (r2 > (rad - 1.15) * (rad - 1.15)) return rgb(214, 226, 255);
    const n = hash((dx * 2) | 0, (dy * 2) | 0);
    if (dx > rad * 0.18) return n > 0.6 ? rgb(18, 22, 40) : rgb(10, 12, 28);
    if (n > 0.66) return rgb(232, 238, 246);
    return n > 0.4 ? rgb(64, 140, 210) : rgb(46, 120, 78);
  }
  function paintSky(col, row, rayAng, now) {
    let bg = skyRow[row] || haze;
    let ch = " ";
    let ink = bg;
    const earth = row < hz ? earthAt(rayAng, row) : 0;
    if (earth) {
      bg = earth;
      ch = hash(col + 3, row) > 0.7 ? "o" : ".";
      ink = mix(earth, rgb(255, 255, 255), 0.22);
    } else if (row < hz - 1) {
      const h = hash(col, row);
      if (world.id === "moon" && h > 0.9) {
        ch = h > 0.975 ? "*" : ".";
        ink = rgb(230, 232, 240);
      } else if (day < 0.35 && h > 0.986) {
        ch = ".";
        ink = rgb(206, 214, 230);
      }
      if (world.id === "city") {
        for (let i = 0; i < 3; i++) {
          const lane = (hz * (0.16 + i * 0.14)) | 0;
          if (row !== lane && row !== lane + 1) continue;
          const span = cols + 12;
          let x = (now * (0.004 + i * 0.0015) + i * 19) % span;
          if (x < 0) x += span;
          x -= 6;
          const d = col - x;
          if (d >= 0 && d < 4) {
            ch = d === 3 ? ">" : "=";
            ink = i === 1 ? MAGENTA : CYAN;
            bg = mix(bg, ink, 0.16);
          }
        }
      }
    }
    fillCell(col, row, ch, ink, bg);
  }

  function maskOf(ch) {
    return atlas.get(ch) || atlas.get("#") || spaceMask;
  }
  function fillCell(col, row, ch, inkC, bgC) {
    col |= 0;
    row |= 0;
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    const mask = ch && ch !== " " ? maskOf(ch) : spaceMask;
    let dst = row * CH * bufW + col * CW;
    let s = 0;
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++, s++) pix[dst + x] = mask[s] ? inkC : bgC;
      dst += bufW;
    }
  }
  function inkCell(col, row, ch, color) {
    col |= 0;
    row |= 0;
    if (col < 0 || row < 0 || col >= cols || row >= rows || !ch || ch === " ") return;
    const mask = maskOf(ch);
    let dst = row * CH * bufW + col * CW;
    let s = 0;
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++, s++) if (mask[s]) pix[dst + x] = color;
      dst += bufW;
    }
  }

  function cast(rayX, rayY) {
    const g = world.grid;
    const w = g[0].length, h = g.length;
    let mapX = px | 0, mapY = py | 0;
    const deltaX = Math.abs(1 / (rayX || 1e-8));
    const deltaY = Math.abs(1 / (rayY || 1e-8));
    let stepX, stepY, sideX, sideY;
    if (rayX < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
    if (rayY < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }
    let side = 0;
    for (let i = 0; i < 56; i++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= w || mapY >= h) {
        return { miss: true, dist: 28, side: side, mapX: mapX, mapY: mapY, wallX: 0, tile: ".", rayX: rayX, rayY: rayY };
      }
      const tile = g[mapY][mapX];
      if (!WALL[tile]) continue;
      const dist = side === 0 ? sideX - deltaX : sideY - deltaY;
      let wallX = side === 0 ? py + dist * rayY : px + dist * rayX;
      wallX -= Math.floor(wallX);
      if (tile === "T" || tile === "Y") {
        if (Math.abs(wallX - 0.5) > (tile === "Y" ? 0.22 : 0.1)) continue;
      }
      return {
        miss: false,
        dist: dist < 0.06 ? 0.06 : dist,
        side: side,
        mapX: mapX,
        mapY: mapY,
        wallX: wallX,
        tile: tile,
        rayX: rayX,
        rayY: rayY,
      };
    }
    return { miss: true, dist: 28, side: side, mapX: mapX, mapY: mapY, wallX: 0, tile: ".", rayX: rayX, rayY: rayY };
  }

  function renderColumn(x, now) {
    const cameraX = (2 * x) / cols - 1;
    const rayX = dirX + planeX * cameraX;
    const rayY = dirY + planeY * cameraX;
    const hit = cast(rayX, rayY);
    const focal = rows * FOCAL;
    let top, bot;
    if (hit.miss) {
      top = hz;
      bot = hz;
      zbuf[x] = 28;
    } else {
      const mul = mulFor(world.id, hit.tile);
      top = hz - ((mul - EYE) / hit.dist) * focal;
      bot = hz + (EYE / hit.dist) * focal;
      zbuf[x] = hit.dist;
    }
    const rayAng = Math.atan2(rayY, rayX);
    const topI = top | 0;
    const botI = bot | 0;
    for (let row = 0; row < rows; row++) {
      if (!hit.miss && row >= topI && row < botI) {
        const look = wallLook(hit, hit.wallX, (row - top) / (bot - top || 1), now);
        fillCell(x, row, look.ch, look.ink, look.bg);
      } else if (row >= hz) {
        const p = row - hz;
        const dist = (EYE * focal) / (p > 0.35 ? p : 0.35);
        const fx = px + rayX * dist;
        const fy = py + rayY * dist;
        const look = floorLook(groundAt(fx, fy), fx, fy, dist, x, row, now, null);
        fillCell(x, row, look.ch, look.ink, look.bg);
      } else {
        paintSky(x, row, rayAng, now);
      }
    }
  }

  function project(x, y) {
    const dx = x - px, dy = y - py;
    const det = planeX * dirY - dirX * planeY;
    if (Math.abs(det) < 1e-6) return null;
    const inv = 1 / det;
    const tx = inv * (dirY * dx - dirX * dy);
    const ty = inv * (-planeY * dx + planeX * dy);
    if (ty < 0.28 || ty > 22) return null;
    const sx = (cols / 2) * (1 + tx / ty);
    if (sx < -8 || sx > cols + 8) return null;
    return { ty: ty, sx: sx };
  }
  function queueBill(x, y, rowsSpr, color, mode) {
    const p = project(x, y);
    if (!p) return;
    let b = bills[billN];
    if (!b) { b = {}; bills[billN] = b; }
    b.ty = p.ty;
    b.sx = p.sx;
    b.rows = rowsSpr;
    b.color = color;
    b.mode = mode;
    billN++;
  }
  function sortBills() {
    for (let i = 1; i < billN; i++) {
      const v = bills[i];
      let j = i;
      while (j > 0 && bills[j - 1].ty < v.ty) {
        bills[j] = bills[j - 1];
        j--;
      }
      bills[j] = v;
    }
  }
  function inkOf(mode, ch, sy, color, now) {
    if ((mode === "lamp" || mode === "lantern") && ch === "O") return rgb(255, 214, 90);
    if (mode === "patrol" && ch === "*") return ((now / 160) | 0) & 1 ? rgb(255, 54, 64) : rgb(70, 140, 255);
    return color;
  }
  function drawBills(now) {
    billN = 0;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      queueBill(a.x, a.y, SPRITES[a.kind] || SPRITES.person, a.kind === "person" ? a.tint : (SPRITE_INK[a.kind] || a.tint), a.kind);
    }
    for (let i = 0; i < lamps.length; i++) queueBill(lamps[i].x, lamps[i].y, SPRITES.lamp, SPRITE_INK.lamp, "lamp");
    for (let i = 0; i < signs.length; i++) {
      const s = signs[i];
      queueBill(s.x, s.y, sprite([" " + s.word + " "]), s.color, "sign");
    }
    sortBills();
    const focal = rows * FOCAL;
    for (let i = 0; i < billN; i++) {
      const b = bills[i];
      const spr = b.rows;
      const sh = spr.length, sw = spr[0].length;
      let drawH = Math.max(2.2, Math.min(rows * 0.36, (rows * 0.5) / b.ty));
      let drawW = drawH * (sw / sh);
      const foot0 = hz + (EYE * focal) / b.ty;
      let top = foot0 - drawH;
      if (b.mode === "sign") {
        if (b.ty > 9) continue;
        const scale = b.ty < 4.5 ? 2 : 1;
        drawW = sw * scale;
        drawH = sh * scale;
        top = hz - drawH - 3;
      }
      if (b.mode !== "lamp") top += Math.sin(now * 0.007 + b.ty * 2) * 0.22;
      const x0 = Math.floor(b.sx - drawW / 2);
      const x1 = Math.ceil(b.sx + drawW / 2);
      const foot = b.mode === "sign" ? top + drawH : foot0;
      const y0 = Math.floor(top);
      const y1 = Math.ceil(foot);
      for (let y = y0; y < y1; y++) {
        if (y < 0 || y >= rows) continue;
        const v = (y - top) / (foot - top || 1);
        const sy = clamp(v * sh, 0, sh - 0.001) | 0;
        for (let x = x0; x < x1; x++) {
          if (x < 0 || x >= cols || b.ty >= zbuf[x]) continue;
          const u = (x - (b.sx - drawW / 2)) / drawW;
          const sx = clamp(u * sw, 0, sw - 0.001) | 0;
          const ch = spr[sy].charAt(sx);
          if (!ch || ch === " ") continue;
          inkCell(x, y, ch, inkOf(b.mode, ch, sy, b.color, now));
        }
      }
    }
  }

  function seedWeather() {
    drops.length = 0;
    if (!cols || !rows) return;
    reseed(80 + wi * 19);
    const kind = world.weather;
    const n = kind === "rain" ? Math.min(110, (cols * 1.55) | 0) : kind === "dust" ? 40 : 14;
    for (let i = 0; i < n; i++) {
      drops.push({
        x: rand() * cols,
        y: rand() * rows,
        v: kind === "rain" ? 16 + rand() * 26 : kind === "dust" ? 2.4 + rand() * 4.5 : 0.8 + rand() * 1.8,
        ch: kind === "rain" ? (rand() > 0.5 ? "/" : "|") : rand() > 0.65 ? "'" : ".",
      });
    }
  }
  function drawWeather(dt) {
    if (!drops.length) seedWeather();
    const kind = world.weather;
    const colr = kind === "rain" ? rgb(186, 220, 255) : kind === "dust" ? rgb(206, 164, 96) : rgb(220, 220, 228);
    const drift = kind === "dust" ? 7 : 2.4;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.v * dt;
      d.x += drift * dt;
      if (d.y >= rows) { d.y = 0; d.x = rand() * cols; }
      if (d.x >= cols) d.x -= cols;
      if (d.x < 0) d.x += cols;
      inkCell(d.x, d.y, d.ch, colr);
    }
  }
  function drawStick() {
    const rad = 3.05;
    let cx = 4.4, cy = rows - 5.5, kx = cx, ky = cy, hot = false;
    for (const p of pointers.values()) {
      if (!p.stick) continue;
      hot = true;
      const cw = canvas.clientWidth || bufW;
      const chh = canvas.clientHeight || bufH;
      cx = (p.ox / cw) * cols;
      cy = (p.oy / chh) * rows;
      const dx = ((p.x - p.ox) / cw) * cols;
      const dy = ((p.y - p.oy) / chh) * rows;
      const m = Math.hypot(dx, dy) || 1;
      const k = Math.min(rad * 0.72, m);
      kx = cx + (dx / m) * k;
      ky = cy + (dy / m) * k;
    }
    const ring = hot ? rgb(140, 224, 255) : rgb(42, 72, 96);
    const knob = hot ? rgb(244, 255, 255) : rgb(150, 198, 216);
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * TAU;
      inkCell(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad, "o", ring);
    }
    inkCell(kx, ky, "+", knob);
  }

  function resize() {
    const cssW = canvas.clientWidth | 0;
    const cssH = canvas.clientHeight | 0;
    if (cssW < 40 || cssH < 40) return false;
    const nCols = Math.max(32, Math.min(52, Math.round(cssW / 8)));
    const nRows = Math.max(40, Math.min(86, Math.round(cssH / 12)));
    if (nCols === cols && nRows === rows && pix) return true;
    cols = nCols;
    rows = nRows;
    bufW = cols * CW;
    bufH = rows * CH;
    canvas.width = bufW;
    canvas.height = bufH;
    image = ctx.createImageData(bufW, bufH);
    pix = new Uint32Array(image.data.buffer, image.data.byteOffset, bufW * bufH);
    zbuf = new Float32Array(cols);
    if (skyRow.length < rows) skyRow = new Uint32Array(rows);
    drops.length = 0;
    return true;
  }

  function placeActors() {
    actors = [];
    const g = world.grid;
    const streets = [];
    for (let y = 1; y < g.length - 1; y++) {
      for (let x = 1; x < g[0].length - 1; x++) {
        const c = g[y][x];
        if (c === "." || c === "c") streets.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    for (let i = 0; i < world.actors.length; i++) {
      const kind = world.actors[i];
      let pos = streets.length ? streets[(i * 7 + 3) % streets.length] : { x: world.sx, y: world.sy };
      if (i === 0) {
        const ax = world.sx + Math.cos(world.face) * 3.5;
        const ay = world.sy + Math.sin(world.face) * 3.5;
        if (!blocks(tileAt(ax, ay), false)) pos = { x: ax, y: ay };
      }
      actors.push({
        x: pos.x,
        y: pos.y,
        ang: world.face + (i - 1) * 0.55,
        kind: kind,
        speed: kind === "cat" ? 0.26 : 0.4 + (i % 3) * 0.08,
        tint: TINTS[i % TINTS.length],
      });
    }
    lamps = [];
    if (!world.lampCount) return;
    const spots = [];
    for (let y = 1; y < g.length - 1; y++) {
      for (let x = 1; x < g[0].length - 1; x++) {
        if (g[y][x] !== ".") continue;
        const nb = g[y - 1][x] + g[y + 1][x] + g[y][x - 1] + g[y][x + 1];
        if (nb.indexOf("#") < 0 && nb.indexOf("=") < 0 && nb.indexOf("+") < 0 && nb.indexOf("^") < 0) continue;
        const lx = x + 0.5, ly = y + 0.5;
        if (Math.hypot(lx - world.sx, ly - world.sy) < 1.8) continue;
        spots.push({ x: lx, y: ly });
      }
    }
    for (let i = 0; i < world.lampCount && spots.length; i++) lamps.push(spots[(i * 5 + 1) % spots.length]);
  }

  function placeSigns() {
    signs = [];
    const words = WORDS[world.id];
    if (!words) return;
    const g = world.grid;
    const paints = [CYAN, MAGENTA, AMBER, MINT];
    const fx = Math.cos(world.face);
    const fy = Math.sin(world.face);
    const rx = -fy;
    const ry = fx;
    const lefts = [];
    const rights = [];
    for (let y = 2; y < g.length - 2; y++) {
      for (let x = 2; x < g[0].length - 2; x++) {
        if (g[y][x] !== "." && g[y][x] !== "c") continue;
        const wallL = WALL[g[y][x - 1]];
        const wallR = WALL[g[y][x + 1]];
        if (!wallL && !wallR) continue;
        const sx = x + 0.5 + (wallL ? -0.22 : 0.22);
        const sy = y + 0.5;
        const dx = sx - world.sx;
        const dy = sy - world.sy;
        const ahead = dx * fx + dy * fy;
        if (ahead < 3.2 || ahead > 9) continue;
        const side = dx * rx + dy * ry;
        const item = { x: sx, y: sy, ahead: ahead, side: side };
        if (side < -0.35) lefts.push(item);
        else if (side > 0.35) rights.push(item);
      }
    }
    lefts.sort((a, b) => a.ahead - b.ahead);
    rights.sort((a, b) => a.ahead - b.ahead);
    const pick = [lefts[0], rights[0], lefts[2], rights[2]];
    for (let i = 0; i < pick.length; i++) {
      const s = pick[i];
      if (!s) continue;
      signs.push({
        x: s.x,
        y: s.y,
        word: words[i % words.length],
        color: paints[i % paints.length],
      });
    }
  }

  function stepActors(dt) {
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      const nx = a.x + Math.cos(a.ang) * a.speed * dt;
      const ny = a.y + Math.sin(a.ang) * a.speed * dt;
      if (blocks(tileAt(nx, ny), true)) a.ang += 1.7;
      else { a.x = nx; a.y = ny; }
      a.ang += Math.sin(clock * 3 + i) * dt * 0.35;
    }
  }
  function tryMove(dx, dy) {
    const r = 0.2;
    function hit(x, y) {
      return blocks(tileAt(x - r, y - r), false) || blocks(tileAt(x + r, y - r), false) ||
        blocks(tileAt(x - r, y + r), false) || blocks(tileAt(x + r, y + r), false);
    }
    if (!hit(px + dx, py)) px += dx;
    if (!hit(px, py + dy)) py += dy;
  }
  function readStick() {
    let f = 0, s = 0;
    for (const p of pointers.values()) {
      if (p.stick) {
        s += clamp((p.x - p.ox) / 56, -1, 1);
        f += clamp(-(p.y - p.oy) / 56, -1, 1);
      } else if (Math.abs(p.y - p.oy) > 22) {
        f += clamp(-(p.y - p.oy) / 110, -1, 1);
      }
    }
    return { f: clamp(f, -1, 1), s: clamp(s, -1, 1), manual: pointers.size > 0 };
  }
  function stepWorld(dt, now) {
    const input = readStick();
    const auto = !input.manual && now > userUntil;
    const sp = 1.62;
    let mx = 0, my = 0;
    if (input.manual) {
      const fx = Math.cos(angle), fy = Math.sin(angle);
      mx = (fx * input.f - fy * input.s) * sp * dt;
      my = (fy * input.f + fx * input.s) * sp * dt;
    } else if (auto) {
      const fx = Math.cos(angle), fy = Math.sin(angle);
      if (blocks(tileAt(px + fx * 0.62, py + fy * 0.62), true)) {
        const lo = !blocks(tileAt(px + Math.cos(angle - 1.05) * 0.7, py + Math.sin(angle - 1.05) * 0.7), true);
        const ro = !blocks(tileAt(px + Math.cos(angle + 1.05) * 0.7, py + Math.sin(angle + 1.05) * 0.7), true);
        if (lo && !ro) angle -= 2 * dt;
        else if (ro && !lo) angle += 2 * dt;
        else angle += 1.7 * dt;
      } else {
        mx = fx * 1.18 * dt;
        my = fy * 1.18 * dt;
        angle += Math.sin(now * 0.00035) * 0.28 * dt;
      }
    }
    const ox = px, oy = py;
    if (mx || my) tryMove(mx, my);
    const moved = Math.hypot(px - ox, py - oy);
    moving = moved > 0.001;
    if (auto && !moving) {
      stuckT += dt;
      if (stuckT > 0.4) { angle += 1.35; stuckT = 0; }
    } else stuckT = 0;
    if (moving) stepPhase += moved * 6.5;
    if (portalHold > 0) portalHold -= dt;
    if (input.manual && portalHold <= 0 && tileAt(px, py) === "G") {
      enter((wi + 1) % worlds.length, true);
      return;
    }
    stepActors(dt);
    if (moving) {
      stepAcc += moved;
      if (stepAcc > 0.9) { stepAcc = 0; foot(); }
    }
    if (angle > Math.PI) angle -= TAU;
    else if (angle < -Math.PI) angle += TAU;
  }

  let actx = null, rainGain = null, filt = null;
  function pokeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!actx) {
        actx = new AC();
        const n = actx.sampleRate;
        const buf = actx.createBuffer(1, n, n);
        const data = buf.getChannelData(0);
        let s = 1;
        for (let i = 0; i < n; i++) {
          s = (s * 16807) % 2147483647;
          data[i] = s / 2147483647 * 2 - 1;
        }
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        filt = actx.createBiquadFilter();
        filt.type = "highpass";
        filt.frequency.value = 740;
        rainGain = actx.createGain();
        rainGain.gain.value = 0;
        src.connect(filt);
        filt.connect(rainGain);
        rainGain.connect(actx.destination);
        src.start();
      }
      if (actx.state === "suspended") actx.resume();
      syncAmbience();
    } catch (err) { /* sound is optional */ }
  }
  function syncAmbience() {
    if (!rainGain || !actx) return;
    const wet = world.weather === "rain" ? 0.04 : world.weather === "dust" ? 0.016 : 0;
    rainGain.gain.setTargetAtTime(wet, actx.currentTime, 0.18);
    if (filt) filt.frequency.setTargetAtTime(world.weather === "dust" ? 240 : 760, actx.currentTime, 0.2);
  }
  function foot() {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "triangle";
    o.frequency.value = 68 + rand() * 28;
    const t = actx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.028, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + 0.08);
  }
  function chime() {
    if (!actx) return;
    const notes = [523, 659, 784];
    for (let i = 0; i < notes.length; i++) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = "sine";
      o.frequency.value = notes[i];
      const t0 = actx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g);
      g.connect(actx.destination);
      o.start(t0);
      o.stop(t0 + 0.2);
    }
  }

  let hud = "";
  function hourName() {
    const c = clock;
    if (c < 0.08 || c > 0.92) return "Night";
    if (c < 0.2) return "Dawn";
    if (c < 0.38) return "Morning";
    if (c < 0.62) return "Noon";
    if (c < 0.78) return "Afternoon";
    return "Dusk";
  }
  function paintHud() {
    if (!whereEl) return;
    const label = world.name + " · " + hourName();
    if (label !== hud) { hud = label; whereEl.textContent = label; }
    const buttons = sheet ? sheet.querySelectorAll("[data-world]") : [];
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("on", Number(buttons[i].getAttribute("data-world")) === wi);
    }
  }
  function enter(i, fromUser) {
    wi = ((i % worlds.length) + worlds.length) % worlds.length;
    world = worlds[wi];
    px = world.sx;
    py = world.sy;
    angle = world.face;
    portalHold = 0.75;
    drops.length = 0;
    placeActors();
    placeSigns();
    if (cols) seedWeather();
    syncAmbience();
    if (fromUser) {
      userUntil = performance.now() + 1400;
      chime();
    }
    paintHud();
  }

  function render(now, dt) {
    dirX = Math.cos(angle);
    dirY = Math.sin(angle);
    planeX = -dirY * FOV;
    planeY = dirX * FOV;
    hz = world.horizon * rows + Math.sin(stepPhase) * (moving ? 0.32 : 0);
    for (let r = 0; r < rows; r++) skyRow[r] = skyColor(r);
    haze = skyRow[Math.min(rows - 1, Math.max(0, hz | 0))];
    for (let x = 0; x < cols; x++) renderColumn(x, now);
    drawBills(now);
    drawWeather(dt);
    drawStick();
  }

  let sent = false, armed = false, last = 0, gearFolded = false;
  function draw(now) {
    if (!resize()) return false;
    if (!gearFolded && document.getElementById("gb-ui-toggle")) {
      gear.style.display = "none";
      gearFolded = true;
    }
    let dt;
    if (!last) { last = now; dt = 0.016; }
    else {
      dt = (now - last) / 1000;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      last = now;
    }
    clock += dt / 90;
    if (clock >= 1) clock -= 1;
    elev = -Math.cos(clock * TAU);
    day = clamp(elev * 0.5 + 0.5, 0, 1);
    sunX = Math.cos(clock * TAU);
    sunY = Math.sin(clock * TAU);
    stepWorld(dt, now);
    render(now, dt);
    ctx.putImageData(image, 0, 0);
    paintHud();
    return true;
  }
  function loop(now) {
    const ok = draw(now);
    if (ok && !sent) {
      if (!armed) armed = true;
      else if (window.__gbSandbox && typeof window.__gbSandbox.ready === "function") {
        sent = true;
        window.__gbSandbox.ready();
      }
    }
    requestAnimationFrame(loop);
  }

  function localPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    const p = localPos(e);
    pointers.set(e.pointerId, {
      stick: p.x < p.w * 0.46 && p.y > p.h * 0.56,
      ox: p.x, oy: p.y, x: p.x, y: p.y,
    });
    userUntil = performance.now() + 2400;
    pokeAudio();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }, { passive: false });
  canvas.addEventListener("pointermove", function (e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const pos = localPos(e);
    if (!p.stick) angle += (pos.x - p.x) * 0.0092;
    p.x = pos.x;
    p.y = pos.y;
  }, { passive: false });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    userUntil = performance.now() + 1600;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  addEventListener("blur", function () { pointers.clear(); });

  function swallow(el) {
    if (!el) return;
    const evs = ["pointerdown", "pointerup", "pointermove", "pointercancel", "touchstart", "touchend", "touchmove", "mousedown", "mouseup", "wheel", "click"];
    for (let i = 0; i < evs.length; i++) el.addEventListener(evs[i], function (e) { e.stopPropagation(); });
  }
  swallow(gear);
  swallow(sheet);
  if (gear) {
    gear.addEventListener("click", function (e) {
      e.stopPropagation();
      const on = document.documentElement.classList.toggle("gb-ui-open");
      gear.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }
  if (sheet) {
    sheet.addEventListener("click", function (e) {
      const b = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!b || !sheet.contains(b)) return;
      pokeAudio();
      if (b.id === "hour") {
        clock = (clock + 1 / 6) % 1;
        paintHud();
        return;
      }
      const idx = b.getAttribute("data-world");
      if (idx != null) enter(Number(idx), true);
    });
  }

  buildAtlas();
  enter(0, false);
  userUntil = performance.now() + 450;
  requestAnimationFrame(loop);
})();
