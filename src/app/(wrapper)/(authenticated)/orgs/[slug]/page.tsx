/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Organization_Dashboard_Content } from "@/components/organization/dashboard-content";
import { isModuleUsable } from "@/lib/module-flags";
import { hasAnyRoleWithPermissions, Permissions } from "@/lib/permissions";
import { resolveModuleFlags } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function Organization_Index_Page(props: PageProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const { organization, settings, roles } = await requireOrganization(slug);
    // After the session read: flag evaluation calls `Math.random()`, which prerendering rejects.
    const moduleFlags = await resolveModuleFlags();
    const organizationId = organization.id;

    // Prefetch exactly what the stat cards will read — each gated on the same permission as
    // its card's `<Protect>`, so a card the viewer can't see doesn't cost a query. Without
    // this the cards' `useSuspenseQuery` calls run during SSR through the HTTP client, which
    // carries no session and gets a 401 before the browser retries.
    const can = (permissions: Permissions) => hasAnyRoleWithPermissions(roles, permissions);

    if (can({ person: ["view"] }))
        prefetch(trpc.personnel.listPersonnel.queryOptions({ organizationId }));
    if (can({ team: ["view"] })) prefetch(trpc.teams.listTeams.queryOptions({ organizationId }));
    if (can({ member: ["view"] }))
        prefetch(trpc.organizations.listMembers.queryOptions({ organizationId }));
    if (can({ invitation: ["view"] }))
        prefetch(trpc.invitations.listInvitations.queryOptions({ organizationId }));

    if (
        isModuleUsable(
            moduleFlags,
            "skill-track",
            settings.modules["skill-track"]?.enabled === true,
        )
    ) {
        if (can({ skillPackageSubscription: ["view"] }))
            prefetch(
                trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
                    organizationId,
                }),
            );
        if (can({ skillCheckSession: ["view"] }))
            prefetch(trpc.skillCheckSessions.listSessions.queryOptions({ organizationId }));
        if (can({ skillCheck: ["view"] }))
            prefetch(trpc.skillChecks.listSkillChecks.queryOptions({ organizationId }));
    }

    return (
        <HydrateClient>
            <Organization_Dashboard_Content />
        </HydrateClient>
    );
}
