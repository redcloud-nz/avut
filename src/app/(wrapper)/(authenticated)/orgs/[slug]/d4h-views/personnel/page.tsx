/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/personnel
 */

import { Std } from "@/components/blocks/std";
import { route } from "@/lib/routes";
import { UserId } from "@/lib/schemas/user";
import {
    D4HViewsModules_Personnel_List,
    type D4HViewsModules_Personnel_Row,
} from "@/modules/d4h-views/components/personnel/personnel-list";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import { getD4HTeamsWithMembers } from "@/server/d4h-api/client";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";

export default async function D4HViewsModules_Personnel_Page(
    props: PageProps<`/orgs/[slug]/d4h-views/personnel`>,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-views"))) return null;
    const { organization, session } = await requireOrganization(slug);

    const accessToken = await getConfiguredD4HAccessToken(
        organization.id,
        UserId.schema.parse(session.user.id),
    );

    const teams = await getD4HTeamsWithMembers(toD4HCredentialRef(accessToken));

    // Only the displayed columns cross to the client — no email or other member detail.
    const members: D4HViewsModules_Personnel_Row[] = teams.flatMap((team) =>
        team.members.map((member) => ({
            id: member.id,
            name: member.name,
            status: member.status,
            team: { id: team.id, title: team.title },
        })),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H Views", href: route("/orgs/[slug]/d4h-views", { slug }) },
                    "Personnel",
                ]}
            />
            <Std.ScrollContainer>
                <D4HViewsModules_Personnel_List members={members} />
            </Std.ScrollContainer>
        </>
    );
}
