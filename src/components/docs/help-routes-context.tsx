/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { createContext, ReactNode, useContext } from "react";

import type { HelpCardRoutes } from "@/lib/route-pattern";

const HelpRoutesContext = createContext<readonly HelpCardRoutes[]>([]);

/**
 * Hands the help cards' routes to `PageHelpButton`. The authenticated layout fills it from
 * `helpCardRoutes()` (`src/server/docs.ts`), so the client never imports `allHelpCards` and its
 * compiled MDX. Build-time data: the same for every request.
 */
export function HelpRoutesProvider({
    cards,
    children,
}: {
    cards: readonly HelpCardRoutes[];
    children: ReactNode;
}) {
    return <HelpRoutesContext value={cards}>{children}</HelpRoutesContext>;
}

/** The help cards' routes, or an empty list outside `HelpRoutesProvider`. */
export function useHelpCardRoutes(): readonly HelpCardRoutes[] {
    return useContext(HelpRoutesContext);
}
