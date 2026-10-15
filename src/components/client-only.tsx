/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode, useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Render `children` only in the browser, showing `fallback` during SSR and hydration.
 *
 * For subtrees that can't render on the server at all — TanStack DB's `useLiveSuspenseQuery`
 * has no server snapshot, and its collections fetch through the HTTP tRPC client, which carries
 * no session during SSR.
 */
export function ClientOnly({
    children,
    fallback = null,
}: {
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const isClient = useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );

    return isClient ? children : fallback;
}
