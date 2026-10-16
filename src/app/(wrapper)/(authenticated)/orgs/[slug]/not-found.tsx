/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { AppErrorPanel } from "@/components/errors/app-error";
import { ErrorDescriptions } from "@/components/errors/describe-error";

// Keeps a server-side `notFound()` (from a page, or `fetchQuery` mapping a tRPC NOT_FOUND) inside
// the Sidebar/NavBar, matching what `error.tsx` shows for the same failure on the client.
// Without it, the root boundary renders the panel full-screen.
export default function Organization_NotFound() {
    return <AppErrorPanel {...ErrorDescriptions.NotFound} />;
}
