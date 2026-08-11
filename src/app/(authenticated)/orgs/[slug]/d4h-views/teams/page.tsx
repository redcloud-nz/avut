/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/teams
 */

import { Std } from "@/components/blocks/std";

import { requireOrganization } from "@/server/organization-access";
import { getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { route } from "@/lib/routes";
import prisma from "@/server/prisma";

import { D4HViewsModule_Teams_List } from "./d4h-teams-list";

export default async function D4HViewsModule_Teams_Page(
    props: PageProps<`/orgs/[slug]/d4h-views/teams`>,
) {
    const { slug } = await props.params;
    const { organization, settings } = await requireOrganization(slug);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error("D4H Views module is not enabled for this organization.");

    const accessTokenId = settings.integrations.d4h.syncToken;

    if (!accessTokenId)
        throw new Error("D4H Views module is not configured properly. No sync token found.");

    const record = await prisma.d4hAccessToken.findUnique({
        where: {
            id: accessTokenId,
            organizationId: organization.id,
        },
    });

    if (!record) {
        throw new Error("Token not found");
    }

    const token = D4HAccessToken_ServerOnly.fromRecord(record);

    const teams = await getD4HTeamsAccessibleWithToken(token);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H Views", href: route("/orgs/[slug]/d4h-views", { slug }) },
                    "Teams",
                ]}
            />
            <Std.ScrollContainer>
                <D4HViewsModule_Teams_List teams={teams} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
