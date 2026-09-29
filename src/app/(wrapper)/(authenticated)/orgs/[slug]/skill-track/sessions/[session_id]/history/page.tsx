/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/history
 */

import { Metadata } from "next";

import { SkillTrack_SessionHistory_Content } from "@/components/skill-track/session-history-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/history">;

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

    return {
        title: `${session.name || `Session ${session.id}`} History ${TITLE_SEPARATOR} Sessions`,
    };
}

export default async function SkillTrack_SessionHistory_Page(props: Props) {
    const { slug, session_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

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
            <SkillTrack_SessionHistory_Content sessionId={skillCheckSessionId} />
        </HydrateClient>
    );
}
