/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, trpc } from "@/trpc/server";

// Reads through the same query options the page prefetches, so metadata and the page cost
// one database round trip between them. The procedure throws NOT_FOUND itself, so the
// explicit notFound() fallback is gone.
export async function generateMetadata(
    props: LayoutProps<"/orgs/[slug]/skill-track/sessions/[session_id]">,
): Promise<Metadata> {
    const { slug, session_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const session = await getServerQueryClient().fetchQuery(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: SkillCheckSessionId.schema.parse(session_id),
        }),
    );

    return {
        title: `${session.name || `Session ${session.id}`} ${TITLE_SEPARATOR} Skills Module`,
    };
}

export default async function SkillTrack_Session_Layout(
    props: LayoutProps<"/orgs/[slug]/skill-track/sessions/[session_id]">,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return <>{props.children}</>;
}
