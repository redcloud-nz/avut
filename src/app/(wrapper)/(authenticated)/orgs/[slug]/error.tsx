/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */
"use client";

import { AppError } from "@/components/errors/app-error";

export default function Organization_Error({ error }: { error: Error } & { digest?: string }) {
    return <AppError error={error} />;
}
