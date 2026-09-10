/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * `<ProductShot id="…" />` — a screenshot on the public marketing site. Reads the
 * same committed index as the docs `<Screenshot>` (see `@/lib/screenshots` and
 * `docs/specs/docs-screenshots.md`), but renders server-side with `next/image`
 * and no browser-chrome frame. Light/dark sources swap by CSS.
 */

import Image from "next/image";

import { getScreenshot } from "@/lib/screenshots";
import { cn } from "@/lib/utils";

export function ProductShot({ id, className }: { id: string; className?: string }) {
    const entry = getScreenshot(id);
    const dark = entry.dark ?? entry.light;

    return (
        <div className={cn("border-border overflow-hidden rounded-lg border", className)}>
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
        </div>
    );
}
