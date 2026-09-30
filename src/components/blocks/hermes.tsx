/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Hermes master-detail layout components.
 *
 * A list pane beside a detail pane, filling what's left of `Std.SidebarInset` under the navbar.
 * Render `Hermes.Root` from the route's `layout.tsx`, with the list in `Hermes.List` and the
 * layout's `children` (the selected record, or `Hermes.Placeholder` on the index route) in
 * `Hermes.Detail`. Each pane scrolls on its own, and together they replace `Std.ScrollContainer`.
 *
 * At `md` and up both panes show side by side. Below `md` only the active one does: the list
 * when nothing is selected, the detail when a record is.
 *
 * Switching records crossfades the detail pane: `Hermes.Detail` wraps its children in a
 * `ViewTransition` keyed on the selected segment (see `HermesDetailTransition`). Two limits follow:
 *
 * - The record id must be the direct child segment of the layout that renders Hermes (e.g.
 *   `notes/layout.tsx` above `notes/[note_id]`). Anything deeper doesn't change the key, so those
 *   records swap without the crossfade.
 * - The transition's `name` is fixed (`hermes-detail`), and a view-transition name must be unique
 *   on screen, so there can be only one Hermes per screen.
 *
 * Suspense: `Hermes.List` has its own boundary. `Hermes.Detail` has none, and the route must not
 * add one with a `loading.tsx`: a fallback mounted under the new key would be what the crossfade
 * shows. Without one, a record navigation keeps the old record on screen until the new one is
 * ready, and a hard load falls back to the nearest `loading.tsx` above the route (for org routes,
 * `orgs/[slug]/loading.tsx`).
 */

import { ComponentProps, Suspense } from "react";

import { RainbowSpinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

import { HermesDetailTransition, HermesRoot } from "./hermes-root";

const paneScroll =
    "overflow-y-auto [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable_both-edges]";

function HermesList({ children, className, ...props }: ComponentProps<"nav">) {
    return (
        <nav
            data-component="HermesList"
            data-slot="list"
            className={cn(
                "flex-1 max-md:group-data-[selected=true]/hermes:hidden md:flex-none md:w-80 md:border-r",
                paneScroll,
                className,
            )}
            {...props}
        >
            <Suspense
                fallback={
                    <div className="flex h-full items-center justify-center p-4">
                        <RainbowSpinner />
                    </div>
                }
            >
                {children}
            </Suspense>
        </nav>
    );
}

function HermesDetail({ children, className, ...props }: ComponentProps<"main">) {
    return (
        <main
            data-component="HermesDetail"
            data-slot="detail"
            className={cn(
                "relative min-w-0 flex-1 p-4 max-md:group-data-[selected=false]/hermes:hidden",
                paneScroll,
                className,
            )}
            {...props}
        >
            <HermesDetailTransition>{children}</HermesDetailTransition>
        </main>
    );
}

function HermesPlaceholder({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="HermesPlaceholder"
            className={cn(
                "hidden h-full items-center justify-center text-sm text-muted-foreground md:flex",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export const Hermes = {
    Root: HermesRoot,
    List: HermesList,
    Detail: HermesDetail,
    Placeholder: HermesPlaceholder,
};
