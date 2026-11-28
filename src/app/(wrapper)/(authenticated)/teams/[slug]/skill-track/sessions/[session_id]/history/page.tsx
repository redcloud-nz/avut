/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/sessions/[session_id]/history
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillTrack_SessionHistory_Content } from "@/modules/skill-track/components/session-history-content";
import { getTeamBySlug } from "@/server/cache/team";
import { requireTeam } from "@/server/team-access";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props = PageProps<"/teams/[slug]/skill-track/sessions/[session_id]/history">;

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

    return {
        title: `${session.name || `Session ${session.id}`} History ${TITLE_SEPARATOR} Sessions`,
    };
}

export default async function Team_SkillTrack_SessionHistory_Page(props: Props) {
    const { slug, session_id } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);

    const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

    prefetch(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );
    // Same input as `ObjectHistory`'s client query (no `limit`), so the keys match.
    prefetchInfinite(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            {
                organizationId: organization.id,
                objectType: "SkillCheckSession",
                objectId: skillCheckSessionId,
            },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_SessionHistory_Content sessionId={skillCheckSessionId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
