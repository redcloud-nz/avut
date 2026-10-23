/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams
 */

import { Std } from "@/components/blocks/std";
import { route } from "@/lib/routes";
import { UserId } from "@/lib/schemas/user";
import {
    D4HModule_Teams_List,
    type D4HModule_Teams_Row,
} from "@/modules/d4h/components/teams/d4h-teams-list";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import { getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";

export default async function D4HModule_Teams_Page(props: PageProps<`/orgs/[slug]/d4h/teams`>) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const { organization, session } = await requireOrganization(slug);

    const accessToken = await getConfiguredD4HAccessToken(
        organization.id,
        UserId.schema.parse(session.user.id),
    );

    const teams: D4HModule_Teams_Row[] = (
        await getD4HTeamsAccessibleWithToken(toD4HCredentialRef(accessToken))
    ).map((team) => ({ id: team.id, title: team.title }));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[{ label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) }, "Teams"]}
            />
            <Std.ScrollContainer>
                <D4HModule_Teams_List teams={teams} />
            </Std.ScrollContainer>
        </>
    );
}
