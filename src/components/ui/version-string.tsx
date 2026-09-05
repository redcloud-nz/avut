/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Renders the running app version, e.g. `AVUT v0.7-build.41 (Philomel)` on
 * master, or `AVUT v0.7 (Philomel)` on `production` (no build suffix).
 *
 * Values come from the `NEXT_PUBLIC_APP_*` env vars that `next.config.ts` derives
 * from the `nz.avut` block in `package.json` — the single source of truth for the
 * version number and its codename.
 */
export function VersionString({
    showName = true,
    className,
}: {
    /** Prefix with the app display name (`AVUT`). Off when a nearby logo already says it. */
    showName?: boolean;
    className?: string;
}) {
    const name = process.env.NEXT_PUBLIC_APP_DISPLAY_NAME;
    const version = process.env.NEXT_PUBLIC_APP_VERSION;
    const versionName = process.env.NEXT_PUBLIC_APP_VERSION_NAME;

    return (
        <span className={className}>
            {showName && name ? `${name} ` : ""}v{version}
            {versionName ? ` (${versionName})` : ""}
        </span>
    );
}
