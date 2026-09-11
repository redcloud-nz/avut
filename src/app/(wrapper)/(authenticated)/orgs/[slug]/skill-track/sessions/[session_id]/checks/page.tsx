/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/checks
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionChecks_Content } from "@/components/skill-track/session-checks-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/checks">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, session_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
    const session = await fetchQuery(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );

    return { title: `${session.name || session.id} ${TITLE_SEPARATOR} Checks` };
}

export default async function SkillTrack_SessionChecks_Page(props: Props) {
    const { slug, session_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

    prefetch(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );
    prefetch(
        trpc.skills.listSessionAssessees.queryOptions({
            organizationId: organization.id,
            sessionId: skillCheckSessionId,
            scope: "all",
        }),
    );
    prefetch(
        trpc.skills.listSessionAssessors.queryOptions({
            organizationId: organization.id,
            sessionId: skillCheckSessionId,
            scope: "all",
        }),
    );
    prefetch(
        trpc.skills.listSessionSkills.queryOptions({
            organizationId: organization.id,
            sessionId: skillCheckSessionId,
            scope: "all",
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_SessionChecks_Content sessionId={skillCheckSessionId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
