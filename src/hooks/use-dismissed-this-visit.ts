/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Whether a dialog that's forced open on arrival has been dismissed during this visit to the page.
 * `useState` alone isn't enough: with cacheComponents, Next keeps a page the user navigated away
 * from mounted in a hidden `<Activity>` and shows the same instance again on return, so a plain
 * flag would outlive the visit and the dialog would stay shut (#470). The layout-effect cleanup runs
 * when the page is hidden, so each return counts as a fresh arrival.
 */
export function useDismissedThisVisit() {
    const [dismissed, setDismissed] = useState(false);

    useLayoutEffect(() => () => setDismissed(false), []);

    return [dismissed, setDismissed] as const;
}
