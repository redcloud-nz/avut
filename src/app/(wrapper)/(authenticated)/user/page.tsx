/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user
 */

import { Std } from "@/components/blocks/std";
import { OrgSelector_Card } from "@/components/cards/org-selector";
import { getOrganizationMembershipsAndInvitations } from "@/server/entry-control";

export const metadata = {
    title: `Dashboard`,
};

export default async function UserDashboard_Page() {
    const data = await getOrganizationMembershipsAndInvitations();

    return (
        <>
            <Std.Navbar breadcrumbs={["Dashboard"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="Dashboard">
                    <OrgSelector_Card data={data} />
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
