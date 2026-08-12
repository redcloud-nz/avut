/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, trpc } from "@/trpc/server";

import { SkillTrack_Session_Content } from "./content";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]">;

/**
 * Resolve the route's skill check session.
 *
 * `generateMetadata` and the page body both call this, but it costs a single round trip:
 * `requireOrganization` is React-`cache`d and `fetchQuery` writes into the request-scoped
 * query client, so the second call is a cache hit.
 */
async function resolveSession(props: Props) {
    const { slug, session_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const session = await fetchQuery(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: SkillCheckSessionId.schema.parse(session_id),
        }),
    );

    return { slug, session };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { session } = await resolveSession(props);

    return {
        title: `${session.name || `Session ${session.id}`} ${TITLE_SEPARATOR} Skills Module`,
    };
}

export default async function SkillTrack_Session_Page(props: Props) {
    const { slug, session } = await resolveSession(props);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                    {
                        label: "Sessions",
                        href: route("/orgs/[slug]/skill-track/sessions", { slug }),
                    },
                    { label: session.name || session.id },
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_Session_Content slug={slug} session={session} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
