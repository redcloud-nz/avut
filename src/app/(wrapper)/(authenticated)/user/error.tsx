/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user
 */
"use client";

import { AppError } from "@/components/errors/app-error";

// Without this, an error here falls through to the root `src/app/error.tsx`, which sits above
// `(authenticated)/layout.tsx` and so renders without the Sidebar/NavBar.
export default function User_Error({ error }: { error: Error } & { digest?: string }) {
    return <AppError error={error} />;
}
