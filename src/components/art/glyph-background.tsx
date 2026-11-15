/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * A field of monospace characters lit by drifting glows, a cursor trail and waves on click.
 *
 * `clouds` picks the drifting light and `surface` what it falls on (characters, or a topographic
 * map). The shader for each combination is assembled in glyph-background-shader.ts.
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

import {
    fragmentShader,
    MAX_WAVES,
    TRAIL,
    VERTEX_SHADER,
    type GlyphClouds,
    type GlyphSurface,
} from "@/components/art/glyph-background-shader";
import { cn } from "@/lib/utils";

const CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TRAIL_LIFE = 700;
const WAVE_LIFE = 6;
const WAVE_GAP = 0.6;
const WAVE_SPEED = 200;
const WAVE_SLOWDOWN = 0.15;
/** How fast the glows drift across, in px/s (left, down). Still under reduced motion: nothing animates. */
const DRIFT = [-12, 5] as const;
const ACTIVITY_DECAY = 900;
/** ~30 fps (with slack for a 60 Hz display's jitter): the field moves too slowly to gain from more. */
const FRAME_INTERVAL = 31;

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
    /** The characters the field is made of, picked at random per cell. Ignored by the `contours` surface. */
    characters?: string;
    /** The drifting light: see `GlyphClouds`. */
    clouds?: GlyphClouds;
    /** What the light falls on: see `GlyphSurface`. */
    surface?: GlyphSurface;
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

function drawAtlas(cellWidth: number, cellHeight: number, font: string, characters: string[]) {
    const atlas = document.createElement("canvas");
    atlas.width = Math.ceil(cellWidth * characters.length);
    atlas.height = Math.ceil(cellHeight);
    const context = atlas.getContext("2d")!;
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    for (let i = 0; i < characters.length; i++)
        context.fillText(characters[i]!, (i + 0.5) * cellWidth, cellHeight / 2);
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

function createRenderer(gl: WebGLRenderingContext, clouds: GlyphClouds, surface: GlyphSurface) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader(clouds, surface));
    const program = gl.createProgram();
    const release = () => {
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
    };
    if (!vertex || !fragment || !program) {
        release();
        return null;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        release();
        return null;
    }
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

    return {
        atlas(image: HTMLCanvasElement, count: number) {
            gl.uniform1f(uniforms.count, count);
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
        /** Free the GPU objects. The context itself is the canvas's, and outlives this renderer. */
        dispose() {
            release();
            gl.deleteBuffer(buffer);
            gl.deleteTexture(texture);
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
    characters = CHARACTERS,
    clouds = "layers",
    surface = "glyphs",
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
    const [contextGeneration, setContextGeneration] = useState(0);

    const wavesRef = useRef<Wave[]>([]);
    const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
    const drawRef = useRef<(time: number, looping?: boolean) => void>(() => {});
    const timeRef = useRef(0);
    const resizeRef = useRef(() => {});
    const levelsRef = useRef((_haze: number, _hoverInk: number) => {});
    const activityRef = useRef({ value: 0, at: 0 });

    const optionsRef = useRef({ glowColor, shapeColor, fontSize, characters, haze, hoverInk });
    useEffect(() => {
        optionsRef.current = { glowColor, shapeColor, fontSize, characters, haze, hoverInk };
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const gl = canvas.getContext("webgl", {
            premultipliedAlpha: true,
            antialias: false,
        });
        // A new shader program per clouds/surface pair, so switching them rebuilds it.
        const renderer = gl ? createRenderer(gl, clouds, surface) : null;
        // A lost context (GPU reset, sleep) blanks the canvas; when the browser restores it, rebuild.
        const onLost = (event: Event) => event.preventDefault();
        const onRestored = () => setContextGeneration((generation) => generation + 1);
        canvas.addEventListener("webglcontextlost", onLost);
        canvas.addEventListener("webglcontextrestored", onRestored);
        if (!renderer) {
            return () => {
                canvas.removeEventListener("webglcontextlost", onLost);
                canvas.removeEventListener("webglcontextrestored", onRestored);
            };
        }

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
            const { fontSize, characters } = optionsRef.current;
            // Only rebuild the atlas when it would change: the box resizes every frame while the sidebar animates.
            const key = `${fontSize}|${dpr}|${characters}`;
            if (key === atlasKey) return;
            atlasKey = key;
            const font = `${fontSize * dpr}px Menlo, ui-monospace, SFMono-Regular, Consolas, monospace`;
            const measure = document.createElement("canvas").getContext("2d")!;
            measure.font = font;
            cell = [Math.round(measure.measureText("0").width), Math.round(fontSize * 1.25 * dpr)];
            const glyphs = Array.from(characters);
            renderer.atlas(drawAtlas(cell[0], cell[1], font, glyphs), glyphs.length);
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
        renderer.levels(optionsRef.current.haze, optionsRef.current.hoverInk);
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
            canvas.removeEventListener("webglcontextlost", onLost);
            canvas.removeEventListener("webglcontextrestored", onRestored);
            renderer.dispose();
            drawRef.current = () => {};
            resizeRef.current = () => {};
            levelsRef.current = () => {};
        };
    }, [clouds, surface, contextGeneration]);

    useEffect(() => {
        resizeRef.current();
        drawRef.current(timeRef.current);
    }, [fontSize, characters]);

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
            handle = requestAnimationFrame(tick);
            if (now - last < FRAME_INTERVAL) return;
            timeRef.current += Math.min(now - last, 64);
            last = now;
            drawRef.current(timeRef.current, true);
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
