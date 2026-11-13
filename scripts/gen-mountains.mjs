// Generates the Aoraki / Mount Cook–inspired ink sketch used as the page background:
// four layered SVGs (sky, massif, valley, fore) written to img/scene/, stacked by index.html
// so each layer can drift at its own speed on scroll.
// Usage: node scripts/gen-mountains.mjs [seed]   — change the seed for a different hand.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 1440, H = 900;
const outDir = fileURLToPath(new URL("../img/scene/", import.meta.url));
const seed = Number(process.argv[2] ?? 7);

const INK = "#1d4b85";
const INK2 = "#2f63a7";

function rng(s) {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(seed);
const rand = (a, b) => a + r() * (b - a);
const n = (v) => Math.round(v);
const pt = ([x, y]) => `${n(x)},${n(y)}`;
const line = (pts) => "M" + pts.map(pt).join("L");
const closed = (pts) => line(pts) + "Z";

function valueNoise(s) {
  const r2 = rng(s), v = Array.from({ length: 64 }, () => r2());
  return (x) => {
    const i = Math.floor(x), t = x - i, e = t * t * (3 - 2 * t);
    return v[i & 63] + (v[(i + 1) & 63] - v[i & 63]) * e;
  };
}

// Rugged polyline through anchors (midpoint displacement between each pair).
function jag(anchors, levels, amp) {
  const out = [anchors[0]];
  for (let k = 0; k < anchors.length - 1; k++) {
    let seg = [anchors[k], anchors[k + 1]], a = amp;
    for (let l = 0; l < levels; l++) {
      const next = [seg[0]];
      for (let i = 0; i < seg.length - 1; i++) {
        const [x1, y1] = seg[i], [x2, y2] = seg[i + 1];
        next.push([(x1 + x2) / 2 + (r() - 0.5) * a * 0.3, (y1 + y2) / 2 + (r() - 0.5) * a], seg[i + 1]);
      }
      seg = next; a *= 0.55;
    }
    out.push(...seg.slice(1));
  }
  return out;
}

// A slightly bowed pen stroke from p to q.
function curve(p, q, bow = 0.15) {
  const dx = q[0] - p[0], dy = q[1] - p[1], k = (r() - 0.5) * 2 * bow;
  return `M${pt(p)}Q${pt([(p[0] + q[0]) / 2 - dy * k, (p[1] + q[1]) / 2 + dx * k])} ${pt(q)}`;
}

function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// y of a polyline (sorted by x) at x.
function yAt(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    if (x >= x1 && x <= x2) return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1 || 1);
  }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}

function catmull(points, per) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const c = (a, b, cc, d) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Strokes are grouped into one <path> per style to keep the files light.
function strokes() {
  const map = new Map();
  return {
    add(d, { color = INK, w = 1.1, o = 0.5 } = {}) {
      const key = `${color}|${w}|${o}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    },
    render() {
      return [...map].map(([key, ds]) => {
        const [color, w, o] = key.split("|");
        return `<path d="${ds.join("")}" fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }).join("");
    },
  };
}
const op = () => [0.3, 0.45, 0.6][Math.floor(r() * 3)];
const fill = (pts, color, extra = "") => `<path d="${closed(pts)}" fill="${color}"${extra}/>`;
const svg = (body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  (defs ? `<defs>${defs}</defs>` : "") + body + `</svg>\n`;

/* ---------- Sky: wispy cloud banks drawn as stacked horizontal strokes ---------- */
function skyLayer() {
  const s = strokes();
  let fills = "";
  const cloud = (cx, cy, width) => {
    fills += `<ellipse cx="${n(cx)}" cy="${n(cy - 12)}" rx="${n(width * 0.62)}" ry="${n(width * 0.12)}" fill="url(#cloud)"/>`;
    const rows = 6 + Math.floor(r() * 3);
    for (let k = 0; k < rows; k++) {
      const t = k / (rows - 1), y = cy - t * width * 0.11;
      const half = width * 0.5 * (1 - t * 0.7) * rand(0.8, 1.05), x = cx - half + rand(-20, 20);
      const pts = [];
      for (let px = 0; px <= half * 2; px += 24) pts.push([x + px, y + Math.sin(px / 38 + k) * 2.5 + rand(-1.5, 1.5)]);
      s.add(line(pts), { color: INK2, w: 1, o: k === 0 ? 0.32 : 0.2 });
    }
  };
  cloud(560, 176, 380);
  cloud(1130, 124, 440);
  cloud(220, 236, 280);
  cloud(1350, 240, 230);
  for (let i = 0; i < 9; i++) {
    const y = rand(60, 290), x = rand(-40, 1300);
    s.add(curve([x, y], [x + rand(120, 300), y + rand(-6, 6)], 0.02), { color: INK2, w: 1, o: 0.15 });
  }
  const defs = `<radialGradient id="cloud"><stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`;
  return svg(fills + s.render(), defs);
}

/* ---------- Massif: Aoraki and its neighbour, snow left, rock-shadowed right ---------- */
function massifLayer() {
  const s = strokes();
  const ridge = jag([
    [-20, 560], [110, 520], [230, 468], [330, 410], [410, 350], [462, 312], [503, 290], [538, 314],
    [578, 340], [616, 331], [660, 291], [704, 246], [744, 206], [777, 173], [805, 142], [827, 159],
    [849, 183], [879, 189], [906, 213], [937, 223], [973, 259], [1011, 269], [1047, 299], [1083, 304],
    [1123, 339], [1166, 351], [1213, 389], [1263, 399], [1323, 437], [1391, 453], [1460, 470],
  ], 3, 12);
  const poly = [...ridge, [1460, H], [-20, H]];
  const band = valueNoise(seed + 1);

  // Fall-line strokes from the skyline: dense and long on shadow faces, sparse on sunlit snow.
  for (let i = 2; i < ridge.length - 2; i++) {
    const [x, y] = ridge[i];
    const slope = (ridge[i + 2][1] - ridge[i - 2][1]) / (ridge[i + 2][0] - ridge[i - 2][0] || 1);
    const rock = band(x / 70), high = Math.max(0, (540 - y) / 400);
    if (slope > 0.12) {
      if (r() > 0.5 + rock * 0.45) continue;
      const a = (rand(68, 94) * Math.PI) / 180, len = rand(30, 120) * (0.45 + high);
      const st = [x + rand(-2, 2), y + rand(2, 6)];
      const en = [st[0] + Math.cos(a) * len, st[1] + Math.sin(a) * len];
      s.add(curve(st, en, 0.08), { w: 1.1, o: op() });
      if (r() < 0.6) {
        const k = rand(0.4, 0.9), st2 = [st[0] + (en[0] - st[0]) * k + rand(-4, 4), st[1] + (en[1] - st[1]) * k];
        s.add(curve(st2, [st2[0] + Math.cos(a) * rand(15, 50), st2[1] + Math.sin(a) * rand(15, 50)], 0.1), { w: 0.9, o: 0.3 });
      }
    } else if (slope < -0.12 && r() < 0.16 + rock * 0.3) {
      const a = (rand(100, 125) * Math.PI) / 180, len = rand(8, 34) * (0.5 + high);
      const st = [x + rand(-2, 2), y + rand(3, 8)];
      s.add(curve(st, [st[0] + Math.cos(a) * len, st[1] + Math.sin(a) * len], 0.1), { color: INK2, w: 0.9, o: 0.3 });
    }
  }

  // Aretes running down from the ridge, each with a little shadow hatching on its right.
  const ribs = [
    [[705, 248], [660, 430]], [[778, 176], [748, 400]], [[849, 185], [876, 420]], [[937, 225], [960, 440]],
    [[1047, 301], [1062, 450]], [[1166, 353], [1180, 460]], [[503, 293], [480, 430]], [[616, 334], [604, 440]],
  ];
  for (const [a, b] of ribs) {
    const pts = jag([a, [(a[0] + b[0]) / 2 + rand(-15, 15), (a[1] + b[1]) / 2], b], 3, 10);
    s.add(line(pts), { w: 1.3, o: 0.55 });
    for (let i = 1; i < pts.length; i += 2) {
      const [x, y] = pts[i], len = rand(10, 34), st = [x + 2, y + rand(-2, 2)];
      s.add(curve(st, [st[0] + len * 0.5, st[1] + len], 0.1), { w: 0.9, o: 0.35 });
    }
  }

  // Glacier and crevasse lines on the snowfields.
  for (let i = 0; i < 22; i++) {
    const y = rand(330, 420), x = rand(560, 1220), len = rand(40, 140);
    if (!inside([x, y - 12], poly)) continue;
    s.add(curve([x, y], [x + len, y + rand(-8, 8)], 0.05), { color: INK2, w: 0.9, o: 0.25 });
  }

  // Form lines on the sunlit snow faces, following the slope.
  for (let i = 0; i < 30; i++) {
    const x = rand(560, 800), y = yAt(ridge, x) + rand(15, 120), len = rand(18, 50);
    if (!inside([x, y], poly)) continue;
    s.add(curve([x, y], [x - len * 0.55, y + len], 0.12), { color: INK2, w: 0.8, o: 0.2 });
  }

  // Rocky lower slopes: hatching that thickens towards the base of the mountain.
  for (let i = 0; i < 900; i++) {
    const x = rand(380, 1460), y = rand(380, 560);
    const depth = (y - 380) / 180;
    if (r() > depth * 0.9 || !inside([x, y], poly)) continue;
    const len = rand(8, 22);
    s.add(curve([x, y], [x + len * 0.35, y + len], 0.1), { w: 0.9, o: depth > 0.6 ? 0.45 : 0.3 });
  }

  const sketchy = ridge.map(([x, y]) => [x + rand(-1.5, 1.5), y + rand(-1.5, 1.5)]);
  s.add(line(ridge), { w: 2.2, o: 0.85 });
  s.add(line(sketchy), { w: 1, o: 0.35 });
  const defs = `<clipPath id="cm"><path d="${closed(poly)}"/></clipPath>`;
  return svg(fill(poly, "#f6f9fe") + `<g clip-path="url(#cm)">${s.render()}</g>`, defs);
}

/* ---------- Valley: far valley floor, moraine hill on the right, dark slope on the left ---------- */
function valleyLayer() {
  let body = "", defs = "";

  // Distant valley floor.
  const floorTop = jag([[480, 590], [640, 528], [780, 510], [920, 500], [1080, 505], [1240, 516], [1460, 528]], 2, 6);
  const floor = [...floorTop, [1460, H], [480, H]];
  const sf = strokes();
  sf.add(line(floorTop), { color: INK2, w: 1, o: 0.4 });
  for (let i = 0; i < 30; i++) {
    const x = rand(600, 1440), y = rand(515, 620), len = rand(30, 110);
    if (inside([x, y], floor)) sf.add(curve([x, y], [x + len, y + rand(-4, 4)], 0.04), { color: INK2, w: 0.9, o: 0.22 });
  }
  body += fill(floor, "#e4edf8") + sf.render();

  // Moraine hill on the right, scribbled like low scrub.
  const hillTop = jag([[600, 640], [700, 600], [800, 575], [900, 560], [1000, 552], [1120, 548], [1240, 556], [1360, 566], [1460, 574]], 2, 8);
  const hill = [...hillTop, [1460, H], [600, H]];
  const sh = strokes();
  for (let i = 0; i < 520; i++) {
    const c = [rand(600, 1460), rand(548, 790)];
    if (!inside(c, hill)) continue;
    const sz = rand(4, 9);
    sh.add(curve([c[0] - sz, c[1]], [c[0] + sz, c[1] + rand(-2, 2)], 0.6), { w: 1, o: op() });
  }
  sh.add(line(hillTop), { w: 1.6, o: 0.75 });
  defs += `<clipPath id="ch"><path d="${closed(hill)}"/></clipPath>`;
  body += fill(hill, "#d0dff1") + `<g clip-path="url(#ch)">${sh.render()}</g>`;

  // Steep slope on the left, shaded with contour strokes that follow the ridge.
  const anchors = [[-20, 300], [90, 332], [200, 374], [300, 420], [390, 470], [470, 522], [545, 570], [612, 612], [668, 642], [720, 668]];
  const wallTop = jag(anchors, 3, 10);
  const wall = [...wallTop, [720, H], [-20, H]];
  const sw = strokes();
  for (let d = 10; d < 560; d += rand(7, 11)) {
    let x = -20 + rand(0, 40);
    while (x < 720) {
      const len = rand(25, 90), x1 = Math.min(720, x + len);
      sw.add(curve([x, yAt(anchors, x) + d], [x1, yAt(anchors, x1) + d], 0.04), { w: 1, o: op() });
      x = x1 + rand(6, 40);
    }
  }
  for (let i = 0; i < 34; i++) {
    const x = rand(-20, 680), y = yAt(anchors, x) + rand(2, 8), a = (rand(62, 80) * Math.PI) / 180, len = rand(40, 160);
    sw.add(curve([x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len], 0.08), { w: 1.2, o: 0.35 });
  }
  sw.add(line(wallTop), { w: 1.8, o: 0.8 });
  defs += `<clipPath id="cw"><path d="${closed(wall)}"/></clipPath>`;
  body += fill(wall, "#c7d9ef") + `<g clip-path="url(#cw)">${sw.render()}</g>`;

  return svg(body, defs);
}

/* ---------- Foreground: tussock grass, a boulder and the winding boardwalk ---------- */
function foreLayer() {
  const grassTop = jag([[-20, 700], [140, 688], [300, 680], [460, 676], [600, 668], [740, 660], [880, 664], [1020, 656], [1180, 664], [1320, 670], [1460, 676]], 2, 6);
  const field = [...grassTop, [1460, H], [-20, H]];

  // Boardwalk: a centreline narrowing into the distance.
  // Wide, gentle sweep near the viewer; the tight hook happens far away where the walk is narrow.
  const centre = catmull([[900, 970], [800, 880], [660, 816], [556, 772], [510, 742], [524, 718], [580, 702], [660, 690], [740, 680], [800, 673], [846, 668]], 16);
  const width = (y) => Math.max(1.5, 10 + ((y - 680) / (940 - 680)) * 250);
  const left = [], right = [];
  centre.forEach((p, i) => {
    const a = centre[Math.max(0, i - 3)], b = centre[Math.min(centre.length - 1, i + 3)];
    const tx = b[0] - a[0], ty = b[1] - a[1], len = Math.hypot(tx, ty) || 1;
    // Never wider than the bend is tight, so the edges can't fold over each other.
    const ab = Math.hypot(p[0] - a[0], p[1] - a[1]), pb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const area = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (p[1] - a[1])) / 2;
    const radius = area > 1e-6 ? (ab * pb * len) / (4 * area) : Infinity;
    const nx = -ty / len, ny = tx / len, half = Math.min(width(p[1]) / 2, radius * 0.8);
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  });
  const walk = [...left, ...right.slice().reverse()];

  const sb = strokes();
  let dist = 0, next = 0;
  for (let i = 1; i < centre.length; i++) {
    dist += Math.hypot(centre[i][0] - centre[i - 1][0], centre[i][1] - centre[i - 1][1]);
    if (dist >= next) {
      const w = width(centre[i][1]);
      sb.add(curve(left[i], right[i], 0.01), { w: w > 120 ? 1.3 : 0.9, o: 0.4 });
      next = dist + Math.max(2.5, w * 0.12);
    }
  }
  sb.add(line(left), { w: 1.6, o: 0.8 });
  sb.add(line(right), { w: 2.2, o: 0.85 });
  sb.add(line(right.map(([x, y]) => [x, y + 2 + width(y) * 0.02])), { w: 1.2, o: 0.45 });

  // Boulder on the right.
  const rock = [[948, 676], [958, 650], [982, 634], [1018, 630], [1050, 641], [1068, 662], [1062, 679], [1004, 686]];
  const sr = strokes();
  for (let i = 0; i < 16; i++) {
    const x = rand(1000, 1070), y = rand(640, 690);
    sr.add(curve([x, y], [x - 12, y + 14], 0.05), { w: 0.9, o: 0.45 });
  }
  sr.add(closed(rock), { w: 1.6, o: 0.85 });
  sr.add(curve([940, 689], [1075, 685], 0.02), { w: 1.2, o: 0.4 });

  // Tussock clumps, bigger and darker towards the viewer. Blades rise steeply then arc
  // outwards, with the tallest in the middle of each clump.
  const sg = strokes();
  const blade = (base, a, len, w, o, color) => {
    const tip = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
    const out = Math.cos(a) < 0 ? 1 : -1, k = 0.22 * out;
    const dx = tip[0] - base[0], dy = tip[1] - base[1];
    const c = [(base[0] + tip[0]) / 2 - dy * k, (base[1] + tip[1]) / 2 + dx * k];
    sg.add(`M${pt(base)}Q${pt(c)} ${pt(tip)}`, { color, w, o });
  };
  for (let i = 0; i < 520; i++) {
    const y = 664 + (H + 40 - 664) * Math.pow(r(), 0.8), x = rand(-20, 1460);
    if (inside([x, y], walk) || inside([x, y], rock)) continue;
    const t = Math.min(1, (y - 660) / 270), sc = 0.15 + 1.6 * t;
    const o = t < 0.33 ? 0.3 : t < 0.66 ? 0.45 : 0.6, w = t < 0.33 ? 0.8 : t < 0.66 ? 1 : 1.3;
    if (t < 0.15) {
      for (let k = 0; k < 3; k++) blade([x + k * 3, y], ((-90 + rand(-25, 25)) * Math.PI) / 180, rand(4, 8), 0.8, 0.3, INK2);
      continue;
    }
    const blades = 8 + Math.floor(r() * 7);
    for (let k = 0; k < blades; k++) {
      const spread = (k / (blades - 1)) * 2 - 1;
      const a = ((-90 + spread * 62 + rand(-8, 8)) * Math.PI) / 180;
      const len = rand(22, 46) * sc * (1 - Math.abs(spread) * 0.45);
      blade([x + spread * 6 * sc + rand(-2, 2), y], a, len, w, o, r() < 0.5 ? INK : INK2);
    }
  }
  for (let i = 2; i < grassTop.length - 2; i += 2) {
    const [x, y] = grassTop[i];
    sg.add(curve([x, y + 2], [x + rand(-5, 5), y - rand(4, 10)], 0.3), { color: INK2, w: 0.8, o: 0.35 });
  }

  return svg(
    fill(field, "#e9f0fa") +
    `<path d="${line(grassTop)}" fill="none" stroke="${INK2}" stroke-width="1" stroke-opacity="0.35"/>` +
    fill(rock, "#dce7f5") + sr.render() +
    fill(walk, "#fbfdff") + sb.render() +
    sg.render()
  );
}

mkdirSync(outDir, { recursive: true });
for (const [name, make] of [["sky", skyLayer], ["massif", massifLayer], ["valley", valleyLayer], ["fore", foreLayer]]) {
  const out = make();
  writeFileSync(outDir + name + ".svg", out);
  console.log(`img/scene/${name}.svg  ${(out.length / 1024).toFixed(1)} KB`);
}
