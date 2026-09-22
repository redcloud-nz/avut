/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Lets a scope's real route-tree layout (which Next always invokes normally, unlike the
 * `@sidebar` parallel route this replaces — see `org-sidebar-modules.tsx`) render sidebar
 * content that visually appears inside the shared sidebar shell in `(authenticated)/layout.tsx`.
 * A `createPortal` only changes *where in the DOM* `children` mounts — the React tree (and so
 * context/hooks like `useOrganization`) still resolves from wherever `SidebarPortal` was
 * actually rendered, which is what makes this work.
 */

"use client";

import { createContext, ReactNode, use, useState } from "react";
import { createPortal } from "react-dom";

import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface SidebarPortalContextValue {
    container: HTMLDivElement | null;
    setContainer: (node: HTMLDivElement | null) => void;
}

const SidebarPortalContext = createContext<SidebarPortalContextValue | null>(null);

/** Wraps the authenticated shell — both the sidebar (with the outlet) and the main content tree (with portal sources) need to share this context. */
export function SidebarPortalProvider({ children }: { children: ReactNode }) {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    return (
        <SidebarPortalContext value={{ container, setContainer }}>{children}</SidebarPortalContext>
    );
}

/**
 * Rendered once, in the sidebar shell, where scope-specific module content should appear.
 *
 * `createPortal` can't run during SSR, so a `SidebarPortal`'s content is absent from the server
 * HTML and only appears after hydration. The skeleton below covers that gap: it is hidden by
 * default and shown only while a `SidebarPortal` is mounted but has nowhere to portal to yet
 * (its pending marker is in the DOM). Keying off the marker in CSS — rather than state — is what
 * lets it show in the server-rendered first paint, and keeps it off scopes with no portal source.
 */
export function SidebarPortalOutlet() {
    const ctx = use(SidebarPortalContext);
    return (
        <>
            <div ref={ctx?.setContainer} />
            <div aria-hidden className="hidden [body:has([data-sidebar-portal-pending])_&]:block">
                <SidebarGroup>
                    <SidebarMenu>
                        {Array.from({ length: 5 }, (_, i) => (
                            <SidebarMenuItem key={i}>
                                <Skeleton className="h-8 w-full" />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </div>
        </>
    );
}

/** Portals `children` into wherever `SidebarPortalOutlet` is mounted. Until the outlet exists, renders only the marker that tells the outlet to show its skeleton. */
export function SidebarPortal({ children }: { children: ReactNode }) {
    const ctx = use(SidebarPortalContext);
    if (!ctx?.container) return <span hidden data-sidebar-portal-pending="" />;
    return createPortal(children, ctx.container);
}
