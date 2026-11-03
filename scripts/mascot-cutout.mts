/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Turns an Artie pose generated on white (public/mascot/Artie-Description.md) into a
 * transparent cutout that sits on the page background in either theme (#495).
 *
 *   npx tsx scripts/mascot-cutout.mts diag <in.png> <out.png>
 *   npx tsx scripts/mascot-cutout.mts cut  <in.png> <out.png> [x,y ...]
 *
 * `diag` floods the background in from the image edge (magenta) and colours and numbers
 * the light regions it couldn't reach, printing a seed point for each. Most are real white
 * fills (bubbles, stripes, goggles); the ones that are background showing through a gap
 * (between an arm on the hip and the body, holes in a key) are passed to `cut` as seeds.
 *
 * `cut` clears the background and the seeded gaps, keeps everything else opaque, and turns
 * the ground shadow into semi-transparent black. Check the result on both page colours
 * before committing it.
 *
 * Seeds used for the current poses, against their original white-background renders
 * (in git history before the commit that fixed #495):
 *
 *   check-this-out  310,371          secure     631,245 670,250
 *   login           321,370 679,194  success    371,371
 *   not-found       371,189          welcome    393,369
 *   working         567,410 592,510  the rest   none
 */

import sharp from "sharp";

const [mode, inPath, outPath, ...seedArgs] = process.argv.slice(2);
if ((mode !== "diag" && mode !== "cut") || !inPath || !outPath) {
  console.error("usage: mascot-cutout.mts diag|cut <in.png> <out.png> [x,y ...]");
  process.exit(1);
}
const seeds = seedArgs.map((s) => s.split(",").map(Number));

const { data, info } = await sharp(inPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const N = W * H;

const rgb = (i: number): [number, number, number] => [
  data[i * 3],
  data[i * 3 + 1],
  data[i * 3 + 2],
];
const chroma = (i: number) => {
  const [r, g, b] = rgb(i);
  return Math.max(r, g, b) - Math.min(r, g, b);
};
const darkest = (i: number) => Math.min(...rgb(i));

// Background is neutral and light. The ground shadow (~200–225) counts; outlines don't, so
// the flood stops at them.
const NEUTRAL = 22;
const FLOOD_MIN = 150;
const isBackground = (i: number) => chroma(i) < NEUTRAL && darkest(i) >= FLOOD_MIN;

const neighbours = (i: number) => {
  const x = i % W;
  const y = (i / W) | 0;
  return [
    x > 0 ? i - 1 : -1,
    x < W - 1 ? i + 1 : -1,
    y > 0 ? i - W : -1,
    y < H - 1 ? i + W : -1,
  ].filter((j) => j >= 0);
};

function flood(mask: Uint8Array, starts: number[], pred: (i: number) => boolean) {
  const stack: number[] = [];
  for (const s of starts) {
    if (!mask[s] && pred(s)) {
      mask[s] = 1;
      stack.push(s);
    }
  }
  while (stack.length) {
    for (const j of neighbours(stack.pop()!)) {
      if (!mask[j] && pred(j)) {
        mask[j] = 1;
        stack.push(j);
      }
    }
  }
}

interface Component {
  n: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  touchesEdge: boolean;
  seed: number;
}

function components(pred: (i: number) => boolean) {
  const label = new Int32Array(N).fill(-1);
  const comps: Component[] = [];
  for (let s = 0; s < N; s++) {
    if (label[s] !== -1 || !pred(s)) continue;
    const c: Component = { n: 0, x0: W, y0: H, x1: 0, y1: 0, touchesEdge: false, seed: s };
    const stack = [s];
    label[s] = comps.length;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i / W) | 0;
      c.n++;
      c.x0 = Math.min(c.x0, x);
      c.y0 = Math.min(c.y0, y);
      c.x1 = Math.max(c.x1, x);
      c.y1 = Math.max(c.y1, y);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c.touchesEdge = true;
      for (const j of neighbours(i)) {
        if (label[j] === -1 && pred(j)) {
          label[j] = comps.length;
          stack.push(j);
        }
      }
    }
    comps.push(c);
  }
  return { label, comps };
}

const edge: number[] = [];
for (let x = 0; x < W; x++) edge.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) edge.push(y * W, y * W + W - 1);

const background = new Uint8Array(N);
flood(background, edge, isBackground);
flood(
  background,
  seeds.map(([x, y]) => y * W + x),
  isBackground,
);

if (mode === "diag") {
  const { label, comps } = components(
    (i) => !background[i] && isBackground(i) && darkest(i) >= 225,
  );
  const shown = comps.filter((c) => c.n >= 300);
  const palette: [number, number, number][] = [
    [0, 200, 255],
    [0, 220, 0],
    [255, 200, 0],
    [120, 80, 255],
  ];
  const out = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    const k = label[i] >= 0 ? shown.indexOf(comps[label[i]]) : -1;
    const [r, g, b] = background[i] ? [255, 0, 255] : k >= 0 ? palette[k % palette.length] : rgb(i);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  const labels = shown
    .map(
      (c, k) =>
        `<text x="${(c.x0 + c.x1) >> 1}" y="${(c.y0 + c.y1) >> 1}" font-size="28" font-family="Helvetica" font-weight="bold" fill="black" stroke="white" stroke-width="1">${k}</text>`,
    )
    .join("");
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels}</svg>`,
        ),
      },
    ])
    .png()
    .toFile(outPath);
  for (const [k, c] of shown.entries()) {
    console.log(
      `${k}: ${c.n}px  bbox ${c.x0},${c.y0}-${c.x1},${c.y1}  seed ${c.seed % W},${(c.seed / W) | 0}`,
    );
  }
  process.exit(0);
}

// Shadows: blobs darker than the paper that don't touch the image edge. Everything else in
// the background (paper, the corner vignette, the generator's watermark) goes fully clear.
const SHADOW_MAX = 238;
const SHADOW_MIN_PX = 2000;
const shadows = components((i) => background[i] && darkest(i) <= SHADOW_MAX);
const isShadow = (i: number) => {
  const c = shadows.comps[shadows.label[i]];
  return c !== undefined && !c.touchesEdge && c.n >= SHADOW_MIN_PX;
};

// Anti-aliasing band: neutral pixels within 2px of the background, on the way into an outline.
const band = new Uint8Array(N);
for (let pass = 0; pass < 2; pass++) {
  const next: number[] = [];
  for (let i = 0; i < N; i++) {
    if (background[i] || band[i] || chroma(i) >= NEUTRAL * 2) continue;
    if (neighbours(i).some((j) => background[j] || band[j])) next.push(i);
  }
  for (const i of next) band[i] = 1;
}

// What the generator's "white" averages to.
const PAPER = 250;
const out = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const [r, g, b] = rgb(i);
  let a = 255;
  let colour = [r, g, b];
  if (background[i] && !band[i] && !isShadow(i)) {
    a = 0;
    colour = [0, 0, 0];
  } else if (background[i] || band[i]) {
    // Colour-to-alpha against the paper: how much darker than it a pixel is becomes
    // how opaque it is, so shadows and line edges blend onto any page colour.
    a = Math.round(Math.max(0, Math.min(1, (PAPER - darkest(i)) / PAPER)) * 255);
    if (a < 8) a = 0;
    colour =
      a === 0
        ? [0, 0, 0]
        : [r, g, b].map((c) =>
            Math.round(Math.min(255, Math.max(0, (c - PAPER * (1 - a / 255)) / (a / 255)))),
          );
  }
  out.set([...colour, a], i * 4);
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(outPath);
console.log(`wrote ${outPath}`);
