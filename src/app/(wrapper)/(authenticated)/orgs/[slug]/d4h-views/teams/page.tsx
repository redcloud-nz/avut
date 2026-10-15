/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/teams
 */

import { Std } from "@/components/blocks/std";
import { route } from "@/lib/routes";
import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import { getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";

import { D4HViewsModule_Teams_List, type D4HViewsModule_Teams_Row } from "./d4h-teams-list";

export default async function D4HViewsModule_Teams_Page(
    props: PageProps<`/orgs/[slug]/d4h-views/teams`>,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-views"))) return null;
    const { organization, session } = await requireOrganization(slug);

    const accessToken = await getConfiguredD4HAccessToken(
        organization.id,
        UserId.schema.parse(session.user.id),
    );

    const teams: D4HViewsModule_Teams_Row[] = (
        await getD4HTeamsAccessibleWithToken(toD4HCredentialRef(accessToken))
    ).map((team) => ({ id: team.id, title: team.title }));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H Views", href: route("/orgs/[slug]/d4h-views", { slug }) },
                    "Teams",
                ]}
            />
            <Std.ScrollContainer>
                <D4HViewsModule_Teams_List teams={teams} />
            </Std.ScrollContainer>
        </>
    );
}
