/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { execSync } from "node:child_process";

import { withContentCollections } from "@content-collections/next";
import type { NextConfig } from "next";

interface PackageData {
    name: string;
    version: string;
    license: string;
    private: boolean;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    ["nz.avut"]?: {
        displayName: string;
        repositoryUrl: string;
        version: string;
        versionName: string;
    };
}

import packageDataJson from "./package.json" with { type: "json" };
const packageData = packageDataJson as unknown as PackageData;

const appMetadata = packageData["nz.avut"];
if (!appMetadata) {
    throw new Error("Missing required 'nz.avut' metadata in package.json");
}

// Neither Vercel nor GitHub Actions sets these locally, so fall back to reading
// the current worktree's own checkout — each worktree has its own HEAD, so this
// naturally disambiguates multiple dev servers running against different branches.
// Keep this rule in sync with `src/app/api/version/route.ts`.
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

const envBranch = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? null;
const environment = process.env.VERCEL_ENV ?? "development";
const isProduction = environment === "production" || envBranch === "production";

const gitFallback = envBranch ? null : readGitFallback();
const branchName = envBranch ?? gitFallback?.branch ?? "local";
const commitSha =
    (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA)?.slice(0, 7) ??
    gitFallback?.commit ??
    null;

const environmentLabel =
    environment === "development"
        ? "Development"
        : environment === "preview"
          ? "Preview"
          : environment;

// Only production renders a real version and codename (e.g. `v0.7 (Philomel)`).
// Every other environment is transient: `NEXT_PUBLIC_APP_VERSION` carries the
// environment label ("Development"/"Preview") and `NEXT_PUBLIC_APP_BRANCH`/
// `_COMMIT` carry the checkout — `VersionString` renders those as a second
// line rather than concatenating everything into one string.
const appVersion = isProduction ? `v${appMetadata.version}` : environmentLabel;
const appVersionName = isProduction ? appMetadata.versionName : "";

const nextConfig: NextConfig = {
    cacheComponents: true,
    images: {
        // Product screenshots served from the Vercel Blob store (see
        // docs/specs/docs-screenshots.md). Public, immutable pathnames.
        remotePatterns: [
            { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
        ],
    },
    env: {
        NEXT_PUBLIC_APP_VERSION: appVersion,
        NEXT_PUBLIC_APP_VERSION_NAME: appVersionName,
        NEXT_PUBLIC_APP_BRANCH: isProduction ? "" : branchName,
        NEXT_PUBLIC_APP_COMMIT: isProduction ? "" : (commitSha ?? ""),
        NEXT_PUBLIC_APP_DISPLAY_NAME: appMetadata.displayName,
        NEXT_PUBLIC_APP_REPOSITORY_URL: appMetadata.repositoryUrl,
    },
    experimental: {
        // Enables `forbidden()` / `forbidden.tsx`. Server-thrown errors lose their class
        // and message across the RSC boundary, so an interrupt is the only way a
        // permission failure can carry its own copy into production.
        authInterrupts: true,
    },
    typedRoutes: true,
};

export default withContentCollections(nextConfig);
