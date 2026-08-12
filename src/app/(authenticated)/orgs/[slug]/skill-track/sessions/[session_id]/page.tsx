/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]
 */

import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SkillTrack_Session_Content } from "./content";

export default async function SkillTrack_Session_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]">,
) {
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
            <SkillTrack_Session_Content slug={slug} skillCheckSessionId={skillCheckSessionId} />
        </HydrateClient>
    );
}
