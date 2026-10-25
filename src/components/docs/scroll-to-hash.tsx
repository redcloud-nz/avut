/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect } from "react";

/**
 * Scrolls to the URL's `#hash` target once on mount. Render it inside a Suspense boundary whose
 * content holds the targets: on a client navigation Next scrolls to the hash when the static
 * shell commits, before streamed content exists, and doesn't retry once it arrives.
 */
export function ScrollToHash() {
    useEffect(() => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (id) document.getElementById(id)?.scrollIntoView();
    }, []);
    return null;
}
