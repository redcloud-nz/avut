/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/
 */

import { redirect } from "next/navigation";

import { route } from "@/lib/routes";
import { getEntryControl } from "@/server/entry-control";

export async function GET() {
    // Route handlers do not render layouts, so the group-level guard does not apply here.
    // `getEntryControl` calls `requireSession` itself.
    const entryControl = await getEntryControl();

    if (entryControl.status === "Proceed") {
        redirect(route("/orgs/[slug]", { slug: entryControl.slug }));
    }

    redirect("/user");
}
