/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * `<ProductShot id="…" />` — a screenshot on the public marketing site. Reads the
 * same committed index as the docs `<Screenshot>` (see `@/lib/screenshots` and
 * `docs/specs/docs-screenshots.md`), rendered with `next/image` and no
 * browser-chrome frame. Light/dark sources are art-directed via `<picture>`
 * (`getImageProps` + a `prefers-color-scheme` `<source>`) so the browser fetches
 * only the variant it needs, not both. The trigger image is on the hero's LCP
 * path, so it's marked `priority`.
 */

"use client";

import { getImageProps } from "next/image";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getScreenshot } from "@/lib/screenshots";
import { cn } from "@/lib/utils";

function ThemedPicture({
    light,
    dark,
    alt,
    sizes,
    priority,
    className,
}: {
    light: { url: string; width: number; height: number };
    dark: { url: string; width: number; height: number };
    alt: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}) {
    const {
        props: { srcSet: darkSrcSet },
    } = getImageProps({
        src: dark.url,
        alt,
        width: dark.width,
        height: dark.height,
        sizes,
        priority,
    });
    const { props: lightImgProps } = getImageProps({
        src: light.url,
        alt,
        width: light.width,
        height: light.height,
        sizes,
        priority,
    });

    return (
        <picture>
            <source media="(prefers-color-scheme: dark)" srcSet={darkSrcSet} />
            {/* eslint-disable-next-line jsx-a11y/alt-text -- `alt` is in the getImageProps() spread; the rule can't see through it */}
            <img {...lightImgProps} className={className} />
        </picture>
    );
}

export function ProductShot({
    id,
    className,
    caption,
}: {
    id: string;
    className?: string;
    /** Shown under the image in the zoom dialog. Defaults to the index's alt text. */
    caption?: string;
}) {
    const entry = getScreenshot(id);
    const dark = entry.dark ?? entry.light;
    const maxWidth = entry.light.width;
    const dialogCaption = caption ?? entry.alt;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "border-border block w-full cursor-zoom-in overflow-hidden rounded-lg border",
                        className,
                    )}
                >
                    <ThemedPicture
                        light={entry.light}
                        dark={dark}
                        alt={entry.alt}
                        sizes="(min-width: 1120px) 1040px, 100vw"
                        priority
                        className="w-full"
                    />
                </button>
            </DialogTrigger>
            <DialogContent
                className="w-fit max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-[95vw]"
                style={{ width: maxWidth }}
            >
                <DialogTitle className="sr-only">{entry.alt}</DialogTitle>
                <ThemedPicture
                    light={entry.light}
                    dark={dark}
                    alt={entry.alt}
                    sizes="95vw"
                    className="h-auto w-full"
                />
                {dialogCaption && (
                    <figcaption className="text-muted-foreground border-t px-3 py-2 text-center text-sm">
                        {dialogCaption}
                    </figcaption>
                )}
            </DialogContent>
        </Dialog>
    );
}
