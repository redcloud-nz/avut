/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { requireOrganization } from "@/server/organization-access";
import { getTeamById } from "@/server/team";

// NOTE: `generateMetadata` must not redirect, so it uses the plain cached lookup. Access
// is gated by the ancestor organization and admin layouts.
export async function generateMetadata(
    props: LayoutProps<`/orgs/[slug]/admin/teams/[team_id]`>,
): Promise<Metadata> {
    const { slug, team_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const team = await getTeamById(organization.id, team_id);

    return {
        title: `${team.name} ${TITLE_SEPARATOR} Teams`,
    };
}

export default async function AdminModule_Team_Layout(
    props: LayoutProps<`/orgs/[slug]/admin/teams/[team_id]`>,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return <>{props.children}</>;
}
