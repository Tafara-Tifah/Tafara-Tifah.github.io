// Generates the layered mountain background and writes it into index.html,
// between the <!-- scene:start --> and <!-- scene:end --> markers.
// Usage: node scripts/gen-mountains.mjs [seedFar seedMid seedNear seedFront]
// Change the seeds for a different mountain range; colours and heights are in `layers` below.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 1440, H = 600;
const seedArgs = process.argv.slice(2);
const indexPath = fileURLToPath(new URL("../index.html", import.meta.url));
const seeds = seedArgs.length === 4 ? seedArgs.map(Number) : [11, 23, 37, 51];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Midpoint displacement between two anchor points.
function subdivide(a, b, levels, amp, r) {
  let pts = [a, b], am = amp;
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      next.push([(x1 + x2) / 2, (y1 + y2) / 2 + (r() - 0.5) * am], pts[i + 1]);
    }
    pts = next; am *= 0.55;
  }
  return pts;
}

// Ridgeline: alternating valley/peak anchors, then rugged detail between them.
function ridge({ seed, peaks, peakY, valleyY, detail, levels }) {
  const r = rng(seed);
  const K = peaks * 2 + 1, seg = W / (K - 1);
  const anchors = [];
  for (let k = 0; k < K; k++) {
    const jitter = k > 0 && k < K - 1 ? (r() - 0.5) * seg * 0.5 : 0;
    const [lo, hi] = k % 2 ? peakY : valleyY;
    anchors.push([k * seg + jitter, lo + r() * (hi - lo)]);
  }
  const pts = [anchors[0]];
  for (let k = 0; k < K - 1; k++) pts.push(...subdivide(anchors[k], anchors[k + 1], levels, detail, r).slice(1));
  return pts;
}

const f = (v) => Math.round(v * 10) / 10;

// Catmull-Rom -> cubic Bezier for smooth hills; straight lines for rugged ranges.
function pathFrom(pts, smooth) {
  let d = `M0,${H} L${f(pts[0][0])},${f(pts[0][1])}`;
  if (!smooth) {
    for (let i = 1; i < pts.length; i++) d += ` L${f(pts[i][0])},${f(pts[i][1])}`;
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
    }
  }
  return d + ` L${W},${H} Z`;
}

const layers = [
  { name: "far",   seed: seeds[0], peaks: 7, peakY: [150, 245], valleyY: [270, 330], detail: 44, levels: 4, smooth: false,
    top: "#a3c0e3", bottom: "#c8dcf2", snowline: 200 },
  { name: "mid",   seed: seeds[1], peaks: 5, peakY: [238, 300], valleyY: [325, 372], detail: 30, levels: 3, smooth: false,
    top: "#7aa2d3", bottom: "#a4c2e6", snowline: 252 },
  { name: "near",  seed: seeds[2], peaks: 4, peakY: [345, 392], valleyY: [405, 432], detail: 14, levels: 2, smooth: true,
    top: "#4a7ebd", bottom: "#6e98ce" },
  { name: "front", seed: seeds[3], peaks: 3, peakY: [436, 466], valleyY: [482, 506], detail: 8,  levels: 2, smooth: true,
    top: "#22558f", bottom: "#2d63a3" },
];

const vb = `viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"`;
let html = "";
let farPts;

for (const L of layers) {
  const pts = ridge(L);
  if (L.name === "far") farPts = pts;
  const minY = Math.min(...pts.map((p) => p[1]));
  const span = H - minY;
  const id = `g-${L.name}`;
  const o = (y) => Math.min(1, Math.max(0, (y - minY) / span)).toFixed(3);
  const stops = L.snowline && L.snowline > minY
    ? `<stop offset="0" stop-color="#ffffff"/><stop offset="${o(L.snowline)}" stop-color="#f1f6fd"/>` +
      `<stop offset="${o(L.snowline + 18)}" stop-color="${L.top}"/><stop offset="1" stop-color="${L.bottom}"/>`
    : `<stop offset="0" stop-color="${L.top}"/><stop offset="1" stop-color="${L.bottom}"/>`;
  const grad = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(minY)}" x2="0" y2="${H}">${stops}</linearGradient>`;
  html += `    <svg class="scene-layer layer-${L.name}" ${vb}><defs>${grad}</defs><path fill="url(#${id})" d="${pathFrom(pts, L.smooth)}"/></svg>\n`;
  console.log(`${L.name}: y ${f(minY)}..${f(Math.max(...pts.map((p) => p[1])))}, ${pts.length} pts`);
}

// Sun sits in a notch of the far ridge on the right-hand side.
const candidates = farPts.filter(([x]) => x > 860 && x < 1200);
const dip = candidates.reduce((a, b) => (b[1] > a[1] ? b : a));
const sunX = f(dip[0]), sunY = f(dip[1] - 105);
const sun =
  `    <svg class="scene-layer layer-sun" ${vb}><defs>` +
  `<radialGradient id="g-glow"><stop offset="0" stop-color="#ffe9b0" stop-opacity="0.75"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="g-sun"><stop offset="0" stop-color="#fffaf0"/><stop offset="0.7" stop-color="#ffefc4"/><stop offset="1" stop-color="#ffdf94"/></radialGradient>` +
  `</defs><circle cx="${sunX}" cy="${sunY}" r="170" fill="url(#g-glow)"/><circle cx="${sunX}" cy="${sunY}" r="46" fill="url(#g-sun)"/></svg>\n`;

const scene =
  `  <div class="scene" aria-hidden="true">\n    <div class="scene-sky"></div>\n` +
  sun + html +
  `    <div class="scene-photo"></div>\n    <div class="scene-tint"></div>\n    <div class="scene-wash"></div>\n` +
  `    <div class="scene-dusk"></div>\n  </div>\n`;

const page = readFileSync(indexPath, "utf8");
const re = /(<!-- scene:start -->)[\s\S]*?(\s*<!-- scene:end -->)/;
if (!re.test(page)) throw new Error("scene markers not found in index.html");
writeFileSync(indexPath, page.replace(re, `$1\n${scene.trimEnd()}$2`));
console.log(`index.html updated: seeds ${seeds.join(",")}, sun at ${sunX},${sunY}`);
