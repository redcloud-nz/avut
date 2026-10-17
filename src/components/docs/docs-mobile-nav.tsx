/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { DocsSearch } from "@/components/docs/docs-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** True when `el` is the docs search input with its results popover open. */
function isOpenSearchCombobox(el: Element | null) {
    return el?.getAttribute("role") === "combobox" && el.getAttribute("aria-expanded") === "true";
}

/**
 * The docs nav below `md`: a menu button (rendered before the logo in `PublicHeader`) that opens
 * a left sheet holding the docs search and `children` (the nav, passed in from the layout so its
 * Suspense boundary and flag read stay server-side). The sheet closes when the pathname changes
 * and when any link inside it is clicked, so picking the current page closes it too.
 */
export function DocsMobileNav({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Close on navigation. Adjusting state during render rather than in an effect, per
    // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setOpen(false);
    }

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
                <SheetTitle className="sr-only">Docs</SheetTitle>
                <div className="border-b p-4 pr-12">
                    <DocsSearch className="w-full" align="start" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
