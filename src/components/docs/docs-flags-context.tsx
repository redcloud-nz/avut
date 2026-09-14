/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Carries deployment-flag state into MDX-rendered docs content. Flags resolve server-side
 * (`src/lib/flags.ts`), but the components authors write MDX against (`docsMdxComponents`) are
 * shared, unmodified, between a server-rendered page (`/docs/[[...slug]]`) and the client-side
 * `?help=` sheet — so a flag-gated MDX component can't call a flag directly. Whoever resolves the
 * flag (the docs page, or the `/docs/help/[...slug]` route) provides it here instead.
 */

"use client";

import { createContext, useContext, type ReactNode } from "react";

interface DocsFlags {
    /** Mirrors `syntheticChecksFlag` — see `src/lib/flags.ts`. */
    syntheticChecksEnabled: boolean;
}

const DEFAULT_DOCS_FLAGS: DocsFlags = { syntheticChecksEnabled: false };

const DocsFlagsContext = createContext<DocsFlags>(DEFAULT_DOCS_FLAGS);

export function DocsFlagsProvider({ children, ...flags }: DocsFlags & { children: ReactNode }) {
    return <DocsFlagsContext.Provider value={flags}>{children}</DocsFlagsContext.Provider>;
}

export function useDocsFlags(): DocsFlags {
    return useContext(DocsFlagsContext);
}
