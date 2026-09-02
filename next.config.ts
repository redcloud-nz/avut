/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
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

// Deployments off the `production` branch ship a bare product version (e.g. `0.7`);
// every other branch (chiefly `master`) displays the build number alongside it
// (e.g. `0.7-build.41`) so in-progress builds remain distinguishable.
const branchName = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME;
const appVersion =
    branchName === "production"
        ? appMetadata?.version
        : `${appMetadata?.version}-build.${appMetadata?.build}`;

const nextConfig: NextConfig = {
    cacheComponents: true,
    env: {
        NEXT_PUBLIC_APP_VERSION: appVersion,
        NEXT_PUBLIC_APP_VERSION_NAME: appMetadata?.versionName,
        NEXT_PUBLIC_APP_DISPLAY_NAME: appMetadata?.displayName,
        NEXT_PUBLIC_APP_REPOSITORY_URL: appMetadata?.repositoryUrl,
    },
    experimental: {
        // Enables `forbidden()` / `forbidden.tsx`. Server-thrown errors lose their class
        // and message across the RSC boundary, so an interrupt is the only way a
        // permission failure can carry its own copy into production.
        authInterrupts: true,
    },
    typedRoutes: true,
};

export default nextConfig;
