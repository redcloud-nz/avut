/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/
 */

import { redirect } from "next/navigation";

import { requireSession } from "@/server/session";

export async function GET() {
    // Route handlers do not render layouts, so the group-level guard does not apply here.
    await requireSession();

    redirect("/orgs/--select-org");
}
