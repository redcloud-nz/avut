/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_Session_Content } from "@/components/skill-track/session-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]">;

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

    return {
        title: `${session.name || `Session ${session.id}`} ${TITLE_SEPARATOR} Skills Module`,
    };
}

export default async function SkillTrack_Session_Page(props: Props) {
    const { slug, session_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

    prefetch(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_Session_Content sessionId={skillCheckSessionId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
