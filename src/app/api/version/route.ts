/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /api/version
 *
 * Reports the version of the running deployment.
 *
 * `/api/version`                → JSON: ground-truth version, codename,
 *                                 branch, commit, environment, plus `display`
 *                                 (what the UI actually renders).
 * `/api/version?format=shields` → shields.io endpoint badge payload. The README's
 *                                 Production badge points here; non-production
 *                                 environments sit behind Vercel auth and aren't
 *                                 reachable by shields anyway.
 *
 * Not auth-gated by the app (the proxy matcher excludes `/api`).
 */

import { execSync } from "node:child_process";

import { NextResponse } from "next/server";

import appPackage from "../../../../package.json" with { type: "json" };

const meta = (appPackage as { "nz.avut": { version: string; versionName: string } })["nz.avut"];

// Neither Vercel nor GitHub Actions sets these locally — fall back to the
// current worktree's own checkout. Keep in sync with `next.config.ts`.
function readGitFallback(): { branch: string | null; commit: string | null } {
    try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", {
            stdio: ["ignore", "pipe", "ignore"],
        })
            .toString()
            .trim();
        const commit = execSync("git rev-parse --short HEAD", {
            stdio: ["ignore", "pipe", "ignore"],
        })
            .toString()
            .trim();
        return { branch, commit };
    } catch {
        return { branch: null, commit: null };
    }
}

// Reads request-specific query params, so this always runs at request time.
export async function GET(request: Request): Promise<NextResponse> {
    const envBranch = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? null;
    const environment = process.env.VERCEL_ENV ?? "development";
    const isProduction = environment === "production" || envBranch === "production";

    const gitFallback = envBranch ? null : readGitFallback();
    const branch = envBranch ?? gitFallback?.branch ?? null;
    const commit =
        (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA)?.slice(0, 7) ??
        gitFallback?.commit ??
        null;

    // Keep in sync with next.config.ts: only production renders a real version
    // and codename; everything else is `DEV.{branch}@{commit}`.
    const display = isProduction
        ? `v${meta.version} (${meta.versionName})`
        : `DEV.${branch ?? "local"}${commit ? `@${commit}` : ""}`;

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
        branch,
        commit,
        environment,
    });
}
