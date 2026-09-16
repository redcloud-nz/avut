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

/** Rendered once, in the sidebar shell, where scope-specific module content should appear. */
export function SidebarPortalOutlet() {
    const ctx = use(SidebarPortalContext);
    return <div ref={ctx?.setContainer} />;
}

/** Portals `children` into wherever `SidebarPortalOutlet` is mounted. Renders nothing until the outlet exists. */
export function SidebarPortal({ children }: { children: ReactNode }) {
    const ctx = use(SidebarPortalContext);
    if (!ctx?.container) return null;
    return createPortal(children, ctx.container);
}
