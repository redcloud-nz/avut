/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

import { RainbowSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations within the notes module. It wraps the layout's `children`,
 * which render inside `Hermes.Detail`, so it's sized to the detail pane rather than the page: the
 * navbar and list pane stay put while the next note loads.
 */
export default function Notes_LoadingPage() {
    return (
        <div className="flex h-full items-center justify-center">
            <RainbowSpinner />
        </div>
    );
}
