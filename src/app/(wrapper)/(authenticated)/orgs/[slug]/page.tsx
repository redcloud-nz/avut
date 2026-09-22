/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Organization_Dashboard_Content } from "@/components/organization/dashboard-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { getOrganizationSettings } from "@/server/cache/organization-settings";
import { resolveModuleFlags } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);
    const moduleFlags = await resolveModuleFlags();

    const skillTrackEnabled =
        moduleFlags["skill-track"] !== false && settings.modules["skill-track"].enabled;

    prefetch(trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    if (skillTrackEnabled) {
        prefetch(
            trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }),
        );
        prefetch(trpc.skills.listSessions.queryOptions({ organizationId: organization.id }));
        prefetch(
            trpc.skillChecks.listSkillChecks.queryOptions({ organizationId: organization.id }),
        );
    }

    return (
        <HydrateClient>
            <Organization_Dashboard_Content />
        </HydrateClient>
    );
}
