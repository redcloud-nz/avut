/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Render anywhere in a page to show the glyph background behind it (see page-background.tsx). Only
 * low-traffic pages opt in: index pages (`Std.IndexPage` renders one) and the org dashboard.
 *
 * It marks the hosting `Std.SidebarInset` with `data-glyph-pages` from a layout effect rather than
 * by its presence in the DOM: Next keeps a route it has navigated away from mounted inside a hidden
 * React `<Activity>`, so a DOM marker (and a `:has()` on it) would outlive its page. A hidden
 * Activity runs its layout effects' cleanups, so the attribute tracks the pages actually on screen.
 * A layout effect changes it in the same commit as the navigation, before paint, so neither page
 * shows a frame with the other's background. It is a count, so two opted-in pages swapping (one
 * cleaning up, one mounting) never drop it in between.
 */
export function GlyphPage() {
    const ref = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const host = ref.current?.closest<HTMLElement>("[data-page-background]");
        if (!host) return;

        host.dataset.glyphPages = String(Number(host.dataset.glyphPages ?? 0) + 1);
        return () => {
            const remaining = Number(host.dataset.glyphPages ?? 1) - 1;
            if (remaining > 0) host.dataset.glyphPages = String(remaining);
            else delete host.dataset.glyphPages;
        };
    }, []);

    return <span ref={ref} hidden />;
}
