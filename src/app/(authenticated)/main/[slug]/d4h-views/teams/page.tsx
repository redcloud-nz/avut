/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/teams
 */

import { Lexington } from "@/components/blocks/lexington";

import { getD4HTeamsAccessibleWithToken } from "@/lib/d4h-api/client";
import { D4HAccessToken } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";
import prisma from "@/server/prisma";

import { D4HViewsModule_Teams_List } from "./d4h-teams-list";

export default async function D4HViewsModule_Teams_Page(
    props: PageProps<`/main/[slug]/d4h-views/teams`>,
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

    const token = D4HAccessToken.fromRecord(record);

    const teams = await getD4HTeamsAccessibleWithToken(token);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).d4HViews.index,
                    Paths.main(slug).d4HViews.teams,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <D4HViewsModule_Teams_List teams={teams} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
