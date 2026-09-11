/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /api/version
 *
 * Reports the version of the running deployment.
 *
 * `/api/version`                → JSON: ground-truth version, codename, build,
 *                                 branch, commit, environment, plus `display`
 *                                 (what the UI actually renders).
 * `/api/version?format=shields` → shields.io endpoint badge payload. The README's
 *                                 Production badge points here; non-production
 *                                 environments sit behind Vercel auth and aren't
 *                                 reachable by shields anyway (the Integration
 *                                 badge reads the build number straight off the
 *                                 branch's package.json instead).
 *
 * Not auth-gated by the app (the proxy matcher excludes `/api`).
 */

import { NextResponse } from "next/server";

import appPackage from "../../../../package.json" with { type: "json" };

const meta = (appPackage as { "nz.avut": { version: string; versionName: string; build: number } })[
    "nz.avut"
];

// Reads request-specific query params, so this always runs at request time.
export async function GET(request: Request): Promise<NextResponse> {
    const branch = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? null;
    const environment = process.env.VERCEL_ENV ?? "development";
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

    // Keep in sync with next.config.ts: only production renders a real version
    // and codename; everything else is `DEV.{build}`.
    const isProduction = environment === "production" || branch === "production";
    const display = isProduction ? `v${meta.version} (${meta.versionName})` : `DEV.${meta.build}`;

    if (new URL(request.url).searchParams.get("format") === "shields") {
        return NextResponse.json({
            schemaVersion: 1,
            label: isProduction ? "production" : (branch ?? "dev"),
            message: display,
            color: isProduction ? "brightgreen" : "blue",
            cacheSeconds: 300,
        });
    }

    return NextResponse.json({
        display,
        version: meta.version,
        versionName: meta.versionName,
        build: meta.build,
        branch,
        commit,
        environment,
    });
}
