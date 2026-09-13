/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const REPO_URL =
    process.env.NEXT_PUBLIC_APP_REPOSITORY_URL ?? "https://github.com/redcloud-nz/avut";
export const REPO_SLUG = REPO_URL.replace(/^https?:\/\/github\.com\//, "");
