/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/sessions/[session_id]/by-skill
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillTrack_SessionBySkill_Content } from "@/modules/skill-track/components/session-by-skill-content";
import { prefetchSessionConfigDialog } from "@/modules/skill-track/lib/prefetch-session-config-dialog";
import { getTeamBySlug } from "@/server/cache/team";
import { requireTeam } from "@/server/team-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/teams/[slug]/skill-track/sessions/[session_id]/by-skill">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, session_id } = await props.params;
    // Not `requireTeam`: metadata must not redirect, and the team layout is the entry gate.
    const { organization } = await getTeamBySlug(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
    const session = await fetchQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );

    return { title: `${session.name || session.id} ${TITLE_SEPARATOR} By Skill` };
}

export default async function Team_SkillTrack_SessionBySkill_Page(props: Props) {
    const { slug, session_id } = await props.params;
    const { action } = await props.searchParams;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

    prefetch(
        trpc.skillCheckSessions.getSession.queryOptions({
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
        trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
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
    prefetch(
        trpc.skillCheckSessions.listSessionAssessees.queryOptions({
            organizationId: organization.id,
            sessionId: skillCheckSessionId,
            scope: "assigned",
        }),
    );
    prefetch(
        trpc.skillCheckSessions.listSessionSkills.queryOptions({
            organizationId: organization.id,
            sessionId: skillCheckSessionId,
            scope: "assigned",
        }),
    );
    // The Actions sheet's dialogs load their own lists once opened; prefetch only the one that
    // `?action=` opens on arrival.
    prefetchSessionConfigDialog({
        action,
        organizationId: organization.id,
        sessionId: skillCheckSessionId,
    });

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_SessionBySkill_Content sessionId={skillCheckSessionId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
