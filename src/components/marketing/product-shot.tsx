/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * `<ProductShot id="…" />` — a screenshot on the public marketing site. Reads the
 * same committed index as the docs `<Screenshot>` (see `@/lib/screenshots` and
 * `docs/specs/docs-screenshots.md`), rendered with `next/image` and no
 * browser-chrome frame. Light/dark sources swap by CSS; clicking opens the image
 * full-size in a dialog, the same as the docs `<Screenshot>`.
 */

"use client";

import Image from "next/image";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getScreenshot } from "@/lib/screenshots";
import { cn } from "@/lib/utils";

export function ProductShot({ id, className }: { id: string; className?: string }) {
    const entry = getScreenshot(id);
    const dark = entry.dark ?? entry.light;
    const maxWidth = entry.light.width;

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
                    <Image
                        src={entry.light.url}
                        alt={entry.alt}
                        width={entry.light.width}
                        height={entry.light.height}
                        sizes="(min-width: 1120px) 1040px, 100vw"
                        className="w-full dark:hidden"
                    />
                    <Image
                        src={dark.url}
                        alt={entry.alt}
                        width={dark.width}
                        height={dark.height}
                        sizes="(min-width: 1120px) 1040px, 100vw"
                        className="hidden w-full dark:block"
                    />
                </button>
            </DialogTrigger>
            <DialogContent
                className="w-fit max-w-[95vw] p-2 sm:max-w-[95vw]"
                style={{ width: maxWidth + 16 }}
            >
                <DialogTitle className="sr-only">{entry.alt}</DialogTitle>
                <Image
                    src={entry.light.url}
                    alt={entry.alt}
                    width={entry.light.width}
                    height={entry.light.height}
                    sizes="95vw"
                    className="h-auto w-full rounded dark:hidden"
                />
                <Image
                    src={dark.url}
                    alt={entry.alt}
                    width={dark.width}
                    height={dark.height}
                    sizes="95vw"
                    className="hidden h-auto w-full rounded dark:block"
                />
            </DialogContent>
        </Dialog>
    );
}
