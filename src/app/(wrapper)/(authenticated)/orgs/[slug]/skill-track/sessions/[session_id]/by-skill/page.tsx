/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/by-skill
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionBySkill_Content } from "@/components/skill-track/session-by-skill-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/by-skill">;

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

    return { title: `${session.name || session.id} ${TITLE_SEPARATOR} By Skill` };
}

export default async function SkillTrack_SessionBySkill_Page(props: Props) {
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
        trpc.personnel.getPersonSelf.queryOptions({
            organizationId: organization.id,
        }),
    );
    prefetch(
        trpc.skills.listAssessableSkills.queryOptions({
            organizationId: organization.id,
        }),
    );
    prefetch(
        trpc.skillChecks.listSkillChecks.queryOptions({
            organizationId: organization.id,
            sessionId: skillCheckSessionId,
            ownChecksOnly: true,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_SessionBySkill_Content sessionId={skillCheckSessionId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
