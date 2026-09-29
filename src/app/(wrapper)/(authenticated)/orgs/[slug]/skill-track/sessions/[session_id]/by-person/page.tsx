/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/by-person
 */

import { Metadata } from "next";

import { SkillTrack_SessionByPerson_Content } from "@/components/skill-track/session-by-person-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

import { prefetchSessionConfigDialog } from "../_prefetch-session-config-dialog";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/by-person">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, session_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
    const session = await fetchQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );

    return { title: `${session.name || session.id} ${TITLE_SEPARATOR} By Person` };
}

export default async function SkillTrack_SessionByPerson_Page(props: Props) {
    const { slug, session_id } = await props.params;
    const { action } = await props.searchParams;
    const organization = await getOrganizationBySlug(slug);

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
    // The Actions sheet's dialogs load their own lists once opened; prefetch only the one that
    // `?action=` opens on arrival.
    prefetchSessionConfigDialog({
        action,
        organizationId: organization.id,
        sessionId: skillCheckSessionId,
    });

    return (
        <HydrateClient>
            <SkillTrack_SessionByPerson_Content sessionId={skillCheckSessionId} />
        </HydrateClient>
    );
}
