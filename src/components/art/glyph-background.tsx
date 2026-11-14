/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * A field of monospace characters lit by drifting glows, a cursor trail and waves on click.
 *
 * Adapted from animate-ui's Glyph Background (https://animate-ui.com/docs/backgrounds/glyph),
 * with its `motion` and `@animate-ui/react` dependencies replaced by a plain
 * requestAnimationFrame loop, IntersectionObserver, `visibilitychange` and the
 * reduced-motion media query.
 *
 * Unlike the original it's a backdrop layer rather than a wrapper: it renders its own
 * `pointer-events-none` box (position it with `className`) and listens for the pointer on
 * `window`, so the page above it stays fully interactive and still lights the glyphs.
 */
"use client";

import { ComponentProps, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_WAVES = 12;
const TRAIL = 12;
const TRAIL_LIFE = 700;
const WAVE_LIFE = 6;
const WAVE_GAP = 0.6;
const WAVE_SPEED = 200;
const WAVE_SLOWDOWN = 0.15;
const WAVE_EDGE = 10;
const WAVE_TAIL = 16;
/** How fast the glows drift across, in px/s (left, down). Still under reduced motion: nothing animates. */
const DRIFT = [-12, 5] as const;
const ACTIVITY_DECAY = 900;

const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
uniform sampler2D atlas;
uniform vec2 size;
uniform vec2 origin;
uniform vec2 cell;
uniform float dpr;
uniform float count;
uniform float time;
uniform float rest;
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

float outline(float kind, float angle, float phase) {
  if (kind < 0.5) return 1.0;
  if (kind < 1.5) {
    float s = sin(angle);
    float c = cos(angle);
    return (2.0 - 2.0 * s + s * sqrt(abs(c)) / (s + 1.4)) * 0.42;
  }
  return 1.0 + 0.14 * sin(3.0 * angle + phase) + 0.08 * sin(5.0 * angle - phase * 1.3);
}

void main() {
  // Viewport device pixels, so the field stays put when the box moves or resizes (e.g. the sidebar).
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) + origin;
  vec2 index = floor(pixel / cell);
  vec2 point = (index + 0.5) * cell / dpr;

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
    float k = d > 0.0 ? d / ${WAVE_EDGE.toFixed(1)} : d / ${WAVE_TAIL.toFixed(1)};
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

  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  vec2 q = turn * (point - drift);
  float blob = smoothNoise(vec2(q.x / 140.0, q.y / 80.0) + vec2(time * 0.04, 0.0)) * 0.62
    + smoothNoise(vec2(q.x / 62.0, q.y / 36.0) + vec2(3.7, time * 0.06)) * 0.38;
  float grain = smoothNoise(vec2(q.x / 30.0, q.y / 14.0) + vec2(time * 0.2, 7.3));
  float cloud = blob * (0.82 + 0.24 * grain);
  float mask = pow(smoothstep(0.47 - 0.2 * activity, 0.84, cloud), 2.6);

  float seed = hash(index);
  float epoch = floor(time * 0.08 * (0.4 + seed) + seed * 97.0);
  float character = floor(hash(index + epoch * 0.137) * count);
  vec2 local = fract(pixel / cell);
  float ink = pow(texture2D(atlas, vec2((character + local.x) / count, local.y)).a, 1.7);

  float grey = ink * clamp(rest + haze * mask * (1.0 + 0.3 * activity) + hoverInk * hover * (0.6 + 0.4 * mask), 0.0, 1.0);
  float blue = ink * ring * 0.25;
  float alpha = grey + blue - grey * blue;
  vec3 tint = color * grey * (1.0 - blue) + accent * blue;
  gl_FragColor = vec4(tint, alpha);
}
`;

type Wave = {
    x: number;
    y: number;
    kind: number;
    phase: number;
    strength: number;
    /** Clock time (ms) the wave starts, after its delay. */
    start: number;
};

type Rgb = [number, number, number];

export type GlyphBackgroundProps = Omit<ComponentProps<"div">, "children"> & {
    /** Colour of the glows and cursor trail: a CSS colour, or a custom property name like `--muted-foreground`. Defaults to the box's text colour. */
    glowColor?: string;
    /** Colour of the click waves: a CSS colour or custom property name. Defaults to the box's text colour. */
    shapeColor?: string;
    /** Character size in px. */
    fontSize?: number;
    /** Base brightness of the drifting glows (0–1). */
    haze?: number;
    /** How strongly the cursor trail lights the glyphs (0–1). */
    hoverInk?: number;
    /** Cursor trail and click waves. */
    interactive?: boolean;
};

function compile(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function toRgb(color: string): Rgb {
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!probe) return [0.5, 0.5, 0.5];
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return [r! / 255, g! / 255, b! / 255];
}

function resolveColor(element: Element, color: string | undefined, fallback: string) {
    if (!color) return fallback;
    if (color.startsWith("--"))
        return getComputedStyle(element).getPropertyValue(color).trim() || fallback;
    return color;
}

function drawAtlas(cellWidth: number, cellHeight: number, font: string) {
    const atlas = document.createElement("canvas");
    atlas.width = Math.ceil(cellWidth * CHARACTERS.length);
    atlas.height = Math.ceil(cellHeight);
    const context = atlas.getContext("2d")!;
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    for (let i = 0; i < CHARACTERS.length; i++)
        context.fillText(CHARACTERS[i]!, (i + 0.5) * cellWidth, cellHeight / 2);
    return atlas;
}

type Frame = {
    width: number;
    /** The box's top-left in viewport device pixels. */
    origin: [number, number];
    height: number;
    dpr: number;
    cell: [number, number];
    time: number;
    activity: number;
    drift: [number, number];
    color: Rgb;
    accent: Rgb;
    waves: Float32Array;
    trail: Float32Array;
};

function createRenderer(gl: WebGLRenderingContext) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const at = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
        atlas: at("atlas"),
        size: at("size"),
        origin: at("origin"),
        cell: at("cell"),
        dpr: at("dpr"),
        count: at("count"),
        time: at("time"),
        rest: at("rest"),
        haze: at("haze"),
        hoverInk: at("hoverInk"),
        activity: at("activity"),
        drift: at("drift"),
        color: at("color"),
        accent: at("accent"),
        waves: at("waves"),
        trail: at("trail"),
    };
    gl.uniform1i(uniforms.atlas, 0);
    gl.uniform1f(uniforms.count, CHARACTERS.length);
    gl.uniform1f(uniforms.rest, 0);

    return {
        atlas(image: HTMLCanvasElement) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        },
        levels(haze: number, hoverInk: number) {
            gl.uniform1f(uniforms.haze, haze);
            gl.uniform1f(uniforms.hoverInk, hoverInk);
        },
        draw(frame: Frame) {
            gl.viewport(0, 0, frame.width, frame.height);
            gl.uniform2f(uniforms.size, frame.width, frame.height);
            gl.uniform2f(uniforms.origin, ...frame.origin);
            gl.uniform2f(uniforms.cell, ...frame.cell);
            gl.uniform1f(uniforms.dpr, frame.dpr);
            gl.uniform1f(uniforms.time, frame.time);
            gl.uniform1f(uniforms.activity, frame.activity);
            gl.uniform2f(uniforms.drift, ...frame.drift);
            gl.uniform3f(uniforms.color, ...frame.color);
            gl.uniform3f(uniforms.accent, ...frame.accent);
            gl.uniform4fv(uniforms.waves, frame.waves);
            gl.uniform4fv(uniforms.trail, frame.trail);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
    };
}

function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void) {
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
}

function useReducedMotion() {
    return useSyncExternalStore(
        subscribeReducedMotion,
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        () => false,
    );
}

function usePageVisible() {
    return useSyncExternalStore(
        subscribeVisibility,
        () => document.visibilityState === "visible",
        () => true,
    );
}

function useInView(ref: React.RefObject<Element | null>) {
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) =>
            setInView(entry?.isIntersecting ?? false),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return inView;
}

export function GlyphBackground({
    glowColor,
    shapeColor,
    fontSize = 10,
    haze = 0.1,
    hoverInk = 0.3,
    interactive = true,
    className,
    ...props
}: GlyphBackgroundProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const inView = useInView(containerRef);
    const pageVisible = usePageVisible();
    const reduce = useReducedMotion();
    const playing = inView && pageVisible && !reduce;

    const wavesRef = useRef<Wave[]>([]);
    const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
    const drawRef = useRef<(time: number, looping?: boolean) => void>(() => {});
    const timeRef = useRef(0);
    const resizeRef = useRef(() => {});
    const levelsRef = useRef((_haze: number, _hoverInk: number) => {});
    const activityRef = useRef({ value: 0, at: 0 });

    const optionsRef = useRef({ glowColor, shapeColor, fontSize });
    useEffect(() => {
        optionsRef.current = { glowColor, shapeColor, fontSize };
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const gl = canvas.getContext("webgl", {
            premultipliedAlpha: true,
            preserveDrawingBuffer: true,
            antialias: false,
        });
        const renderer = gl ? createRenderer(gl) : null;
        if (!renderer) return;

        let width = 0;
        let height = 0;
        let dpr = 1;
        let cell: [number, number] = [7, 13];
        let atlasKey = "";
        let frames = 0;
        let colorKey = "";
        let color: Rgb = [0.5, 0.5, 0.5];
        let accent: Rgb = [0.5, 0.5, 0.5];
        const waves = new Float32Array(MAX_WAVES * 8);
        const trail = new Float32Array(TRAIL * 4);

        const resize = () => {
            const rect = container.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
            canvas.width = Math.max(1, Math.round(width * dpr));
            canvas.height = Math.max(1, Math.round(height * dpr));
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            const { fontSize } = optionsRef.current;
            // Only rebuild the atlas when it would change: the box resizes every frame while the sidebar animates.
            const key = `${fontSize}|${dpr}`;
            if (key === atlasKey) return;
            atlasKey = key;
            const font = `${fontSize * dpr}px Menlo, ui-monospace, SFMono-Regular, Consolas, monospace`;
            const measure = document.createElement("canvas").getContext("2d")!;
            measure.font = font;
            cell = [Math.round(measure.measureText("0").width), Math.round(fontSize * 1.25 * dpr)];
            renderer.atlas(drawAtlas(cell[0], cell[1], font));
        };

        const draw = (time: number, looping = false) => {
            if (width === 0 || height === 0) return;
            if (!looping || frames++ % 30 === 0) {
                const { glowColor, shapeColor } = optionsRef.current;
                const text = getComputedStyle(container).color || "#737373";
                const glow = resolveColor(container, glowColor, text);
                const shape = resolveColor(container, shapeColor, text);
                const key = `${glow}|${shape}`;
                if (key !== colorKey) {
                    colorKey = key;
                    color = toRgb(glow);
                    accent = toRgb(shape);
                }
            }
            waves.fill(0);
            wavesRef.current = wavesRef.current.filter(
                (wave) => (time - wave.start) / 1000 < WAVE_LIFE,
            );
            wavesRef.current.forEach((wave, i) => {
                const age = (time - wave.start) / 1000;
                if (age <= 0) return;
                const radius = (WAVE_SPEED * age) / (1 + WAVE_SLOWDOWN * age);
                const fade =
                    // Faint at the click point (10%), full strength once it has spread out (~200px at 1s).
                    (0.1 + 0.9 * Math.min(1, age / 1)) *
                    Math.exp(-Math.max(0, age - 1) / 2.5) *
                    Math.min(1, (WAVE_LIFE - age) / 1);
                waves[i * 8] = wave.x;
                waves[i * 8 + 1] = wave.y;
                waves[i * 8 + 2] = radius;
                waves[i * 8 + 3] = fade * wave.strength;
                waves[i * 8 + 4] = wave.kind;
                waves[i * 8 + 5] = 0.12 + 0.5 * Math.min(1, age / 4);
                waves[i * 8 + 6] = wave.phase;
                waves[i * 8 + 7] = age * 3;
            });
            trail.fill(0);
            trailRef.current.forEach((point, i) => {
                const age = (time - point.t) / TRAIL_LIFE;
                if (age < 0 || age >= 1) return;
                trail[i * 4] = point.x;
                trail[i * 4 + 1] = point.y;
                trail[i * 4 + 2] = 40 + 25 * age;
                trail[i * 4 + 3] = 0.3 * (1 - age) * (1 - age);
            });
            const seconds = time / 1000;
            const energy = activityRef.current;
            const activity =
                energy.value * Math.exp(-Math.max(0, time - energy.at) / ACTIVITY_DECAY);
            const rect = container.getBoundingClientRect();
            renderer.draw({
                activity,
                origin: [rect.left * dpr, rect.top * dpr],
                width: canvas.width,
                height: canvas.height,
                dpr,
                cell,
                time: seconds,
                drift: [DRIFT[0] * seconds, DRIFT[1] * seconds],
                color,
                accent,
                waves,
                trail,
            });
        };

        drawRef.current = draw;
        resizeRef.current = resize;
        levelsRef.current = renderer.levels;
        resize();
        draw(timeRef.current);
        const observer = new ResizeObserver(() => {
            resize();
            draw(timeRef.current);
        });
        observer.observe(container);
        // A theme switch changes the colours. The animation loop picks that up on its own, but a still
        // field (reduced motion, or off screen) has to redraw for it.
        const themeObserver = new MutationObserver(() => draw(timeRef.current));
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
        return () => {
            observer.disconnect();
            themeObserver.disconnect();
            drawRef.current = () => {};
            resizeRef.current = () => {};
            levelsRef.current = () => {};
        };
    }, []);

    useEffect(() => {
        resizeRef.current();
        drawRef.current(timeRef.current);
    }, [fontSize]);

    useEffect(() => {
        levelsRef.current(haze, hoverInk);
        drawRef.current(timeRef.current);
    }, [haze, hoverInk]);

    useEffect(() => {
        drawRef.current(timeRef.current);
    }, [glowColor, shapeColor]);

    useEffect(() => {
        if (!playing) return;
        let handle = 0;
        let last = performance.now();
        const tick = (now: number) => {
            timeRef.current += Math.min(now - last, 64);
            last = now;
            drawRef.current(timeRef.current, true);
            handle = requestAnimationFrame(tick);
        };
        handle = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(handle);
    }, [playing]);

    useEffect(() => {
        if (!interactive || reduce) return;
        const container = containerRef.current;
        if (!container) return;

        /** The pointer in viewport coordinates (as the shader works in), or null when it's outside the box. */
        const point = (event: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = event.clientX;
            const y = event.clientY;
            return x < rect.left || y < rect.top || x > rect.right || y > rect.bottom
                ? null
                : { x, y };
        };

        const onPointerMove = (event: PointerEvent) => {
            const p = point(event);
            if (!p) return;
            const now = timeRef.current;
            const trail = trailRef.current;
            const last = trail[trail.length - 1];
            const energy = activityRef.current;
            const current = energy.value * Math.exp(-Math.max(0, now - energy.at) / ACTIVITY_DECAY);
            const moved = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
            activityRef.current = { value: Math.min(1, current + moved / 600), at: now };
            if (last && moved < 18) return;
            trailRef.current = [
                ...trail.filter((q) => now - q.t < TRAIL_LIFE).slice(1 - TRAIL),
                { ...p, t: now },
            ];
        };

        const onPointerDown = (event: PointerEvent) => {
            const p = point(event);
            if (!p) return;
            const kind = 1 + Math.floor(Math.random() * 2);
            const phase = Math.random() * Math.PI * 2;
            for (const [delay, strength] of [
                [0, 1],
                [WAVE_GAP, 0.3],
            ] as const) {
                const wave: Wave = {
                    ...p,
                    kind,
                    phase,
                    strength,
                    start: timeRef.current + delay * 1000,
                };
                wavesRef.current = [...wavesRef.current.slice(1 - MAX_WAVES), wave];
            }
        };

        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("pointerdown", onPointerDown, { passive: true });
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerdown", onPointerDown);
        };
    }, [interactive, reduce]);

    return (
        <div
            ref={containerRef}
            data-slot="glyph-background"
            aria-hidden="true"
            className={cn("pointer-events-none overflow-hidden", className)}
            {...props}
        >
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}
