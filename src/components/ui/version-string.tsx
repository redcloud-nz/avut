/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * Renders the running app version. Production always renders one line — a
 * real version and codename, `AVUT v0.7 (Philomel)`.
 *
 * Non-production has two layouts:
 * - `inline` (default) — one line, `Development 40849aa integration` — for
 *   tight spaces like the marketing page's pill.
 * - `stacked` — two lines, `AVUT Development 40849aa` over `integration` —
 *   for roomier spots like the sidebar footer, where the branch reads better
 *   on its own line.
 *
 * All parts come pre-formatted from the `NEXT_PUBLIC_APP_*` env vars that
 * `next.config.ts` derives from the `nz.avut` block in `package.json` plus
 * the deployment's git ref — that decides prod-vs-not; this component just
 * lays them out.
 */
export function VersionString({
    showName = true,
    layout = "inline",
    className,
}: {
    /** Prefix with the app display name (`AVUT`). Off when a nearby logo already says it. */
    showName?: boolean;
    /** `inline` (default): one line, no branch. `stacked`: two lines, with branch on its own line. */
    layout?: "inline" | "stacked";
    className?: string;
}) {
    const name = env.NEXT_PUBLIC_APP_DISPLAY_NAME;
    const version = env.NEXT_PUBLIC_APP_VERSION;
    const versionName = env.NEXT_PUBLIC_APP_VERSION_NAME;
    const branch = env.NEXT_PUBLIC_APP_BRANCH;
    const commit = env.NEXT_PUBLIC_APP_COMMIT;

    if (branch && layout === "stacked") {
        return (
            <span className={cn("flex flex-col items-center leading-tight", className)}>
                <span>
                    {showName && name ? `${name} ` : ""}
                    {version}
                    {commit ? ` ${commit}` : ""}
                </span>
                <span className="opacity-70">{branch}</span>
            </span>
        );
    }

    if (branch) {
        const prefix = showName && name ? `${name} ` : "";
        const commitPart = commit ? ` ${commit}` : "";
        return (
            <span className={className}>
                {prefix}
                {version}
                {commitPart} {branch}
            </span>
        );
    }

    return (
        <span className={className}>
            {showName && name ? `${name} ` : ""}
            {version}
            {versionName ? ` (${versionName})` : ""}
        </span>
    );
}
