/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Renders the running app version. Only production shows a real version and
 * codename — `AVUT v0.7 (Philomel)`. Every other environment is transient and
 * renders `AVUT DEV.62` (the build number, nothing else).
 *
 * Both parts come pre-formatted from the `NEXT_PUBLIC_APP_*` env vars that
 * `next.config.ts` derives from the `nz.avut` block in `package.json` — that
 * decides prod-vs-not; this component just concatenates.
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
            {showName && name ? `${name} ` : ""}
            {version}
            {versionName ? ` (${versionName})` : ""}
        </span>
    );
}
