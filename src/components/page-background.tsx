/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The decorative layer behind pages in `Std.SidebarInset`.
 */

import { GlyphBackground } from "@/components/art/glyph-background";

/**
 * Switch for the animated glyph field. Off, every page sits on the plain `--page` tint and
 * everything glyph-specific (the `glyph-halo` class and the rules in `globals.css`) is inert.
 *
 * On, the field still shows only behind pages that render `<GlyphPage />` (glyph-page.tsx): the
 * low-traffic ones such as index pages and the org dashboard. Working pages (lists, detail pages,
 * forms) stay on the plain tint, since a moving background competes with the content.
 *
 * Off for now (2026-11-19): set aside until the palette work (#543) settles. Turning it back on
 * gives the low-traffic-only field above, in the colours `globals.css` then holds.
 */
export const GLYPH_BACKGROUND_ENABLED = false;

/**
 * The field is made of braille patterns, which read as a fine dot texture rather than text. Every
 * 4th pattern of U+2801–U+28FF: 64 is plenty of variety and keeps the glyph atlas a sane width.
 */
const BRAILLE = Array.from({ length: 64 }, (_, i) => String.fromCodePoint(0x2801 + i * 4)).join("");

/** Attributes for the element that hosts the page background (`Std.SidebarInset`). */
export const pageBackgroundAttributes = {
    "data-page-background": GLYPH_BACKGROUND_ENABLED ? "glyph" : "plain",
} as const;

/**
 * The glyph field, filling its positioned parent behind the page content (`-z-10`, so the parent
 * must be a stacking context). `globals.css` hides it (`.glyph-layer`) unless a `<GlyphPage />` has
 * marked the host; hidden, it is not intersecting, so its animation loop pauses.
 */
export function PageBackground() {
    if (!GLYPH_BACKGROUND_ENABLED) return null;

    return (
        <GlyphBackground
            className="glyph-layer absolute inset-0 -z-10"
            // Per-theme colours, in globals.css.
            glowColor="--glyph-glow"
            shapeColor="--glyph-ripple"
            haze={0.3}
            hoverInk={0.25}
            characters={BRAILLE}
            // The alternatives that were tried: clouds "single" or "warped", surface "contours"
            // (a topographic map, which needs its own tuning before it's subtle enough to use).
            clouds="layers"
            surface="glyphs"
        />
    );
}
