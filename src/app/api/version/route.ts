/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /api/version
 *
 * Reports the version of the running deployment. Each environment answers for
 * itself — production at its domain returns the bare release version, the
 * integration deployment returns the build-stamped version — so the README can
 * carry a live badge per environment (`?format=shields`).
 *
 * `/api/version`                → JSON: { version, versionName, build, branch, commit, environment }
 * `/api/version?format=shields` → shields.io endpoint badge payload
 *
 * Not auth-gated (the proxy matcher excludes `/api`). Public-facing but harmless:
 * version, codename, branch, short commit.
 */

import { NextResponse } from "next/server";

import appPackage from "../../../../package.json" with { type: "json" };

const meta = (appPackage as { "nz.avut": { version: string; versionName: string; build: number } })[
    "nz.avut"
];

// Reads request-specific query params, so this always runs at request time.
export async function GET(request: Request): Promise<NextResponse> {
    // Mirror next.config.ts: production ships a bare `{version}`, every other
    // branch appends the build number so in-progress builds stay distinct.
    const branch = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? null;
    const isProduction = process.env.VERCEL_ENV === "production" || branch === "production";
    const version = isProduction ? meta.version : `${meta.version}-build.${meta.build}`;
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
    const environment = process.env.VERCEL_ENV ?? "development";

    const display = `v${version}${meta.versionName ? ` (${meta.versionName})` : ""}`;

    if (new URL(request.url).searchParams.get("format") === "shields") {
        return NextResponse.json({
            schemaVersion: 1,
            label: isProduction ? "production" : (branch ?? "integration"),
            message: display,
            color: isProduction ? "brightgreen" : "blue",
            cacheSeconds: 300,
        });
    }

    return NextResponse.json({
        version,
        versionName: meta.versionName,
        build: meta.build,
        branch,
        commit,
        environment,
    });
}
