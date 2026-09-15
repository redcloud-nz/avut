/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Docs-side mirror of `syntheticChecksFlag` (see `src/lib/flags.ts`): the same flag that gates
 * the "Use Synthetic Checks" report toggle also gates whether this callout — which documents
 * that toggle — appears at all. A dedicated "use client" component (rather than a branch inside
 * `<Callout>` in `mdx-components.tsx`) because it needs `useDocsFlags()`, and `mdx-components.tsx`
 * is shared, unmodified, with the server-rendered docs page.
 */

"use client";

import { useDocsFlags } from "@/components/docs/docs-flags-context";
import { Alert } from "@/components/ui/alert";

export function SyntheticChecksCallout() {
    const { syntheticChecksEnabled } = useDocsFlags();
    if (!syntheticChecksEnabled) return null;

    return (
        <Alert variant="warning" className="my-4 text-sm [&_p]:my-0">
            <div>
                Every report&rsquo;s <strong>⋮</strong> menu carries a{" "}
                <strong>Use Synthetic Checks</strong> toggle. Turning it on throws away the recorded
                results and fills the report with generated ones, so the numbers stop being about
                your people. Two things tell you it&rsquo;s on: a <strong>Synthetic Data</strong>{" "}
                button appears next to <strong>Change scope</strong>, and the address bar picks up{" "}
                <code>?synthetic</code>. Untick it — or drop that from the URL — to get the real
                data back.
            </div>
        </Alert>
    );
}
