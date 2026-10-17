/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * "On this page" contents list for the Saratoga secondary column — jump links to a page's own
 * section headings, with the current section highlighted as it scrolls past. Meant for pages
 * with several sections (e.g. a settings form with more than one card); a single-section page
 * gets more value from an empty secondary column than a one-item list pointing at itself, so
 * this renders nothing once there are fewer than two entries (counting nested `children`).
 *
 * Works in two scroll modes: inside a `Std.ScrollContainer` (the app shell, where the page
 * scrolls in that `overflow-y-auto` element) it measures against that container; with no such
 * ancestor (e.g. the public docs pages) it measures against the window. Either way the trigger
 * line sits `offset` px below the top of what scrolls — pass a larger `offset` when a sticky
 * header covers the top of the viewport.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface SaratogaContentsItem {
    /** Must match the `id` of the heading/section element this entry jumps to. */
    id: string;
    label: string;
    /** E.g. the individual module cards nested under a form's "Modules" section. */
    children?: SaratogaContentsItem[];
}

function flatten(items: SaratogaContentsItem[]): SaratogaContentsItem[] {
    return items.flatMap((item) => [item, ...(item.children ?? [])]);
}

export function SaratogaContents({
    items,
    offset = 24,
    className,
}: {
    items: SaratogaContentsItem[];
    /** Px from the top of the scroll viewport to the line a heading must pass to become current. */
    offset?: number;
    /** Merged onto the `<nav>`, e.g. to change its breakpoint or `sticky top-…`. */
    className?: string;
}) {
    const flat = flatten(items);
    const [activeId, setActiveId] = useState<string | undefined>(flat[0]?.id);
    const navRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;

        // In the app shell the page scrolls inside `Std.ScrollContainer` (`overflow-y-auto`), not
        // the window, so measure against that ancestor when there is one; otherwise the window.
        const container = nav.closest('[data-slot="scroll-container"]');
        const scrollTarget: HTMLElement | Window =
            container instanceof HTMLElement ? container : window;

        const ids = flat.map((item) => item.id);

        // Deliberately not IntersectionObserver: with entries reported only on state changes, a
        // short section (e.g. a single module card) can be skipped over between two callbacks —
        // it never gets its own "isIntersecting" entry if a scroll jump carries the trigger band
        // straight past it. Reading every heading's position on each scroll avoids that.
        let ticking = false;
        function updateActiveId() {
            ticking = false;

            // Once scrolled to the bottom, trailing headings close enough to the end of the
            // page can never themselves reach the trigger line below — there isn't enough
            // content left under them to keep scrolling. Treat "at the bottom" as "on the last
            // entry" rather than leaving it permanently unreachable.
            const atBottom = container
                ? container.scrollTop + container.clientHeight >= container.scrollHeight - 1
                : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
            if (atBottom) {
                setActiveId(ids[ids.length - 1]);
                return;
            }

            const triggerY = (container ? container.getBoundingClientRect().top : 0) + offset;

            let current = ids[0];
            for (const id of ids) {
                const heading = document.getElementById(id);
                if (heading && heading.getBoundingClientRect().top <= triggerY) {
                    current = id;
                }
            }
            setActiveId(current);
        }

        function onScroll() {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(updateActiveId);
            }
        }

        updateActiveId();
        scrollTarget.addEventListener("scroll", onScroll, { passive: true });
        return () => scrollTarget.removeEventListener("scroll", onScroll);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `flat` is a new array each render; its ids are what actually matter.
    }, [flat.map((item) => item.id).join(","), offset]);

    if (flat.length < 2) return null;

    const linkClass = (id: string) =>
        cn(
            "block border-l-2 border-transparent py-1 pl-3 text-muted-foreground transition-colors hover:text-foreground",
            activeId === id && "border-foreground font-medium text-foreground",
        );

    return (
        <nav ref={navRef} className={cn("hidden lg:block sticky top-4 text-sm", className)}>
            <p className="mb-2 font-medium text-muted-foreground">On this page</p>
            <ul className="space-y-1">
                {items.map((item) => (
                    <li key={item.id}>
                        <a href={`#${item.id}`} className={linkClass(item.id)}>
                            {item.label}
                        </a>
                        {item.children && item.children.length > 0 && (
                            <ul className="space-y-1">
                                {item.children.map((child) => (
                                    <li key={child.id}>
                                        <a
                                            href={`#${child.id}`}
                                            className={cn(linkClass(child.id), "pl-6")}
                                        >
                                            {child.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}

/**
 * A spacer for the *main* column on a page that also renders `Saratoga.Contents` in the
 * secondary column — without it, a heading near the end of the page can never scroll up to
 * `Saratoga.Contents`' trigger line, since there's nowhere left to scroll once it's reached.
 * Deliberately a sibling in the main column rather than something added to the secondary
 * column's own height: they're independent grid items, so padding out the TOC's column doesn't
 * reliably carry over to how far the *main* column's own content can scroll.
 */
export function SaratogaContentsSpacer({ className }: { className?: string }) {
    return <div aria-hidden className={cn("hidden h-[50vh] lg:block", className)} />;
}
