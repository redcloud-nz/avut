/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { DocsSearch } from "@/components/docs/docs-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** True when `el` is the docs search input with its results popover open. */
function isOpenSearchCombobox(el: Element | null) {
    return el?.getAttribute("role") === "combobox" && el.getAttribute("aria-expanded") === "true";
}

/**
 * Calls `onNavigate` once the pathname moves away from the one it mounted with. Rendered inside
 * the sheet's content, so it only mounts while the sheet is open and the `usePathname()` read
 * stays out of the static shell (under Cache Components it suspends during prerender).
 */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
    const pathname = usePathname();
    const [mountedPathname] = useState(pathname);

    useEffect(() => {
        if (pathname !== mountedPathname) onNavigate();
    }, [pathname, mountedPathname, onNavigate]);

    return null;
}

/**
 * The docs nav below `md`: a menu button (rendered before the logo in `PublicHeader`) that opens
 * a left sheet holding the docs search and `children` (the nav, passed in from the layout so its
 * Suspense boundary and flag read stay server-side). The sheet closes when the pathname changes
 * and when any link inside it is clicked, so picking the current page closes it too.
 */
export function DocsMobileNav({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {/* `-ml-2` lines the icon up with the page's left edge (the ghost button's padding). */}
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Docs menu"
                    className="-ml-2 md:hidden"
                >
                    <MenuIcon />
                </Button>
            </SheetTrigger>
            <SheetContent
                side="left"
                aria-describedby={undefined}
                className="gap-0"
                onOpenAutoFocus={(e) => {
                    // Focus the sheet itself rather than its first tabbable element (the search
                    // input), which would pop up the phone keyboard and fetch the search index.
                    e.preventDefault();
                    (e.currentTarget as HTMLElement | null)?.focus();
                }}
                onEscapeKeyDown={(e) => {
                    // Escape in open search results closes only the results (DocsSearch's own
                    // listener), not the sheet.
                    if (isOpenSearchCombobox(document.activeElement)) e.preventDefault();
                }}
                onClick={(e) => {
                    if ((e.target as Element).closest("a")) setOpen(false);
                }}
                onKeyDown={(e) => {
                    // Enter on a highlighted result navigates without a click; close here too, in
                    // case the result is the current page and the pathname doesn't change.
                    const target = e.target as Element;
                    if (
                        e.key === "Enter" &&
                        isOpenSearchCombobox(target) &&
                        target.hasAttribute("aria-activedescendant")
                    ) {
                        setOpen(false);
                    }
                }}
            >
                <Suspense fallback={null}>
                    <CloseOnNavigate onNavigate={() => setOpen(false)} />
                </Suspense>
                <SheetTitle className="sr-only">Docs</SheetTitle>
                <div className="border-b p-4 pr-12">
                    <DocsSearch className="w-full" align="start" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
