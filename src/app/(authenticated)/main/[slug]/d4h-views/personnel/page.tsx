/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/personnel
 */

import { Lexington } from "@/components/blocks/lexington";

import { getD4HTeamsWithMembers } from "@/server/d4h-api/client";
import * as Paths from "@/paths";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

import { D4HViewsModules_Personnel_List } from "./personnel-list";

export default async function D4HViewsModules_Personnel_Page(
    props: PageProps<`/main/[slug]/d4h-views/personnel`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error("D4H Views module is not enabled for this organization.");

    const accessTokenId = settings.integrations.d4h.syncToken;

    if (!accessTokenId)
        throw new Error("D4H Views module is not configured properly. No sync token found.");

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: accessTokenId,
        organizationId: organization.id,
    });

    if (!accessToken) {
        throw new Error("D4H Access Token not found");
    }

    const teams = await getD4HTeamsWithMembers(accessToken);

    const members = teams.flatMap((t) => t.members.map((m) => ({ ...m, team: t })));

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.main(slug).d4HViews.index, Paths.main(slug).d4HViews.personnel]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <D4HViewsModules_Personnel_List members={members} teams={teams} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
