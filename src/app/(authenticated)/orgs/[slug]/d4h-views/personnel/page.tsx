/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/personnel
 */

import { Lexington } from "@/components/blocks/lexington";

import { getD4HTeamsWithMembers } from "@/lib/d4h-api/client";
import { D4hAccessTokenData } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";
import prisma from "@/server/prisma";

import { D4HViewsModules_Personnel_List } from "./personnel-list";

export default async function D4HViewsModules_Personnel_Page(
    props: PageProps<`/orgs/[slug]/d4h-views/personnel`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error(
            "D4H Views module is not enabled for this organization.",
        );

    const accessTokenId = settings.integrations.d4h.syncToken;

    if (!accessTokenId)
        throw new Error(
            "D4H Views module is not configured properly. No sync token found.",
        );

    const record = await prisma.d4hAccessToken.findUnique({
        where: {
            id: accessTokenId,
            organizationId: organization.id,
        },
    });

    if (!record) {
        throw new Error("Token not found");
    }

    const token = D4hAccessTokenData.fromRecord(record);

    const teams = await getD4HTeamsWithMembers(token);

    const members = teams.flatMap((t) =>
        t.members.map((m) => ({ ...m, team: t })),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).d4hViews.index,
                    Paths.org(slug).d4hViews.personnel,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <D4HViewsModules_Personnel_List
                        members={members}
                        teams={teams}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
