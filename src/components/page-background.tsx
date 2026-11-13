/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The decorative layer behind every page in `Std.SidebarInset`.
 */

import { GlyphBackground } from "@/components/art/glyph-background";

/**
 * Switch for the animated glyph field behind every `Std` page. Off, pages sit on the plain `--page`
 * tint and everything glyph-specific (the `glyph-halo` class in `globals.css`) is inert.
 */
export const GLYPH_BACKGROUND_ENABLED = true;

/** Attributes for the element that hosts the page background (`Std.SidebarInset`). */
export const pageBackgroundAttributes = {
    "data-page-background": GLYPH_BACKGROUND_ENABLED ? "glyph" : "plain",
} as const;

/**
 * The glyph field, filling its positioned parent behind the page content (`-z-10`, so the parent
 * must be a stacking context). Light mode only for now.
 */
export function PageBackground() {
    if (!GLYPH_BACKGROUND_ENABLED) return null;

    return (
        <GlyphBackground
            className="absolute inset-0 -z-10 dark:hidden"
            glowColor="--muted-foreground"
            // The primary's hue (223) with far less chroma and a little lighter: a grey-blue.
            shapeColor="oklch(0.62 0.045 223)"
            haze={0.2}
            hoverInk={0.25}
        />
    );
}
