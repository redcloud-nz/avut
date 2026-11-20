/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The GLSL behind `GlyphBackground`. The fragment shader is assembled from two independent parts:
 *
 * - **clouds**: the drifting light mask (0–1) that decides where the field is lit.
 * - **surface**: what the light falls on, monospace characters or a topographic map.
 *
 * Every other part (click waves, cursor trail, colour mixing) is shared.
 */

/** The drifting light that lights the field. */
export type GlyphClouds =
    /** One noise layer with a fine grain on it: small, busy blobs. The first version. */
    | "single"
    /** Two noise layers at different sizes, speeds and directions, screen-blended, for depth. */
    | "layers"
    /** Domain-warped fractal noise: billowy clouds whose edges curl into each other. */
    | "warped";

/** What the light falls on. */
export type GlyphSurface =
    /** A grid of characters, each picked at random and changing now and then. */
    | "glyphs"
    /** A made-up topographic map: contours (every 5th heavier), hillshade and a grid. */
    | "contours";

/** The most click waves alive at once. */
export const MAX_WAVES = 12;
/** Cursor trail points. */
export const TRAIL = 12;

/** Px a wave's leading edge fades over (outside the ring). */
const WAVE_EDGE = 10;
/** Px a wave's trailing edge fades over (inside the ring). */
const WAVE_TAIL = 16;

/** layers: the far layer's drift, as a multiple of the near layer's. */
const LAYER_SPEED = 2.2;
/** layers: the far layer's brightness relative to the near one. */
const FAR_STRENGTH = 0.55;

/** warped: fbm below LOW is dark, above HIGH fully lit. Raise LOW for fewer, sparser clouds. */
const CLOUD_LOW = 0.48;
const CLOUD_HIGH = 0.72;

/** contours: lines per unit of terrain height (0–1). */
const LEVELS = 80;
/** contours: terrain feature size, in px. Bigger is broader ranges. */
const TERRAIN_SCALE = 500;
/** contours: how visible the map is outside the clouds (0–1). */
const BASE = 0.08;
/** contours: map grid spacing, in px. */
const GRID = 180;
/** contours: hillshade strength (0–1), lit from the north-west. */
const SHADE = 0.2;

const f = (value: number) => value.toFixed(2);

export const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const HEADER = `
precision highp float;
uniform sampler2D atlas;
uniform vec2 size;
uniform vec2 origin;
uniform vec2 cell;
uniform float dpr;
uniform float count;
uniform float time;
uniform float haze;
uniform float hoverInk;
uniform float activity;
uniform vec2 drift;
uniform vec3 color;
uniform vec3 accent;
uniform vec4 waves[${MAX_WAVES * 2}];
uniform vec4 trail[${TRAIL}];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// A wave's outline: a circle (0), a heart (1) or a wobbly blob (2).
float outline(float kind, float angle, float phase) {
  if (kind < 0.5) return 1.0;
  if (kind < 1.5) {
    float s = sin(angle);
    float c = cos(angle);
    return (2.0 - 2.0 * s + s * sqrt(abs(c)) / (s + 1.4)) * 0.42;
  }
  return 1.0 + 0.14 * sin(3.0 * angle + phase) + 0.08 * sin(5.0 * angle - phase * 1.3);
}
`;

const HELPERS: { clouds: Record<GlyphClouds, string>; surface: Record<GlyphSurface, string> } = {
    clouds: {
        single: "",
        layers: "",
        warped: `
// Fractal noise: 4 octaves, each rotated so the value-noise grid doesn't show. Range ~0–0.94.
float fbm(vec2 p) {
  mat2 octave = mat2(1.6, 1.2, -1.2, 1.6);
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * smoothNoise(p);
    p = octave * p;
    a *= 0.5;
  }
  return v;
}
`,
    },
    surface: {
        glyphs: "",
        contours: `
// The terrain height (0–1) at p. Valleys are V-shaped troughs along the 0.5 line of two valley
// fields (main and tributary), so contours kink upstream where they cross them. A broad fBm sets
// the overall height, and a light domain warp keeps the valleys from looking like noise.
float land(vec2 p) {
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  vec2 w = vec2(smoothNoise(p * 0.7 + 1.3), smoothNoise(p * 0.7 + 7.1)) - 0.5;
  p += w * 0.8;
  float base = smoothNoise(p * 0.6) * 0.55 + smoothNoise(rot * p * 1.3 + 5.3) * 0.3 + smoothNoise(rot * p * 2.9 + 2.2) * 0.15;
  // Meander: nudge the valley fields with finer noise, so valleys wind
  // instead of sweeping in long smooth arcs.
  vec2 bend = vec2(smoothNoise(p * 6.0 + 41.0), smoothNoise(p * 6.0 + 47.0)) - 0.5;
  float trunk = smoothNoise(rot * p * 1.5 + 11.0 + bend * 0.35);
  float side = smoothNoise(rot * rot * p * 3.6 + 23.0 + bend * 0.5);
  float detail = smoothNoise(p * 7.0 + 31.0) * 0.6 + smoothNoise(rot * p * 15.0 + 37.0) * 0.4;
  float h = base * 0.55 + abs(2.0 * trunk - 1.0) * 0.28 + abs(2.0 * side - 1.0) * 0.12 * (0.5 + base) + detail * 0.05;
  return h;
}
`,
    },
};

/** Where each fragment samples the field: `point` (CSS px) and, for glyphs, the cell `index`. */
const POINT: Record<GlyphSurface, string> = {
    // Whole cells: every pixel of a character shares its cell's light.
    glyphs: `
  vec2 index = floor(pixel / cell);
  vec2 point = (index + 0.5) * cell / dpr;
`,
    // Per pixel: lines need full resolution.
    contours: `
  vec2 point = pixel / dpr;
`,
};

/** Each sets `float mask` (0–1) from `point`, `drift`, `time` and `activity`. */
const CLOUDS: Record<GlyphClouds, string> = {
    single: `
  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  vec2 q = turn * (point - drift);
  float blob = smoothNoise(vec2(q.x / 140.0, q.y / 80.0) + vec2(time * 0.04, 0.0)) * 0.62
    + smoothNoise(vec2(q.x / 62.0, q.y / 36.0) + vec2(3.7, time * 0.06)) * 0.38;
  float grain = smoothNoise(vec2(q.x / 30.0, q.y / 14.0) + vec2(time * 0.2, 7.3));
  float cloud = blob * (0.82 + 0.24 * grain);
  float mask = pow(smoothstep(0.47 - 0.2 * activity, 0.84, cloud), 2.6);
`,
    layers: `
  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  // Near layer: large shapes at the base drift speed, full strength.
  vec2 qa = turn * (point - drift);
  float nearCloud = smoothNoise(vec2(qa.x / 220.0, qa.y / 150.0) + vec2(time * 0.03, 0.0)) * 0.65
    + smoothNoise(vec2(qa.x / 100.0, qa.y / 70.0) + vec2(3.7, time * 0.04)) * 0.35;
  // Far layer: smaller shapes, faster and turned ~15° off the drift, fainter.
  vec2 driftB = mat2(0.97, -0.26, 0.26, 0.97) * drift * ${f(LAYER_SPEED)};
  vec2 qb = turn * (point - driftB);
  float farCloud = smoothNoise(vec2(qb.x / 80.0, qb.y / 55.0) + vec2(9.1, time * 0.05)) * 0.6
    + smoothNoise(vec2(qb.x / 38.0, qb.y / 26.0) + vec2(time * 0.08, 2.4)) * 0.4;
  float nearMask = pow(smoothstep(0.5 - 0.2 * activity, 0.85, nearCloud), 2.0);
  float farMask = pow(smoothstep(0.55 - 0.2 * activity, 0.88, farCloud), 2.4) * ${f(FAR_STRENGTH)};
  // Screen blend: where they overlap it brightens, but never past 1.
  float mask = 1.0 - (1.0 - nearMask) * (1.0 - farMask);
`,
    warped: `
  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  vec2 q = turn * (point - drift);
  // Domain warping (after Inigo Quilez): sample the noise at a position pushed around by two more
  // noise fields, which are themselves warped and slowly evolving. Gives curling, billowy edges.
  vec2 p = vec2(q.x / 260.0, q.y / 190.0);
  vec2 w1 = vec2(fbm(p + vec2(0.0, time * 0.02)), fbm(p + vec2(5.2, 1.3 - time * 0.015)));
  vec2 w2 = vec2(fbm(p + 3.0 * w1 + vec2(1.7, 9.2) + time * 0.025), fbm(p + 3.0 * w1 + vec2(8.3, 2.8) - time * 0.02));
  float cloud = fbm(p + 3.0 * w2);
  float mask = smoothstep(${f(CLOUD_LOW)} - 0.12 * activity, ${f(CLOUD_HIGH)}, cloud);
  mask *= mask;
`,
};

/** Each sets `float grey` (lit in `color`) and `float blue` (lit in `accent`) from the mask, waves and trail. */
const SURFACE: Record<GlyphSurface, string> = {
    glyphs: `
  float seed = hash(index);
  float epoch = floor(time * 0.08 * (0.4 + seed) + seed * 97.0);
  float character = floor(hash(index + epoch * 0.137) * count);
  vec2 local = fract(pixel / cell);
  float ink = pow(texture2D(atlas, vec2((character + local.x) / count, local.y)).a, 1.2);

  float grey = ink * clamp(haze * mask * (1.0 + 0.3 * activity) + hoverInk * hover * (0.6 + 0.4 * mask), 0.0, 1.0);
  float blue = ink * ring * 0.25;
`,
    contours: `
  vec2 tp = point / ${f(TERRAIN_SCALE)};
  float px = 1.0 / ${f(TERRAIN_SCALE)};
  float h = land(tp);
  vec2 slope = vec2(land(tp + vec2(px, 0.0)) - h, land(tp + vec2(0.0, px)) - h);

  // Contour lines: distance to the nearest level, in px (via the gradient), drawn ~1px wide.
  vec2 grad = slope * ${f(LEVELS)};
  float spacing = 1.0 / max(length(grad), 1e-4);
  float level = h * ${f(LEVELS)};
  float gap = abs(fract(level - 0.5) - 0.5) * spacing;
  // Every 5th line is an index contour: wider and darker.
  float major = step(abs(mod(floor(level + 0.5), 5.0)), 0.5);
  float width = mix(0.45, 0.9, major) * dpr;
  float contour = (1.0 - smoothstep(width - 0.5, width + 0.75, gap * dpr)) * mix(0.6, 1.0, major);
  // On cliffs the lines run together: fade the minor ones out there, as a real sheet does.
  contour *= mix(smoothstep(1.5, 4.0, spacing), 1.0, major);

  // Hillshade, lit from the north-west (screen up-left), only the shadowed side.
  float shade = clamp(dot(slope / px, vec2(0.5, 0.5)), 0.0, 1.0) * ${f(SHADE)};

  // The map grid.
  vec2 g = abs(fract(point / ${f(GRID)} + 0.5) - 0.5) * ${f(GRID)};
  float grid = 1.0 - smoothstep(0.3, 1.0, min(g.x, g.y));

  float light = clamp(${f(BASE)} + haze * mask * (1.0 + 0.3 * activity) + hoverInk * hover * (0.6 + 0.4 * mask), 0.0, 1.0);
  float grey = clamp(contour + shade, 0.0, 1.0) * light;
  float blue = clamp(grid * 0.35 * light * 1.4 + contour * ring * 0.25, 0.0, 1.0);
`,
};

/** The fragment shader for one combination of clouds and surface. */
export function fragmentShader(clouds: GlyphClouds, surface: GlyphSurface) {
    return `${HEADER}${HELPERS.clouds[clouds]}${HELPERS.surface[surface]}
void main() {
  // Viewport device pixels, so the field stays put when the box moves or resizes (e.g. the sidebar).
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) + origin;
${POINT[surface]}
  float ring = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 a = waves[i * 2];
    vec4 b = waves[i * 2 + 1];
    if (a.w <= 0.0) continue;
    vec2 v = point - a.xy;
    float angle = atan(-v.y, v.x);
    float shape = mix(1.0, outline(b.x, angle, b.z), b.y);
    shape *= 1.0 + 0.07 * sin(3.0 * angle + b.z + b.w) + 0.05 * sin(5.0 * angle - b.z * 1.7 - b.w * 1.3) + 0.03 * sin(9.0 * angle + b.w * 2.1);
    float d = length(v) - a.z * shape;
    float k = d > 0.0 ? d / ${f(WAVE_EDGE)} : d / ${f(WAVE_TAIL)};
    ring = max(ring, exp(-k * k) * a.w);
  }

  float hover = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec4 t = trail[i];
    if (t.w <= 0.0) continue;
    vec2 v = point - t.xy;
    hover += t.w * exp(-dot(v, v) / (2.0 * t.z * t.z));
  }
  hover = min(hover, 1.0);
${CLOUDS[clouds]}${SURFACE[surface]}
  float alpha = grey + blue - grey * blue;
  vec3 tint = color * grey * (1.0 - blue) + accent * blue;
  gl_FragColor = vec4(tint, alpha);
}
`;
}
