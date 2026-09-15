/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * `<Screenshot id="…" />` — the only sanctioned way to put an image in docs MDX.
 * Resolves the id against the committed index (`screenshots.generated.json`),
 * renders a framed figure with light/dark sources art-directed via `<picture>`
 * (a `prefers-color-scheme` `<source>`, so the browser fetches only the variant
 * it needs), and opens the image full-size in a dialog on click (it is often
 * shown in the narrow `?help=` sheet). See `docs/specs/docs-screenshots.md`.
 */

"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getScreenshot } from "@/lib/screenshots";

function ThemedPicture({
    light,
    dark,
    alt,
    loading,
    className,
}: {
    light: { url: string; width: number; height: number };
    dark: { url: string; width: number; height: number };
    alt: string;
    loading?: "lazy" | "eager";
    className?: string;
}) {
    return (
        <picture>
            <source media="(prefers-color-scheme: dark)" srcSet={dark.url} />
            <img
                src={light.url}
                width={light.width}
                height={light.height}
                alt={alt}
                loading={loading}
                className={className}
            />
        </picture>
    );
}

interface ScreenshotProps {
    /**
     * Key into `screenshots.generated.json`. An unknown id throws when resolved —
     * this component is client-rendered on a dynamically-rendered `/docs/*` route,
     * so that surfaces in the browser at request time, not at `next build`. Only
     * the statically-rendered `<ProductShot>` on the home page actually fails the
     * build.
     */
    id: string;
    /** Optional `<figcaption>` shown under the frame. */
    caption?: string;
    /** Optional override of the index's `alt` text. */
    alt?: string;
}

export function Screenshot({ id, caption, alt }: ScreenshotProps) {
    const entry = getScreenshot(id);
    const resolvedAlt = alt ?? entry.alt;
    const dark = entry.dark ?? entry.light;

    // Never upscale past the captured resolution — a 500px-wide capture shown in
    // a wider prose column looks blown up. Cap the figure at the intrinsic width
    // (`width` in the index is CSS px) and centre it.
    const maxWidth = entry.light.width;

    return (
        <figure
            className="my-6 flex flex-col items-center"
            style={{ maxWidth, marginInline: "auto" }}
        >
            <Dialog>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="ring-border block w-full cursor-zoom-in overflow-hidden rounded-lg ring-1"
                    >
                        <ThemedPicture
                            light={entry.light}
                            dark={dark}
                            alt={resolvedAlt}
                            loading="lazy"
                            className="block h-auto w-full"
                        />
                    </button>
                </DialogTrigger>
                <DialogContent
                    className="w-fit max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-[95vw]"
                    style={{ width: maxWidth }}
                >
                    <DialogTitle className="sr-only">{resolvedAlt}</DialogTitle>
                    <ThemedPicture
                        light={entry.light}
                        dark={dark}
                        alt={resolvedAlt}
                        className="block h-auto w-full"
                    />
                    {caption && (
                        <figcaption className="text-muted-foreground border-t px-3 py-2 text-center text-sm">
                            {caption}
                        </figcaption>
                    )}
                </DialogContent>
            </Dialog>
            {caption && (
                <figcaption className="text-muted-foreground mt-2 text-center text-sm">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
}

/**
 * Raw Markdown images (`![]()`) are not supported in docs MDX — screenshots must
 * go through `<Screenshot>` so they are captured, themed, and dimensioned from
 * the index. This override makes a stray image loud rather than silently broken.
 */
export function UnsupportedImg({ src }: { src?: string }) {
    return (
        <span className="my-4 block rounded border border-red-500 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            Raw Markdown images aren’t supported in docs. Use <code>{`<Screenshot id="…" />`}</code>{" "}
            instead
            {src ? ` (found: ${src})` : ""}.
        </span>
    );
}
