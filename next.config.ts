/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
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
        build: number;
        versionName: string;
    };
}

import packageDataJson from "./package.json" with { type: "json" };
const packageData = packageDataJson as unknown as PackageData;

const appMetadata = packageData["nz.avut"];
if (!appMetadata) {
    throw new Error("Missing required 'nz.avut' metadata in package.json");
}

// Only production renders a real version and codename (e.g. `v0.7 (Philomel)`).
// Every other environment is transient, so it shows `DEV.{build}` and nothing
// else — the build number is the only identifier that matters there. Keep this
// rule in sync with `src/app/api/version/route.ts`.
const branchName = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME;
const isProduction = process.env.VERCEL_ENV === "production" || branchName === "production";
const appVersion = isProduction ? `v${appMetadata.version}` : `DEV.${appMetadata.build}`;
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
