/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user
 */

import { redirect } from "next/navigation";

import { Std } from "@/components/blocks/std";
import { OrgSelector_Card } from "@/components/cards/org-selector";
import { route } from "@/lib/routes";
import { getEntryControl } from "@/server/entry-control";

export default async function UserDashboard_Page() {
    const entryControl = await getEntryControl();

    if (entryControl.status == "Proceed") {
        redirect(route("/orgs/[slug]", { slug: entryControl.slug }));
    }

    return (
        <>
            <Std.Navbar breadcrumbs={["Dashboard"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="Dashboard">
                    <OrgSelector_Card entryControl={entryControl} />
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
