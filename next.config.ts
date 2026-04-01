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
        versionName: string;

        [key: string]: any;
    };
}

import packageDataJson from "./package.json" with { type: "json" };
const packageData = packageDataJson as unknown as PackageData;

const appMetadata = packageData["nz.avut"];

const nextConfig: NextConfig = {
    cacheComponents: true,
    env: {
        NEXT_PUBLIC_APP_VERSION: appMetadata?.version,
        NEXT_PUBLIC_APP_VERSION_NAME: appMetadata?.versionName,
        NEXT_PUBLIC_APP_DISPLAY_NAME: appMetadata?.displayName,
        NEXT_PUBLIC_APP_REPOSITORY_URL: appMetadata?.repositoryUrl,
    },
    typedRoutes: true,
};

export default nextConfig;
